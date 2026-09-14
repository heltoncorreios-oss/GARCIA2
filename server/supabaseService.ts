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

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseInstance) {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!;
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)!;
    supabaseInstance = createClient(url, key, {
      auth: { persistSession: false }
    });
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

export async function ensureSupabaseTables(): Promise<boolean> {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connectionString) return false;

  try {
    const pool = createPostgresPool(connectionString);

    const schemaQuery = `
      CREATE TABLE IF NOT EXISTS bank_accounts (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS categories (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS operation_types (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS classification_rules (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS mapping_templates (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS transactions (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS bank_statements (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS audit_logs (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
    `;

    await pool.query(schemaQuery);
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
    const [
      accsRes,
      catsRes,
      opsRes,
      rulesRes,
      txsRes,
      stmtsRes,
      tmplsRes
    ] = await Promise.all([
      client.from('bank_accounts').select('*'),
      client.from('categories').select('*'),
      client.from('operation_types').select('*'),
      client.from('classification_rules').select('*'),
      client.from('transactions').select('*'),
      client.from('bank_statements').select('*'),
      client.from('mapping_templates').select('*')
    ]);

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
    const saveCollection = async (tableName: string, items: any[]) => {
      if (!items || items.length === 0) return;
      const rows = items.map((item) => ({
        id: item.id,
        data: item,
        updated_at: new Date().toISOString()
      }));

      // Batch upsert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await client.from(tableName).upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.error(`Erro ao salvar no Supabase (${tableName}):`, error.message);
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

    return true;
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
