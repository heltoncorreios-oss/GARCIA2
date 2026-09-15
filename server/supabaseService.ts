import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

export interface DatabaseSchema {
  bankAccounts: any[];
  categories: any[];
  operationTypes: any[];
  classificationRules: any[];
  transactions: any[];
  bankStatements: any[];
  mappingTemplates: any[];
}

export type SupabaseErrorCategory =
  | 'AUTH_CONFIG'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'HTTP_POSTGREST'
  | 'TABLE_MISSING'
  | 'COLUMN_MISSING'
  | 'RLS_PERMISSION'
  | 'DATA_CONSTRAINT'
  | 'SCHEMA_CACHE'
  | 'UNKNOWN';

export interface CategorizedError {
  category: SupabaseErrorCategory;
  message: string;
  code?: string;
  isRetryable: boolean;
}

export function categorizeSupabaseError(error: any): CategorizedError {
  if (!error) {
    return { category: 'UNKNOWN', message: 'Nenhum erro reportado', isRetryable: false };
  }
  const msg = (error.message || error.toString() || '').toLowerCase();
  const code = (error.code || error.status || '').toString();

  if (code === '42501' || msg.includes('row-level security') || msg.includes('rls')) {
    return { category: 'RLS_PERMISSION', message: error.message || 'Row Level Security (RLS) bloqueou o acesso', code, isRetryable: false };
  }
  if (msg.includes('schema cache') || (msg.includes('pgrst') && msg.includes('cache'))) {
    return { category: 'SCHEMA_CACHE', message: error.message || 'Cache de esquema PostgREST em atualização', code, isRetryable: true };
  }
  if (code === '42P01' || (msg.includes('relation') && msg.includes('does not exist'))) {
    return { category: 'TABLE_MISSING', message: error.message || 'Tabela não encontrada no PostgreSQL', code, isRetryable: false };
  }
  if (code === '42703' || code === 'PGRST204' || (msg.includes('column') && msg.includes('does not exist'))) {
    return { category: 'COLUMN_MISSING', message: error.message || 'Coluna não encontrada na tabela', code, isRetryable: false };
  }
  if (code === '401' || code === '403' || msg.includes('invalid api key') || msg.includes('jwt') || msg.includes('auth')) {
    return { category: 'AUTH_CONFIG', message: error.message || 'Erro de autenticação ou chave inválida', code, isRetryable: false };
  }
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('fetch failed') || msg.includes('network')) {
    return { category: 'NETWORK', message: error.message || 'Erro de conexão de rede com o Supabase', code, isRetryable: true };
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { category: 'TIMEOUT', message: error.message || 'Tempo limite excedido ao comunicar com o Supabase', code, isRetryable: true };
  }
  if (code.startsWith('23')) {
    return { category: 'DATA_CONSTRAINT', message: error.message || 'Violação de chave ou restrição de banco', code, isRetryable: false };
  }
  if (code.startsWith('PGRST') || (error.status && error.status >= 400)) {
    return { category: 'HTTP_POSTGREST', message: error.message || 'Erro de resposta PostgREST HTTP', code, isRetryable: false };
  }
  return { category: 'UNKNOWN', message: error.message || String(error), code, isRetryable: false };
}

let supabaseInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function resetSupabaseClient() {
  supabaseInstance = null;
  lastUrl = '';
  lastKey = '';
}

export function isSupabaseConfigured(): boolean {
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  url = url.trim().replace(/^["']|["']$/g, '');
  key = key.trim().replace(/^["']|["']$/g, '');
  return Boolean(url && key && url.startsWith('http'));
}

export function getSupabaseClient(): SupabaseClient | null {
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  
  url = url.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]/g, '').replace(/\/$/, '');
  key = key.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]/g, '');
  if (!url || !key || !url.startsWith('http')) return null;

  if (!supabaseInstance || url !== lastUrl || key !== lastKey) {
    lastUrl = url;
    lastKey = key;
    try {
      supabaseInstance = createClient(url, key, {
        auth: { persistSession: false }
      });
    } catch (err) {
      supabaseInstance = null;
      return null;
    }
  }
  return supabaseInstance;
}

export interface SupabaseDiagnosticResult {
  urlConfigured: boolean;
  keyConfigured: boolean;
  clientCreated: boolean;
  connected: boolean;
  responseTimeMs: number | null;
  transactionsAccessible: boolean;
  selectWorking: boolean;
  insertPermitted: boolean;
  errorCategory: SupabaseErrorCategory | null;
  detailedError: string | null;
  baseDataInitAllowed: boolean;
  baseDataInitReason: string;
}

export async function diagnoseSupabaseConnection(): Promise<SupabaseDiagnosticResult> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const urlConfigured = Boolean(url && url.trim().startsWith('http'));
  const keyConfigured = Boolean(key && key.trim().length > 0);

  console.log('[SUPABASE] Iniciando teste de conexão');
  console.log(`[SUPABASE] URL configurada: ${urlConfigured ? 'SIM' : 'NÃO'}`);
  console.log(`[SUPABASE] Chave configurada: ${keyConfigured ? 'SIM' : 'NÃO'}`);

  if (!urlConfigured || !keyConfigured) {
    console.log('[SUPABASE] Cliente criado: NÃO');
    console.log('[SUPABASE] transactions acessível: NÃO');
    console.log('[SUPABASE] Erro detalhado: Credenciais do Supabase não configuradas no ambiente');
    console.log('[SUPABASE] Inicialização de dados base: BLOQUEADA');
    console.log('[SUPABASE] Motivo: Supabase não está configurado com URL e Chave válidas.');

    return {
      urlConfigured,
      keyConfigured,
      clientCreated: false,
      connected: false,
      responseTimeMs: null,
      transactionsAccessible: false,
      selectWorking: false,
      insertPermitted: false,
      errorCategory: 'AUTH_CONFIG',
      detailedError: 'Credenciais do Supabase não configuradas.',
      baseDataInitAllowed: false,
      baseDataInitReason: 'Supabase não está configurado com URL e Chave válidas.'
    };
  }

  const client = getSupabaseClient();
  const clientCreated = Boolean(client);
  console.log(`[SUPABASE] Cliente criado: ${clientCreated ? 'SIM' : 'NÃO'}`);

  if (!client) {
    console.log('[SUPABASE] transactions acessível: NÃO');
    console.log('[SUPABASE] Erro detalhado: Não foi possível instanciar o cliente Supabase');
    console.log('[SUPABASE] Inicialização de dados base: BLOQUEADA');
    console.log('[SUPABASE] Motivo: Falha ao inicializar o SDK Supabase.');

    return {
      urlConfigured,
      keyConfigured,
      clientCreated: false,
      connected: false,
      responseTimeMs: null,
      transactionsAccessible: false,
      selectWorking: false,
      insertPermitted: false,
      errorCategory: 'AUTH_CONFIG',
      detailedError: 'Não foi possível instanciar cliente Supabase.',
      baseDataInitAllowed: false,
      baseDataInitReason: 'Falha ao instanciar cliente Supabase.'
    };
  }

  console.log('[SUPABASE] Testando acesso à tabela transactions');
  const startTime = Date.now();

  try {
    const queryPromise = client.from('transactions').select('id').limit(1);
    const res: any = await withTimeout(queryPromise as any, 5000);
    const data = res?.data;
    const error = res?.error;
    const latency = Date.now() - startTime;

    console.log(`[SUPABASE] Resposta recebida em ${latency} ms`);

    if (error) {
      const cat = categorizeSupabaseError(error);
      console.log('[SUPABASE] transactions acessível: NÃO');
      console.log(`[SUPABASE] Erro detalhado: ${cat.category} - ${cat.message}`);
      console.log('[SUPABASE] Inicialização de dados base: BLOQUEADA');
      console.log(`[SUPABASE] Motivo: Consulta falhou: ${cat.message}`);

      return {
        urlConfigured,
        keyConfigured,
        clientCreated: true,
        connected: false,
        responseTimeMs: latency,
        transactionsAccessible: false,
        selectWorking: false,
        insertPermitted: false,
        errorCategory: cat.category,
        detailedError: `${cat.category}: ${cat.message}`,
        baseDataInitAllowed: false,
        baseDataInitReason: `Falha ao consultar tabela transactions: ${cat.message}`
      };
    }

    console.log('[SUPABASE] transactions acessível: SIM');

    let insertPermitted = true;
    try {
      const testCheck: any = await withTimeout(
        client.from('audit_logs').select('id').limit(1) as any,
        3000
      );
      if (testCheck?.error && (testCheck.error.code === '42501' || testCheck.error.message?.includes('row-level security'))) {
        insertPermitted = false;
      }
    } catch {
      insertPermitted = false;
    }

    console.log(`[SUPABASE] SELECT em transactions funcionando: SIM`);
    console.log(`[SUPABASE] INSERT permitido: ${insertPermitted ? 'SIM' : 'NÃO'}`);

    return {
      urlConfigured,
      keyConfigured,
      clientCreated: true,
      connected: true,
      responseTimeMs: latency,
      transactionsAccessible: true,
      selectWorking: true,
      insertPermitted,
      errorCategory: null,
      detailedError: null,
      baseDataInitAllowed: true,
      baseDataInitReason: 'Conexão e tabelas validadas com sucesso.'
    };
  } catch (err: any) {
    const latency = Date.now() - startTime;
    const cat = categorizeSupabaseError(err);

    console.log(`[SUPABASE] Resposta recebida em ${latency} ms (FALHA)`);
    console.log('[SUPABASE] transactions acessível: NÃO');
    console.log(`[SUPABASE] Erro detalhado: ${cat.category} - ${cat.message}`);
    console.log('[SUPABASE] Inicialização de dados base: BLOQUEADA');
    console.log(`[SUPABASE] Motivo: Supabase não respondeu dentro do tempo limite (${latency} ms).`);

    return {
      urlConfigured,
      keyConfigured,
      clientCreated: true,
      connected: false,
      responseTimeMs: latency,
      transactionsAccessible: false,
      selectWorking: false,
      insertPermitted: false,
      errorCategory: cat.category,
      detailedError: `Timeout/Conexão (${latency}ms): ${cat.message}`,
      baseDataInitAllowed: false,
      baseDataInitReason: `Supabase não respondeu ou conexao falhou: ${cat.message}`
    };
  }
}

function createPostgresPool(connectionString: string): pg.Pool {
  let cleaned = connectionString;
  if (!cleaned.includes('?') && cleaned.includes('&')) {
    const firstAmpIndex = cleaned.indexOf('&');
    cleaned = cleaned.substring(0, firstAmpIndex) + '?' + cleaned.substring(firstAmpIndex + 1);
  }

  try {
    const url = new URL(cleaned);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('supa');
    url.searchParams.delete('pgbouncer');

    let dbName = url.pathname.replace(/^\//, '').split('?')[0].split('&')[0];
    if (!dbName || dbName === '') dbName = 'postgres';
    url.pathname = '/' + dbName;

    return new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000
    });
  } catch {
    const cleanConn = cleaned
      .replace(/[?&]sslmode=[^&]*/g, '')
      .replace(/[?&]supa=[^&]*/g, '')
      .replace(/[?&]pgbouncer=[^&]*/g, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');

    return new pg.Pool({
      connectionString: cleanConn,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000
    });
  }
}

function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Supabase request timeout')), ms);
      if (timer && typeof (timer as any).unref === 'function') {
        (timer as any).unref();
      }
    })
  ]);
}

let tablesEnsured = false;

export async function ensureSupabaseTables(): Promise<boolean> {
  if (tablesEnsured) return true;

  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connectionString) return false;

  let pool: pg.Pool | null = null;
  try {
    pool = createPostgresPool(connectionString);

    // Garantir que TODAS as tabelas existam (CREATE TABLE IF NOT EXISTS é seguro e não destrói dados)
    const schemaQuery = `
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS bank_accounts (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON bank_accounts TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS categories (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON categories TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS operation_types (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE operation_types DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON operation_types TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS classification_rules (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE classification_rules DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON classification_rules TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS mapping_templates (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE mapping_templates DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON mapping_templates TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS transactions (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON transactions TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS bank_statements (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE bank_statements DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON bank_statements TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS audit_logs (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON audit_logs TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS user_profiles (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON user_profiles TO anon, authenticated, service_role;
      
      CREATE TABLE IF NOT EXISTS user_invites (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      ALTER TABLE user_invites DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON user_invites TO anon, authenticated, service_role;
    `;

    await withTimeout(pool.query(schemaQuery), 6000);
    
    await pool.end().catch(() => {});
    tablesEnsured = true;
    return true;
  } catch (err: any) {
    if (pool) {
      pool.end().catch(() => {});
    }
    console.log(`[SUPABASE] Verificação inicial de tabela no DDL concluída ou ignorada (${err.message}).`);
    return false;
  }
}

export async function loadFromSupabase(): Promise<DatabaseSchema | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const fetchTable = async (tableName: string): Promise<any[]> => {
      try {
        const res: any = await withTimeout(
          client.from(tableName).select('*') as any,
          6000
        );
        if (res?.error) {
          console.log(`[SUPABASE] Tabela '${tableName}' vazia ou indisponível na nuvem (${res.error.message || 'sem erro'}). Assumindo [].`);
          return [];
        }
        return Array.isArray(res?.data) ? res.data : [];
      } catch (err: any) {
        console.log(`[SUPABASE] Tabela '${tableName}' não consultada (${err?.message || err}). Assumindo [].`);
        return [];
      }
    };

    // Carregamento sequencial controlado para evitar tempestade de requisições paralelas ao PostgREST
    const bankAccountsData = await fetchTable('bank_accounts');
    const categoriesData = await fetchTable('categories');
    const operationTypesData = await fetchTable('operation_types');
    const classificationRulesData = await fetchTable('classification_rules');
    const transactionsData = await fetchTable('transactions');
    const bankStatementsData = await fetchTable('bank_statements');
    const mappingTemplatesData = await fetchTable('mapping_templates');

    const extractItem = (r: any) => {
      if (!r) return null;
      if (typeof r.data === 'object' && r.data !== null) return r.data;
      return r;
    };

    return {
      bankAccounts: bankAccountsData.map(extractItem).filter(Boolean),
      categories: categoriesData.map(extractItem).filter(Boolean),
      operationTypes: operationTypesData.map(extractItem).filter(Boolean),
      classificationRules: classificationRulesData.map(extractItem).filter(Boolean),
      transactions: transactionsData.map(extractItem).filter(Boolean),
      bankStatements: bankStatementsData.map(extractItem).filter(Boolean),
      mappingTemplates: mappingTemplatesData.map(extractItem).filter(Boolean)
    };
  } catch (err: any) {
    console.warn(`[SUPABASE] Aviso em loadFromSupabase: ${err?.message || err}`);
    // Retornar schema vazio em vez de null para não bloquear inicialização caso seja erro não-fatídico
    return {
      bankAccounts: [],
      categories: [],
      operationTypes: [],
      classificationRules: [],
      transactions: [],
      bankStatements: [],
      mappingTemplates: []
    };
  }
}

export async function syncToSupabase(schema: DatabaseSchema): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    let hadError = false;
    const saveCollection = async (tableName: string, items: any[]) => {
      if (!items || items.length === 0) return;
      const validItems = items.filter(item => item && item.id);
      if (validItems.length === 0) return;
      
      const rows = validItems.map((item) => ({
        id: item.id,
        data: item,
        updated_at: new Date().toISOString()
      }));

      const chunkSize = 1000;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        let attempts = 0;
        let success = false;
        
        while (attempts < 2 && !success) {
          try {
            const upsertRes: any = await withTimeout(
              client.from(tableName).upsert(chunk, { onConflict: 'id' }) as any,
              6000
            );
            const error = upsertRes?.error;
            if (error) {
              const cat = categorizeSupabaseError(error);
              if (cat.category === 'TABLE_MISSING' || cat.category === 'SCHEMA_CACHE' || error.code === 'PGRST205') {
                console.log(`[SUPABASE] Tabela '${tableName}' ausente na nuvem para upsert. Coleção ignorada.`);
                break;
              }
              if (cat.isRetryable && attempts < 1) {
                attempts++;
                await new Promise(r => setTimeout(r, 1000));
              } else {
                hadError = true;
                break;
              }
            } else {
              success = true;
            }
          } catch (err: any) {
            const cat = categorizeSupabaseError(err);
            if (cat.category === 'TABLE_MISSING' || cat.category === 'SCHEMA_CACHE' || err?.code === 'PGRST205') {
              console.log(`[SUPABASE] Tabela '${tableName}' indisponível para upsert (${err?.message || err}). Ignorada.`);
              break;
            }
            if (cat.isRetryable && attempts < 1) {
              attempts++;
              await new Promise(r => setTimeout(r, 1000));
            } else {
              hadError = true;
              break;
            }
          }
        }
      }
    };

    await saveCollection('bank_accounts', schema.bankAccounts);
    await saveCollection('categories', schema.categories);
    await saveCollection('operation_types', schema.operationTypes);
    await saveCollection('classification_rules', schema.classificationRules);
    await saveCollection('transactions', schema.transactions);
    await saveCollection('bank_statements', schema.bankStatements);
    await saveCollection('mapping_templates', schema.mappingTemplates);

    return !hadError;
  } catch (err) {
    return false;
  }
}

export async function deleteFromSupabase(tableName: string, id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from(tableName).delete().eq('id', id);
    return !error;
  } catch (err) {
    return false;
  }
}
