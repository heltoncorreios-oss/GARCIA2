import { BankAccount, Category, ClassificationRule, OperationTypeInfo, Transaction } from '../src/types';

export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc_itau',
    bankCode: '341',
    bankName: 'Banco Itaú S.A.',
    accountName: 'Itaú - Conta Movimento Supermercado',
    agency: '1240',
    accountNumber: '45890-2',
    accountType: 'CORRENTE',
    initialBalance: 120000.00,
    initialBalanceDate: '2026-08-01',
    currentBalance: 185420.50,
    isActive: true,
    color: '#ea580c',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'acc_bradesco',
    bankCode: '237',
    bankName: 'Banco Bradesco S.A.',
    accountName: 'Bradesco - Cobrança e Boletos',
    agency: '0450',
    accountNumber: '29871-0',
    accountType: 'CORRENTE',
    initialBalance: 85000.00,
    initialBalanceDate: '2026-08-01',
    currentBalance: 104250.00,
    isActive: true,
    color: '#dc2626',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'acc_bb',
    bankCode: '001',
    bankName: 'Banco do Brasil S.A.',
    accountName: 'BB - Folha & Encargos',
    agency: '3210-5',
    accountNumber: '10982-3',
    accountType: 'CORRENTE',
    initialBalance: 40000.00,
    initialBalanceDate: '2026-08-01',
    currentBalance: 32410.80,
    isActive: true,
    color: '#2563eb',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'acc_stone',
    bankCode: '197',
    bankName: 'Stone Instituição de Pagamento',
    accountName: 'Stone - Domicílio Cartões PDV',
    agency: '0001',
    accountNumber: '782910-1',
    accountType: 'APLICACAO',
    initialBalance: 50000.00,
    initialBalanceDate: '2026-08-01',
    currentBalance: 78900.00,
    isActive: true,
    color: '#16a34a',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'acc_caixa',
    bankCode: '000',
    bankName: 'Tesouraria Interna',
    accountName: 'Cofre & Gavetas de Caixa (Dinheiro Físico)',
    agency: '0000',
    accountNumber: '00001-0',
    accountType: 'CAIXA_FISICO',
    initialBalance: 15000.00,
    initialBalanceDate: '2026-08-01',
    currentBalance: 21300.00,
    isActive: true,
    color: '#0d9488',
    createdAt: '2026-01-01T00:00:00Z'
  }
];

// EXACT 10 OPERATION TYPES FOLLOWING USER SPECIFICATION & ORDER
export const INITIAL_OPERATION_TYPES: OperationTypeInfo[] = [
  { id: 'op_bol_rec', code: 'BOLETO_RECEBIDO', name: 'Boleto recebido', defaultType: 'ENTRADA', badgeColor: 'emerald' },
  { id: 'op_cart_rec', code: 'CARTAO_RECEBIDO', name: 'Cartão recebido', defaultType: 'ENTRADA', badgeColor: 'indigo' },
  { id: 'op_chq_comp', code: 'CHEQUE_COMPENSADO', name: 'Cheque compensado', defaultType: 'SAIDA', badgeColor: 'amber' },
  { id: 'op_deb_auto', code: 'DEBITO_AUTOMATICO', name: 'Débito Automático', defaultType: 'SAIDA', badgeColor: 'cyan' },
  { id: 'op_pagto_bol', code: 'PAGTO_BOLETOS', name: 'Pagto de boletos', defaultType: 'SAIDA', badgeColor: 'rose' },
  { id: 'op_pix_cnpj', code: 'PIX_CNPJ', name: 'Pix Cnpj', defaultType: 'ENTRADA', badgeColor: 'teal' },
  { id: 'op_pix_qr', code: 'PIX_QR_CODE', name: 'Pix QR Code', defaultType: 'ENTRADA', badgeColor: 'blue' },
  { id: 'op_rend_aplc', code: 'RENDIMENTO_APLICACAO', name: 'Rendimento de aplicação', defaultType: 'ENTRADA', badgeColor: 'violet' },
  { id: 'op_taxas_tar', code: 'TAXAS_TARIFAS', name: 'Taxas e Tarifas', defaultType: 'SAIDA', badgeColor: 'red' },
  { id: 'op_transf_rec', code: 'TRANSFERENCIA_RECEBIDA', name: 'Transferencia recebida', defaultType: 'ENTRADA', badgeColor: 'sky' }
];

// EXACT 10 REGISTERED CATEGORIES IN EXACT SPECIFIED ORDER
export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat_boleto_recebido',
    name: 'Boleto recebido',
    type: 'ENTRADA',
    icon: 'FileText',
    color: '#10b981',
    isSystem: true,
    subcategories: [
      { id: 'sub_bol_rec_cobranca', categoryId: 'cat_boleto_recebido', name: 'Liquidação de Cobrança' }
    ]
  },
  {
    id: 'cat_cartao_recebido',
    name: 'Cartão recebido',
    type: 'ENTRADA',
    icon: 'CreditCard',
    color: '#6366f1',
    isSystem: true,
    subcategories: [
      { id: 'sub_cartao_cielo', categoryId: 'cat_cartao_recebido', name: 'Cielo / Cartões' },
      { id: 'sub_cartao_alelo', categoryId: 'cat_cartao_recebido', name: 'Alelo' },
      { id: 'sub_cartao_greencard', categoryId: 'cat_cartao_recebido', name: 'Green Card' },
      { id: 'sub_cartao_naip', categoryId: 'cat_cartao_recebido', name: 'Naip' },
      { id: 'sub_cartao_ticket', categoryId: 'cat_cartao_recebido', name: 'Ticket Serviços' },
      { id: 'sub_cartao_vr', categoryId: 'cat_cartao_recebido', name: 'VR Benefícios' },
      { id: 'sub_cartao_dm', categoryId: 'cat_cartao_recebido', name: 'DM Meios de Pagamento' },
      { id: 'sub_cartao_solucard', categoryId: 'cat_cartao_recebido', name: 'Solucard' },
      { id: 'sub_cartao_up', categoryId: 'cat_cartao_recebido', name: 'Up Brasil' },
      { id: 'sub_cartao_verocheque', categoryId: 'cat_cartao_recebido', name: 'Verocheque Refeições' },
      { id: 'sub_cartao_elo', categoryId: 'cat_cartao_recebido', name: 'Voucher Elo' }
    ]
  },
  {
    id: 'cat_cheque_compensado',
    name: 'Cheque compensado',
    type: 'SAIDA',
    icon: 'Banknote',
    color: '#f59e0b',
    isSystem: true,
    subcategories: [
      { id: 'sub_chq_pago', categoryId: 'cat_cheque_compensado', name: 'Cheque Pago / Compensado' }
    ]
  },
  {
    id: 'cat_debito_automatico',
    name: 'Débito Automático',
    type: 'SAIDA',
    icon: 'Zap',
    color: '#06b6d4',
    isSystem: true,
    subcategories: [
      { id: 'sub_deb_agua', categoryId: 'cat_debito_automatico', name: 'Conta de Água (Sabesp)' },
      { id: 'sub_deb_luz', categoryId: 'cat_debito_automatico', name: 'Conta de Luz (CPFL)' }
    ]
  },
  {
    id: 'cat_pagto_boletos',
    name: 'Pagto de boletos',
    type: 'SAIDA',
    icon: 'Receipt',
    color: '#ef4444',
    isSystem: true,
    subcategories: [
      { id: 'sub_pagto_bol_forn', categoryId: 'cat_pagto_boletos', name: 'Boletos Fornecedores & Mercadorias' },
      { id: 'sub_pagto_bol_serv', categoryId: 'cat_pagto_boletos', name: 'Boletos Serviços & Diversos' }
    ]
  },
  {
    id: 'cat_pix_cnpj',
    name: 'Pix Cnpj',
    type: 'ENTRADA',
    icon: 'Building2',
    color: '#0d9488',
    isSystem: true,
    subcategories: [
      { id: 'sub_pix_cnpj_cli', categoryId: 'cat_pix_cnpj', name: 'PIX Recebido CNPJ / Clientes' }
    ]
  },
  {
    id: 'cat_pix_qr_code',
    name: 'Pix QR Code',
    type: 'ENTRADA',
    icon: 'QrCode',
    color: '#0284c7',
    isSystem: true,
    subcategories: [
      { id: 'sub_pix_qr_dinamico', categoryId: 'cat_pix_qr_code', name: 'PIX QR Code Dinâmico PDV' }
    ]
  },
  {
    id: 'cat_rendimento_aplicacao',
    name: 'Rendimento de aplicação',
    type: 'ENTRADA',
    icon: 'TrendingUp',
    color: '#8b5cf6',
    isSystem: true,
    subcategories: [
      { id: 'sub_rend_facilcred', categoryId: 'cat_rendimento_aplicacao', name: 'Rentar Invest / Facilcred' }
    ]
  },
  {
    id: 'cat_taxas_tarifas',
    name: 'Taxas e Tarifas',
    type: 'SAIDA',
    icon: 'Percent',
    color: '#be123c',
    isSystem: true,
    subcategories: [
      { id: 'sub_taxas_bancarias', categoryId: 'cat_taxas_tarifas', name: 'Tarifas Bancárias e Cesta PJ' },
      { id: 'sub_taxas_pix', categoryId: 'cat_taxas_tarifas', name: 'Tarifas QR Code PIX' },
      { id: 'sub_taxas_cobranca', categoryId: 'cat_taxas_tarifas', name: 'Tarifas Registro Cobrança' }
    ]
  },
  {
    id: 'cat_transf_recebida',
    name: 'Transferencia recebida',
    type: 'ENTRADA',
    icon: 'ArrowDownLeft',
    color: '#3b82f6',
    isSystem: true,
    subcategories: [
      { id: 'sub_transf_ted_rec', categoryId: 'cat_transf_recebida', name: 'TED / Transf Recebida' },
      { id: 'sub_transf_cc_rec', categoryId: 'cat_transf_recebida', name: 'Transf CC para CC Recebidas' }
    ]
  }
];

export const INITIAL_RULES: ClassificationRule[] = [
  // 1. BOLETO RECEBIDO
  {
    id: 'rule_bol_rec_1',
    keyword: 'LIQUIDACAO DE COBRANCA VALOR DISPONIVEL',
    operationType: 'Boleto recebido',
    categoryId: 'cat_boleto_recebido',
    categoryName: 'Boleto recebido',
    subcategoryId: 'sub_bol_rec_cobranca',
    subcategoryName: 'Liquidação de Cobrança',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_bol_rec_2',
    keyword: 'LIQUIDACAO DE COBRANCA',
    operationType: 'Boleto recebido',
    categoryId: 'cat_boleto_recebido',
    categoryName: 'Boleto recebido',
    subcategoryId: 'sub_bol_rec_cobranca',
    subcategoryName: 'Liquidação de Cobrança',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 2. CARTÃO RECEBIDO (Adquirentes & Vouchers: Elo, Cielo, VR, Alelo, Naip, Ticket, DM Meios, Solucard, Verocheque, Up Brasil)
  {
    id: 'rule_cart_elo_1',
    keyword: 'COMPRA CARTAO VISA ELO S.A. - INSTITUICAO DE PAG',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_elo',
    subcategoryName: 'Voucher Elo',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_elo_2',
    keyword: 'COMPRA CARTAO VISA ELO',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_elo',
    subcategoryName: 'Voucher Elo',
    confidence: 'ALTA',
    priority: 29,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_elo_3',
    keyword: 'VOUCHER ELO - CIELO S.A. - INSTITUICAO DE PAG',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_elo',
    subcategoryName: 'Voucher Elo',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_cielo_1',
    keyword: 'PIX RECEBIDO REM: CIELO S.A - INSTITUICAO',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_cielo',
    subcategoryName: 'Cielo / Cartões',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_cielo_2',
    keyword: 'PIX RECEBIDO REM: CIELO',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_cielo',
    subcategoryName: 'Cielo / Cartões',
    confidence: 'ALTA',
    priority: 29,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_vr_1',
    keyword: 'PIX RECEBIDO REM: VR BENEFICIOS SERV PRO',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_vr',
    subcategoryName: 'VR Benefícios',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_vr_2',
    keyword: 'PIX RECEBIDO REM: VR BENEFICIOS',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_vr',
    subcategoryName: 'VR Benefícios',
    confidence: 'ALTA',
    priority: 29,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_alelo_1',
    keyword: 'RECEBIMENTO FORNECEDOR ALELO INSTITUICAO DE PAGAMENTO S',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_alelo',
    subcategoryName: 'Alelo',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_alelo_2',
    keyword: 'RECEBIMENTO FORNECEDOR ALELO',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_alelo',
    subcategoryName: 'Alelo',
    confidence: 'ALTA',
    priority: 29,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_naip_1',
    keyword: 'RECEBIMENTO FORNECEDOR NAIP INSTITUICAO DE PAGAMENTO SA',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_naip',
    subcategoryName: 'Naip',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_ticket_1',
    keyword: 'RECEBIMENTO FORNECEDOR TICKET SERVICOS S A',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_ticket',
    subcategoryName: 'Ticket Serviços',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_vr_rec_1',
    keyword: 'RECEBIMENTO FORNECEDOR VR BENEFICIOS E SERVICOS DE',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_vr',
    subcategoryName: 'VR Benefícios',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_dm_1',
    keyword: 'TED-TRANSF ELET DISPON REMET.DM MEIOS DE PAGAMENT',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_dm',
    subcategoryName: 'DM Meios de Pagamento',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_solu_1',
    keyword: 'TED-TRANSF ELET DISPON REMET.SOLUCARD ADMINISTRAO',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_solucard',
    subcategoryName: 'Solucard',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_vero_1',
    keyword: 'TED-TRANSF ELET DISPON REMET.VEROCHEQUE REFEICOES',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_verocheque',
    subcategoryName: 'Verocheque Refeições',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_cart_gen_1',
    keyword: 'COMPRA CARTAO',
    operationType: 'Cartão recebido',
    categoryId: 'cat_cartao_recebido',
    categoryName: 'Cartão recebido',
    subcategoryId: 'sub_cartao_cielo',
    subcategoryName: 'Cielo / Cartões',
    confidence: 'ALTA',
    priority: 25,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 3. CHEQUE COMPENSADO
  {
    id: 'rule_chq_comp_1',
    keyword: 'CHEQUE COMPENSADO',
    operationType: 'Cheque compensado',
    categoryId: 'cat_cheque_compensado',
    categoryName: 'Cheque compensado',
    subcategoryId: 'sub_chq_pago',
    subcategoryName: 'Cheque Pago / Compensado',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_chq_comp_2',
    keyword: 'CHEQUE PAGO',
    operationType: 'Cheque compensado',
    categoryId: 'cat_cheque_compensado',
    categoryName: 'Cheque compensado',
    subcategoryId: 'sub_chq_pago',
    subcategoryName: 'Cheque Pago / Compensado',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 4. DÉBITO AUTOMÁTICO (Sabesp, CPFL)
  {
    id: 'rule_deb_agua_1',
    keyword: 'CONTA DE AGUA SABESP',
    operationType: 'Débito Automático',
    categoryId: 'cat_debito_automatico',
    categoryName: 'Débito Automático',
    subcategoryId: 'sub_deb_agua',
    subcategoryName: 'Conta de Água (Sabesp)',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_deb_agua_2',
    keyword: 'SABESP',
    operationType: 'Débito Automático',
    categoryId: 'cat_debito_automatico',
    categoryName: 'Débito Automático',
    subcategoryId: 'sub_deb_agua',
    subcategoryName: 'Conta de Água (Sabesp)',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_deb_luz_1',
    keyword: 'CONTA DE LUZ CPFL PAULISTA',
    operationType: 'Débito Automático',
    categoryId: 'cat_debito_automatico',
    categoryName: 'Débito Automático',
    subcategoryId: 'sub_deb_luz',
    subcategoryName: 'Conta de Luz (CPFL)',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_deb_luz_2',
    keyword: 'CPFL PAULISTA',
    operationType: 'Débito Automático',
    categoryId: 'cat_debito_automatico',
    categoryName: 'Débito Automático',
    subcategoryId: 'sub_deb_luz',
    subcategoryName: 'Conta de Luz (CPFL)',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 5. PAGTO DE BOLETOS (Fornecedores: Ambev, BRF, Nestlé, Pepsico, Seara, SPAL / Coca Cola, Souza Cruz, etc.)
  {
    id: 'rule_pag_bol_1',
    keyword: 'PAGTO ELETRON COBRANCA',
    operationType: 'Pagto de boletos',
    categoryId: 'cat_pagto_boletos',
    categoryName: 'Pagto de boletos',
    subcategoryId: 'sub_pagto_bol_forn',
    subcategoryName: 'Boletos Fornecedores & Mercadorias',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_pag_bol_2',
    keyword: 'PAGTO ELETRON',
    operationType: 'Pagto de boletos',
    categoryId: 'cat_pagto_boletos',
    categoryName: 'Pagto de boletos',
    subcategoryId: 'sub_pagto_bol_forn',
    subcategoryName: 'Boletos Fornecedores & Mercadorias',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_pag_bol_3',
    keyword: 'PAGTO ELETRONICO',
    operationType: 'Pagto de boletos',
    categoryId: 'cat_pagto_boletos',
    categoryName: 'Pagto de boletos',
    subcategoryId: 'sub_pagto_bol_forn',
    subcategoryName: 'Boletos Fornecedores & Mercadorias',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_pag_bol_4',
    keyword: 'PAGAMENTO BOLETO',
    operationType: 'Pagto de boletos',
    categoryId: 'cat_pagto_boletos',
    categoryName: 'Pagto de boletos',
    subcategoryId: 'sub_pagto_bol_forn',
    subcategoryName: 'Boletos Fornecedores & Mercadorias',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 6. PIX QR CODE (Dinâmico PDV)
  {
    id: 'rule_pix_qr_1',
    keyword: 'PIX QR CODE DINAM:',
    operationType: 'Pix QR Code',
    categoryId: 'cat_pix_qr_code',
    categoryName: 'Pix QR Code',
    subcategoryId: 'sub_pix_qr_dinamico',
    subcategoryName: 'PIX QR Code Dinâmico PDV',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_pix_qr_2',
    keyword: 'PIX QR CODE DINAM',
    operationType: 'Pix QR Code',
    categoryId: 'cat_pix_qr_code',
    categoryName: 'Pix QR Code',
    subcategoryId: 'sub_pix_qr_dinamico',
    subcategoryName: 'PIX QR Code Dinâmico PDV',
    confidence: 'ALTA',
    priority: 29,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_pix_qr_3',
    keyword: 'PIX QR CODE',
    operationType: 'Pix QR Code',
    categoryId: 'cat_pix_qr_code',
    categoryName: 'Pix QR Code',
    subcategoryId: 'sub_pix_qr_dinamico',
    subcategoryName: 'PIX QR Code Dinâmico PDV',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_pix_qr_4',
    keyword: 'QR CODE DINAM',
    operationType: 'Pix QR Code',
    categoryId: 'cat_pix_qr_code',
    categoryName: 'Pix QR Code',
    subcategoryId: 'sub_pix_qr_dinamico',
    subcategoryName: 'PIX QR Code Dinâmico PDV',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 7. PIX CNPJ (Todos os PIX recebidos de clientes/empresas)
  {
    id: 'rule_pix_cnpj_1',
    keyword: 'PIX RECEBIDO REM:',
    operationType: 'Pix Cnpj',
    categoryId: 'cat_pix_cnpj',
    categoryName: 'Pix Cnpj',
    subcategoryId: 'sub_pix_cnpj_cli',
    subcategoryName: 'PIX Recebido CNPJ / Clientes',
    confidence: 'ALTA',
    priority: 26,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_pix_cnpj_2',
    keyword: 'PIX RECEBIDO',
    operationType: 'Pix Cnpj',
    categoryId: 'cat_pix_cnpj',
    categoryName: 'Pix Cnpj',
    subcategoryId: 'sub_pix_cnpj_cli',
    subcategoryName: 'PIX Recebido CNPJ / Clientes',
    confidence: 'ALTA',
    priority: 24,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 8. RENDIMENTO DE APLICAÇÃO
  {
    id: 'rule_rend_1',
    keyword: 'RENTAB.INVEST FACILCRED',
    operationType: 'Rendimento de aplicação',
    categoryId: 'cat_rendimento_aplicacao',
    categoryName: 'Rendimento de aplicação',
    subcategoryId: 'sub_rend_facilcred',
    subcategoryName: 'Rentab Invest / Facilcred',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_rend_2',
    keyword: 'RENTAB.INVEST',
    operationType: 'Rendimento de aplicação',
    categoryId: 'cat_rendimento_aplicacao',
    categoryName: 'Rendimento de aplicação',
    subcategoryId: 'sub_rend_facilcred',
    subcategoryName: 'Rentab Invest / Facilcred',
    confidence: 'ALTA',
    priority: 29,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_rend_3',
    keyword: 'FACILCRED',
    operationType: 'Rendimento de aplicação',
    categoryId: 'cat_rendimento_aplicacao',
    categoryName: 'Rendimento de aplicação',
    subcategoryId: 'sub_rend_facilcred',
    subcategoryName: 'Rentab Invest / Facilcred',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 9. TAXAS E TARIFAS
  {
    id: 'rule_tax_1',
    keyword: 'TARIFA BANCARIA LIQUIDACAO QRCODE PIX',
    operationType: 'Taxas e Tarifas',
    categoryId: 'cat_taxas_tarifas',
    categoryName: 'Taxas e Tarifas',
    subcategoryId: 'sub_taxas_pix',
    subcategoryName: 'Tarifas QR Code PIX',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_tax_2',
    keyword: 'TARIFA REGISTRO COBRANCA QUANDO DO REGISTRO',
    operationType: 'Taxas e Tarifas',
    categoryId: 'cat_taxas_tarifas',
    categoryName: 'Taxas e Tarifas',
    subcategoryId: 'sub_taxas_cobranca',
    subcategoryName: 'Tarifas Registro Cobrança',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_tax_3',
    keyword: 'TARIFA BANCARIA',
    operationType: 'Taxas e Tarifas',
    categoryId: 'cat_taxas_tarifas',
    categoryName: 'Taxas e Tarifas',
    subcategoryId: 'sub_taxas_bancarias',
    subcategoryName: 'Tarifas Bancárias e Cesta PJ',
    confidence: 'ALTA',
    priority: 27,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_tax_4',
    keyword: 'TARIFA REGISTRO COBRANCA',
    operationType: 'Taxas e Tarifas',
    categoryId: 'cat_taxas_tarifas',
    categoryName: 'Taxas e Tarifas',
    subcategoryId: 'sub_taxas_cobranca',
    subcategoryName: 'Tarifas Registro Cobrança',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },

  // 10. TRANSFERÊNCIA RECEBIDA (TED, DOC, Transf CC para CC)
  {
    id: 'rule_transf_1',
    keyword: 'TRANSF CC PARA CC RECEBIDAS',
    operationType: 'Transferencia recebida',
    categoryId: 'cat_transf_recebida',
    categoryName: 'Transferencia recebida',
    subcategoryId: 'sub_transf_cc_rec',
    subcategoryName: 'Transf CC para CC Recebidas',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_transf_2',
    keyword: 'RECEBIMENTO TED',
    operationType: 'Transferencia recebida',
    categoryId: 'cat_transf_recebida',
    categoryName: 'Transferencia recebida',
    subcategoryId: 'sub_transf_ted_rec',
    subcategoryName: 'TED / Transf Recebida',
    confidence: 'ALTA',
    priority: 30,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_transf_3',
    keyword: 'TED-TRANSF ELET DISPON',
    operationType: 'Transferencia recebida',
    categoryId: 'cat_transf_recebida',
    categoryName: 'Transferencia recebida',
    subcategoryId: 'sub_transf_ted_rec',
    subcategoryName: 'TED / Transf Recebida',
    confidence: 'ALTA',
    priority: 25,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'rule_transf_4',
    keyword: 'TRANSF CC PARA CC',
    operationType: 'Transferencia recebida',
    categoryId: 'cat_transf_recebida',
    categoryName: 'Transferencia recebida',
    subcategoryId: 'sub_transf_cc_rec',
    subcategoryName: 'Transf CC para CC Recebidas',
    confidence: 'ALTA',
    priority: 28,
    isActive: true,
    matchCount: 0,
    createdAt: '2026-01-01T00:00:00Z'
  }
];

export function generateSeedTransactions(): Transaction[] {
  const transactions: Transaction[] = [];

  // FIRST VALID BALANCE OF EXTRACT: 21/08/2026 -> Saldo Inicial R$ 151.839,95 (Crédito=0, Débito=0)
  transactions.push({
    id: 'tx_init_20260821',
    bankAccountId: 'acc_itau',
    bankAccountName: 'Itaú - Conta Movimento Supermercado',
    bankName: 'Banco Itaú S.A.',
    agency: '1240',
    date: '2026-08-21',
    competenceDate: '2026-08-21',
    description: 'SALDO INICIAL DO EXTRATO',
    normalizedDescription: 'SALDO INICIAL DO EXTRATO',
    amount: 0,
    type: 'ENTRADA',
    operationType: 'Boleto recebido',
    transactionHash: 'hash_init_20260821',
    balanceAfter: 151839.95,
    origin: 'EXTRATO',
    reconciliationStatus: 'CONCILIADO',
    confidence: 'ALTA',
    importDate: '2026-08-21T08:00:00Z',
    responsibleUser: 'Sistema'
  });

  const dates = [
    '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31',
    '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'
  ];

  let idCounter = 1000;

  dates.forEach((date) => {
    // 1. Cartão recebido (Cielo / Elo / VR)
    transactions.push({
      id: `tx_${idCounter++}`,
      bankAccountId: 'acc_itau',
      bankAccountName: 'Itaú - Conta Movimento Supermercado',
      bankName: 'Banco Itaú S.A.',
      agency: '1240',
      date,
      competenceDate: date,
      description: 'PIX RECEBIDO REM: CIELO S.A - INSTITUICAO',
      normalizedDescription: 'PIX RECEBIDO REM: CIELO S.A - INSTITUICAO',
      amount: 23800.50 + (Math.sin(idCounter) * 3200),
      type: 'ENTRADA',
      categoryId: 'cat_cartao_recebido',
      categoryName: 'Cartão recebido',
      subcategoryId: 'sub_cartao_cielo',
      subcategoryName: 'Cielo / Cartões',
      operationType: 'Cartão recebido',
      origin: 'EXTRATO',
      reconciliationStatus: 'CONCILIADO',
      confidence: 'ALTA',
      importDate: `${date}T19:15:00Z`,
      responsibleUser: 'Mariana Souza (Gerente Financeiro)',
      externalId: `CIELO_${idCounter}`,
      transactionHash: `hash_cielo_${date}_${idCounter}`
    });

    // 2. Pix QR Code Dinâmico PDV
    transactions.push({
      id: `tx_${idCounter++}`,
      bankAccountId: 'acc_itau',
      bankAccountName: 'Itaú - Conta Movimento Supermercado',
      bankName: 'Banco Itaú S.A.',
      agency: '1240',
      date,
      competenceDate: date,
      description: 'PIX QR CODE DINAM: REM: ALYSON DE OLIVEIRA',
      normalizedDescription: 'PIX QR CODE DINAM: REM: ALYSON DE OLIVEIRA',
      amount: 14250.80 + (Math.cos(idCounter) * 2100),
      type: 'ENTRADA',
      categoryId: 'cat_pix_qr_code',
      categoryName: 'Pix QR Code',
      subcategoryId: 'sub_pix_qr_dinamico',
      subcategoryName: 'PIX QR Code Dinâmico PDV',
      operationType: 'Pix QR Code',
      origin: 'EXTRATO',
      reconciliationStatus: 'CONCILIADO',
      confidence: 'ALTA',
      importDate: `${date}T18:30:00Z`,
      responsibleUser: 'Mariana Souza (Gerente Financeiro)',
      externalId: `QR_${idCounter}`,
      transactionHash: `hash_qr_${date}_${idCounter}`
    });

    // 3. Pix Cnpj (Clientes / Empresas)
    transactions.push({
      id: `tx_${idCounter++}`,
      bankAccountId: 'acc_stone',
      bankAccountName: 'Stone - Domicílio Cartões PDV',
      bankName: 'Stone Instituição de Pagamento',
      agency: '0001',
      date,
      competenceDate: date,
      description: 'PIX RECEBIDO REM: COM.L PULMIER ALIMENT',
      normalizedDescription: 'PIX RECEBIDO REM: COM.L PULMIER ALIMENT',
      amount: 5400.00 + (Math.sin(idCounter * 2) * 800),
      type: 'ENTRADA',
      categoryId: 'cat_pix_cnpj',
      categoryName: 'Pix Cnpj',
      subcategoryId: 'sub_pix_cnpj_cli',
      subcategoryName: 'PIX Recebido CNPJ / Clientes',
      operationType: 'Pix Cnpj',
      origin: 'EXTRATO',
      reconciliationStatus: 'CONCILIADO',
      confidence: 'ALTA',
      importDate: `${date}T16:00:00Z`,
      responsibleUser: 'Mariana Souza (Gerente Financeiro)',
      externalId: `PIX_CNPJ_${idCounter}`,
      transactionHash: `hash_pix_cnpj_${date}_${idCounter}`
    });

    // 4. Boleto recebido (Liquidação de cobrança)
    transactions.push({
      id: `tx_${idCounter++}`,
      bankAccountId: 'acc_bradesco',
      bankAccountName: 'Bradesco - Cobrança e Boletos',
      bankName: 'Banco Bradesco S.A.',
      agency: '0450',
      date,
      competenceDate: date,
      description: 'LIQUIDACAO DE COBRANCA VALOR DISPONIVEL',
      normalizedDescription: 'LIQUIDACAO DE COBRANCA VALOR DISPONIVEL',
      amount: 11200.00 + (Math.abs(Math.sin(idCounter)) * 2500),
      type: 'ENTRADA',
      categoryId: 'cat_boleto_recebido',
      categoryName: 'Boleto recebido',
      subcategoryId: 'sub_bol_rec_cobranca',
      subcategoryName: 'Liquidação de Cobrança',
      operationType: 'Boleto recebido',
      origin: 'EXTRATO',
      reconciliationStatus: 'CONCILIADO',
      confidence: 'ALTA',
      importDate: `${date}T17:00:00Z`,
      responsibleUser: 'Mariana Souza (Gerente Financeiro)',
      externalId: `COBR_${idCounter}`,
      transactionHash: `hash_cobr_${date}_${idCounter}`
    });

    // 5. Transferencia recebida (TED / Transf CC)
    transactions.push({
      id: `tx_${idCounter++}`,
      bankAccountId: 'acc_itau',
      bankAccountName: 'Itaú - Conta Movimento Supermercado',
      bankName: 'Banco Itaú S.A.',
      agency: '1240',
      date,
      competenceDate: date,
      description: 'TRANSF CC PARA CC RECEBIDAS MERCADINHO PAULIST',
      normalizedDescription: 'TRANSF CC PARA CC RECEBIDAS MERCADINHO PAULIST',
      amount: 4800.00 + (Math.abs(Math.cos(idCounter)) * 900),
      type: 'ENTRADA',
      categoryId: 'cat_transf_recebida',
      categoryName: 'Transferencia recebida',
      subcategoryId: 'sub_transf_cc_rec',
      subcategoryName: 'Transf CC para CC Recebidas',
      operationType: 'Transferencia recebida',
      origin: 'EXTRATO',
      reconciliationStatus: 'CONCILIADO',
      confidence: 'ALTA',
      importDate: `${date}T14:00:00Z`,
      responsibleUser: 'Mariana Souza (Gerente Financeiro)',
      externalId: `TRANSF_${idCounter}`,
      transactionHash: `hash_transf_${date}_${idCounter}`
    });

    // 6. Pagto de boletos (Fornecedores: Ambev, Nestlé, BRF)
    transactions.push({
      id: `tx_${idCounter++}`,
      bankAccountId: 'acc_itau',
      bankAccountName: 'Itaú - Conta Movimento Supermercado',
      bankName: 'Banco Itaú S.A.',
      agency: '1240',
      date,
      competenceDate: date,
      description: 'PAGTO ELETRON COBRANCA AMBEV S A',
      normalizedDescription: 'PAGTO ELETRON COBRANCA AMBEV S A',
      amount: 12500.00 + (Math.abs(Math.cos(idCounter)) * 3400),
      type: 'SAIDA',
      categoryId: 'cat_pagto_boletos',
      categoryName: 'Pagto de boletos',
      subcategoryId: 'sub_pagto_bol_forn',
      subcategoryName: 'Boletos Fornecedores & Mercadorias',
      operationType: 'Pagto de boletos',
      origin: 'EXTRATO',
      reconciliationStatus: 'CONCILIADO',
      confidence: 'ALTA',
      importDate: `${date}T10:00:00Z`,
      responsibleUser: 'Mariana Souza (Gerente Financeiro)',
      externalId: `BOL_${idCounter}`,
      transactionHash: `hash_bol_${date}_${idCounter}`
    });

    // 7. Taxas e Tarifas
    transactions.push({
      id: `tx_${idCounter++}`,
      bankAccountId: 'acc_itau',
      bankAccountName: 'Itaú - Conta Movimento Supermercado',
      bankName: 'Banco Itaú S.A.',
      agency: '1240',
      date,
      competenceDate: date,
      description: 'TARIFA BANCARIA LIQUIDACAO QRCODE PIX',
      normalizedDescription: 'TARIFA BANCARIA LIQUIDACAO QRCODE PIX',
      amount: 45.80,
      type: 'SAIDA',
      categoryId: 'cat_taxas_tarifas',
      categoryName: 'Taxas e Tarifas',
      subcategoryId: 'sub_taxas_pix',
      subcategoryName: 'Tarifas QR Code PIX',
      operationType: 'Taxas e Tarifas',
      origin: 'EXTRATO',
      reconciliationStatus: 'CONCILIADO',
      confidence: 'ALTA',
      importDate: `${date}T02:00:00Z`,
      responsibleUser: 'Sistema Automático',
      externalId: `TAR_${idCounter}`,
      transactionHash: `hash_tar_${date}_${idCounter}`
    });
  });

  // Specific key transactions on key dates:
  // Rendimento de aplicação
  transactions.push({
    id: `tx_${idCounter++}`,
    bankAccountId: 'acc_stone',
    bankAccountName: 'Stone - Domicílio Cartões PDV',
    bankName: 'Stone Instituição de Pagamento',
    agency: '0001',
    date: '2026-08-31',
    competenceDate: '2026-08-31',
    description: 'RENTAR.INVEST FACILCRED*',
    normalizedDescription: 'RENTAR.INVEST FACILCRED*',
    amount: 1640.20,
    type: 'ENTRADA',
    categoryId: 'cat_rendimento_aplicacao',
    categoryName: 'Rendimento de aplicação',
    subcategoryId: 'sub_rend_facilcred',
    subcategoryName: 'Rentar Invest / Facilcred',
    operationType: 'Rendimento de aplicação',
    origin: 'EXTRATO',
    reconciliationStatus: 'CONCILIADO',
    confidence: 'ALTA',
    importDate: '2026-08-31T23:59:00Z',
    responsibleUser: 'Sistema Automático',
    externalId: 'REND_FACILCRED_08',
    transactionHash: 'hash_rend_facilcred_08'
  });

  // Débito Automático CPFL
  transactions.push({
    id: `tx_${idCounter++}`,
    bankAccountId: 'acc_itau',
    bankAccountName: 'Itaú - Conta Movimento Supermercado',
    bankName: 'Banco Itaú S.A.',
    agency: '1240',
    date: '2026-09-04',
    competenceDate: '2026-09-04',
    description: 'CONTA DE LUZ CPFL PAULISTA 08/2026',
    normalizedDescription: 'CONTA DE LUZ CPFL PAULISTA 08/2026',
    amount: 14850.90,
    type: 'SAIDA',
    categoryId: 'cat_debito_automatico',
    categoryName: 'Débito Automático',
    subcategoryId: 'sub_deb_luz',
    subcategoryName: 'Conta de Luz (CPFL)',
    operationType: 'Débito Automático',
    origin: 'EXTRATO',
    reconciliationStatus: 'CONCILIADO',
    confidence: 'ALTA',
    importDate: '2026-09-04T12:00:00Z',
    responsibleUser: 'Mariana Souza (Gerente Financeiro)',
    externalId: 'CPFL_09_2026',
    transactionHash: 'hash_cpfl_09_2026'
  });

  // Débito Automático Sabesp
  transactions.push({
    id: `tx_${idCounter++}`,
    bankAccountId: 'acc_itau',
    bankAccountName: 'Itaú - Conta Movimento Supermercado',
    bankName: 'Banco Itaú S.A.',
    agency: '1240',
    date: '2026-09-05',
    competenceDate: '2026-09-05',
    description: 'CONTA DE AGUA SABESP 08/2026',
    normalizedDescription: 'CONTA DE AGUA SABESP 08/2026',
    amount: 2450.00,
    type: 'SAIDA',
    categoryId: 'cat_debito_automatico',
    categoryName: 'Débito Automático',
    subcategoryId: 'sub_deb_agua',
    subcategoryName: 'Conta de Água (Sabesp)',
    operationType: 'Débito Automático',
    origin: 'EXTRATO',
    reconciliationStatus: 'CONCILIADO',
    confidence: 'ALTA',
    importDate: '2026-09-05T12:00:00Z',
    responsibleUser: 'Mariana Souza (Gerente Financeiro)',
    externalId: 'SABESP_09_2026',
    transactionHash: 'hash_sabesp_09_2026'
  });

  // Cheque Compensado
  transactions.push({
    id: `tx_${idCounter++}`,
    bankAccountId: 'acc_bb',
    bankAccountName: 'BB - Folha & Encargos',
    bankName: 'Banco do Brasil S.A.',
    agency: '3210-5',
    date: '2026-09-03',
    competenceDate: '2026-09-03',
    description: 'CHEQUE COMPENSADO NR 004892',
    normalizedDescription: 'CHEQUE COMPENSADO NR 004892',
    amount: 6500.00,
    type: 'SAIDA',
    categoryId: 'cat_cheque_compensado',
    categoryName: 'Cheque compensado',
    subcategoryId: 'sub_chq_pago',
    subcategoryName: 'Cheque Pago / Compensado',
    operationType: 'Cheque compensado',
    origin: 'EXTRATO',
    reconciliationStatus: 'CONCILIADO',
    confidence: 'ALTA',
    importDate: '2026-09-03T11:00:00Z',
    responsibleUser: 'Mariana Souza (Gerente Financeiro)',
    externalId: 'CHQ_004892',
    transactionHash: 'hash_chq_004892'
  });

  // Tarifa Registro Cobrança
  transactions.push({
    id: `tx_${idCounter++}`,
    bankAccountId: 'acc_bradesco',
    bankAccountName: 'Bradesco - Cobrança e Boletos',
    bankName: 'Banco Bradesco S.A.',
    agency: '0450',
    date: '2026-09-02',
    competenceDate: '2026-09-02',
    description: 'TARIFA REGISTRO COBRANCA QUANDO DO REGISTRO',
    normalizedDescription: 'TARIFA REGISTRO COBRANCA QUANDO DO REGISTRO',
    amount: 142.50,
    type: 'SAIDA',
    categoryId: 'cat_taxas_tarifas',
    categoryName: 'Taxas e Tarifas',
    subcategoryId: 'sub_taxas_cobranca',
    subcategoryName: 'Tarifas Registro Cobrança',
    operationType: 'Taxas e Tarifas',
    origin: 'EXTRATO',
    reconciliationStatus: 'CONCILIADO',
    confidence: 'ALTA',
    importDate: '2026-09-02T03:00:00Z',
    responsibleUser: 'Sistema Automático',
    externalId: 'TAR_REG_02',
    transactionHash: 'hash_tar_reg_02'
  });

  return transactions;
}
