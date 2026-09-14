import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const getRequire = () => {
  if (typeof require !== 'undefined') return require;
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.url) {
      return createRequire((import.meta as any).url);
    }
  } catch {}
  return createRequire(path.join(process.cwd(), 'package.json'));
};
const customRequire = getRequire();
import {
  isSupabaseConfigured,
  ensureSupabaseTables,
  loadFromSupabase,
  syncToSupabase,
  deleteFromSupabase
} from './supabaseService.js';
import {
  loadAllFromSqlite,
  saveAllToSqlite,
  upsertTransactionSqlite,
  deleteTransactionSqlite,
  getSqliteDatabaseInfo
} from './sqliteService.js';
import {
  BankAccount,
  Category,
  ClassificationRule,
  OperationTypeInfo,
  Transaction,
  BankStatement,
  StatementFileType,
  BankMappingTemplate,
  ImportPreviewItem,
  ImportPreviewSummary,
  DashboardResponse,
  DashboardMetrics,
  ChartDayData,
  ChartMonthData,
  CategoryDistribution,
  OperationDistribution,
  PaymentComparison,
  DailyMovementGroup,
  ExtractedStatementBalance,
  StatementBalancesSummary,
  StatementBalanceRecord,
  ConfidenceLevel,
  TransactionType
} from '../src/types';
import { calculateConsolidatedBalance } from '../src/utils/consolidatedBalance';
import { isStatementBalanceRow } from './importers/bankStatementParsers';
import {
  INITIAL_BANK_ACCOUNTS,
  INITIAL_CATEGORIES,
  INITIAL_RULES,
  INITIAL_OPERATION_TYPES,
  generateSeedTransactions
} from './seedData';

const DEFAULT_MAPPING_TEMPLATES: BankMappingTemplate[] = [
  {
    id: 'tmpl_itau_csv',
    bankNameOrCode: '341',
    templateName: 'Itaú Empresas (CSV Padrão)',
    fileType: 'CSV',
    mapping: {
      dateCol: 0,
      descCol: 1,
      amountMode: 'SEPARATE_DEBIT_CREDIT',
      creditCol: 3,
      debitCol: 4,
      balanceCol: 5,
      docCol: 2,
      hasHeader: true,
      headerRowIndex: 0,
      delimiter: ';'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl_bradesco_csv',
    bankNameOrCode: '237',
    templateName: 'Bradesco Net Empresa (CSV)',
    fileType: 'CSV',
    mapping: {
      dateCol: 0,
      descCol: 1,
      amountMode: 'SEPARATE_DEBIT_CREDIT',
      creditCol: 3,
      debitCol: 4,
      balanceCol: 5,
      docCol: 2,
      hasHeader: true,
      headerRowIndex: 0,
      delimiter: ';'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl_bb_txt',
    bankNameOrCode: '001',
    templateName: 'Banco do Brasil (TXT / Tabulado)',
    fileType: 'TXT',
    mapping: {
      dateCol: 0,
      descCol: 1,
      amountMode: 'SINGLE_COLUMN',
      amountCol: 2,
      typeCol: 3,
      docCol: 4,
      hasHeader: true,
      headerRowIndex: 0,
      delimiter: '\t'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl_santander_xlsx',
    bankNameOrCode: '033',
    templateName: 'Santander / Excel (Débito e Crédito Separados)',
    fileType: 'XLSX',
    mapping: {
      dateCol: 0,
      descCol: 1,
      amountMode: 'SEPARATE_DEBIT_CREDIT',
      debitCol: 3,
      creditCol: 4,
      balanceCol: 5,
      docCol: 2,
      hasHeader: true,
      headerRowIndex: 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

interface DatabaseSchema {
  bankAccounts: BankAccount[];
  categories: Category[];
  operationTypes: OperationTypeInfo[];
  classificationRules: ClassificationRule[];
  transactions: Transaction[];
  bankStatements: BankStatement[];
  mappingTemplates: BankMappingTemplate[];
}

const isVercelEnvironment = Boolean(process.env.VERCEL || process.env.NOW_REGION);

function getDbPaths(): { dataDir: string; dbFile: string } {
  if (isVercelEnvironment) {
    return {
      dataDir: '/tmp',
      dbFile: path.join('/tmp', 'supermarket_db.json')
    };
  }
  const dataDir = path.join(process.cwd(), 'data');
  return {
    dataDir,
    dbFile: path.join(dataDir, 'supermarket_db.json')
  };
}

class SupermarketDatabase {
  private data: DatabaseSchema;
  private isSupabaseInit: boolean = false;
  private supabaseSyncPromise: Promise<void> | null = null;

  constructor() {
    this.data = this.loadDatabase();
    this.recalculateAllAccountBalances();
    this.ensureSupabaseReady().catch(err => {
      console.error('[Supabase] Init error in constructor:', err);
    });
  }

  public async ensureSupabaseReady(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    if (this.isSupabaseInit) return;
    if (this.supabaseSyncPromise) return this.supabaseSyncPromise;

    this.supabaseSyncPromise = (async () => {
      try {
        await ensureSupabaseTables();
        const cloudData = await loadFromSupabase();
        if (cloudData && cloudData.bankAccounts && cloudData.bankAccounts.length > 0) {
          this.data = cloudData;
          this.recalculateAllAccountBalances();
          console.log('[Supabase] Dados do banco de dados em nuvem carregados com sucesso!');
        } else {
          await syncToSupabase(this.data);
          console.log('[Supabase] Banco de dados em nuvem inicializado com dados base.');
        }
        this.isSupabaseInit = true;
      } catch (err) {
        console.error('[Supabase] Erro ao sincronizar com Supabase:', err);
      } finally {
        this.supabaseSyncPromise = null;
      }
    })();

    return this.supabaseSyncPromise;
  }

  private loadDatabase(): DatabaseSchema {
    try {
      // 1. Tenta carregar primeiro do SQLite nativo local
      const sqliteData = loadAllFromSqlite();
      if (sqliteData && sqliteData.bankAccounts && sqliteData.bankAccounts.length > 0) {
        console.log('[SQLite] Dados carregados com sucesso do banco de dados SQLite local!');
        return sqliteData;
      }

      // 2. Se o SQLite for novo/vazio, carrega do JSON existente para migrar automaticamente
      const { dataDir, dbFile } = getDbPaths();
      if (!fs.existsSync(dataDir)) {
        try {
          fs.mkdirSync(dataDir, { recursive: true });
        } catch {
          // ignore
        }
      }

      let parsed: any = null;

      if (fs.existsSync(dbFile)) {
        try {
          const content = fs.readFileSync(dbFile, 'utf-8');
          if (content && content.trim().length > 2) {
            parsed = JSON.parse(content);
          }
        } catch (e) {
          console.warn('[DB] Arquivo JSON de fallback corrompido ou vazio, ignorando.');
        }
      } else if (isVercelEnvironment) {
        try {
          parsed = customRequire('../data/supermarket_db.json');
        } catch {
          const bundledSeed = path.join(process.cwd(), 'data', 'supermarket_db.json');
          if (fs.existsSync(bundledSeed)) {
            try {
              const content = fs.readFileSync(bundledSeed, 'utf-8');
              if (content && content.trim().length > 2) {
                parsed = JSON.parse(content);
              }
            } catch {}
          }
        }
      } else {
        const localSeed = path.join(process.cwd(), 'data', 'supermarket_db.json');
        if (fs.existsSync(localSeed)) {
          try {
            const content = fs.readFileSync(localSeed, 'utf-8');
            if (content && content.trim().length > 2) {
              parsed = JSON.parse(content);
            }
          } catch {}
        }
      }

      if (parsed) {
        if (!parsed.mappingTemplates || parsed.mappingTemplates.length === 0) {
          parsed.mappingTemplates = [...DEFAULT_MAPPING_TEMPLATES];
        }

        // STRICT ENFORCEMENT: Only the 10 registered categories in exact order
        parsed.categories = [...INITIAL_CATEGORIES];

        // STRICT ENFORCEMENT: Only the 10 registered operation types in exact order
        parsed.operationTypes = [...INITIAL_OPERATION_TYPES];

        // Synchronize and update classification rules
        const customRules = (parsed.classificationRules || []).filter(
          (r: any) => !INITIAL_RULES.some(initR => initR.id === r.id || this.normalizeText(initR.keyword) === this.normalizeText(r.keyword))
        );
        parsed.classificationRules = [...INITIAL_RULES, ...customRules];

        // STRICT REQUIREMENT: Bank statement balance lines must NEVER be transactions/entradas
        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          const validTransactions: Transaction[] = [];
          for (const tx of parsed.transactions) {
            if (isStatementBalanceRow(tx.description)) {
              const acc = (parsed.bankAccounts || []).find((a: any) => a.id === tx.bankAccountId);
              if (acc) {
                const upper = tx.description.toUpperCase();
                if (upper.includes('ANTERIOR') || upper.includes('INICIAL')) {
                  acc.initialStatementBalance = tx.amount;
                } else {
                  acc.lastStatementBalance = tx.amount;
                  acc.lastStatementBalanceDate = tx.date;
                }
              }
            } else {
              const classification = this.classifyDescriptionWithRules(tx.description, tx.type, parsed.classificationRules);
              tx.operationType = classification.operationType;
              tx.categoryId = classification.categoryId;
              tx.categoryName = classification.categoryName;
              tx.subcategoryId = classification.subcategoryId;
              tx.subcategoryName = classification.subcategoryName;
              validTransactions.push(tx);
            }
          }
          parsed.transactions = validTransactions;
        }

        this.saveDatabase(parsed);
        return parsed;
      }
    } catch (e) {
      console.error('Erro ao ler banco de dados local, recriando com dados iniciais:', e);
    }

    const defaultDb: DatabaseSchema = {
      bankAccounts: INITIAL_BANK_ACCOUNTS,
      categories: INITIAL_CATEGORIES,
      operationTypes: INITIAL_OPERATION_TYPES,
      classificationRules: INITIAL_RULES,
      transactions: generateSeedTransactions(),
      bankStatements: [],
      mappingTemplates: [...DEFAULT_MAPPING_TEMPLATES]
    };

    this.saveDatabase(defaultDb);
    return defaultDb;
  }

  private saveDatabase(dataToSave?: DatabaseSchema) {
    const data = dataToSave || this.data;

    // 1. Salvar no banco SQLite local (Transacional)
    try {
      saveAllToSqlite(data);
    } catch (sqliteErr) {
      console.error('[SQLite] Erro ao persistir dados no SQLite:', sqliteErr);
    }

    // 2. Salvar backup no arquivo JSON para compatibilidade e segurança
    try {
      const { dataDir, dbFile } = getDbPaths();
      if (!fs.existsSync(dataDir)) {
        try {
          fs.mkdirSync(dataDir, { recursive: true });
        } catch {
          // ignore
        }
      }
      fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      try {
        const tmpFile = path.join('/tmp', 'supermarket_db.json');
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      } catch (fallbackErr) {
        console.error('Falha ao salvar backup JSON do banco:', fallbackErr);
      }
    }

    if (isSupabaseConfigured()) {
      syncToSupabase(data).catch(err => {
        console.error('[Supabase] Erro ao sincronizar estado com o Supabase:', err);
      });
    }
  }

  public isEntradaTransaction(t: { type?: string; amount?: number; operationType?: string }): boolean {
    const typeUpper = (t.type || '').toUpperCase();
    if (typeUpper === 'TRANSFERENCIA_INTERNA' || typeUpper === 'SALDO_INICIAL') return false;

    // Se o extrato bancário definiu a linha como ENTRADA / CRÉDITO, respeitar a coluna bancária como soberana
    if (typeUpper === 'ENTRADA' || typeUpper === 'CREDITO' || typeUpper === 'C' || typeUpper === 'RECEITA' || typeUpper === 'RECEBIMENTO') {
      return true;
    }
    // Se o extrato bancário definiu a linha como SAÍDA / DÉBITO, respeitar a coluna bancária como soberana
    if (typeUpper === 'SAIDA' || typeUpper === 'DEBITO' || typeUpper === 'D' || typeUpper === 'DESPESA') {
      return false;
    }

    const opUpper = (t.operationType || '').toUpperCase();
    if (opUpper.includes('SALDO') || opUpper.includes('SDO')) {
      return false;
    }
    if (opUpper.includes('PAGTO') || opUpper.includes('TARIFA') || opUpper.includes('CHEQUE COMPENSADO') || opUpper.includes('DEBITO')) {
      return false;
    }

    return Number(t.amount) > 0;
  }

  public recalculateAllAccountBalances() {
    for (const acc of this.data.bankAccounts) {
      const txs = this.data.transactions
        .filter(t => t.bankAccountId === acc.id)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return (a.sourceLineNumber || 0) - (b.sourceLineNumber || 0);
        });

      let balance = Number(acc.initialBalance) || 0;
      for (const tx of txs) {
        if (tx.type === 'SALDO_INICIAL') {
          if (typeof tx.balanceAfter === 'number' && !isNaN(tx.balanceAfter)) {
            balance = tx.balanceAfter;
          }
        } else if (tx.type === 'TRANSFERENCIA_INTERNA') {
          // Excluded from standard revenue/expense
        } else if (this.isEntradaTransaction(tx)) {
          balance += Math.abs(Number(tx.amount) || 0);
        } else {
          balance -= Math.abs(Number(tx.amount) || 0);
        }
        tx.balanceAfter = Math.round(balance * 100) / 100;
      }
      acc.currentBalance = Math.round(balance * 100) / 100;
    }
    this.saveDatabase();
  }

  public logAudit(
    _userName?: string,
    _operation?: string,
    _entity?: string,
    _entityId?: string,
    _description?: string,
    _previousValue?: Record<string, unknown> | null,
    _newValue?: Record<string, unknown> | null
  ) {
    // No-op after removing audit logs
  }

  // ===================== RESET & RESTORE SYSTEM DATA =====================
  public resetToBlank(userName: string = 'Administrador') {
    this.data.transactions = [];
    this.data.bankStatements = [];
    for (const acc of this.data.bankAccounts) {
      acc.initialBalance = 0;
      acc.currentBalance = 0;
    }
    this.logAudit(
      userName,
      'EXCLUSAO',
      'TRANSACAO',
      'sistema',
      'Base de movimentações e extratos zerada para importação de extrato real'
    );
    this.saveDatabase();
  }

  public restoreSampleData(userName: string = 'Administrador') {
    this.data.bankAccounts = INITIAL_BANK_ACCOUNTS;
    this.data.transactions = generateSeedTransactions();
    this.data.bankStatements = [
      {
        id: 'stmt_seed_01',
        bankAccountId: 'acc_itau',
        bankAccountName: 'Itaú - Conta Movimento Supermercado',
        fileName: 'EXTRATO_ITAU_AGO_SET_2026.ofx',
        fileType: 'OFX',
        startDate: '2026-08-25',
        endDate: '2026-09-06',
        totalRecords: 28,
        importedRecords: 28,
        duplicateRecords: 0,
        unclassifiedRecords: 1,
        importedByUserName: 'Mariana Souza (Gerente Financeiro)',
        importedAt: '2026-09-06T10:00:00Z'
      }
    ];
    this.recalculateAllAccountBalances();
    this.logAudit(
      userName,
      'IMPORTACAO',
      'TRANSACAO',
      'sistema',
      'Dados demonstrativos restaurados'
    );
    this.saveDatabase();
  }

  // Generate unique deterministic fingerprint for duplicate checking and transaction tracking
  public generateHash(
    date: string,
    amount: number,
    description: string,
    accountId: string,
    type?: string,
    documentId?: string
  ): string {
    const cleanDate = (date || '').substring(0, 10);
    const normDesc = this.normalizeText(description);
    const absVal = Math.abs(amount || 0).toFixed(2);
    const cleanDoc = documentId ? this.normalizeText(documentId).replace(/\s+/g, '') : '';
    const cleanType = (type || 'ENTRADA').toUpperCase();
    const raw = `${cleanDate}|${normDesc}|${cleanDoc}|${absVal}|${cleanType}|${accountId || ''}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  public normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .trim();
  }

  // ===================== BANK ACCOUNTS =====================
  public getBankAccounts(): BankAccount[] {
    return this.data.bankAccounts;
  }

  public getBankAccountById(id: string): BankAccount | undefined {
    return this.data.bankAccounts.find(a => a.id === id);
  }

  public createBankAccount(account: Omit<BankAccount, 'id' | 'currentBalance' | 'createdAt'>, user: string): BankAccount {
    const newAccount: BankAccount = {
      ...account,
      id: `acc_${Date.now()}`,
      currentBalance: Number(account.initialBalance) || 0,
      createdAt: new Date().toISOString()
    };
    this.data.bankAccounts.push(newAccount);
    this.recalculateAllAccountBalances();
    this.logAudit(user, 'CRIACAO', 'CONTA', newAccount.id, `Criada conta bancária: ${newAccount.accountName}`);
    this.saveDatabase();
    return newAccount;
  }

  public updateBankAccount(id: string, updates: Partial<BankAccount>, user: string): BankAccount | null {
    const accIndex = this.data.bankAccounts.findIndex(a => a.id === id);
    if (accIndex === -1) return null;

    const old = { ...this.data.bankAccounts[accIndex] };
    this.data.bankAccounts[accIndex] = { ...old, ...updates };
    this.recalculateAllAccountBalances();
    this.logAudit(
      user,
      'EDICAO',
      'CONTA',
      id,
      `Alterada conta: ${this.data.bankAccounts[accIndex].accountName}`,
      old as unknown as Record<string, unknown>,
      updates as Record<string, unknown>
    );
    this.saveDatabase();
    return this.data.bankAccounts[accIndex];
  }

  // ===================== CATEGORIES =====================
  public getCategories(): Category[] {
    return this.data.categories;
  }

  public createCategory(name: string, type: 'ENTRADA' | 'SAIDA', subcategories: string[], user: string): Category {
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name,
      type,
      color: type === 'ENTRADA' ? '#10b981' : '#ef4444',
      isSystem: false,
      subcategories: subcategories.map((sName, idx) => ({
        id: `sub_${Date.now()}_${idx}`,
        categoryId: `cat_${Date.now()}`,
        name: sName
      }))
    };
    this.data.categories.push(newCat);
    this.logAudit(user, 'CRIACAO', 'CATEGORIA', newCat.id, `Criada categoria: ${newCat.name}`);
    this.saveDatabase();
    return newCat;
  }

  // ===================== OPERATION TYPES =====================
  public getOperationTypes(): OperationTypeInfo[] {
    return this.data.operationTypes;
  }

  // ===================== CLASSIFICATION RULES =====================
  public getClassificationRules(): ClassificationRule[] {
    return this.data.classificationRules.sort((a, b) => b.priority - a.priority);
  }

  public isDuplicateAllowed(description: string): boolean {
    if (!description) return false;
    const norm = this.normalizeText(description);
    const rules = this.data.classificationRules.filter(r => r.isActive && r.allowMultipleSameDay);
    for (const rule of rules) {
      const ruleKeywordNorm = this.normalizeText(rule.keyword);
      if (ruleKeywordNorm && norm.includes(ruleKeywordNorm)) {
        return true;
      }
    }
    return false;
  }

  public allowDuplicateForKeyword(
    keyword: string,
    operationType: string = 'Boleto pago',
    categoryId?: string,
    categoryName?: string,
    user: string = 'Administrador'
  ): ClassificationRule {
    const norm = this.normalizeText(keyword);
    // Find if rule already exists
    let existing = this.data.classificationRules.find(r => this.normalizeText(r.keyword) === norm);
    if (existing) {
      existing.allowMultipleSameDay = true;
      existing.isActive = true;
      if (operationType) existing.operationType = operationType;
      if (categoryId) existing.categoryId = categoryId;
      if (categoryName) existing.categoryName = categoryName;
      this.logAudit(user, 'ATUALIZACAO', 'REGRA', existing.id, `Regra atualizada para permitir múltiplos lançamentos com mesmo valor/dia: "${keyword}"`);
      this.saveDatabase();
      return existing;
    }

    const cat = categoryId ? this.data.categories.find(c => c.id === categoryId) : undefined;
    const newRule: ClassificationRule = {
      id: `rule_dup_${Date.now()}`,
      keyword: keyword.trim(),
      operationType: operationType || 'Boleto pago',
      categoryId: categoryId || cat?.id,
      categoryName: categoryName || cat?.name,
      confidence: 'ALTA',
      priority: 25,
      isActive: true,
      allowMultipleSameDay: true,
      learnedFromUser: true,
      matchCount: 1,
      createdAt: new Date().toISOString()
    };

    this.data.classificationRules.unshift(newRule);
    this.logAudit(user, 'CRIACAO', 'REGRA', newRule.id, `Criada regra de exceção para permitir múltiplos lançamentos: "${keyword}"`);
    this.saveDatabase();
    return newRule;
  }

  public batchCategorizeTransactions(
    transactionIds: string[],
    data: {
      categoryId?: string;
      categoryName?: string;
      subcategoryId?: string;
      subcategoryName?: string;
      operationType: string;
      createRule?: boolean;
      ruleKeyword?: string;
      applyToAllSimilar?: boolean;
      allowMultipleSameDay?: boolean;
    },
    user: string = 'Administrador'
  ): {
    updatedCount: number;
    ruleCreated?: ClassificationRule;
    similarUpdatedCount: number;
  } {
    const idSet = new Set(transactionIds);
    let updatedCount = 0;
    let similarUpdatedCount = 0;

    // Resolve category names if missing
    let resolvedCategoryName = data.categoryName;
    let resolvedSubcategoryName = data.subcategoryName;
    if (data.categoryId && !resolvedCategoryName) {
      const cat = this.data.categories.find(c => c.id === data.categoryId);
      if (cat) {
        resolvedCategoryName = cat.name;
        if (data.subcategoryId && !resolvedSubcategoryName) {
          const sub = cat.subcategories?.find(s => s.id === data.subcategoryId);
          if (sub) resolvedSubcategoryName = sub.name;
        }
      }
    }

    // 1. Update selected transactions
    for (const tx of this.data.transactions) {
      if (idSet.has(tx.id)) {
        tx.categoryId = data.categoryId || tx.categoryId;
        tx.categoryName = resolvedCategoryName || tx.categoryName;
        tx.subcategoryId = data.subcategoryId || tx.subcategoryId;
        tx.subcategoryName = resolvedSubcategoryName || tx.subcategoryName;
        tx.operationType = data.operationType || tx.operationType;
        tx.classificationStatus = 'CLASSIFICADO';
        tx.confidence = 'ALTA';
        updatedCount++;
      }
    }

    // 2. Create rule if requested
    let createdRule: ClassificationRule | undefined;
    const ruleKeyword = (data.ruleKeyword || '').trim();

    if (data.createRule && ruleKeyword.length >= 2) {
      // Check if rule exists
      const normKeyword = this.normalizeText(ruleKeyword);
      let existingRule = this.data.classificationRules.find(r => this.normalizeText(r.keyword) === normKeyword);

      if (existingRule) {
        existingRule.operationType = data.operationType;
        existingRule.categoryId = data.categoryId || existingRule.categoryId;
        existingRule.categoryName = resolvedCategoryName || existingRule.categoryName;
        existingRule.subcategoryId = data.subcategoryId || existingRule.subcategoryId;
        existingRule.subcategoryName = resolvedSubcategoryName || existingRule.subcategoryName;
        existingRule.isActive = true;
        if (data.allowMultipleSameDay !== undefined) {
          existingRule.allowMultipleSameDay = data.allowMultipleSameDay;
        }
        createdRule = existingRule;
      } else {
        createdRule = {
          id: `rule_user_${Date.now()}`,
          keyword: ruleKeyword,
          operationType: data.operationType,
          categoryId: data.categoryId,
          categoryName: resolvedCategoryName,
          subcategoryId: data.subcategoryId,
          subcategoryName: resolvedSubcategoryName,
          confidence: 'ALTA',
          priority: 25, // High priority for explicit user rules
          isActive: true,
          allowMultipleSameDay: Boolean(data.allowMultipleSameDay),
          learnedFromUser: true,
          matchCount: 1,
          createdAt: new Date().toISOString()
        };
        this.data.classificationRules.unshift(createdRule);
      }

      this.logAudit(
        user,
        'CRIACAO',
        'REGRA',
        createdRule.id,
        `Regra de categorização criada/atualizada para "${ruleKeyword}" -> ${data.operationType} (${resolvedCategoryName || 'Sem Categoria'})`
      );

      // 3. Apply to other similar transactions if requested
      if (data.applyToAllSimilar) {
        for (const tx of this.data.transactions) {
          if (idSet.has(tx.id)) continue; // Already updated
          if (tx.type === 'SALDO_INICIAL') continue; // Don't overwrite initial balance

          const normDesc = this.normalizeText(tx.description);
          if (normDesc.includes(normKeyword)) {
            tx.categoryId = data.categoryId || tx.categoryId;
            tx.categoryName = resolvedCategoryName || tx.categoryName;
            tx.subcategoryId = data.subcategoryId || tx.subcategoryId;
            tx.subcategoryName = resolvedSubcategoryName || tx.subcategoryName;
            tx.operationType = data.operationType || tx.operationType;
            tx.classificationStatus = 'CLASSIFICADO';
            tx.confidence = 'ALTA';
            similarUpdatedCount++;
          }
        }
      }
    }

    this.recalculateAllAccountBalances();
    this.saveDatabase();

    return {
      updatedCount,
      ruleCreated: createdRule,
      similarUpdatedCount
    };
  }

  public applyRulesToAllExistingUncategorized(user: string = 'Administrador'): { updatedCount: number } {
    let updatedCount = 0;
    const rules = this.getClassificationRules().filter(r => r.isActive);

    for (const tx of this.data.transactions) {
      if (tx.type === 'SALDO_INICIAL') continue;
      const isUncategorized =
        !tx.categoryId ||
        tx.operationType === 'NAO_CLASSIFICADO' ||
        tx.operationType === 'OUTRAS' ||
        !tx.operationType ||
        (tx.categoryName && (tx.categoryName.includes('Não classificado') || tx.categoryName.includes('Não Categorizado')));

      if (isUncategorized) {
        const result = this.classifyDescriptionWithRules(tx.description, tx.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA', rules);
        if (result && result.operationType !== 'NAO_CLASSIFICADO' && result.categoryId) {
          tx.operationType = result.operationType;
          tx.categoryId = result.categoryId;
          tx.categoryName = result.categoryName;
          tx.subcategoryId = result.subcategoryId;
          tx.subcategoryName = result.subcategoryName;
          tx.confidence = result.confidence;
          tx.classificationStatus = 'CLASSIFICADO';
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      this.recalculateAllAccountBalances();
      this.saveDatabase();
      this.logAudit(
        user,
        'ATUALIZACAO',
        'TRANSACAO',
        'sistema',
        `Classificação automática com regras aplicada a ${updatedCount} transações pendentes`
      );
    }

    return { updatedCount };
  }

  public createClassificationRule(rule: Omit<ClassificationRule, 'id' | 'createdAt' | 'matchCount'>, user: string): ClassificationRule {
    const newRule: ClassificationRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      matchCount: 0,
      createdAt: new Date().toISOString()
    };
    this.data.classificationRules.unshift(newRule);
    this.logAudit(user, 'CRIACAO', 'REGRA', newRule.id, `Criada regra de classificação: "${newRule.keyword}" -> ${newRule.operationType}`);
    this.saveDatabase();
    return newRule;
  }

  public deleteClassificationRule(id: string, user: string): boolean {
    const idx = this.data.classificationRules.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const rule = this.data.classificationRules[idx];
    this.data.classificationRules.splice(idx, 1);
    this.logAudit(user, 'EXCLUSAO', 'REGRA', id, `Excluída regra de classificação: "${rule.keyword}"`);
    this.saveDatabase();
    return true;
  }

  // Machine Learning / Learning from user manual correction
  public learnFromUserCorrection(description: string, operationType: string, categoryId?: string, subcategoryId?: string, user?: string) {
    const norm = this.normalizeText(description);
    if (!norm || norm.length < 3) return;

    // Extract key representative words (e.g. "PIX RECEBIDO MERCADO XYZ" -> "MERCADO XYZ" or first 2 significant tokens)
    const tokens = norm.split(/\s+/).filter(t => t.length > 2 && !['PAGTO', 'PAGAMENTO', 'DOC', 'TED', 'TRANSF', 'VALOR', 'REF'].includes(t));
    const keyword = tokens.slice(0, 3).join(' ') || norm.substring(0, 20);

    // Find category details
    const cat = this.data.categories.find(c => c.id === categoryId);
    const subcat = cat?.subcategories.find(s => s.id === subcategoryId);

    // Check if an identical learned rule already exists
    const existing = this.data.classificationRules.find(r => r.keyword.toUpperCase() === keyword.toUpperCase());
    if (existing) {
      existing.operationType = operationType;
      existing.categoryId = categoryId;
      existing.categoryName = cat?.name;
      existing.subcategoryId = subcategoryId;
      existing.subcategoryName = subcat?.name;
      existing.matchCount = (existing.matchCount || 0) + 1;
      existing.learnedFromUser = true;
      existing.confidence = 'ALTA';
    } else {
      const learnedRule: ClassificationRule = {
        id: `rule_learned_${Date.now()}`,
        keyword: keyword,
        operationType: operationType,
        categoryId: categoryId,
        categoryName: cat?.name,
        subcategoryId: subcategoryId,
        subcategoryName: subcat?.name,
        confidence: 'ALTA',
        priority: 15, // Higher priority for learned rules
        isActive: true,
        learnedFromUser: true,
        matchCount: 1,
        createdAt: new Date().toISOString()
      };
      this.data.classificationRules.unshift(learnedRule);
      if (user) {
        this.logAudit(
          user,
          'RECLASSIFICACAO',
          'REGRA',
          learnedRule.id,
          `Sistema aprendeu nova regra com base em correção do usuário: "${keyword}" -> ${operationType} / ${cat?.name || 'Geral'}`
        );
      }
    }
    this.saveDatabase();
  }

  public classifyDescriptionWithRules(
    description: string,
    type: 'ENTRADA' | 'SAIDA',
    customRules?: ClassificationRule[]
  ): {
    operationType: string;
    categoryId?: string;
    categoryName?: string;
    subcategoryId?: string;
    subcategoryName?: string;
    confidence: 'ALTA' | 'MEDIA' | 'BAIXA';
    ruleId?: string;
  } {
    const norm = this.normalizeText(description);
    const rules = (customRules || this.getClassificationRules()).filter(r => r.isActive);

    const outflowCategories = new Set(['cat_pagto_boletos', 'cat_debito_automatico', 'cat_cheque_compensado', 'cat_taxas_tarifas']);
    const inflowCategories = new Set(['cat_cartao_recebido', 'cat_boleto_recebido', 'cat_transf_recebida', 'cat_pix_cnpj', 'cat_pix_qr_code', 'cat_rendimento_aplicacao']);

    for (const rule of rules) {
      // Incompatibilidade de tipo: regra de saída nunca deve ser aplicada em entrada bancária e vice-versa
      if (type === 'ENTRADA' && rule.categoryId && outflowCategories.has(rule.categoryId)) {
        continue;
      }
      if (type === 'SAIDA' && rule.categoryId && inflowCategories.has(rule.categoryId)) {
        continue;
      }

      const ruleKeywordNorm = this.normalizeText(rule.keyword);
      if (norm.includes(ruleKeywordNorm)) {
        rule.matchCount = (rule.matchCount || 0) + 1;
        return {
          operationType: rule.operationType,
          categoryId: rule.categoryId,
          categoryName: rule.categoryName,
          subcategoryId: rule.subcategoryId,
          subcategoryName: rule.subcategoryName,
          confidence: rule.confidence || 'ALTA',
          ruleId: rule.id
        };
      }
    }

    // Regra específica para recebimento / estorno / devolução de fornecedor
    if (type === 'ENTRADA' && (norm.includes('RECEBIMENTO FORNECEDOR') || norm.includes('REC FORNECEDOR') || (norm.includes('RECEBIMENTO') && norm.includes('FORNECEDOR')))) {
      return {
        operationType: 'Transferencia recebida',
        categoryId: 'cat_transf_recebida',
        categoryName: 'Transferencia recebida',
        subcategoryId: 'sub_transf_ted_rec',
        subcategoryName: 'Recebimento / Reembolso Fornecedor',
        confidence: 'ALTA'
      };
    }

    // Direct Mapping Rules strictly adhering to the 10 registered categories & operations
    // 1. Boleto recebido
    if (norm.includes('LIQUIDACAO DE COBRANCA') || norm.includes('LIQUIDACAO COBRANCA') || (type === 'ENTRADA' && norm.includes('COBRANCA VALOR DISPONIVEL'))) {
      return {
        operationType: 'Boleto recebido',
        categoryId: 'cat_boleto_recebido',
        categoryName: 'Boleto recebido',
        subcategoryId: 'sub_bol_rec_cobranca',
        subcategoryName: 'Liquidação de Cobrança',
        confidence: 'ALTA'
      };
    }

    // 2. Cartão recebido (Alelo, Cielo, Green Card, Naip, Ticket, VR Beneficios, DM Meios, Solucard, Up Brasil, Verocheque, Voucher Elo)
    if (
      norm.includes('COMPRA CARTAO') ||
      norm.includes('ALELO') ||
      norm.includes('GREEN CARD') ||
      norm.includes('NAIP') ||
      norm.includes('TICKET SERVICOS') ||
      norm.includes('TICKET') ||
      norm.includes('VR BENEFICIOS') ||
      norm.includes('VR BENEF') ||
      norm.includes('DM MEIOS DE PAGAMENT') ||
      norm.includes('DM MEIOS') ||
      norm.includes('SOLUCARD') ||
      norm.includes('UP BRASIL') ||
      norm.includes('VEROCHEQUE') ||
      norm.includes('VOUCHER ELO') ||
      norm.includes('CIELO') ||
      norm.includes('REDE') ||
      norm.includes('STONE') ||
      norm.includes('PAGSEGURO')
    ) {
      let subId = 'sub_cartao_cielo';
      let subName = 'Cielo / Cartões';
      if (norm.includes('ALELO')) { subId = 'sub_cartao_alelo'; subName = 'Alelo'; }
      else if (norm.includes('GREEN CARD')) { subId = 'sub_cartao_greencard'; subName = 'Green Card'; }
      else if (norm.includes('NAIP')) { subId = 'sub_cartao_naip'; subName = 'Naip'; }
      else if (norm.includes('TICKET')) { subId = 'sub_cartao_ticket'; subName = 'Ticket Serviços'; }
      else if (norm.includes('VR')) { subId = 'sub_cartao_vr'; subName = 'VR Benefícios'; }
      else if (norm.includes('DM MEIOS')) { subId = 'sub_cartao_dm'; subName = 'DM Meios de Pagamento'; }
      else if (norm.includes('SOLUCARD')) { subId = 'sub_cartao_solucard'; subName = 'Solucard'; }
      else if (norm.includes('UP BRASIL')) { subId = 'sub_cartao_up'; subName = 'Up Brasil'; }
      else if (norm.includes('VEROCHEQUE')) { subId = 'sub_cartao_verocheque'; subName = 'Verocheque Refeições'; }
      else if (norm.includes('ELO')) { subId = 'sub_cartao_elo'; subName = 'Voucher Elo'; }

      return {
        operationType: 'Cartão recebido',
        categoryId: 'cat_cartao_recebido',
        categoryName: 'Cartão recebido',
        subcategoryId: subId,
        subcategoryName: subName,
        confidence: 'ALTA'
      };
    }

    // 3. Cheque compensado
    if (norm.includes('CHEQUE COMPENSADO') || norm.includes('CHEQUE PAGO') || norm.includes('CHQ COMP') || norm.includes('CHEQUE')) {
      return {
        operationType: 'Cheque compensado',
        categoryId: 'cat_cheque_compensado',
        categoryName: 'Cheque compensado',
        subcategoryId: 'sub_chq_pago',
        subcategoryName: 'Cheque Pago / Compensado',
        confidence: 'ALTA'
      };
    }

    // 4. Débito Automático (Água / Luz / Sabesp / CPFL)
    if (norm.includes('CONTA DE AGUA') || norm.includes('SABESP') || norm.includes('CONTA DE LUZ') || norm.includes('CPFL') || norm.includes('DEBITO AUTOMATICO')) {
      const isAgua = norm.includes('AGUA') || norm.includes('SABESP');
      return {
        operationType: 'Débito Automático',
        categoryId: 'cat_debito_automatico',
        categoryName: 'Débito Automático',
        subcategoryId: isAgua ? 'sub_deb_agua' : 'sub_deb_luz',
        subcategoryName: isAgua ? 'Conta de Água (Sabesp)' : 'Conta de Luz (CPFL)',
        confidence: 'ALTA'
      };
    }

    // 5. Pagto de boletos (Pagamentos eletrônicos / fornecedores em geral quando saída)
    if (
      type === 'SAIDA' && (
        norm.includes('PAGTO ELETRON') ||
        norm.includes('PAGTO ELETRONICA') ||
        norm.includes('PAGTO ELETRONICO') ||
        norm.includes('PAGTO TIT') ||
        norm.includes('PAGAMENTO BOLETO') ||
        norm.includes('BOLETO') ||
        norm.includes('PAGTO') ||
        norm.includes('PAGAMENTO') ||
        norm.includes('FORNECEDOR')
      )
    ) {
      return {
        operationType: 'Pagto de boletos',
        categoryId: 'cat_pagto_boletos',
        categoryName: 'Pagto de boletos',
        subcategoryId: 'sub_pagto_bol_forn',
        subcategoryName: 'Boletos Fornecedores & Mercadorias',
        confidence: 'ALTA'
      };
    }

    // 6. Pix QR Code (Dinâmico PDV)
    if (norm.includes('PIX QR CODE') || norm.includes('QR CODE DINAM') || norm.includes('QRCODE DINAM') || norm.includes('QRCODE') || norm.includes('PIX DINAM')) {
      return {
        operationType: 'Pix QR Code',
        categoryId: 'cat_pix_qr_code',
        categoryName: 'Pix QR Code',
        subcategoryId: 'sub_pix_qr_dinamico',
        subcategoryName: 'PIX QR Code Dinâmico PDV',
        confidence: 'ALTA'
      };
    }

    // 7. Rendimento de aplicação
    if (norm.includes('RENTAR.INVEST') || norm.includes('RENTAR INVEST') || norm.includes('FACILCRED') || norm.includes('REND APLICACAO') || norm.includes('RENDIMENTO') || norm.includes('APLICACAO')) {
      return {
        operationType: 'Rendimento de aplicação',
        categoryId: 'cat_rendimento_aplicacao',
        categoryName: 'Rendimento de aplicação',
        subcategoryId: 'sub_rend_facilcred',
        subcategoryName: 'Rentar Invest / Facilcred',
        confidence: 'ALTA'
      };
    }

    // 8. Taxas e Tarifas
    if (norm.includes('TARIFA') || norm.includes('TAR BANC') || norm.includes('CESTA PJ') || norm.includes('TAXA') || norm.includes('REGISTRO COBRANCA') || norm.includes('MANUTENCAO CONTA')) {
      let subId = 'sub_taxas_bancarias';
      let subName = 'Tarifas Bancárias e Cesta PJ';
      if (norm.includes('PIX') || norm.includes('QRCODE')) { subId = 'sub_taxas_pix'; subName = 'Tarifas QR Code PIX'; }
      else if (norm.includes('COBRANCA') || norm.includes('REGISTRO')) { subId = 'sub_taxas_cobranca'; subName = 'Tarifas Registro Cobrança'; }

      return {
        operationType: 'Taxas e Tarifas',
        categoryId: 'cat_taxas_tarifas',
        categoryName: 'Taxas e Tarifas',
        subcategoryId: subId,
        subcategoryName: subName,
        confidence: 'ALTA'
      };
    }

    // 9. Transferência recebida
    if (
      type === 'ENTRADA' && (
        norm.includes('TRANSF CC PARA CC') ||
        norm.includes('RECEBIMENTO TED') ||
        norm.includes('TED-TRANSF') ||
        norm.includes('TRANSF CC') ||
        norm.includes('TED') ||
        norm.includes('DOC') ||
        norm.includes('TRANSFERENCIA RECEBIDA')
      )
    ) {
      return {
        operationType: 'Transferencia recebida',
        categoryId: 'cat_transf_recebida',
        categoryName: 'Transferencia recebida',
        subcategoryId: norm.includes('CC') ? 'sub_transf_cc_rec' : 'sub_transf_ted_rec',
        subcategoryName: norm.includes('CC') ? 'Transf CC para CC Recebidas' : 'TED / Transf Recebida',
        confidence: 'ALTA'
      };
    }

    // 10. Pix Cnpj (Todos os outros PIX de entrada)
    if (type === 'ENTRADA' && (norm.includes('PIX RECEBIDO') || norm.includes('PIX TRANSF') || norm.includes('PIX'))) {
      return {
        operationType: 'Pix Cnpj',
        categoryId: 'cat_pix_cnpj',
        categoryName: 'Pix Cnpj',
        subcategoryId: 'sub_pix_cnpj_cli',
        subcategoryName: 'PIX Recebido CNPJ / Clientes',
        confidence: 'ALTA'
      };
    }

    // Fallbacks to guarantee compliant categorization
    if (type === 'ENTRADA') {
      return {
        operationType: 'Pix Cnpj',
        categoryId: 'cat_pix_cnpj',
        categoryName: 'Pix Cnpj',
        subcategoryId: 'sub_pix_cnpj_cli',
        subcategoryName: 'PIX Recebido CNPJ / Clientes',
        confidence: 'MEDIA'
      };
    }

    return {
      operationType: 'Pagto de boletos',
      categoryId: 'cat_pagto_boletos',
      categoryName: 'Pagto de boletos',
      subcategoryId: 'sub_pagto_bol_forn',
      subcategoryName: 'Boletos Fornecedores & Mercadorias',
      confidence: 'MEDIA'
    };
  }

  // Classify a description using active rules and heuristics
  public classifyDescription(description: string, type: 'ENTRADA' | 'SAIDA'): {
    operationType: string;
    categoryId?: string;
    categoryName?: string;
    subcategoryId?: string;
    subcategoryName?: string;
    confidence: 'ALTA' | 'MEDIA' | 'BAIXA';
    ruleId?: string;
  } {
    return this.classifyDescriptionWithRules(description, type);
  }

  // ===================== TRANSACTIONS =====================
  public getTransactions(filters: {
    startDate?: string;
    endDate?: string;
    bankAccountId?: string;
    type?: 'ENTRADA' | 'SAIDA';
    categoryId?: string;
    subcategoryId?: string;
    operationType?: string;
    reconciliationStatus?: string;
    classificationStatus?: string;
    statementId?: string;
    origin?: string;
    search?: string;
  } = {}): Transaction[] {
    return this.data.transactions.filter(t => {
      if (filters.startDate && t.date < filters.startDate) return false;
      if (filters.endDate && t.date > filters.endDate) return false;
      if (filters.bankAccountId && t.bankAccountId !== filters.bankAccountId) return false;
      if (filters.type && t.type !== filters.type) return false;

      // Robust Category Filtering
      if (filters.categoryId) {
        const catFilter = filters.categoryId.trim();
        const catFilterNorm = this.normalizeText(catFilter);

        const matchDirect = t.categoryId === catFilter || (t.categoryName && t.categoryName === catFilter);
        const matchNorm = t.categoryName ? this.normalizeText(t.categoryName) === catFilterNorm : false;

        const catObj = this.data.categories.find(c => 
          c.id === catFilter || 
          this.normalizeText(c.name) === catFilterNorm
        );
        const matchCatObj = catObj ? (
          t.categoryId === catObj.id || 
          (t.categoryName && this.normalizeText(t.categoryName) === this.normalizeText(catObj.name))
        ) : false;

        if (!matchDirect && !matchNorm && !matchCatObj) return false;
      }

      if (filters.subcategoryId && t.subcategoryId !== filters.subcategoryId) return false;

      // Robust Operation Type Filtering (matches by code e.g. "PIX_CNPJ", name e.g. "Pix Cnpj", or ID)
      if (filters.operationType) {
        const opFilter = filters.operationType.trim();
        const opFilterNorm = this.normalizeText(opFilter);

        const tOpNorm = this.normalizeText(t.operationType || '');
        const matchDirect = t.operationType === opFilter || tOpNorm === opFilterNorm;

        const opObj = this.data.operationTypes.find(o => 
          o.code === opFilter || 
          o.id === opFilter || 
          o.name === opFilter || 
          this.normalizeText(o.name) === opFilterNorm ||
          this.normalizeText(o.code) === opFilterNorm
        );

        let matchOpObj = false;
        if (opObj) {
          const opObjNameNorm = this.normalizeText(opObj.name);
          const opObjCodeNorm = this.normalizeText(opObj.code);
          matchOpObj = t.operationType === opObj.name || 
                       t.operationType === opObj.code || 
                       tOpNorm === opObjNameNorm || 
                       tOpNorm === opObjCodeNorm;
        }

        if (!matchDirect && !matchOpObj) return false;
      }

      // Robust Reconciliation Status Filtering
      if (filters.reconciliationStatus) {
        const statusFilterNorm = this.normalizeText(filters.reconciliationStatus);
        const tStatusNorm = this.normalizeText(t.reconciliationStatus || 'PENDENTE');
        if (t.reconciliationStatus !== filters.reconciliationStatus && tStatusNorm !== statusFilterNorm) {
          return false;
        }
      }

      if (filters.classificationStatus && t.classificationStatus !== filters.classificationStatus) return false;
      if (filters.statementId && t.statementId !== filters.statementId) return false;
      if (filters.origin && t.origin !== filters.origin) return false;
      if (filters.search) {
        const s = this.normalizeText(filters.search);
        const matchDesc = this.normalizeText(t.description).includes(s);
        const matchObs = t.observation ? this.normalizeText(t.observation).includes(s) : false;
        const matchOp = this.normalizeText(t.operationType).includes(s);
        const matchCat = t.categoryName ? this.normalizeText(t.categoryName).includes(s) : false;
        const matchDoc = t.externalId ? this.normalizeText(t.externalId).includes(s) : false;
        const matchFile = t.statementFileName ? this.normalizeText(t.statementFileName).includes(s) : false;
        if (!matchDesc && !matchObs && !matchOp && !matchCat && !matchDoc && !matchFile) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  public createTransaction(tx: Omit<Transaction, 'id' | 'importDate' | 'transactionHash'>, user: string): Transaction {
    const hash = this.generateHash(tx.date, tx.amount, tx.description, tx.bankAccountId);

    const account = this.getBankAccountById(tx.bankAccountId);
    const newTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`,
      bankAccountName: account?.accountName,
      bankName: account?.bankName,
      agency: account?.agency,
      importDate: new Date().toISOString(),
      transactionHash: hash
    };

    this.data.transactions.unshift(newTx);
    this.recalculateAllAccountBalances();
    this.logAudit(
      user,
      'CRIACAO',
      'TRANSACAO',
      newTx.id,
      `Criado lançamento manual: ${newTx.type} R$ ${newTx.amount.toFixed(2)} - ${newTx.description}`
    );
    this.saveDatabase();
    return newTx;
  }

  public updateTransaction(id: string, updates: Partial<Transaction>, user: string): Transaction | null {
    const idx = this.data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const old = { ...this.data.transactions[idx] };
    const updated = { ...old, ...updates };

    // If description changed or amount changed, regenerate hash
    if (updates.description || updates.amount || updates.date) {
      updated.transactionHash = this.generateHash(updated.date, updated.amount, updated.description, updated.bankAccountId);
    }

    // If user changed category or operation type, trigger smart learning
    if (
      (updates.categoryId && updates.categoryId !== old.categoryId) ||
      (updates.operationType && updates.operationType !== old.operationType)
    ) {
      this.learnFromUserCorrection(
        updated.description,
        updated.operationType,
        updated.categoryId,
        updated.subcategoryId,
        user
      );
    }

    this.data.transactions[idx] = updated;
    this.recalculateAllAccountBalances();
    this.logAudit(
      user,
      'EDICAO',
      'TRANSACAO',
      id,
      `Atualizado lançamento: ${updated.description} (Status: ${updated.reconciliationStatus})`,
      old as unknown as Record<string, unknown>,
      updates as Record<string, unknown>
    );
    this.saveDatabase();
    return updated;
  }

  public deleteTransaction(id: string, user: string): boolean {
    const idx = this.data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const deleted = this.data.transactions[idx];
    this.data.transactions.splice(idx, 1);
    this.recalculateAllAccountBalances();
    this.logAudit(user, 'EXCLUSAO', 'TRANSACAO', id, `Excluído lançamento: ${deleted.description} R$ ${deleted.amount}`);
    if (isSupabaseConfigured()) {
      deleteFromSupabase('transactions', id).catch(err => {
        console.error('[Supabase] Erro ao deletar transação no Supabase:', err);
      });
    }
    this.saveDatabase();
    return true;
  }

  public batchUpdateReconciliationStatus(ids: string[], status: string, user: string): number {
    const idSet = new Set(ids);
    let count = 0;
    for (const tx of this.data.transactions) {
      if (idSet.has(tx.id)) {
        tx.reconciliationStatus = status as any;
        count++;
      }
    }
    if (count > 0) {
      this.logAudit(
        user,
        'CONCILIACAO',
        'TRANSACAO',
        ids.slice(0, 5).join(',') + (ids.length > 5 ? ` e mais ${ids.length - 5}` : ''),
        `Status de conciliação atualizado para "${status}" em ${count} lançamento(s)`
      );
      this.saveDatabase();
    }
    return count;
  }

  // ===================== IMPORT & CONCILIAÇÃO ENGINE =====================
  public processImportPreview(
    rawRows: Array<{
      date: string;
      postingDate?: string;
      description: string;
      amount: number;
      type?: TransactionType;
      balanceAfter?: number;
      documentId?: string;
      sourceLineNumber?: number;
    }>,
    bankAccountId: string,
    extractedBalanceParam?: ExtractedStatementBalance
  ): ImportPreviewSummary {
    const account = this.getBankAccountById(bankAccountId);
    const extractedBalance: ExtractedStatementBalance = { ...(extractedBalanceParam || {}) };

    // Preload transactions for target bank account
    const existingTxList = this.data.transactions.filter(t => t.bankAccountId === bankAccountId);

    const items: ImportPreviewItem[] = [];
    let totalEntradas = 0;
    let totalSaidas = 0;
    let totalEntradasCount = 0;
    let totalSaidasCount = 0;

    let totalRecords = 0;
    let newRecords = 0;
    let duplicateRecords = 0;
    let errorRecords = 0;
    let autoClassifiedRecords = 0;
    let unclassifiedRecords = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      // If date is invalid or missing, exclude row
      if (!row.date || isNaN(new Date(row.date).getTime())) {
        continue;
      }
      
      const rawDesc = row.description ? row.description.trim() : '';
      const cleanDesc = rawDesc || (typeof row.balanceAfter === 'number' && !isNaN(row.balanceAfter) ? 'Saldo Inicial' : '');
      if (!cleanDesc || cleanDesc.length === 0) {
        continue;
      }

      const isBalRow = row.type === 'SALDO_INICIAL' || isStatementBalanceRow(cleanDesc);

      // Check if this row is a statement balance row (Saldo Anterior, Saldo Atual, Saldo do Dia, etc.)
      if (isBalRow) {
        const balVal = typeof row.balanceAfter === 'number' && !isNaN(row.balanceAfter) && row.balanceAfter !== 0
          ? row.balanceAfter
          : Math.abs(row.amount || 0);
        const descUpper = cleanDesc.toUpperCase();
        if (descUpper.includes('ANTERIOR') || descUpper.includes('INICIAL') || extractedBalance.initialBalance === undefined) {
          extractedBalance.initialBalance = balVal;
          extractedBalance.initialBalanceDate = row.date;
          extractedBalance.sourceDescription = cleanDesc;
        } else {
          if (extractedBalance.finalBalance === undefined) {
            extractedBalance.finalBalance = balVal;
            extractedBalance.finalBalanceDate = row.date;
          }
        }
        extractedBalance.sourceDescription = cleanDesc;
        // Set amount to 0 and type to SALDO_INICIAL so it stays as initial balance record without adding credit/debit
        row.amount = 0;
        row.type = 'SALDO_INICIAL';
        row.balanceAfter = balVal;
      } else if (typeof row.amount !== 'number' || isNaN(row.amount) || row.amount === 0) {
        // If amount is 0/empty, but balanceAfter is present, preserve row as amount = 0
        if (typeof row.balanceAfter === 'number' && !isNaN(row.balanceAfter)) {
          const isBal = isStatementBalanceRow(cleanDesc) || cleanDesc.toUpperCase().includes('SALDO') || cleanDesc.toUpperCase().includes('SDO');
          if (isBal && extractedBalance.initialBalance === undefined) {
            extractedBalance.initialBalance = row.balanceAfter;
            extractedBalance.initialBalanceDate = row.date;
            extractedBalance.sourceDescription = cleanDesc;
          }
          row.amount = 0;
          row.type = isBal ? 'SALDO_INICIAL' : 'ENTRADA';
        } else {
          continue;
        }
      }

      totalRecords++;

      const tempId = `prev_${Date.now()}_${i}`;
      let hasError = false;
      const errMsgs: string[] = [];
      const errorMessage = errMsgs.join('; ');

      const positiveAmount = Math.abs(row.amount || 0);
      const inferredType: 'ENTRADA' | 'SAIDA' | 'SALDO_INICIAL' = row.type === 'SALDO_INICIAL'
        ? 'SALDO_INICIAL'
        : (row.type === 'SAIDA' ? 'SAIDA' : (row.amount < 0 ? 'SAIDA' : 'ENTRADA'));

      if (inferredType === 'SALDO_INICIAL') {
        // Saldo Inicial NÃO é crédito, NÃO é receita, NÃO entra na Soma de Entradas nem Saídas!
      } else if (inferredType === 'ENTRADA') {
        totalEntradas += positiveAmount;
        totalEntradasCount++;
      } else {
        totalSaidas += positiveAmount;
        totalSaidasCount++;
      }

      const rowDate = (row.date || '').substring(0, 10);
      const normDesc = this.normalizeText(cleanDesc);
      const cleanDoc = row.documentId ? row.documentId.trim() : '';
      const normDoc = cleanDoc ? this.normalizeText(cleanDoc).replace(/\s+/g, '') : '';
      const sourceLineNumber = row.sourceLineNumber || i + 1;

      // Deterministic hash / fingerprint
      const hash = this.generateHash(rowDate, positiveAmount, cleanDesc, bankAccountId, inferredType, cleanDoc);

      let isDuplicate = false;
      let duplicateLevel: 'EXACT' | 'NO_DOCUMENT' | 'POSSIBLE' | 'FILE_INTERNAL' | 'SIMILAR' | 'NONE' = 'NONE';
      let duplicateMatchReason: 'DUPLICIDADE_EXATA' | 'POSSIVEL_DUPLICIDADE' | 'REGISTROS_SEMELHANTES' | 'DUPLICIDADE_INTERNA_ARQUIVO' | undefined;
      let duplicateSource: 'BANCO' | 'ARQUIVO' | undefined;
      let duplicateReason = '';
      let existingTransaction: Transaction | undefined;

      const allowsMultiple = this.isDuplicateAllowed(cleanDesc);

      if (inferredType !== 'SALDO_INICIAL') {
        // A. Compare against existing transactions in DB
        let exactDbMatch: Transaction | undefined;
        let noDocDbMatch: Transaction | undefined;
        let similarDocDbMatch: Transaction | undefined;

        for (const tx of existingTxList) {
          const txDate = (tx.date || '').substring(0, 10);
          const txNormDesc = tx.normalizedDescription || this.normalizeText(tx.description);
          const txAmount = Math.abs(tx.amount || 0);
          const txType = tx.type;
          const txDoc = tx.externalId ? tx.externalId.trim() : '';
          const txNormDoc = txDoc ? this.normalizeText(txDoc).replace(/\s+/g, '') : '';

          // 1. Data must match exactly (TESTE 4: Datas diferentes -> NÃO considerar duplicidade)
          if (txDate !== rowDate) continue;

          // 2. Normalized description must match
          if (txNormDesc !== normDesc) continue;

          // 3. Amount must match (TESTE 1: Mesma data + mesma descrição + valores diferentes -> NÃO são duplicados)
          const isSameAmount = Math.abs(txAmount - positiveAmount) < 0.005;
          if (!isSameAmount) continue;

          // 4. Type must match
          if (txType !== inferredType) continue;

          // Same Date, Desc, Amount, and Type!
          // Now inspect document
          const bothHaveDoc = Boolean(normDoc && txNormDoc);

          if (bothHaveDoc) {
            if (normDoc === txNormDoc) {
              // NÍVEL 1 — DUPLICIDADE EXATA COM DOCUMENTO (TESTE 5)
              exactDbMatch = tx;
              break;
            } else {
              // TESTE 3: Mesma data + mesma descrição + mesmo valor + documentos diferentes -> NÃO considerar duplicidade exata!
              similarDocDbMatch = tx;
            }
          } else {
            // NÍVEL 2 — SEM DOCUMENTO
            if (!allowsMultiple) {
              noDocDbMatch = tx;
            }
          }
        }

        const formattedDateBR = rowDate.split('-').reverse().join('/');
        const formattedAmountBR = positiveAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (exactDbMatch) {
          isDuplicate = true;
          duplicateLevel = 'EXACT';
          duplicateMatchReason = 'DUPLICIDADE_EXATA';
          duplicateSource = 'BANCO';
          duplicateReason = `Duplicidade exata: Lançamento de ${inferredType} R$ ${formattedAmountBR} em ${formattedDateBR} com documento "${cleanDoc}" já cadastrado no sistema.`;
          existingTransaction = exactDbMatch;
        } else if (noDocDbMatch) {
          isDuplicate = true;
          duplicateLevel = 'NO_DOCUMENT';
          duplicateMatchReason = 'DUPLICIDADE_EXATA';
          duplicateSource = 'BANCO';
          duplicateReason = `Duplicidade exata (sem documento): Lançamento de ${inferredType} R$ ${formattedAmountBR} em ${formattedDateBR} com mesmo valor e histórico já cadastrado no sistema.`;
          existingTransaction = noDocDbMatch;
        } else if (similarDocDbMatch) {
          // NÍVEL 3: Registros semelhantes com documentos diferentes
          // Não bloqueia a importação automaticamente (isDuplicate = false, selected = true)
          isDuplicate = false;
          duplicateLevel = 'SIMILAR';
          duplicateMatchReason = 'REGISTROS_SEMELHANTES';
          duplicateSource = 'BANCO';
          duplicateReason = `Registros semelhantes, mas não idênticos: Mesma data e valor, porém com números de documentos diferentes (Extrato: "${cleanDoc}" vs Sistema: "${similarDocDbMatch.externalId || similarDocDbMatch.id}").`;
          existingTransaction = similarDocDbMatch;
        }

        // B. Check DUPLICIDADE DENTRO DO PRÓPRIO ARQUIVO (ARQUIVO x ARQUIVO)
        // Regra: Duas linhas no mesmo extrato só são duplicatas se tiverem o MESMO NÚMERO DE DOCUMENTO NÃO-VAZIO.
        // Se os documentos forem diferentes ou não houver documento, são duas movimentações bancárias legítimas distintas.
        if (!isDuplicate && normDoc) {
          const priorItem = items.find(it => {
            if (it.type === 'SALDO_INICIAL') return false;
            const itDate = (it.date || '').substring(0, 10);
            const itNormDesc = it.normalizedDescription || this.normalizeText(it.description);
            const itAmount = Math.abs(it.amount || 0);
            const itType = it.type;

            if (itDate !== rowDate) return false;
            if (itNormDesc !== normDesc) return false;
            if (Math.abs(itAmount - positiveAmount) >= 0.005) return false;
            if (itType !== inferredType) return false;

            const itDoc = it.externalId ? it.externalId.trim() : '';
            const itNormDoc = itDoc ? this.normalizeText(itDoc).replace(/\s+/g, '') : '';

            // Só considera duplicado interno se ambos tiverem documento preenchido e IDÊNTICO
            return Boolean(normDoc && itNormDoc && normDoc === itNormDoc);
          });

          if (priorItem) {
            isDuplicate = true;
            duplicateLevel = 'FILE_INTERNAL';
            duplicateMatchReason = 'DUPLICIDADE_INTERNA_ARQUIVO';
            duplicateSource = 'ARQUIVO';
            duplicateReason = `Duplicidade interna no arquivo: Linha ${priorItem.sourceLineNumber || priorItem.fileRowIndex || 'anterior'} e Linha ${sourceLineNumber} possuem o mesmo número de documento ("${cleanDoc}").`;
            existingTransaction = {
              id: priorItem.id,
              date: priorItem.date,
              description: priorItem.description,
              amount: priorItem.amount,
              type: priorItem.type,
              externalId: priorItem.externalId,
              sourceLineNumber: priorItem.sourceLineNumber,
              bankAccountId: bankAccountId,
              bankAccountName: account?.accountName || '',
              categoryName: priorItem.categoryName || 'Não Classificado',
              reconciliationStatus: 'PENDENTE'
            } as Transaction;
          }
        }
      }

      // If existing transaction is already reconciled, clearly notify user
      if (existingTransaction && existingTransaction.reconciliationStatus === 'CONCILIADO') {
        duplicateReason += ' [AVISO: O lançamento existente já está CONCILIADO].';
      }

      // Classification
      let classification: {
        operationType: string;
        categoryId?: string;
        categoryName?: string;
        subcategoryId?: string;
        subcategoryName?: string;
        confidence: ConfidenceLevel;
        ruleId?: string;
      } = {
        operationType: 'NAO_CLASSIFICADO',
        categoryId: '',
        categoryName: '',
        subcategoryId: '',
        subcategoryName: '',
        confidence: 'BAIXA'
      };

      if (inferredType === 'SALDO_INICIAL') {
        classification = {
          operationType: 'Saldo Inicial / Anterior',
          categoryId: '',
          categoryName: 'Saldo Inicial',
          subcategoryId: '',
          subcategoryName: '',
          confidence: 'ALTA'
        };
      } else {
        classification = this.classifyDescription(cleanDesc, inferredType);
      }

      const isAuto = classification.operationType !== 'NAO_CLASSIFICADO';

      if (hasError) {
        errorRecords++;
      } else if (isDuplicate) {
        duplicateRecords++;
      } else {
        newRecords++;
      }

      if (isAuto) {
        autoClassifiedRecords++;
      } else {
        unclassifiedRecords++;
      }

      items.push({
        id: tempId,
        tempId,
        date: row.date,
        postingDate: row.postingDate || row.date,
        description: cleanDesc,
        normalizedDescription: normDesc,
        rawAmount: row.amount,
        amount: positiveAmount,
        type: inferredType,
        balanceAfter: row.balanceAfter,
        sourceLineNumber,
        fileRowIndex: sourceLineNumber,
        operationType: classification.operationType,
        categoryId: classification.categoryId,
        categoryName: classification.categoryName,
        subcategoryId: classification.subcategoryId,
        subcategoryName: classification.subcategoryName,
        confidence: classification.confidence,
        classificationStatus: isAuto ? 'CLASSIFICADO' : 'PENDENTE',
        isDuplicate,
        duplicateLevel,
        duplicateMatchReason,
        duplicateSource,
        duplicateReason,
        existingTransaction,
        forceImport: false,
        hasError,
        errorMessage,
        isAutoClassified: isAuto,
        selected: !hasError,
        externalId: cleanDoc || undefined,
        transactionHash: hash
      });
    }

    // If finalBalance wasn't extracted from a dedicated row, inspect the running balance of the last item
    if (extractedBalance.finalBalance === undefined && items.length > 0) {
      for (let idx = items.length - 1; idx >= 0; idx--) {
        if (typeof items[idx].balanceAfter === 'number' && !isNaN(items[idx].balanceAfter!)) {
          extractedBalance.finalBalance = items[idx].balanceAfter;
          extractedBalance.finalBalanceDate = items[idx].date;
          extractedBalance.sourceDescription = 'Saldo Final da Coluna de Saldo do Extrato';
          break;
        }
      }
    }

    return {
      totalRecords,
      newRecords,
      duplicateRecords,
      errorRecords,
      autoClassifiedRecords,
      unclassifiedRecords,
      totalEntradas,
      totalSaidas,
      totalEntradasCount,
      totalSaidasCount,
      detectedAccountName: account?.accountName,
      extractedBalance,
      items
    };
  }

  // Save confirmed import items to database
  public confirmImport(
    items: ImportPreviewItem[],
    bankAccountId: string,
    fileName: string,
    fileType: StatementFileType,
    user: string,
    fileSize?: number,
    extractedBalance?: ExtractedStatementBalance
  ): { count: number; statementId: string } {
    const account = this.getBankAccountById(bankAccountId);
    if (!account) throw new Error('Conta bancária não encontrada.');

    const statementId = `stmt_${Date.now()}`;
    const validItems = items.filter(it => it.selected && !it.hasError);

    const sortedDates = validItems.map(it => it.date).sort();
    const startDate = sortedDates[0] || new Date().toISOString().substring(0, 10);
    const endDate = sortedDates[sortedDates.length - 1] || startDate;

    let totalEntradasAmount = 0;
    let totalSaidasAmount = 0;
    let totalEntradasCount = 0;
    let totalSaidasCount = 0;

    const newTransactions: Transaction[] = [];

    for (const it of validItems) {
      if (it.type === 'SALDO_INICIAL') {
        // Saldo inicial não entra na soma de entradas nem saídas!
      } else if (it.type === 'TRANSFERENCIA_INTERNA') {
        // Transferência interna
      } else if (this.isEntradaTransaction(it)) {
        totalEntradasAmount += it.amount;
        totalEntradasCount++;
      } else {
        totalSaidasAmount += it.amount;
        totalSaidasCount++;
      }

      const txHash = it.transactionHash || this.generateHash(
        it.date,
        it.amount,
        it.description,
        bankAccountId,
        it.type,
        it.externalId
      );

      const tx: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`,
        statementId,
        statementFileName: fileName,
        bankAccountId,
        bankAccountName: account.accountName,
        bankName: account.bankName,
        agency: account.agency,
        date: it.date,
        postingDate: it.postingDate || it.date,
        competenceDate: it.date,
        description: it.description,
        normalizedDescription: it.normalizedDescription || this.normalizeText(it.description),
        amount: it.type === 'SALDO_INICIAL' ? 0 : it.amount,
        type: it.type,
        balanceAfter: it.balanceAfter,
        sourceLineNumber: it.sourceLineNumber || it.fileRowIndex,
        categoryId: it.categoryId,
        categoryName: it.categoryName,
        subcategoryId: it.subcategoryId,
        subcategoryName: it.subcategoryName,
        operationType: it.operationType,
        classificationStatus: it.isAutoClassified ? 'CLASSIFICADO' : (it.categoryId ? 'MANUAL' : 'PENDENTE'),
        origin: 'EXTRATO',
        reconciliationStatus: it.isDuplicate ? 'DUPLICADO' : 'PENDENTE',
        confidence: it.confidence,
        importDate: new Date().toISOString(),
        responsibleUser: user || 'Financeiro Supermercado',
        externalId: it.externalId,
        transactionHash: txHash,
        isDuplicateFlag: it.isDuplicate,
        duplicateReason: it.duplicateReason
      };
      newTransactions.push(tx);
    }

    // Add to DB
    this.data.transactions.unshift(...newTransactions);

    // Create BankStatement entry with isolated statement balance fields
    const statement: BankStatement = {
      id: statementId,
      bankAccountId,
      bankAccountName: account.accountName,
      fileName,
      fileType,
      fileSize,
      startDate,
      endDate,
      totalRecords: items.length,
      importedRecords: newTransactions.length,
      duplicateRecords: items.filter(i => i.isDuplicate).length,
      unclassifiedRecords: items.filter(i => i.operationType === 'NAO_CLASSIFICADO').length,
      totalEntradasCount,
      totalSaidasCount,
      totalEntradasAmount: Math.round(totalEntradasAmount * 100) / 100,
      totalSaidasAmount: Math.round(totalSaidasAmount * 100) / 100,
      importedByUserName: user,
      importedAt: new Date().toISOString(),
      initialBalance: extractedBalance?.initialBalance,
      initialBalanceDate: extractedBalance?.initialBalanceDate || startDate,
      finalBalance: extractedBalance?.finalBalance,
      finalBalanceDate: extractedBalance?.finalBalanceDate || endDate,
      balanceDate: extractedBalance?.finalBalanceDate || extractedBalance?.initialBalanceDate || endDate
    };
    this.data.bankStatements.unshift(statement);

    // Update account with statement balances if available - ALWAYS priority for current imported file
    if (extractedBalance?.initialBalance !== undefined) {
      account.initialStatementBalance = extractedBalance.initialBalance;
      account.initialBalance = extractedBalance.initialBalance;
      account.initialBalanceDate = extractedBalance.initialBalanceDate || startDate;
    }
    if (extractedBalance?.finalBalance !== undefined) {
      account.lastStatementBalance = extractedBalance.finalBalance;
      account.lastStatementBalanceDate = extractedBalance.finalBalanceDate || endDate;
    }

    this.recalculateAllAccountBalances();

    this.logAudit(
      user,
      'IMPORTACAO',
      'EXTRATO',
      statementId,
      `Importados ${newTransactions.length} lançamentos do arquivo ${fileName} (${fileType}) na conta ${account.accountName}`
    );

    this.saveDatabase();

    return { count: newTransactions.length, statementId };
  }

  // ===================== BANK STATEMENTS HISTORY & REVERSION =====================
  public getBankStatements(): BankStatement[] {
    return this.data.bankStatements || [];
  }

  public getBankStatementById(id: string): { statement: BankStatement; transactions: Transaction[] } | null {
    const statement = this.data.bankStatements.find(s => s.id === id);
    if (!statement) return null;
    const transactions = this.data.transactions.filter(t => t.statementId === id);
    return { statement, transactions };
  }

  public deleteBankStatement(id: string, user: string): boolean {
    const index = this.data.bankStatements.findIndex(s => s.id === id);
    if (index === -1) return false;

    const statement = this.data.bankStatements[index];
    const removedTxsCount = this.data.transactions.filter(t => t.statementId === id).length;
    this.data.transactions = this.data.transactions.filter(t => t.statementId !== id);
    this.data.bankStatements.splice(index, 1);

    this.recalculateAllAccountBalances();
    this.logAudit(
      user,
      'EXCLUSAO',
      'EXTRATO',
      id,
      `Removido lote de extrato ${statement.fileName} e revertidos ${removedTxsCount} lançamentos.`
    );
    this.saveDatabase();
    return true;
  }

  // ===================== MAPPING TEMPLATES =====================
  public getMappingTemplates(): BankMappingTemplate[] {
    return this.data.mappingTemplates || [];
  }

  public saveMappingTemplate(
    template: Omit<BankMappingTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    user: string
  ): BankMappingTemplate {
    if (!this.data.mappingTemplates) this.data.mappingTemplates = [];

    const existingIdx = this.data.mappingTemplates.findIndex(
      t => t.bankNameOrCode === template.bankNameOrCode && t.fileType === template.fileType
    );

    const now = new Date().toISOString();
    if (existingIdx !== -1) {
      const updated: BankMappingTemplate = {
        ...this.data.mappingTemplates[existingIdx],
        ...template,
        updatedAt: now
      };
      this.data.mappingTemplates[existingIdx] = updated;
      this.logAudit(user, 'EDICAO', 'REGRA', updated.id, `Atualizado modelo de mapeamento para ${template.templateName}`);
      this.saveDatabase();
      return updated;
    }

    const newTemplate: BankMappingTemplate = {
      ...template,
      id: `tmpl_${Date.now()}`,
      createdAt: now,
      updatedAt: now
    };
    this.data.mappingTemplates.unshift(newTemplate);
    this.logAudit(user, 'CRIACAO', 'REGRA', newTemplate.id, `Criado modelo de mapeamento: ${newTemplate.templateName}`);
    this.saveDatabase();
    return newTemplate;
  }

  public deleteMappingTemplate(id: string): boolean {
    if (!this.data.mappingTemplates) return false;
    const idx = this.data.mappingTemplates.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.data.mappingTemplates.splice(idx, 1);
    this.saveDatabase();
    return true;
  }

  // ===================== DASHBOARD METRICS & CHARTS =====================
  public getDashboardData(
    period: string = 'este-mes',
    startDateParam?: string,
    endDateParam?: string,
    bankAccountId?: string,
    dateSortOrder: 'asc' | 'desc' = 'desc'
  ): DashboardResponse {
    let start = '';
    let end = '';
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);

    if (period === 'hoje') {
      start = todayStr;
      end = todayStr;
    } else if (period === 'ontem') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = y.toISOString().substring(0, 10);
      end = start;
    } else if (period === 'ultimos-7-dias') {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 6);
      start = d7.toISOString().substring(0, 10);
      end = todayStr;
    } else if (period === 'ultimos-30-dias') {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 29);
      start = d30.toISOString().substring(0, 10);
      end = todayStr;
    } else if (period === 'este-mes') {
      start = `${todayStr.substring(0, 7)}-01`;
      end = todayStr;
    } else if (period === 'mes-anterior') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      start = prev.toISOString().substring(0, 10);
      end = lastDayPrev.toISOString().substring(0, 10);
    } else if (period === 'este-ano') {
      start = `${now.getFullYear()}-01-01`;
      end = todayStr;
    } else if (period === 'todos') {
      start = '2000-01-01';
      end = '2099-12-31';
    } else if (period === 'personalizado' && startDateParam && endDateParam) {
      start = startDateParam;
      end = endDateParam;
    } else {
      // Default to August/September 2026 data range so charts have rich seed data visible!
      start = '2026-08-01';
      end = '2026-09-30';
    }

    // Filter transactions
    const filteredTxs = this.data.transactions.filter(t => {
      if (t.date < start || t.date > end) return false;
      if (bankAccountId && t.bankAccountId !== bankAccountId) return false;
      return true;
    });

    // Current consolidated balance
    let currentBalance = 0;
    if (bankAccountId) {
      const acc = this.getBankAccountById(bankAccountId);
      currentBalance = acc ? acc.currentBalance : 0;
    } else {
      currentBalance = this.data.bankAccounts
        .filter(a => a.isActive)
        .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    }

    // Totals calculations
    let totalEntradas = 0;
    let totalSaidas = 0;
    let transferenciasCount = 0;
    let transferenciasSum = 0;
    let totalPix = 0;
    let totalCartaoDebito = 0;
    let totalCartaoCredito = 0;
    let totalDinheiro = 0;
    let totalPagamentosSaidas = 0;
    let totalTransferencias = 0;
    let totalTarifasBancarias = 0;
    let totalDepositos = 0;
    let totalBoletosPagos = 0;
    let totalOutrasOperacoes = 0;

    let entradasCount = 0;
    let saidasCount = 0;

    let maiorEntrada: { description: string; amount: number; date: string } | null = null;
    let maiorSaida: { description: string; amount: number; date: string } | null = null;

    const daysMap: Record<string, { entradas: number; saidas: number }> = {};
    const monthsMap: Record<string, { entradas: number; saidas: number }> = {};
    const opDistributionMap: Record<string, { count: number; total: number }> = {};
    const catExpensesMap: Record<string, number> = {};
    const paymentMethodsMap: Record<string, { count: number; total: number }> = {
      PIX: { count: 0, total: 0 },
      'Cartão de Débito': { count: 0, total: 0 },
      'Cartão de Crédito': { count: 0, total: 0 },
      Dinheiro: { count: 0, total: 0 },
      'Outros Recebimentos': { count: 0, total: 0 }
    };

    for (const t of filteredTxs) {
      const amt = Math.abs(Number(t.amount) || 0);

      if (t.type === 'TRANSFERENCIA_INTERNA' || t.type === 'SALDO_INICIAL') {
        if (t.type === 'TRANSFERENCIA_INTERNA') {
          transferenciasCount++;
          transferenciasSum += amt;
        }
        continue; // Exclude from revenue and expense totals
      }

      const isEntrada = this.isEntradaTransaction(t);

      if (isEntrada) {
        totalEntradas += amt;
        entradasCount++;
        if (!maiorEntrada || amt > maiorEntrada.amount) {
          maiorEntrada = { description: t.description, amount: amt, date: t.date };
        }
      } else {
        totalSaidas += amt;
        saidasCount++;
        totalPagamentosSaidas += amt;
        if (!maiorSaida || amt > maiorSaida.amount) {
          maiorSaida = { description: t.description, amount: amt, date: t.date };
        }
      }

      // Categorization for specific KPI cards requested
      const op = t.operationType || '';
      const cat = t.categoryName || '';
      const normDesc = (op + ' ' + cat).toUpperCase();

      if (normDesc.includes('PIX') || op === 'PIX') {
        if (isEntrada) totalPix += amt;
        else totalPagamentosSaidas += amt;
      } else if (normDesc.includes('CARTAO') || normDesc.includes('CARTÃO') || op === 'CARTAO_DEBITO' || op === 'CARTAO_CREDITO') {
        if (normDesc.includes('CREDITO') || normDesc.includes('CRÉDITO')) {
          totalCartaoCredito += amt;
        } else {
          totalCartaoDebito += amt;
        }
      } else if (normDesc.includes('DINHEIRO') || op === 'DINHEIRO') {
        totalDinheiro += amt;
      } else if (normDesc.includes('TRANSF') || normDesc.includes('TED') || normDesc.includes('DOC') || op === 'TED' || op === 'DOC') {
        totalTransferencias += amt;
      } else if (normDesc.includes('TARIFA') || normDesc.includes('TAXA') || op === 'TARIFA_BANCARIA' || op === 'TAXAS_TARIFAS') {
        totalTarifasBancarias += amt;
      } else if (normDesc.includes('DEPOSITO') || normDesc.includes('DEPÓSITO') || op === 'DEPOSITO') {
        totalDepositos += amt;
      } else if (normDesc.includes('BOLETO') || normDesc.includes('COBRANCA') || normDesc.includes('COBRANÇA') || op === 'BOLETO') {
        if (isEntrada) totalPix += 0;
        else totalBoletosPagos += amt;
      } else {
        totalOutrasOperacoes += amt;
      }

      // Group by Day
      if (!daysMap[t.date]) {
        daysMap[t.date] = { entradas: 0, saidas: 0 };
      }
      if (isEntrada) daysMap[t.date].entradas += amt;
      else daysMap[t.date].saidas += amt;

      // Group by Month (YYYY-MM)
      const monthKey = t.date.substring(0, 7);
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { entradas: 0, saidas: 0 };
      }
      if (isEntrada) monthsMap[monthKey].entradas += amt;
      else monthsMap[monthKey].saidas += amt;

      // Distribution by operation type / category (receipts)
      if (isEntrada) {
        const opName = t.categoryName || t.operationType || 'Outras Entradas';
        if (!opDistributionMap[opName]) {
          opDistributionMap[opName] = { count: 0, total: 0 };
        }
        opDistributionMap[opName].count++;
        opDistributionMap[opName].total += amt;

        // Payment Comparison
        if (opName.includes('Pix') || op === 'PIX') {
          paymentMethodsMap.PIX.count++;
          paymentMethodsMap.PIX.total += amt;
        } else if (opName.includes('Cartão') || opName.includes('Cartao')) {
          paymentMethodsMap['Cartão de Débito'].count++;
          paymentMethodsMap['Cartão de Débito'].total += amt;
        } else if (opName.includes('Dinheiro') || op === 'DINHEIRO') {
          paymentMethodsMap.Dinheiro.count++;
          paymentMethodsMap.Dinheiro.total += amt;
        } else {
          paymentMethodsMap['Outros Recebimentos'].count++;
          paymentMethodsMap['Outros Recebimentos'].total += amt;
        }
      }

      // Expenses by Category
      if (!isEntrada) {
        const catName = t.categoryName || t.operationType || 'Despesas Gerais';
        catExpensesMap[catName] = (catExpensesMap[catName] || 0) + amt;
      }
    }

    const resultadoFinanceiro = Math.round((totalEntradas - totalSaidas) * 100) / 100;
    totalEntradas = Math.round(totalEntradas * 100) / 100;
    totalSaidas = Math.round(totalSaidas * 100) / 100;

    // Days unique count for averages
    const uniqueDays = Object.keys(daysMap).length || 1;
    const mediaDiariaEntradas = Math.round((totalEntradas / uniqueDays) * 100) / 100;
    const mediaDiariaSaidas = Math.round((totalSaidas / uniqueDays) * 100) / 100;
    const ticketMedioEntradas = entradasCount > 0 ? Math.round((totalEntradas / entradasCount) * 100) / 100 : 0;
    const ticketMedioSaidas = saidasCount > 0 ? Math.round((totalSaidas / saidasCount) * 100) / 100 : 0;

    const metrics: DashboardMetrics = {
      currentBalance,
      totalEntradas,
      totalSaidas,
      resultadoFinanceiro,
      totalPix,
      totalCartaoDebito,
      totalCartaoCredito,
      totalDinheiro,
      totalPagamentosSaidas,
      totalTransferencias,
      totalTarifasBancarias,
      totalDepositos,
      totalBoletosPagos,
      totalOutrasOperacoes,
      totalTransactionsCount: filteredTxs.length,
      entradasCount,
      saidasCount,
      transferenciasCount,
      transferenciasSum: Math.round(transferenciasSum * 100) / 100,
      ticketMedioEntradas,
      ticketMedioSaidas,
      maiorEntrada,
      maiorSaida,
      mediaDiariaEntradas,
      mediaDiariaSaidas
    };

    // Build sorted days chart using Centralized Consolidated Balance Calculation Engine
    const consResult = calculateConsolidatedBalance(this.data.transactions, {
      startDate: start,
      endDate: end,
      bankAccountId,
      fallbackInitialBalance: currentBalance - (totalEntradas - totalSaidas)
    });

    const daysChart: ChartDayData[] = consResult.days.map(d => ({
      date: d.date,
      formattedDate: d.formattedDate,
      saldoAnterior: d.saldoAnterior,
      entradas: d.creditos,
      saidas: d.debitos,
      resultado: d.saldoConsolidado,
      resultadoOperacional: d.resultadoOperacional,
      saldoAcumulado: d.saldoConsolidado,
      saldoExtratoInformado: d.saldoExtratoInformado,
      hasDivergence: d.hasDivergence,
      divergenceAmount: d.divergenceAmount
    }));

    // Build months chart
    const sortedMonths = Object.keys(monthsMap).sort();
    const monthsChart: ChartMonthData[] = sortedMonths.map(m => {
      const parts = m.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthLabel = `${monthNames[parseInt(parts[1], 10) - 1]}/${parts[0].slice(2)}`;
      return {
        month: monthLabel,
        entradas: Math.round(monthsMap[m].entradas * 100) / 100,
        saidas: Math.round(monthsMap[m].saidas * 100) / 100,
        resultado: Math.round((monthsMap[m].entradas - monthsMap[m].saidas) * 100) / 100
      };
    });

    // Operation / Category distribution for receipts
    const receiptsByOperation: OperationDistribution[] = Object.keys(opDistributionMap).map(opKey => {
      const item = opDistributionMap[opKey];
      const pct = totalEntradas > 0 ? (item.total / totalEntradas) * 100 : 0;
      return {
        operationType: opKey,
        count: item.count,
        total: Math.round(item.total * 100) / 100,
        percentage: Math.round(pct * 10) / 10
      };
    }).sort((a, b) => b.total - a.total);

    // Expenses by category
    const catColors = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b', '#10b981'];
    const expensesByCategory: CategoryDistribution[] = Object.keys(catExpensesMap).map((catName, idx) => {
      const val = catExpensesMap[catName];
      const pct = totalSaidas > 0 ? (val / totalSaidas) * 100 : 0;
      return {
        name: catName,
        value: Math.round(val * 100) / 100,
        percentage: Math.round(pct * 10) / 10,
        color: catColors[idx % catColors.length]
      };
    }).sort((a, b) => b.value - a.value);

    // Comprehensive Categories Breakdown reflecting all implemented categories
    // UNIFICATION GUARANTEE: Every transaction in filteredTxs (excluding TRANSFERENCIA_INTERNA)
    // belongs to EXACTLY ONE category in categoriesBreakdown so that sum(categories) === totalEntradas / totalSaidas.
    const categoryAssignmentsMap = new Map<string, Transaction[]>();
    const systemCategories = [...this.data.categories];

    // Initialize map keys for existing categories
    systemCategories.forEach(cat => categoryAssignmentsMap.set(cat.id, []));

    // Fallback categories for unclassified / unmatched transactions
    const fallbackEntradaCat: Category = {
      id: 'cat_outras_entradas',
      name: 'Outras Entradas / Não Categorizado',
      type: 'ENTRADA',
      icon: 'TrendingUp',
      color: '#10b981',
      isSystem: true,
      subcategories: []
    };

    const fallbackSaidaCat: Category = {
      id: 'cat_outras_saidas',
      name: 'Outras Saídas / Não Categorizadas',
      type: 'SAIDA',
      icon: 'TrendingDown',
      color: '#ef4444',
      isSystem: true,
      subcategories: []
    };

    categoryAssignmentsMap.set(fallbackEntradaCat.id, []);
    categoryAssignmentsMap.set(fallbackSaidaCat.id, []);

    // Assign every transaction to EXACTLY ONE category
    for (const t of filteredTxs) {
      if (t.type === 'TRANSFERENCIA_INTERNA' || t.type === 'SALDO_INICIAL') continue;

      const isEntrada = this.isEntradaTransaction(t);
      const targetType = isEntrada ? 'ENTRADA' : 'SAIDA';

      // Attempt to find matching category of correct type
      let matchedCat = systemCategories.find(cat => {
        if (cat.type !== targetType) return false;
        const catNorm = this.normalizeText(cat.name);
        if (t.categoryId && t.categoryId === cat.id) return true;
        if (t.categoryName && this.normalizeText(t.categoryName) === catNorm) return true;
        if (t.operationType && this.normalizeText(t.operationType) === catNorm) return true;
        return false;
      });

      if (!matchedCat) {
        // Fallback category if no category matched
        matchedCat = isEntrada ? fallbackEntradaCat : fallbackSaidaCat;
      }

      categoryAssignmentsMap.get(matchedCat.id)!.push(t);
    }

    // Build categories list (include fallback categories if they have transactions)
    const allCategoriesToRender = [...systemCategories];
    if (categoryAssignmentsMap.get(fallbackEntradaCat.id)!.length > 0) {
      allCategoriesToRender.push(fallbackEntradaCat);
    }
    if (categoryAssignmentsMap.get(fallbackSaidaCat.id)!.length > 0) {
      allCategoriesToRender.push(fallbackSaidaCat);
    }

    const categoriesBreakdown = allCategoriesToRender.map(cat => {
      const matchingTxs = categoryAssignmentsMap.get(cat.id) || [];
      const total = matchingTxs.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
      const count = matchingTxs.length;
      const baseTotal = cat.type === 'ENTRADA' ? totalEntradas : totalSaidas;
      const percentage = baseTotal > 0 ? (total / baseTotal) * 100 : 0;

      const assignedSubTxs = new Set<string>();
      const subcategories = (cat.subcategories || []).map(sub => {
        const subNorm = this.normalizeText(sub.name);
        const subTxs = matchingTxs.filter(t => {
          if (t.subcategoryId && t.subcategoryId === sub.id) return true;
          if (t.subcategoryName && this.normalizeText(t.subcategoryName) === subNorm) return true;
          return false;
        });
        subTxs.forEach(st => assignedSubTxs.add(st.id));
        const subTotal = subTxs.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
        return {
          id: sub.id,
          name: sub.name,
          total: Math.round(subTotal * 100) / 100,
          count: subTxs.length
        };
      });

      // Add unclassified subcategory if some transactions in this category didn't match subcategories
      const remainingSubTxs = matchingTxs.filter(t => !assignedSubTxs.has(t.id));
      if (remainingSubTxs.length > 0 && subcategories.length > 0) {
        const remTotal = remainingSubTxs.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
        subcategories.push({
          id: `${cat.id}_sub_outros`,
          name: 'Outras / Diversos',
          total: Math.round(remTotal * 100) / 100,
          count: remainingSubTxs.length
        });
      }

      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        total: Math.round(total * 100) / 100,
        count,
        percentage: Math.round(percentage * 10) / 10,
        subcategories
      };
    });

    // Payment comparison
    const paymentComparison: PaymentComparison[] = Object.keys(paymentMethodsMap).map(name => {
      const pm = paymentMethodsMap[name];
      const pct = totalEntradas > 0 ? (pm.total / totalEntradas) * 100 : 0;
      return {
        name,
        value: Math.round(pm.total * 100) / 100,
        percentage: Math.round(pct * 10) / 10,
        count: pm.count
      };
    }).sort((a, b) => b.value - a.value);

    // Statement Balances Summary (Conferência de Saldos dos Extratos Bancários)
    const activeAccounts = this.data.bankAccounts.filter(a => a.isActive);
    const targetAccounts = bankAccountId
      ? activeAccounts.filter(a => a.id === bankAccountId)
      : activeAccounts;

    const statementBalanceRecords: StatementBalanceRecord[] = targetAccounts.map(acc => {
      // Find the most recent statement for this account that has balance information
      const accountStatements = (this.data.bankStatements || [])
        .filter(s => s.bankAccountId === acc.id)
        .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());

      const latestWithBal = accountStatements.find(s => typeof s.finalBalance === 'number');

      const hasDirectBal = typeof acc.lastStatementBalance === 'number';
      const statementBal = hasDirectBal
        ? acc.lastStatementBalance!
        : (latestWithBal && typeof latestWithBal.finalBalance === 'number' ? latestWithBal.finalBalance : acc.currentBalance);

      const balDate = acc.lastStatementBalanceDate || latestWithBal?.balanceDate || latestWithBal?.endDate || todayStr;
      const sysBal = acc.currentBalance || 0;
      const diff = Math.round((sysBal - statementBal) * 100) / 100;
      const status: 'CONCILIADO' | 'DIVERGENTE' | 'SEM_EXTRATO' =
        (!hasDirectBal && !latestWithBal)
          ? 'SEM_EXTRATO'
          : (Math.abs(diff) < 0.01 ? 'CONCILIADO' : 'DIVERGENTE');

      const isReconciled = Math.abs(diff) < 0.01;
      const hasStatement = hasDirectBal || Boolean(latestWithBal);

      return {
        bankAccountId: acc.id,
        bankAccountName: acc.accountName,
        bankName: acc.bankName,
        accountType: acc.accountType,
        agency: acc.agency,
        accountNumber: acc.accountNumber,
        color: acc.color,
        statementFileName: latestWithBal?.fileName,
        statementDate: balDate,
        statementBalance: Math.round(statementBal * 100) / 100,
        initialStatementBalance: acc.initialStatementBalance,
        calculatedBalance: Math.round(sysBal * 100) / 100,
        difference: diff,
        isReconciled,
        hasStatement,
        lastImportedAt: latestWithBal?.importedAt
      };
    });

    if (dateSortOrder === 'desc') {
      statementBalanceRecords.sort((a, b) => (b.statementDate || '').localeCompare(a.statementDate || ''));
    } else {
      statementBalanceRecords.sort((a, b) => (a.statementDate || '').localeCompare(b.statementDate || ''));
    }

    const totalStatementBalance = Math.round(statementBalanceRecords.reduce((sum, r) => sum + r.statementBalance, 0) * 100) / 100;
    const totalCalculatedBalance = Math.round(statementBalanceRecords.reduce((sum, r) => sum + r.calculatedBalance, 0) * 100) / 100;
    const totalDifference = Math.round((totalCalculatedBalance - totalStatementBalance) * 100) / 100;
    const reconciledAccountsCount = statementBalanceRecords.filter(r => r.hasStatement && r.isReconciled).length;

    const statementBalancesSummary: StatementBalancesSummary = {
      totalStatementBalance,
      totalCalculatedBalance,
      totalDifference,
      reconciledAccountsCount,
      totalAccountsCount: statementBalanceRecords.length
    };

    const sortedPeriodTxs = [...filteredTxs].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return dateSortOrder === 'desc' ? -cmp : cmp;
    });

    return {
      metrics,
      daysChart,
      monthsChart,
      receiptsByOperation,
      expensesByCategory,
      categoriesBreakdown,
      balanceEvolution: daysChart,
      paymentComparison,
      statementBalances: statementBalanceRecords,
      statementBalancesSummary,
      periodTransactions: sortedPeriodTxs
    };
  }

  // ===================== DAILY MOVEMENT VIEW =====================
  public getDailyMovement(targetDate: string, bankAccountId?: string): DailyMovementGroup {
    const txs = this.data.transactions.filter(t => {
      if (t.date !== targetDate) return false;
      if (bankAccountId && t.bankAccountId !== bankAccountId) return false;
      return true;
    });

    // Calculate saldo anterior by summing all transactions before targetDate + initial balances
    let saldoAnterior = 0;
    if (bankAccountId) {
      const acc = this.getBankAccountById(bankAccountId);
      saldoAnterior = Number(acc?.initialBalance) || 0;
    } else {
      saldoAnterior = this.data.bankAccounts
        .filter(a => a.isActive)
        .reduce((sum, a) => sum + (Number(a.initialBalance) || 0), 0);
    }

    const priorTxs = this.data.transactions.filter(t => {
      if (t.date >= targetDate) return false;
      if (bankAccountId && t.bankAccountId !== bankAccountId) return false;
      return true;
    });

    for (const pt of priorTxs) {
      if (this.isEntradaTransaction(pt)) saldoAnterior += Number(pt.amount);
      else saldoAnterior -= Number(pt.amount);
    }

    const entradas: DailyMovementGroup['entradas'] = [];
    const saidas: DailyMovementGroup['saidas'] = [];
    let totalEntradas = 0;
    let totalSaidas = 0;

    for (const t of txs) {
      const amt = Number(t.amount);
      if (this.isEntradaTransaction(t)) {
        totalEntradas += amt;
        entradas.push({
          operationType: t.operationType,
          description: t.description,
          amount: amt,
          category: t.categoryName || 'Vendas'
        });
      } else {
        totalSaidas += amt;
        saidas.push({
          category: t.categoryName || 'Despesas',
          description: t.description,
          amount: amt,
          operationType: t.operationType
        });
      }
    }

    const resultadoDia = saldoAnterior + totalEntradas - totalSaidas;
    const saldoFinal = saldoAnterior + totalEntradas - totalSaidas;

    const parts = targetDate.split('-');
    const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

    return {
      date: targetDate,
      formattedDate,
      saldoAnterior: Math.round(saldoAnterior * 100) / 100,
      entradas,
      totalEntradas: Math.round(totalEntradas * 100) / 100,
      saidas,
      totalSaidas: Math.round(totalSaidas * 100) / 100,
      resultadoDia: Math.round(resultadoDia * 100) / 100,
      saldoFinal: Math.round(saldoFinal * 100) / 100,
      transactions: txs
    };
  }
}

export const db = new SupermarketDatabase();
