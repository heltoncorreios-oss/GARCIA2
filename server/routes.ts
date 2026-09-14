import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { db } from './db';
import {
  parseOFX,
  parseCSVWithMapping,
  parseXLSXWithMapping,
  parsePDF,
  parseGenericUnstructuredText,
  getSampleStatement,
  analyzeTabularData,
  splitCsvRow,
  detectDelimiter,
  normalizeStatementLines,
  RawParsedTransaction
} from './importers/bankStatementParsers';
import { ColumnMapping, ImportPreviewItem, StatementFileType } from '../src/types';
import { calculateConsolidatedBalance } from '../src/utils/consolidatedBalance';
import { runFinancialUnitTests } from './financialTests';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseService';
import { getSqliteDatabaseInfo, getSqliteDbPath } from './sqliteService';
import {
  getUserProfiles,
  getUserProfileById,
  getUserProfileByEmail,
  updateUserStatus,
  updateUserRole,
  getInvites,
  createInvite,
  verifyInviteCode,
  consumeInviteAndCreateProfile,
  revokeInvite,
  addAuditLog,
  getAuditLogs
} from './userManagement';

export const apiRouter = Router();

// Endpoint público para fornecer anon key e URL ao frontend com segurança
apiRouter.get('/auth/config', (req: Request, res: Response) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  res.json({
    supabaseUrl,
    supabaseAnonKey
  });
});

// Endpoint para verificar o status de conexão com o Supabase e repositório
apiRouter.get('/supabase/status', async (req: Request, res: Response) => {
  const configured = isSupabaseConfigured();
  let connected = false;
  let errorMsg = null;
  let tablesReady = false;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '';

  if (configured) {
    try {
      const client = getSupabaseClient();
      if (client) {
        const { data, error } = await client.from('bank_accounts').select('id').limit(1);
        if (!error) {
          connected = true;
          tablesReady = true;
        } else {
          errorMsg = error.message;
        }
      }
    } catch (err: any) {
      errorMsg = err.message;
    }
  }

  res.json({
    configured,
    connected,
    tablesReady,
    supabaseUrl: url ? url.replace(/https:\/\/(.*?)\.supabase\.co/, 'https://[PROJECT_ID].supabase.co') : '',
    hasAnonKey: Boolean(anonKey),
    hasDatabaseUrl: Boolean(dbUrl),
    error: errorMsg
  });
});

// Endpoint para verificar status do banco SQLite local
apiRouter.get('/sqlite/status', (req: Request, res: Response) => {
  try {
    const info = getSqliteDatabaseInfo();
    res.json({
      success: true,
      engine: 'SQLite (Node.js native DatabaseSync)',
      status: 'ONLINE',
      ...info
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Endpoint para download do arquivo de banco de dados SQLite (.sqlite)
apiRouter.get('/sqlite/download', (req: Request, res: Response) => {
  try {
    const dbPath = getSqliteDbPath();
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Arquivo do banco SQLite não encontrado.' });
    }
    const filename = path.basename(dbPath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.sqlite3');
    fs.createReadStream(dbPath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validação pública de código de convite para tela de cadastro
apiRouter.post('/auth/verify-invite', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const result = await verifyInviteCode(code);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }
    res.json({
      valid: true,
      invite: {
        code: result.invite!.code,
        role: result.invite!.role,
        expiresAt: result.invite!.expiresAt
      }
    });
  } catch (err: unknown) {
    res.status(500).json({ valid: false, error: (err as Error).message });
  }
});

// Finalização de cadastro controlado por convite
apiRouter.post('/auth/register-profile', async (req: Request, res: Response) => {
  try {
    const { userId, name, email, inviteCode } = req.body;
    if (!userId || !name || !email || !inviteCode) {
      return res.status(400).json({ error: 'Nome, e-mail, senha e código de convite são obrigatórios.' });
    }
    const result = await consumeInviteAndCreateProfile({
      userId,
      name,
      email,
      inviteCode
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, profile: result.profile });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Middleware to ensure Supabase is loaded and synced before any API request
apiRouter.use(async (req: Request, res: Response, next) => {
  try {
    await db.ensureSupabaseReady();
  } catch (err) {
    console.error('Supabase middleware error:', err);
  }
  next();
});

// Middleware de Proteção de Autenticação e Controle de Perfis/Permissões
apiRouter.use(async (req: Request, res: Response, next) => {
  // Rotas públicas que não necessitam de token
  const publicPaths = ['/auth/config', '/auth/verify-invite', '/auth/register-profile', '/health', '/sample-data'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acesso não autorizado. É necessário estar autenticado para acessar os dados financeiros.'
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Suporte a modo Preview / Demonstração no ambiente de desenvolvimento ou sem Supabase
  if (token === 'preview-admin-token' || token.startsWith('preview-')) {
    const previewAdmin = {
      id: 'preview-admin-id',
      name: 'Helton (Administrador)',
      email: 'heltoncorreios@gmail.com',
      role: 'ADMINISTRADOR' as const,
      status: 'ATIVO' as const,
      createdAt: new Date().toISOString(),
      lastSignInAt: new Date().toISOString()
    };
    (req as any).user = { id: previewAdmin.id, email: previewAdmin.email };
    (req as any).userProfile = previewAdmin;
    return next();
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    const defaultAdmin = {
      id: 'local-admin-id',
      name: 'Helton (Administrador)',
      email: 'heltoncorreios@gmail.com',
      role: 'ADMINISTRADOR' as const,
      status: 'ATIVO' as const,
      createdAt: new Date().toISOString(),
      lastSignInAt: new Date().toISOString()
    };
    (req as any).user = { id: defaultAdmin.id, email: defaultAdmin.email };
    (req as any).userProfile = defaultAdmin;
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        error: 'Sessão expirada ou inválida. Por favor, realize o login novamente.'
      });
    }

    // Obter perfil completo do usuário
    let profile = await getUserProfileById(user.id);
    if (!profile && user.email) {
      profile = await getUserProfileByEmail(user.email);
    }

    // Inicialização segura de administrador inicial caso ainda não cadastrado na base de perfis
    if (!profile) {
      const email = (user.email || '').toLowerCase();
      const isAdminEmail = email === 'admin@supermercado.com' || email === 'heltoncorreios@gmail.com';
      profile = {
        id: user.id,
        name: user.user_metadata?.name || (isAdminEmail ? 'Administrador Financeiro' : email.split('@')[0]),
        email: user.email!,
        role: isAdminEmail ? 'ADMINISTRADOR' : 'CONSULTA',
        status: 'ATIVO',
        createdAt: user.created_at || new Date().toISOString(),
        lastSignInAt: new Date().toISOString()
      };
    }

    (req as any).user = user;
    (req as any).userProfile = profile;

    // 1. Verificação de status do usuário (BLOQUEADO ou PENDENTE)
    if (profile.status === 'BLOQUEADO') {
      return res.status(403).json({
        error: 'Acesso bloqueado. Seu usuário foi desativado pelo administrador.',
        code: 'USER_BLOCKED'
      });
    }

    if (profile.status === 'PENDENTE' && req.path !== '/auth/me') {
      return res.status(403).json({
        error: 'Cadastro pendente de aprovação. Aguarde a liberação de acesso pelo administrador.',
        code: 'USER_PENDING'
      });
    }

    // 2. Verificação de permissões administrativas (/admin/*, /reset-data, /restore-sample-data)
    if (req.path.startsWith('/admin') || req.path === '/reset-data' || req.path === '/restore-sample-data') {
      if (profile.role !== 'ADMINISTRADOR') {
        return res.status(403).json({
          error: 'Acesso não autorizado. Recurso exclusivo para Administradores.',
          code: 'FORBIDDEN_ROLE'
        });
      }
    }

    // 3. Verificação para importação de extratos (ADMINISTRADOR e FINANCEIRO)
    if (req.path.startsWith('/import')) {
      if (profile.role !== 'ADMINISTRADOR' && profile.role !== 'FINANCEIRO') {
        return res.status(403).json({
          error: 'Operação de importação não permitida para o seu perfil de acesso.',
          code: 'FORBIDDEN_ROLE'
        });
      }
    }

    // 4. Verificação para perfil CONSULTA (somente leitura - bloqueia POST, PUT, DELETE em dados financeiros)
    if (profile.role === 'CONSULTA' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (!req.path.startsWith('/auth')) {
        return res.status(403).json({
          error: 'Perfil de Consulta possui acesso somente para leitura. Não é permitido criar, alterar ou excluir registros.',
          code: 'READ_ONLY_PROFILE'
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Falha na validação da sessão de usuário.'
    });
  }
});

// Perfil do usuário autenticado atual
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  res.json({
    user: (req as any).user,
    profile: (req as any).userProfile
  });
});

// ===================== ADMINISTRAÇÃO: USUÁRIOS, CONVITES E AUDITORIA =====================
apiRouter.get('/admin/users', async (req: Request, res: Response) => {
  try {
    const users = await getUserProfiles();
    res.json({ users });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/admin/users/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminEmail = (req as any).userProfile?.email || 'admin@supermercado.com';
    const result = await updateUserStatus(id, status, adminEmail);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, profile: result.profile });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/admin/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminEmail = (req as any).userProfile?.email || 'admin@supermercado.com';
    const result = await updateUserRole(id, role, adminEmail);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, profile: result.profile });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.get('/admin/invites', async (req: Request, res: Response) => {
  try {
    const invites = await getInvites();
    res.json({ invites });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/admin/invites', async (req: Request, res: Response) => {
  try {
    const { role, expirationDays, customCode, recipientEmail, autoActivate, notes } = req.body;
    const adminEmail = (req as any).userProfile?.email || (req as any).user?.email || 'admin@supermercado.com';
    const invite = await createInvite(
      adminEmail,
      role || 'CONSULTA',
      Number(expirationDays) || 7,
      customCode,
      recipientEmail,
      autoActivate !== false,
      notes
    );
    res.json({ success: true, invite });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/admin/invites/:id/revoke', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as any).userProfile?.email || 'admin@supermercado.com';
    const result = await revokeInvite(id, adminEmail);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: 'Convite revogado com sucesso.' });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.get('/admin/audit-logs', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const logs = await getAuditLogs(limit);
    res.json({ logs });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===================== BANK ACCOUNTS =====================
apiRouter.get('/accounts', (req: Request, res: Response) => {
  const accounts = db.getBankAccounts();
  const consolidatedBalance = accounts
    .filter(a => a.isActive)
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  res.json({ accounts, consolidatedBalance });
});

apiRouter.post('/accounts', (req: Request, res: Response) => {
  try {
    const {
      bankCode,
      bankName,
      accountName,
      agency,
      accountNumber,
      accountType,
      initialBalance,
      initialBalanceDate,
      color,
      userName
    } = req.body;

    if (!bankName || !accountName || !accountNumber) {
      return res.status(400).json({ error: 'Banco, nome da conta e número são obrigatórios.' });
    }

    const account = db.createBankAccount(
      {
        bankCode: bankCode || '000',
        bankName,
        accountName,
        agency: agency || '0001',
        accountNumber,
        accountType: accountType || 'CORRENTE',
        initialBalance: parseFloat(initialBalance) || 0,
        initialBalanceDate: initialBalanceDate || new Date().toISOString().substring(0, 10),
        isActive: true,
        color: color || '#10b981'
      },
      userName || 'Administrador'
    );

    res.status(201).json({ account });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.put('/accounts/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { userName, ...updates } = req.body;
    const updated = db.updateBankAccount(id, updates, userName || 'Administrador');
    if (!updated) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json({ account: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===================== CATEGORIES & OPERATIONS =====================
apiRouter.get('/categories', (req: Request, res: Response) => {
  res.json({ categories: db.getCategories() });
});

apiRouter.post('/categories', (req: Request, res: Response) => {
  try {
    const { name, type, subcategories, userName } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
    const cat = db.createCategory(name, type, subcategories || [], userName || 'Administrador');
    res.status(201).json({ category: cat });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.get('/operation-types', (req: Request, res: Response) => {
  res.json({ operationTypes: db.getOperationTypes() });
});

// ===================== CLASSIFICATION RULES =====================
apiRouter.get('/rules', (req: Request, res: Response) => {
  res.json({ rules: db.getClassificationRules() });
});

apiRouter.post('/rules/test', (req: Request, res: Response) => {
  const { description, type } = req.body;
  if (!description) return res.status(400).json({ error: 'Descrição é obrigatória' });
  const result = db.classifyDescription(description, (type as 'ENTRADA' | 'SAIDA') || 'ENTRADA');
  res.json({ result });
});

apiRouter.post('/rules', (req: Request, res: Response) => {
  try {
    const { keyword, operationType, categoryId, categoryName, subcategoryId, subcategoryName, confidence, priority, allowMultipleSameDay, userName } = req.body;
    if (!keyword || !operationType) {
      return res.status(400).json({ error: 'Palavra-chave e tipo de operação são obrigatórios.' });
    }
    const rule = db.createClassificationRule(
      {
        keyword,
        operationType,
        categoryId,
        categoryName,
        subcategoryId,
        subcategoryName,
        confidence: confidence || 'ALTA',
        priority: parseInt(priority, 10) || 10,
        allowMultipleSameDay: Boolean(allowMultipleSameDay),
        isActive: true
      },
      userName || 'Administrador'
    );
    res.status(201).json({ rule });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/rules/allow-duplicate', (req: Request, res: Response) => {
  try {
    const { keyword, operationType, categoryId, categoryName, userName } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: 'Palavra-chave é obrigatória.' });
    }
    const rule = db.allowDuplicateForKeyword(
      keyword,
      operationType || 'Boleto pago',
      categoryId,
      categoryName,
      userName || 'Administrador'
    );
    res.status(201).json({ success: true, rule });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/rules/apply-to-existing', (req: Request, res: Response) => {
  try {
    const { userName } = req.body || {};
    const result = db.applyRulesToAllExistingUncategorized(userName || 'Administrador');
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.delete('/rules/:id', (req: Request, res: Response) => {
  const success = db.deleteClassificationRule(req.params.id, (req.query.user as string) || 'Administrador');
  if (!success) return res.status(404).json({ error: 'Regra não encontrada.' });
  res.json({ success: true });
});

// ===================== TRANSACTIONS =====================
apiRouter.get('/transactions', (req: Request, res: Response) => {
  const {
    startDate,
    endDate,
    bankAccountId,
    type,
    categoryId,
    operationType,
    reconciliationStatus,
    search
  } = req.query;

  const transactions = db.getTransactions({
    startDate: startDate as string,
    endDate: endDate as string,
    bankAccountId: bankAccountId as string,
    type: type as 'ENTRADA' | 'SAIDA',
    categoryId: categoryId as string,
    operationType: operationType as string,
    reconciliationStatus: reconciliationStatus as string,
    search: search as string
  });

  res.json({ transactions, total: transactions.length });
});

apiRouter.post('/transactions', (req: Request, res: Response) => {
  try {
    const {
      bankAccountId,
      date,
      competenceDate,
      description,
      amount,
      type,
      categoryId,
      categoryName,
      subcategoryId,
      subcategoryName,
      operationType,
      observation,
      userName
    } = req.body;

    if (!bankAccountId || !date || !description || !amount || !type) {
      return res.status(400).json({ error: 'Conta, data, descrição, valor e tipo são obrigatórios.' });
    }

    const userProfile = (req as any).userProfile;
    const authorName = userProfile?.name || userName || 'Financeiro';

    const tx = db.createTransaction(
      {
        bankAccountId,
        date,
        competenceDate: competenceDate || date,
        description,
        amount: Math.abs(parseFloat(amount)),
        type,
        categoryId,
        categoryName,
        subcategoryId,
        subcategoryName,
        operationType: operationType || 'OUTRAS',
        observation,
        origin: 'MANUAL',
        reconciliationStatus: 'CONCILIADO',
        responsibleUser: authorName
      },
      authorName
    );

    addAuditLog({
      user: userProfile?.email || 'sistema',
      userName: authorName,
      action: 'CRIAR_LANCAMENTO',
      description: `${authorName} criou um lançamento de R$ ${tx.amount.toFixed(2)} (${tx.description}).`,
      entityType: 'TRANSACTION',
      entityId: tx.id
    });

    res.status(201).json({ transaction: tx });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.put('/transactions/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { userName, ...updates } = req.body;
    const userProfile = (req as any).userProfile;
    const authorName = userProfile?.name || userName || 'Financeiro';
    const updated = db.updateTransaction(id, updates, authorName);
    if (!updated) return res.status(404).json({ error: 'Transação não encontrada.' });

    addAuditLog({
      user: userProfile?.email || 'sistema',
      userName: authorName,
      action: 'EDITAR_LANCAMENTO',
      description: `${authorName} editou o lançamento ${updated.description}.`,
      entityType: 'TRANSACTION',
      entityId: updated.id
    });

    res.json({ transaction: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/transactions/batch-categorize', (req: Request, res: Response) => {
  try {
    const {
      transactionIds,
      categoryId,
      categoryName,
      subcategoryId,
      subcategoryName,
      operationType,
      createRule,
      ruleKeyword,
      applyToAllSimilar,
      allowMultipleSameDay,
      userName
    } = req.body || {};

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'Nenhum ID de transação fornecido.' });
    }
    if (!operationType && !categoryId) {
      return res.status(400).json({ error: 'Informe a categoria ou o tipo de operação.' });
    }

    const result = db.batchCategorizeTransactions(
      transactionIds,
      {
        categoryId,
        categoryName,
        subcategoryId,
        subcategoryName,
        operationType,
        createRule,
        ruleKeyword,
        applyToAllSimilar,
        allowMultipleSameDay
      },
      userName || 'Financeiro'
    );

    res.json({ success: true, ...result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/transactions/batch-reconcile', (req: Request, res: Response) => {
  try {
    const { transactionIds, reconciliationStatus, userName } = req.body || {};
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'Nenhum ID de transação fornecido.' });
    }
    const updatedCount = db.batchUpdateReconciliationStatus(
      transactionIds,
      reconciliationStatus || 'CONCILIADO',
      userName || 'Financeiro'
    );
    res.json({ success: true, updatedCount });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.delete('/transactions/:id', (req: Request, res: Response) => {
  const userProfile = (req as any).userProfile;
  const authorName = userProfile?.name || (req.query.user as string) || 'Financeiro';
  const success = db.deleteTransaction(req.params.id, authorName);
  if (!success) return res.status(404).json({ error: 'Transação não encontrada.' });

  addAuditLog({
    user: userProfile?.email || 'sistema',
    userName: authorName,
    action: 'EXCLUIR_LANCAMENTO',
    description: `${authorName} excluiu o lançamento ID ${req.params.id}.`,
    entityType: 'TRANSACTION',
    entityId: req.params.id
  });

  res.json({ success: true });
});

// ===================== IMPORT & CONCILIAÇÃO =====================

// 1. Analyze File Structure (Automatic Detection & Column Mapping Suggestion)
apiRouter.post('/import/analyze', async (req: Request, res: Response) => {
  try {
    const { fileContent, fileBase64, fileName, fileType, bankAccountId } = req.body || {};

    const detectedType = ((fileType || 'OFX') as string).toUpperCase() as StatementFileType;
    const account = bankAccountId ? db.getBankAccountById(bankAccountId) : undefined;
    const templates = db.getMappingTemplates() || [];

    const textContent = fileContent || (fileBase64 ? Buffer.from(fileBase64, 'base64').toString('utf-8') : '');

    // Find saved template matching bank code or name
    let matchingTemplate = templates.find(t => {
      if (!account || !t || !t.bankNameOrCode) return false;
      const tCodeLower = String(t.bankNameOrCode).toLowerCase();
      const bankCodeMatch = account.bankCode && account.bankCode === t.bankNameOrCode;
      const bankIdMatch = account.id === t.bankNameOrCode;
      const bankNameMatch = account.bankName && account.bankName.toLowerCase().includes(tCodeLower);
      const isBankMatch = Boolean(bankCodeMatch || bankIdMatch || bankNameMatch);
      return isBankMatch && (t.fileType === detectedType || detectedType === 'TXT' || detectedType === 'CSV');
    });

    if (detectedType === 'OFX') {
      const parsedRows = parseOFX(textContent || '');
      return res.json({
        fileType: 'OFX',
        canDirectPreview: true,
        totalLinesDetected: parsedRows.length,
        message: 'Formato OFX detectado com sucesso. Estrutura padronizada dispensando mapeamento de colunas.'
      });
    }

    if (detectedType === 'PDF') {
      if (!fileBase64) {
        return res.status(400).json({ error: 'Conteúdo binário do PDF não fornecido.' });
      }
      const buffer = Buffer.from(fileBase64, 'base64');
      const pdfResult = await parsePDF(buffer);

      return res.json({
        fileType: 'PDF',
        canDirectPreview: pdfResult.success,
        totalLinesDetected: pdfResult.transactions.length,
        extractedTextPreview: pdfResult.textPreview,
        warning: pdfResult.warning,
        message: pdfResult.success
          ? `${pdfResult.transactions.length} lançamentos encontrados no arquivo PDF.`
          : pdfResult.warning
      });
    }

    if (detectedType === 'XLSX') {
      let stringRows: string[][] = [];
      if (fileBase64) {
        const buffer = Buffer.from(fileBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames && workbook.SheetNames.length > 0 ? workbook.SheetNames[0] : null;
        if (firstSheetName && workbook.Sheets[firstSheetName]) {
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          stringRows = rawRows.map(r => (r || []).map(c => String(c || '').trim()));
        }
      } else if (textContent) {
        const rawLines = normalizeStatementLines(textContent);
        const delimiter = detectDelimiter(rawLines);
        stringRows = rawLines.map((l: string) => splitCsvRow(l, delimiter));
      }

      const analysis = analyzeTabularData(stringRows, 'XLSX', ';');
      return res.json({
        fileType: 'XLSX',
        canDirectPreview: analysis.autoConfidence === 'ALTA' && !matchingTemplate,
        analysis,
        matchingSavedTemplate: matchingTemplate
      });
    }

    // CSV or TXT
    const rawLines = normalizeStatementLines(textContent);
    const delimiter = detectDelimiter(rawLines);
    const allRows = rawLines.map((l: string) => splitCsvRow(l, delimiter));
    const analysis = analyzeTabularData(allRows, detectedType === 'TXT' ? 'TXT' : 'CSV', delimiter);

    return res.json({
      fileType: detectedType === 'TXT' ? 'TXT' : 'CSV',
      canDirectPreview: analysis.autoConfidence === 'ALTA' && !matchingTemplate,
      analysis,
      matchingSavedTemplate: matchingTemplate
    });
  } catch (err: unknown) {
    console.error('Error analyzing import:', err);
    res.status(500).json({ error: (err as Error).message || 'Erro ao analisar extrato.' });
  }
});

// 2. Generate Import Preview (with Classification, Reconciliation, Duplication Alerts)
apiRouter.post('/import/preview', async (req: Request, res: Response) => {
  try {
    const { fileContent, fileBase64, fileName, fileType, bankAccountId, customMapping } = req.body;

    if (!bankAccountId) {
      return res.status(400).json({ error: 'Conta bancária de destino é obrigatória.' });
    }

    let parsedRows: RawParsedTransaction[] = [];
    let extractedBalance: any = {};
    const typeUpper = ((fileType || 'OFX') as string).toUpperCase() as StatementFileType;

    if (typeUpper === 'OFX') {
      const ofxRes = parseOFX(fileContent || '');
      parsedRows = ofxRes;
      extractedBalance = ofxRes.extractedBalance || {};
    } else if (typeUpper === 'CSV' || typeUpper === 'TXT') {
      const parsed = parseCSVWithMapping(fileContent || '', customMapping as ColumnMapping | undefined);
      parsedRows = parsed.transactions;
      extractedBalance = parsed.extractedBalance || {};
    } else if (typeUpper === 'XLSX') {
      if (fileBase64) {
        const buffer = Buffer.from(fileBase64, 'base64');
        const parsed = parseXLSXWithMapping(buffer, customMapping as ColumnMapping | undefined);
        parsedRows = parsed.transactions;
        extractedBalance = parsed.extractedBalance || {};
      } else if (fileContent) {
        const parsed = parseCSVWithMapping(fileContent, customMapping as ColumnMapping | undefined);
        parsedRows = parsed.transactions;
        extractedBalance = parsed.extractedBalance || {};
      }
    } else if (typeUpper === 'PDF') {
      if (!fileBase64) {
        return res.status(400).json({ error: 'Arquivo PDF não fornecido.' });
      }
      const buffer = Buffer.from(fileBase64, 'base64');
      const pdfResult = await parsePDF(buffer);
      if (pdfResult.transactions.length > 0) {
        parsedRows = pdfResult.transactions;
        extractedBalance = pdfResult.extractedBalance || {};
      } else if (!pdfResult.success) {
        return res.status(422).json({
          error: pdfResult.warning || 'Não foi possível extrair lançamentos estruturados deste arquivo PDF com segurança técnica.',
          textPreview: pdfResult.textPreview,
          isPdfError: true
        });
      }
    }

    // MULTI-STAGE SMART FALLBACK PARSING ENGINE
    // If primary parser returned 0 rows, run fallback passes sequentially
    if (parsedRows.length === 0 && fileContent && (fileContent.includes('<OFX') || fileContent.includes('<STMTTRN'))) {
      const ofxRes = parseOFX(fileContent);
      if (ofxRes.length > 0) {
        parsedRows = ofxRes;
        extractedBalance = ofxRes.extractedBalance || extractedBalance;
      }
    }

    if (parsedRows.length === 0 && fileContent && fileContent.trim().length > 0) {
      const csvRes = parseCSVWithMapping(fileContent);
      if (csvRes.transactions.length > 0) {
        parsedRows = csvRes.transactions;
        extractedBalance = csvRes.extractedBalance || extractedBalance;
      }
    }

    if (parsedRows.length === 0 && fileBase64) {
      try {
        const buffer = Buffer.from(fileBase64, 'base64');
        const parsed = parseXLSXWithMapping(buffer);
        if (parsed.transactions.length > 0) {
          parsedRows = parsed.transactions;
          extractedBalance = parsed.extractedBalance || extractedBalance;
        }
      } catch {
        // ignore
      }
    }

    if (parsedRows.length === 0 && fileContent && fileContent.trim().length > 0) {
      const genericRes = parseGenericUnstructuredText(fileContent);
      if (genericRes.transactions.length > 0) {
        parsedRows = genericRes.transactions;
        extractedBalance = genericRes.extractedBalance || extractedBalance;
      }
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({
        error: 'Nenhum lançamento válido foi identificado no arquivo. Verifique se o formato do extrato corresponde a OFX, CSV, XLSX, TXT ou PDF legível, ou utilize o mapeamento manual de colunas.'
      });
    }

    const preview = db.processImportPreview(parsedRows, bankAccountId, extractedBalance);
    res.json({ preview, fileName, fileType: typeUpper, extractedBalance: preview.extractedBalance });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Confirm Import
apiRouter.post('/import/confirm', (req: Request, res: Response) => {
  try {
    const { items, bankAccountId, fileName, fileType, userName, fileSize, extractedBalance } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nenhum item selecionado para importação.' });
    }
    if (!bankAccountId) {
      return res.status(400).json({ error: 'Conta bancária é obrigatória.' });
    }

    const userProfile = (req as any).userProfile;
    const authorName = userProfile?.name || userName || 'Financeiro Supermercado';

    const result = db.confirmImport(
      items as ImportPreviewItem[],
      bankAccountId,
      fileName || 'extrato_importado.ofx',
      (fileType || 'OFX') as StatementFileType,
      authorName,
      fileSize,
      extractedBalance
    );

    addAuditLog({
      user: userProfile?.email || 'sistema',
      userName: authorName,
      action: 'IMPORTAR_EXTRATO',
      description: `${authorName} importou o extrato ${fileName || 'extrato'} com ${result.count} lançamentos conciliados.`,
      entityType: 'BANK_STATEMENT',
      entityId: result.statementId
    });

    res.json({
      success: true,
      importedCount: result.count,
      statementId: result.statementId,
      message: `${result.count} lançamentos foram importados e integrados com sucesso!`
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===================== BANK MAPPING TEMPLATES =====================
apiRouter.get('/mapping-templates', (req: Request, res: Response) => {
  res.json({ templates: db.getMappingTemplates() });
});

apiRouter.post('/mapping-templates', (req: Request, res: Response) => {
  try {
    const { bankNameOrCode, templateName, fileType, mapping } = req.body;
    if (!bankNameOrCode || !templateName || !mapping) {
      return res.status(400).json({ error: 'Campos de modelo de mapeamento incompletos.' });
    }
    const template = db.saveMappingTemplate(
      { bankNameOrCode, templateName, fileType: fileType || 'CSV', mapping },
      (req.query.user as string) || 'Financeiro'
    );
    res.json({ template });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.delete('/mapping-templates/:id', (req: Request, res: Response) => {
  const success = db.deleteMappingTemplate(req.params.id);
  res.json({ success });
});

// ===================== BANK STATEMENTS HISTORY & REVERSION =====================
apiRouter.get('/statements', (req: Request, res: Response) => {
  res.json({ statements: db.getBankStatements() });
});

apiRouter.get('/statements/:id', (req: Request, res: Response) => {
  const statementData = db.getBankStatementById(req.params.id);
  if (!statementData) {
    return res.status(404).json({ error: 'Extrato não encontrado.' });
  }
  res.json(statementData);
});

apiRouter.delete('/statements/:id', (req: Request, res: Response) => {
  const success = db.deleteBankStatement(req.params.id, (req.query.user as string) || 'Financeiro');
  if (!success) {
    return res.status(404).json({ error: 'Extrato não encontrado para exclusão.' });
  }
  res.json({ success, message: 'Extrato e todos os seus lançamentos importados foram revertidos com sucesso.' });
});

// Reconcile batch
apiRouter.post('/reconciliation/batch', (req: Request, res: Response) => {
  try {
    const { transactionIds, action, userName } = req.body;
    if (!Array.isArray(transactionIds)) return res.status(400).json({ error: 'IDs inválidos.' });

    let updatedCount = 0;
    for (const id of transactionIds) {
      const status = action === 'CONCILIAR' ? 'CONCILIADO' : (action === 'SUSPEITO' ? 'SUSPEITO' : 'PENDENTE');
      const updated = db.updateTransaction(id, { reconciliationStatus: status }, userName || 'Financeiro');
      if (updated) updatedCount++;
    }
    res.json({ success: true, updatedCount });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===================== DASHBOARD & DAILY MOVEMENT =====================
apiRouter.get('/dashboard', (req: Request, res: Response) => {
  const { period, startDate, endDate, bankAccountId, dateSortOrder } = req.query;
  const data = db.getDashboardData(
    period as string,
    startDate as string,
    endDate as string,
    bankAccountId as string,
    (dateSortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
  );
  res.json(data);
});

apiRouter.get('/daily-movement', (req: Request, res: Response) => {
  const { date, bankAccountId } = req.query;
  const targetDate = (date as string) || new Date().toISOString().substring(0, 10);
  const data = db.getDailyMovement(targetDate, bankAccountId as string);
  res.json(data);
});

apiRouter.get('/consolidated-balance', (req: Request, res: Response) => {
  const { startDate, endDate, bankAccountId } = req.query;
  const allTxs = db.getTransactions({});
  const result = calculateConsolidatedBalance(allTxs, {
    startDate: startDate as string,
    endDate: endDate as string,
    bankAccountId: bankAccountId as string
  });
  res.json(result);
});

// ===================== SAMPLE FILES FOR ONE-CLICK TESTING =====================
apiRouter.get('/sample-file', (req: Request, res: Response) => {
  const format = ((req.query.format as string) || 'OFX').toUpperCase() as StatementFileType;
  const sample = getSampleStatement(format === 'TXT' ? 'TXT' : (format === 'XLSX' ? 'XLSX' : (format === 'CSV' ? 'CSV' : 'OFX')));

  if (format === 'XLSX') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${sample.fileName}"`);
    return res.send(sample.content);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${sample.fileName}"`);
  res.send(sample.content);
});

// Quick load sample text into JSON response
apiRouter.get('/sample-data', (req: Request, res: Response) => {
  const format = ((req.query.format as string) || 'OFX').toUpperCase() as StatementFileType;
  const sample = getSampleStatement(format === 'TXT' ? 'TXT' : (format === 'XLSX' ? 'XLSX' : (format === 'CSV' ? 'CSV' : 'OFX')));
  if (format === 'XLSX') {
    return res.json({
      fileName: sample.fileName,
      fileType: format,
      fileBase64: (sample.content as Buffer).toString('base64')
    });
  }
  res.json({
    fileName: sample.fileName,
    fileType: format,
    fileContent: sample.content as string
  });
});

// ===================== DATABASE RESET & RESTORE =====================
apiRouter.post('/reset-data', (req: Request, res: Response) => {
  try {
    const { userName } = req.body;
    const userProfile = (req as any).userProfile;
    const authorName = userProfile?.name || userName || 'Administrador';
    db.resetToBlank(authorName);

    addAuditLog({
      user: userProfile?.email || 'admin@supermercado.com',
      userName: authorName,
      action: 'ZERAR_SISTEMA',
      description: `${authorName} zerou todos os lançamentos e movimentações do sistema.`
    });

    res.json({
      success: true,
      message: 'Sistema zerado com sucesso! Todas as movimentações foram removidas e o sistema está limpo para importação de extrato real.'
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post('/restore-sample-data', (req: Request, res: Response) => {
  try {
    const { userName } = req.body;
    const userProfile = (req as any).userProfile;
    const authorName = userProfile?.name || userName || 'Administrador';
    db.restoreSampleData(authorName);

    addAuditLog({
      user: userProfile?.email || 'admin@supermercado.com',
      userName: authorName,
      action: 'RESTAURAR_DADOS',
      description: `${authorName} restaurou os dados demonstrativos do sistema.`
    });

    res.json({
      success: true,
      message: 'Dados de demonstração restaurados com sucesso!'
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ===================== DATABASE SCHEMA =====================
apiRouter.get('/database/schema-sql', (req: Request, res: Response) => {
  try {
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      res.json({ sql });
    } else {
      res.status(404).json({ error: 'Arquivo schema.sql não encontrado.' });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.get('/financial-tests', (req: Request, res: Response) => {
  try {
    const testResults = runFinancialUnitTests();
    res.json(testResults);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.get('/financial-audit', (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate, bankAccountId } = req.query;
    const dashboard = db.getDashboardData(
      period as string || 'este-mes',
      startDate as string,
      endDate as string,
      bankAccountId as string
    );
    res.json({
      success: true,
      audit: dashboard
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});
