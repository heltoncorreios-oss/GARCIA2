import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  BankAccount,
  Category,
  ClassificationRule,
  OperationTypeInfo,
  Transaction,
  BankStatement,
  BankMappingTemplate,
  UserProfile,
  UserInvite,
  AuditLogEntry
} from '../src/types';

export interface SqliteDatabaseSchema {
  bankAccounts: BankAccount[];
  categories: Category[];
  operationTypes: OperationTypeInfo[];
  classificationRules: ClassificationRule[];
  transactions: Transaction[];
  bankStatements: BankStatement[];
  mappingTemplates: BankMappingTemplate[];
}

let sqliteDbInstance: DatabaseSync | null = null;
let sqliteFilePath: string = '';

export function getSqliteDbPath(): string {
  if (sqliteFilePath) return sqliteFilePath;
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
  const dataDir = isVercel ? '/tmp' : (process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {}
  }

  sqliteFilePath = process.env.SQLITE_DB_PATH || path.join(dataDir, 'supermarket.sqlite');
  return sqliteFilePath;
}

export function getSqliteDb(): DatabaseSync {
  if (sqliteDbInstance) return sqliteDbInstance;

  const dbPath = getSqliteDbPath();
  const db = new DatabaseSync(dbPath);

  // Performance and concurrency settings
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      name TEXT,
      bank_code TEXT,
      account_number TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_types (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classification_rules (
      id TEXT PRIMARY KEY,
      priority INTEGER,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

    CREATE TABLE IF NOT EXISTS bank_statements (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mapping_templates (
      id TEXT PRIMARY KEY,
      bank_name_or_code TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_invites (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      user_email TEXT,
      timestamp TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  sqliteDbInstance = db;
  console.log(`[SQLite] Banco de dados local SQLite inicializado com sucesso em: ${dbPath}`);
  return db;
}

// -------------------------------------------------------------
// FINANCIAL DATA METHODS
// -------------------------------------------------------------

export function loadAllFromSqlite(): SqliteDatabaseSchema | null {
  try {
    const db = getSqliteDb();

    const bankAccountsRows = db.prepare('SELECT data FROM bank_accounts').all() as Array<{ data: string }>;
    const categoriesRows = db.prepare('SELECT data FROM categories').all() as Array<{ data: string }>;
    const operationTypesRows = db.prepare('SELECT data FROM operation_types').all() as Array<{ data: string }>;
    const rulesRows = db.prepare('SELECT data FROM classification_rules').all() as Array<{ data: string }>;
    const txRows = db.prepare('SELECT data FROM transactions').all() as Array<{ data: string }>;
    const stRows = db.prepare('SELECT data FROM bank_statements').all() as Array<{ data: string }>;
    const tmplRows = db.prepare('SELECT data FROM mapping_templates').all() as Array<{ data: string }>;

    // If database is completely empty (no accounts and no categories), return null to allow seeding
    if (bankAccountsRows.length === 0 && txRows.length === 0) {
      return null;
    }

    return {
      bankAccounts: bankAccountsRows.map(r => JSON.parse(r.data)),
      categories: categoriesRows.map(r => JSON.parse(r.data)),
      operationTypes: operationTypesRows.map(r => JSON.parse(r.data)),
      classificationRules: rulesRows.map(r => JSON.parse(r.data)),
      transactions: txRows.map(r => JSON.parse(r.data)),
      bankStatements: stRows.map(r => JSON.parse(r.data)),
      mappingTemplates: tmplRows.map(r => JSON.parse(r.data))
    };
  } catch (err) {
    console.error('[SQLite] Erro ao carregar dados do SQLite:', err);
    return null;
  }
}

export function saveAllToSqlite(data: SqliteDatabaseSchema): void {
  try {
    const db = getSqliteDb();
    const now = new Date().toISOString();

    // Use transaction for atomic bulk replacement
    db.exec('BEGIN TRANSACTION;');

    try {
      // 1. Bank Accounts
      db.exec('DELETE FROM bank_accounts;');
      const insertAccount = db.prepare('INSERT INTO bank_accounts (id, name, bank_code, account_number, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const item of data.bankAccounts) {
        insertAccount.run(item.id, item.accountName || item.bankName || '', item.bankCode || '', item.accountNumber || '', JSON.stringify(item), now);
      }

      // 2. Categories
      db.exec('DELETE FROM categories;');
      const insertCategory = db.prepare('INSERT INTO categories (id, name, type, data, updated_at) VALUES (?, ?, ?, ?, ?)');
      for (const item of data.categories) {
        insertCategory.run(item.id, item.name, item.type, JSON.stringify(item), now);
      }

      // 3. Operation Types
      db.exec('DELETE FROM operation_types;');
      const insertOpType = db.prepare('INSERT INTO operation_types (id, code, name, data, updated_at) VALUES (?, ?, ?, ?, ?)');
      for (const item of data.operationTypes) {
        insertOpType.run(item.id, item.code, item.name, JSON.stringify(item), now);
      }

      // 4. Classification Rules
      db.exec('DELETE FROM classification_rules;');
      const insertRule = db.prepare('INSERT INTO classification_rules (id, priority, data, updated_at) VALUES (?, ?, ?, ?)');
      for (const item of data.classificationRules) {
        insertRule.run(item.id, item.priority || 0, JSON.stringify(item), now);
      }

      // 5. Transactions
      db.exec('DELETE FROM transactions;');
      const insertTx = db.prepare('INSERT INTO transactions (id, account_id, date, type, amount, status, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const item of data.transactions) {
        insertTx.run(item.id, item.bankAccountId, item.date, item.type, item.amount, item.reconciliationStatus || 'PENDING', JSON.stringify(item), now);
      }

      // 6. Bank Statements
      db.exec('DELETE FROM bank_statements;');
      const insertSt = db.prepare('INSERT INTO bank_statements (id, account_id, data, updated_at) VALUES (?, ?, ?, ?)');
      for (const item of data.bankStatements) {
        insertSt.run(item.id, item.bankAccountId, JSON.stringify(item), now);
      }

      // 7. Mapping Templates
      db.exec('DELETE FROM mapping_templates;');
      const insertTmpl = db.prepare('INSERT INTO mapping_templates (id, bank_name_or_code, data, updated_at) VALUES (?, ?, ?, ?)');
      for (const item of data.mappingTemplates) {
        insertTmpl.run(item.id, item.bankNameOrCode || '', JSON.stringify(item), now);
      }

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (err) {
    console.error('[SQLite] Erro ao salvar tudo no SQLite:', err);
  }
}

export function upsertTransactionSqlite(tx: Transaction): void {
  try {
    const db = getSqliteDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO transactions (id, account_id, date, type, amount, status, data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        account_id = excluded.account_id,
        date = excluded.date,
        type = excluded.type,
        amount = excluded.amount,
        status = excluded.status,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run(tx.id, tx.bankAccountId, tx.date, tx.type, tx.amount, tx.reconciliationStatus || 'PENDING', JSON.stringify(tx), now);
  } catch (err) {
    console.error('[SQLite] Erro ao salvar transação no SQLite:', err);
  }
}

export function deleteTransactionSqlite(id: string): void {
  try {
    const db = getSqliteDb();
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    stmt.run(id);
  } catch (err) {
    console.error('[SQLite] Erro ao deletar transação no SQLite:', err);
  }
}

// -------------------------------------------------------------
// USER MANAGEMENT & INVITES (SQLITE)
// -------------------------------------------------------------

export function loadUserProfilesSqlite(): UserProfile[] {
  try {
    const db = getSqliteDb();
    const rows = db.prepare('SELECT data FROM user_profiles').all() as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  } catch (err) {
    console.error('[SQLite] Erro ao carregar perfis de usuário do SQLite:', err);
    return [];
  }
}

export function saveUserProfileSqlite(profile: UserProfile): void {
  try {
    const db = getSqliteDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO user_profiles (id, email, role, status, data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        role = excluded.role,
        status = excluded.status,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run(profile.id, profile.email, profile.role, profile.status, JSON.stringify(profile), now);
  } catch (err) {
    console.error('[SQLite] Erro ao salvar perfil no SQLite:', err);
  }
}

export function loadUserInvitesSqlite(): UserInvite[] {
  try {
    const db = getSqliteDb();
    const rows = db.prepare('SELECT data FROM user_invites').all() as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  } catch (err) {
    console.error('[SQLite] Erro ao carregar convites do SQLite:', err);
    return [];
  }
}

export function saveUserInviteSqlite(invite: UserInvite): void {
  try {
    const db = getSqliteDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO user_invites (id, code, role, status, data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        role = excluded.role,
        status = excluded.status,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run(invite.id, invite.code, invite.role, invite.status, JSON.stringify(invite), now);
  } catch (err) {
    console.error('[SQLite] Erro ao salvar convite no SQLite:', err);
  }
}

export function loadAuditLogsSqlite(limit = 100): AuditLogEntry[] {
  try {
    const db = getSqliteDb();
    const rows = db.prepare('SELECT data FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as Array<{ data: string }>;
    return rows.map(r => JSON.parse(r.data));
  } catch (err) {
    console.error('[SQLite] Erro ao carregar logs de auditoria do SQLite:', err);
    return [];
  }
}

export function saveAuditLogSqlite(entry: AuditLogEntry): void {
  try {
    const db = getSqliteDb();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, action, user_email, timestamp, data)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data
    `);
    stmt.run(entry.id, entry.action, entry.user || '', entry.timestamp, JSON.stringify(entry));
  } catch (err) {
    console.error('[SQLite] Erro ao salvar log de auditoria no SQLite:', err);
  }
}

// -------------------------------------------------------------
// BACKUP & STATUS
// -------------------------------------------------------------

export function getSqliteDatabaseInfo(): {
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  tables: Record<string, number>;
} {
  const dbPath = getSqliteDbPath();
  let sizeBytes = 0;
  try {
    if (fs.existsSync(dbPath)) {
      sizeBytes = fs.statSync(dbPath).size;
    }
  } catch {}

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tables: Record<string, number> = {};
  try {
    const db = getSqliteDb();
    const list = [
      'bank_accounts',
      'categories',
      'operation_types',
      'classification_rules',
      'transactions',
      'bank_statements',
      'mapping_templates',
      'user_profiles',
      'user_invites',
      'audit_logs'
    ];
    for (const tbl of list) {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${tbl}`).get() as { count: number };
      tables[tbl] = row?.count || 0;
    }
  } catch {}

  return {
    path: dbPath,
    sizeBytes,
    sizeFormatted: formatSize(sizeBytes),
    tables
  };
}
