import {
  BankAccount,
  Category,
  ClassificationRule,
  DashboardResponse,
  DailyMovementGroup,
  ImportPreviewItem,
  ImportPreviewSummary,
  OperationTypeInfo,
  Transaction,
  BankStatement,
  BankMappingTemplate,
  ColumnMapping,
  StatementFileType,
  TabularAnalysis
} from '../types';

const API_BASE = '/api';

/**
 * Helper robusto para ler a resposta de API e tratar retornos não-JSON (ex: HTML 404/500 do Vercel)
 */
async function parseJsonResponse<T = any>(res: Response, defaultErrorMsg: string = 'Erro na requisição'): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!res.ok) {
    if (contentType.includes('application/json')) {
      try {
        const err = JSON.parse(text);
        throw new Error(err.error || err.message || `${defaultErrorMsg} (Código ${res.status})`);
      } catch (e: any) {
        if (e.message && !e.message.includes('JSON')) throw e;
      }
    }
    if (text.includes('The page could not be found') || text.includes('<!DOCTYPE html>')) {
      throw new Error(`Rota de API não encontrada no Vercel (Status ${res.status}). Verifique se as funções Serverless da pasta /api foram implantadas.`);
    }
    throw new Error(`${defaultErrorMsg} (${res.status}): ${text.slice(0, 100)}`);
  }

  if (!contentType.includes('application/json')) {
    if (text.includes('The page could not be found') || text.includes('<!DOCTYPE html>')) {
      throw new Error('A requisição de API retornou uma página HTML (404/Redirect) em vez de dados JSON. Certifique-se de configurar a rota /api no Vercel.');
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Resposta de API inválida (esperava JSON, mas recebeu: "${text.slice(0, 40)}...")`);
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Erro ao converter resposta em JSON.');
  }
}


let currentAccessToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  currentAccessToken = token;
}

export function getApiAuthToken(): string | null {
  return currentAccessToken;
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (currentAccessToken && !headers.has("Authorization")) {
    headers.set("Authorization", "Bearer " + currentAccessToken);
  }
  return fetch(input, {
    ...init,
    headers
  });
}

export const apiService = {
  // Bank Accounts
  async getAccounts(): Promise<{ accounts: BankAccount[]; consolidatedBalance: number }> {
    const res = await authFetch(`${API_BASE}/accounts`);
    return await parseJsonResponse(res, 'Erro ao carregar contas bancárias');
  },

  async createAccount(acc: Partial<BankAccount>, userName: string): Promise<BankAccount> {
    const res = await authFetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...acc, userName })
    });
    const data = await parseJsonResponse(res, 'Erro ao cadastrar conta bancária');
    return data.account;
  },

  async updateAccount(id: string, updates: Partial<BankAccount>, userName: string): Promise<BankAccount> {
    const res = await authFetch(`${API_BASE}/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, userName })
    });
    const data = await parseJsonResponse(res, 'Erro ao atualizar conta bancária');
    return data.account;
  },

  // Categories & Operation Types
  async getCategories(): Promise<Category[]> {
    const res = await authFetch(`${API_BASE}/categories`);
    const data = await parseJsonResponse(res, 'Erro ao carregar categorias');
    return data.categories || [];
  },

  async createCategory(name: string, type: 'ENTRADA' | 'SAIDA', subcategories: string[], userName: string): Promise<Category> {
    const res = await authFetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, subcategories, userName })
    });
    const data = await parseJsonResponse(res, 'Erro ao criar categoria');
    return data.category;
  },

  async getOperationTypes(): Promise<OperationTypeInfo[]> {
    const res = await authFetch(`${API_BASE}/operation-types`);
    const data = await parseJsonResponse(res, 'Erro ao carregar tipos de operação');
    return data.operationTypes || [];
  },

  // Classification Rules
  async getRules(): Promise<ClassificationRule[]> {
    const res = await authFetch(`${API_BASE}/rules`);
    const data = await parseJsonResponse(res, 'Erro ao carregar regras de classificação');
    return data.rules || [];
  },

  async testRule(description: string, type: 'ENTRADA' | 'SAIDA' = 'ENTRADA'): Promise<{
    operationType: string;
    categoryId?: string;
    categoryName?: string;
    subcategoryId?: string;
    subcategoryName?: string;
    confidence: 'ALTA' | 'MEDIA' | 'BAIXA';
    ruleId?: string;
  }> {
    const res = await authFetch(`${API_BASE}/rules/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, type })
    });
    const data = await parseJsonResponse(res, 'Erro ao testar regra');
    return data.result;
  },

  async createRule(ruleData: Partial<ClassificationRule>, userName: string): Promise<ClassificationRule> {
    const res = await authFetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ruleData, userName })
    });
    const data = await parseJsonResponse(res, 'Erro ao criar regra de classificação');
    return data.rule;
  },

  async allowDuplicateForKeyword(data: {
    keyword: string;
    operationType?: string;
    categoryId?: string;
    categoryName?: string;
    userName?: string;
  }): Promise<ClassificationRule> {
    const res = await authFetch(`${API_BASE}/rules/allow-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await parseJsonResponse(res, 'Erro ao criar regra de duplicidade');
    return json.rule;
  },

  async deleteRule(id: string, userName: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/rules/${id}?user=${encodeURIComponent(userName)}`, {
      method: 'DELETE'
    });
    await parseJsonResponse(res, 'Erro ao excluir regra');
  },

  async applyRulesToExisting(userName: string = 'Administrador'): Promise<{ updatedCount: number }> {
    const res = await authFetch(`${API_BASE}/rules/apply-to-existing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName })
    });
    return await parseJsonResponse(res, 'Erro ao aplicar regras aos lançamentos existentes');
  },

  // Transactions
  async getTransactions(params: Record<string, string | undefined> = {}): Promise<{ transactions: Transaction[]; total: number }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, v);
    });
    const res = await authFetch(`${API_BASE}/transactions?${query.toString()}`);
    return await parseJsonResponse(res, 'Erro ao carregar lançamentos');
  },

  async batchCategorizeTransactions(data: {
    transactionIds: string[];
    categoryId?: string;
    categoryName?: string;
    subcategoryId?: string;
    subcategoryName?: string;
    operationType: string;
    createRule?: boolean;
    ruleKeyword?: string;
    applyToAllSimilar?: boolean;
    allowMultipleSameDay?: boolean;
    userName?: string;
  }): Promise<{ updatedCount: number; ruleCreated?: ClassificationRule; similarUpdatedCount?: number }> {
    const res = await authFetch(`${API_BASE}/transactions/batch-categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await parseJsonResponse(res, 'Erro ao categorizar lançamentos');
  },

  async createTransaction(txData: Partial<Transaction>, userName: string): Promise<Transaction> {
    const res = await authFetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...txData, userName })
    });
    const data = await parseJsonResponse(res, 'Erro ao salvar lançamento');
    return data.transaction;
  },

  async updateTransaction(id: string, updates: Partial<Transaction>, userName: string): Promise<Transaction> {
    const res = await authFetch(`${API_BASE}/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, userName })
    });
    const data = await parseJsonResponse(res, 'Erro ao atualizar lançamento');
    return data.transaction;
  },

  async deleteTransaction(id: string, userName: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/transactions/${id}?user=${encodeURIComponent(userName)}`, {
      method: 'DELETE'
    });
    await parseJsonResponse(res, 'Erro ao excluir lançamento');
  },

  async batchReconcile(transactionIds: string[], action: 'CONCILIAR' | 'PENDENTE' | 'SUSPEITO', userName: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/reconciliation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds, action, userName })
    });
    await parseJsonResponse(res, 'Erro ao alterar conciliação em lote');
  },

  // Statement Import & Standardization
  async analyzeImport(payload: {
    fileContent?: string;
    fileBase64?: string;
    fileName: string;
    fileType: StatementFileType;
    bankAccountId?: string;
  }): Promise<{
    fileType: StatementFileType;
    canDirectPreview: boolean;
    totalLinesDetected?: number;
    extractedTextPreview?: string;
    warning?: string;
    message?: string;
    analysis?: TabularAnalysis;
    matchingSavedTemplate?: BankMappingTemplate;
  }> {
    const res = await authFetch(`${API_BASE}/import/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await parseJsonResponse(res, 'Erro ao analisar estrutura do extrato');
  },

  async processImportPreview(payload: {
    fileContent?: string;
    fileBase64?: string;
    fileName: string;
    fileType: string;
    bankAccountId: string;
    customMapping?: ColumnMapping;
  }): Promise<{ preview: ImportPreviewSummary; fileName: string; fileType: string }> {
    const res = await authFetch(`${API_BASE}/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await parseJsonResponse(res, 'Erro ao processar arquivo de extrato');
  },

  async confirmImport(payload: {
    items: ImportPreviewItem[];
    bankAccountId: string;
    fileName: string;
    fileType: string;
    userName: string;
    fileSize?: number;
    extractedBalance?: any;
  }): Promise<{ success: boolean; importedCount: number; statementId: string; message: string }> {
    const res = await authFetch(`${API_BASE}/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await parseJsonResponse(res, 'Erro ao confirmar importação');
  },

  // Mapping Templates
  async getMappingTemplates(): Promise<BankMappingTemplate[]> {
    const res = await authFetch(`${API_BASE}/mapping-templates`);
    const data = await parseJsonResponse(res, 'Erro ao carregar modelos de mapeamento');
    return data.templates || [];
  },

  async saveMappingTemplate(
    template: Omit<BankMappingTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    userName: string
  ): Promise<BankMappingTemplate> {
    const res = await authFetch(`${API_BASE}/mapping-templates?user=${encodeURIComponent(userName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template)
    });
    const data = await parseJsonResponse(res, 'Erro ao salvar modelo de mapeamento');
    return data.template;
  },

  async deleteMappingTemplate(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/mapping-templates/${id}`, { method: 'DELETE' });
    await parseJsonResponse(res, 'Erro ao remover modelo de mapeamento');
  },

  // Bank Statements History & Reversion
  async getBankStatements(): Promise<BankStatement[]> {
    const res = await authFetch(`${API_BASE}/statements`);
    const data = await parseJsonResponse(res, 'Erro ao carregar extratos importados');
    return data.statements || [];
  },

  async getBankStatementById(id: string): Promise<{ statement: BankStatement; transactions: Transaction[] }> {
    const res = await authFetch(`${API_BASE}/statements/${id}`);
    return await parseJsonResponse(res, 'Erro ao consultar extrato bancário');
  },

  async deleteBankStatement(id: string, userName: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/statements/${id}?user=${encodeURIComponent(userName)}`, {
      method: 'DELETE'
    });
    await parseJsonResponse(res, 'Erro ao reverter extrato bancário');
  },

  // Dashboard & Daily Movement
  async getDashboardData(params: {
    period?: string;
    startDate?: string;
    endDate?: string;
    bankAccountId?: string;
    dateSortOrder?: 'asc' | 'desc';
  }): Promise<DashboardResponse> {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.bankAccountId) query.append('bankAccountId', params.bankAccountId);
    if (params.dateSortOrder) query.append('dateSortOrder', params.dateSortOrder);

    const res = await authFetch(`${API_BASE}/dashboard?${query.toString()}`);
    return await parseJsonResponse(res, 'Erro ao carregar dados do dashboard');
  },

  async getDailyMovement(date: string, bankAccountId?: string): Promise<DailyMovementGroup> {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (bankAccountId) query.append('bankAccountId', bankAccountId);
    const res = await authFetch(`${API_BASE}/daily-movement?${query.toString()}`);
    return await parseJsonResponse(res, 'Erro ao carregar movimentação diária');
  },

  async getConsolidatedBalance(params: {
    startDate?: string;
    endDate?: string;
    bankAccountId?: string;
  } = {}): Promise<any> {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.bankAccountId) query.append('bankAccountId', params.bankAccountId);

    const res = await authFetch(`${API_BASE}/consolidated-balance?${query.toString()}`);
    return await parseJsonResponse(res, 'Erro ao carregar saldo consolidado');
  },

  // Sample data
  async getSampleData(format: StatementFileType): Promise<{ fileName: string; fileType: string; fileContent?: string; fileBase64?: string }> {
    const res = await authFetch(`${API_BASE}/sample-data?format=${format}`);
    return await parseJsonResponse(res, 'Erro ao baixar extrato de exemplo');
  },

  // Database Schema
  async getSchemaSQL(): Promise<string> {
    const res = await authFetch(`${API_BASE}/database/schema-sql`);
    const data = await parseJsonResponse(res, 'Erro ao carregar SQL do esquema');
    return data.sql || '';
  },

  // Reset & Restore System Data
  async resetToBlank(userName: string = 'Administrador'): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`${API_BASE}/reset-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName })
    });
    return await parseJsonResponse(res, 'Erro ao zerar o sistema');
  },

  async restoreSampleData(userName: string = 'Administrador'): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`${API_BASE}/restore-sample-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName })
    });
    return await parseJsonResponse(res, 'Erro ao restaurar dados demonstrativos');
  },

  // ===================== AUTH & USER MANAGEMENT =====================
  async getAuthMe(): Promise<{ user: any; profile: any }> {
    const res = await authFetch(`${API_BASE}/auth/me`);
    return await parseJsonResponse(res, 'Erro ao obter dados do usuário');
  },

  async verifyInvite(code: string): Promise<{ valid: boolean; error?: string; invite?: any }> {
    const res = await fetch(`${API_BASE}/auth/verify-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    return await parseJsonResponse(res, 'Erro ao verificar código de convite');
  },

  async registerProfile(data: {
    userId: string;
    name: string;
    email: string;
    inviteCode: string;
  }): Promise<{ success: boolean; profile?: any; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/register-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await parseJsonResponse(res, 'Erro ao registrar perfil de usuário');
  },

  async getAdminUsers(): Promise<{ users: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/users`);
    return await parseJsonResponse(res, 'Erro ao carregar lista de usuários');
  },

  async updateUserStatus(id: string, status: string): Promise<{ success: boolean; profile?: any }> {
    const res = await authFetch(`${API_BASE}/admin/users/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return await parseJsonResponse(res, 'Erro ao atualizar status do usuário');
  },

  async updateUserRole(id: string, role: string): Promise<{ success: boolean; profile?: any }> {
    const res = await authFetch(`${API_BASE}/admin/users/${id}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    return await parseJsonResponse(res, 'Erro ao atualizar nível de acesso do usuário');
  },

  async getAdminInvites(): Promise<{ invites: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/invites`);
    return await parseJsonResponse(res, 'Erro ao carregar convites');
  },

  async createAdminInvite(options: {
    role: string;
    expirationDays?: number;
    customCode?: string;
    recipientEmail?: string;
    autoActivate?: boolean;
    notes?: string;
  } | string, expirationDaysLegacy: number = 7): Promise<{ success: boolean; invite: any }> {
    const payload = typeof options === 'string'
      ? { role: options, expirationDays: expirationDaysLegacy }
      : {
          role: options.role,
          expirationDays: options.expirationDays ?? 7,
          customCode: options.customCode,
          recipientEmail: options.recipientEmail,
          autoActivate: options.autoActivate,
          notes: options.notes
        };

    const res = await authFetch(`${API_BASE}/admin/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await parseJsonResponse(res, 'Erro ao gerar código de convite');
  },

  async revokeAdminInvite(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`${API_BASE}/admin/invites/${id}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await parseJsonResponse(res, 'Erro ao revogar convite');
  },

  async getAdminAuditLogs(limit = 100): Promise<{ logs: any[] }> {
    const res = await authFetch(`${API_BASE}/admin/audit-logs?limit=${limit}`);
    return await parseJsonResponse(res, 'Erro ao carregar registros de auditoria');
  },

  async getSupabaseStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    tablesReady: boolean;
    rlsBlocked?: boolean;
    supabaseUrl: string;
    hasAnonKey: boolean;
    hasServiceRoleKey?: boolean;
    hasDatabaseUrl: boolean;
    error?: string;
  }> {
    const res = await authFetch(`${API_BASE}/supabase/status`);
    return await parseJsonResponse(res, 'Erro ao verificar status do Supabase');
  },

  async syncNowToSupabase(): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await authFetch(`${API_BASE}/supabase/sync-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await parseJsonResponse(res, 'Erro ao sincronizar dados com o Supabase');
  },

  async enableMasterUser(params?: { email?: string; userId?: string; name?: string }): Promise<{ success: boolean; message?: string; profile?: any; error?: string }> {
    const res = await authFetch(`${API_BASE}/auth/enable-master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });
    return await parseJsonResponse(res, 'Erro ao habilitar perfil de Administrador Master');
  },

  async configureSupabase(credentials: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey?: string;
  }): Promise<{ success: boolean; connected: boolean; error?: string }> {
    const res = await authFetch(`${API_BASE}/supabase/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return await parseJsonResponse(res, 'Erro ao configurar Supabase');
  },

  async getSqliteStatus(): Promise<{
    success: boolean;
    engine: string;
    status: string;
    path: string;
    sizeBytes: number;
    sizeFormatted: string;
    tables: Record<string, number>;
    error?: string;
  }> {
    const res = await authFetch(`${API_BASE}/sqlite/status`);
    return await parseJsonResponse(res, 'Erro ao verificar status do SQLite');
  }
};
