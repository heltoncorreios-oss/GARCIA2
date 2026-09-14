-- ====================================================================
-- SISTEMA DE GESTÃO FINANCEIRA PARA SUPERMERCADO
-- Banco de Dados: PostgreSQL (Compatível com PostgreSQL 14+)
-- Script DDL: Criação de Tabelas, Índices, Triggers e Carga Inicial
-- ====================================================================

-- 1. Criação de Tipos Enumerados (Enums)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMINISTRADOR', 'FINANCEIRO', 'CONSULTA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM ('ENTRADA', 'SAIDA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reconciliation_status') THEN
        CREATE TYPE reconciliation_status AS ENUM ('CONCILIADO', 'PENDENTE', 'DUPLICADO', 'SUSPEITO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'origin_type') THEN
        CREATE TYPE origin_type AS ENUM ('EXTRATO', 'MANUAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confidence_level') THEN
        CREATE TYPE confidence_level AS ENUM ('ALTA', 'MEDIA', 'BAIXA');
    END IF;
END$$;

-- 2. Tabela de Papéis (Roles)
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Usuários (Users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'FINANCEIRO',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Contas Bancárias (Bank Accounts)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id VARCHAR(36) PRIMARY KEY,
    bank_code VARCHAR(10) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    agency VARCHAR(20) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    account_type VARCHAR(30) NOT NULL DEFAULT 'CORRENTE', -- CORRENTE, POUPANCA, APLICACAO, CAIXA_FISICO
    initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    initial_balance_date DATE NOT NULL,
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    color VARCHAR(20) DEFAULT '#059669',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela de Categorias Financeiras
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA')),
    icon VARCHAR(50) DEFAULT 'Tag',
    color VARCHAR(20) DEFAULT '#64748b',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabela de Subcategorias
CREATE TABLE IF NOT EXISTS subcategories (
    id VARCHAR(36) PRIMARY KEY,
    category_id VARCHAR(36) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cat_subcat UNIQUE (category_id, name)
);

-- 7. Tabela de Tipos de Operação
CREATE TABLE IF NOT EXISTS operation_types (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    default_type VARCHAR(10) NOT NULL CHECK (default_type IN ('ENTRADA', 'SAIDA', 'AMBOS')),
    badge_color VARCHAR(30) DEFAULT 'blue',
    is_active BOOLEAN DEFAULT TRUE
);

-- 8. Tabela de Regras de Classificação Automática
CREATE TABLE IF NOT EXISTS classification_rules (
    id VARCHAR(36) PRIMARY KEY,
    keyword VARCHAR(150) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    category_id VARCHAR(36) REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id VARCHAR(36) REFERENCES subcategories(id) ON DELETE SET NULL,
    confidence VARCHAR(10) NOT NULL DEFAULT 'ALTA', -- ALTA, MEDIA, BAIXA
    priority INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    learned_from_user BOOLEAN DEFAULT FALSE,
    match_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabela de Lotes de Extrato Bancário Importados
CREATE TABLE IF NOT EXISTS bank_statements (
    id VARCHAR(36) PRIMARY KEY,
    bank_account_id VARCHAR(36) NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL, -- OFX, CSV, XLSX, TXT
    start_date DATE,
    end_date DATE,
    total_records INT NOT NULL DEFAULT 0,
    imported_records INT NOT NULL DEFAULT 0,
    duplicate_records INT NOT NULL DEFAULT 0,
    unclassified_records INT NOT NULL DEFAULT 0,
    imported_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabela Principal de Lançamentos Financeiros (Transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    statement_id VARCHAR(36) REFERENCES bank_statements(id) ON DELETE SET NULL,
    bank_account_id VARCHAR(36) NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    competence_date DATE,
    description VARCHAR(255) NOT NULL,
    normalized_description VARCHAR(255),
    amount NUMERIC(15, 2) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA')),
    category_id VARCHAR(36) REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id VARCHAR(36) REFERENCES subcategories(id) ON DELETE SET NULL,
    operation_type VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100),
    agency VARCHAR(20),
    observation TEXT,
    origin VARCHAR(20) NOT NULL DEFAULT 'EXTRATO' CHECK (origin IN ('EXTRATO', 'MANUAL')),
    reconciliation_status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (reconciliation_status IN ('CONCILIADO', 'PENDENTE', 'DUPLICADO', 'SUSPEITO')),
    classification_confidence VARCHAR(10) DEFAULT 'ALTA', -- ALTA, MEDIA, BAIXA
    import_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responsible_user VARCHAR(120),
    external_id VARCHAR(100),
    transaction_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_transaction_hash UNIQUE (bank_account_id, transaction_hash)
);

-- 11. Tabela de Log de Conciliação Bancária
CREATE TABLE IF NOT EXISTS reconciliation_logs (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_name VARCHAR(120) NOT NULL,
    action VARCHAR(50) NOT NULL, -- CONCILIADO, PENDENTE, SUSPEITO, CATEGORIZADO
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabela de Logs de Auditoria (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Tabela de Perfis de Usuário (User Profiles)
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(36) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tabela de Convites de Acesso (User Invites)
CREATE TABLE IF NOT EXISTS user_invites (
    id VARCHAR(36) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Máxima Performance de Consultas Financeiras
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_operation ON transactions(operation_type);
CREATE INDEX IF NOT EXISTS idx_transactions_reconciled ON transactions(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_rules_keyword ON classification_rules(keyword);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
