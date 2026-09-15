-- ====================================================================
-- SISTEMA DE GESTÃO FINANCEIRA PARA SUPERMERCADO - SCHEMA OFICIAL
-- Banco de Dados: PostgreSQL (Supabase / Nuvem)
-- Compatibilidade Total: JSONB Document Store + RLS Liberado para Sincronização
-- ====================================================================

-- 1. LIMPEZA SEGURA DE TABELAS RELACIONAIS ANTIGAS OU INCOMPATÍVEIS
-- (Garante que todas as tabelas possuam a coluna 'data JSONB' necessária para o motor de sincronização)
DROP TABLE IF EXISTS reconciliation_logs CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS bank_statements CASCADE;
DROP TABLE IF EXISTS classification_rules CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS operation_types CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS mapping_templates CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS user_invites CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 2. CRIAÇÃO DAS 10 TABELAS DO SISTEMA
CREATE TABLE IF NOT EXISTS bank_accounts (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operation_types (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classification_rules (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mapping_templates (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_statements (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_invites (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DESATIVAÇÃO DE ROW LEVEL SECURITY (RLS)
-- IMPORTANTE: Por padrão, o Supabase bloqueia inserções (Erro 42501).
-- Este bloco desativa o bloqueio e permite a sincronização com a chave anon/public.
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE operation_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE classification_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites DISABLE ROW LEVEL SECURITY;

-- 4. CONCESSÃO TOTAL DE PERMISSÕES
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. ÍNDICES PARA ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bank_accounts_updated ON bank_accounts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_updated ON categories (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_types_updated ON operation_types (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_classification_rules_updated ON classification_rules (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_updated ON mapping_templates (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_updated ON transactions (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_statements_updated ON bank_statements (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_updated ON audit_logs (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON user_profiles (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_invites_updated ON user_invites (updated_at DESC);

-- 6. INICIALIZAÇÃO DO USUÁRIO ADMINISTRADOR MASTER
INSERT INTO user_profiles (id, data, updated_at)
VALUES (
    '7d055bf2-5a22-4540-8aa7-1068deeb981d',
    '{"id": "7d055bf2-5a22-4540-8aa7-1068deeb981d", "name": "Helton (Administrador Master)", "email": "heltoncorreios@gmail.com", "role": "ADMINISTRADOR", "status": "ATIVO", "createdAt": "2026-01-01T00:00:00.000Z"}'::jsonb,
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW();

INSERT INTO user_profiles (id, data, updated_at)
VALUES (
    '58ca22b6-4fda-4a95-8b4c-12061fa15bee',
    '{"id": "58ca22b6-4fda-4a95-8b4c-12061fa15bee", "name": "Administrador Master", "email": "admin@supermercado.com", "role": "ADMINISTRADOR", "status": "ATIVO", "createdAt": "2026-01-01T00:00:00.000Z"}'::jsonb,
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW();
