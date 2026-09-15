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

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
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

export async function ensureSupabaseTables(): Promise<boolean> {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connectionString) return false;

  try {
    const pool = createPostgresPool(connectionString);

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
      
      NOTIFY pgrst, 'reload schema';
    `;

    await withTimeout(pool.query(schemaQuery), 2500);
    await pool.end();
    return true;
  } catch (err) {
    console.warn('[Supabase] Aviso: DDL tables check skipped or not supported on pooler connection:', (err as Error).message);
    return false;
  }
}

export async function loadFromSupabase(): Promise<DatabaseSchema | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const fetchPromise = Promise.all([
      client.from('bank_accounts').select('*'),
      client.from('categories').select('*'),
      client.from('operation_types').select('*'),
      client.from('classification_rules').select('*'),
      client.from('transactions').select('*'),
      client.from('bank_statements').select('*'),
      client.from('mapping_templates').select('*')
    ]);

    const [
      accsRes,
      catsRes,
      opsRes,
      rulesRes,
      txsRes,
      stmtsRes,
      tmplsRes
    ] = await withTimeout(fetchPromise, 3000);

    if (accsRes.error) {
      console.warn('Supabase fetch bank_accounts error:', accsRes.error.message);
      return null;
    }

    return {
      bankAccounts: (accsRes.data || []).map((r: any) => r.data),
      categories: (catsRes.data || []).map((r: any) => r.data),
      operationTypes: (opsRes.data || []).map((r: any) => r.data),
      classificationRules: (rulesRes.data || []).map((r: any) => r.data),
      transactions: (txsRes.data || []).map((r: any) => r.data),
      bankStatements: (stmtsRes.data || []).map((r: any) => r.data),
      mappingTemplates: (tmplsRes.data || []).map((r: any) => r.data)
    };
  } catch (err) {
    console.error('Erro ao carregar dados do Supabase:', err);
    return null;
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

      // Batch upsert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        
        let attempts = 0;
        let success = false;
        
        while (attempts < 10 && !success) {
          const { error } = await client.from(tableName).upsert(chunk, { onConflict: 'id' });
          if (error) {
            if (error.message && error.message.includes('schema cache')) {
              attempts++;
              console.warn(`[Supabase] Schema cache error on ${tableName}. Retrying in 2s (Attempt ${attempts}/10)...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              hadError = true;
              if (error.code === '42501' || error.message.includes('row-level security')) {
                console.error(`[Supabase RLS] Erro 42501 na tabela '${tableName}': O Supabase está bloqueando a inserção devido a Row Level Security (RLS). Execute "ALTER TABLE ${tableName} DISABLE ROW LEVEL SECURITY;" no SQL Editor do Supabase ou forneça a Service Role Key.`);
              } else {
                console.error(`Erro ao salvar no Supabase (${tableName}):`, error.message);
              }
              break; // Break the retry loop on non-schema cache errors
            }
          } else {
            success = true;
          }
        }
        
        if (!success && attempts >= 10) {
          hadError = true;
          console.error(`Erro ao salvar no Supabase (${tableName}): Schema cache timeout após 10 tentativas.`);
        }
      }
    };

    await Promise.all([
      saveCollection('bank_accounts', schema.bankAccounts),
      saveCollection('categories', schema.categories),
      saveCollection('operation_types', schema.operationTypes),
      saveCollection('classification_rules', schema.classificationRules),
      saveCollection('transactions', schema.transactions),
      saveCollection('bank_statements', schema.bankStatements),
      saveCollection('mapping_templates', schema.mappingTemplates)
    ]);

    return !hadError;
  } catch (err) {
    console.error('Erro ao sincronizar com Supabase:', err);
    return false;
  }
}

export async function deleteFromSupabase(tableName: string, id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from(tableName).delete().eq('id', id);
    if (error) {
      console.error(`Erro ao deletar item do Supabase (${tableName}:${id}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Erro ao excluir do Supabase (${tableName}):`, err);
    return false;
  }
}
