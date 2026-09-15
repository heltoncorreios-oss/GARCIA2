export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  agency: string;
  accountNumber: string;
  accountType: 'CORRENTE' | 'POUPANCA' | 'APLICACAO' | 'CAIXA_FISICO';
  initialBalance: number;
  initialBalanceDate: string;
  currentBalance: number;
  lastStatementBalance?: number;
  lastStatementDate?: string;
  lastStatementBalanceDate?: string;
  initialStatementBalance?: number;
  isActive: boolean;
  color?: string;
  createdAt: string;
}

export type TransactionType = 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA_INTERNA' | 'SALDO_INICIAL';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  isSystem?: boolean;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
}

export interface OperationTypeInfo {
  id: string;
  code: string;
  name: string;
  defaultType: 'ENTRADA' | 'SAIDA' | 'AMBOS';
  badgeColor?: string;
}

export type ConfidenceLevel = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface ClassificationRule {
  id: string;
  keyword: string;
  operationType: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  confidence: ConfidenceLevel;
  priority: number;
  isActive: boolean;
  learnedFromUser?: boolean;
  allowMultipleSameDay?: boolean; // Permite múltiplos pagamentos/recebimentos no mesmo dia sem acusar duplicidade
  matchCount?: number;
  createdAt: string;
}

export type ReconciliationStatus = 'CONCILIADO' | 'PENDENTE' | 'DUPLICADO' | 'SUSPEITO';
export type TransactionOrigin = 'EXTRATO' | 'MANUAL';
export type ClassificationStatus = 'CLASSIFICADO' | 'PENDENTE' | 'MANUAL';

export interface Transaction {
  id: string;
  statementId?: string;
  statementFileName?: string;
  bankAccountId: string;
  bankAccountName?: string;
  bankName?: string;
  agency?: string;
  date: string; // YYYY-MM-DD (Data da movimentação)
  postingDate?: string; // Data de lançamento (quando disponível)
  competenceDate?: string;
  description: string;
  normalizedDescription?: string;
  amount: number;
  type: TransactionType;
  balanceAfter?: number; // Saldo após movimentação (quando disponível)
  sourceLineNumber?: number; // Linha de origem no arquivo original
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  operationType: string;
  classificationStatus?: ClassificationStatus;
  observation?: string;
  origin: TransactionOrigin;
  reconciliationStatus: ReconciliationStatus;
  confidence?: ConfidenceLevel;
  importDate: string;
  responsibleUser: string;
  externalId?: string;
  transactionHash: string;
  isDuplicateFlag?: boolean;
  duplicateReason?: string;
}

export type StatementFileType = 'OFX' | 'CSV' | 'XLSX' | 'TXT' | 'PDF';

export interface ExtractedStatementBalance {
  initialBalance?: number;
  initialBalanceDate?: string;
  finalBalance?: number;
  finalBalanceDate?: string;
  sourceDescription?: string;
}

export interface BankStatement {
  id: string;
  bankAccountId: string;
  bankAccountName?: string;
  fileName: string;
  fileType: StatementFileType;
  fileSize?: number;
  startDate: string;
  endDate: string;
  totalRecords: number;
  importedRecords: number;
  duplicateRecords: number;
  unclassifiedRecords: number;
  totalEntradasCount?: number;
  totalSaidasCount?: number;
  totalEntradasAmount?: number;
  totalSaidasAmount?: number;
  statementBalance?: number;
  finalBalance?: number;
  initialBalance?: number;
  initialBalanceDate?: string;
  initialStatementBalance?: number;
  balanceDate?: string;
  statementBalanceDate?: string;
  finalBalanceDate?: string;
  importedByUserName: string;
  importedAt: string;
}

export interface ColumnMapping {
  dateColumn?: string;
  postingDateColumn?: string;
  descriptionColumn?: string;
  amountColumn?: string;
  creditColumn?: string;
  debitColumn?: string;
  balanceColumn?: string;
  documentIdColumn?: string;
  typeColumn?: string;
  dateFormat?: string;
  decimalSeparator?: ',' | '.';
  headerRowIndex?: number;
  headerRowCount?: number;

  // Numeric index representations for flexible parsing
  dateCol?: number;
  postingDateCol?: number;
  descCol?: number;
  amountMode?: 'SINGLE_COLUMN' | 'SEPARATE_DEBIT_CREDIT';
  amountCol?: number;
  debitCol?: number;
  creditCol?: number;
  balanceCol?: number;
  typeCol?: number;
  docCol?: number;
  hasHeader?: boolean;
  invertedSigns?: boolean;
  delimiter?: string;
}

export interface TabularAnalysis {
  fileType: StatementFileType;
  delimiter?: string;
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: ColumnMapping;
  autoConfidence: ConfidenceLevel;
  totalLinesDetected: number;
}

export interface BankMappingTemplate {
  id: string;
  bankNameOrCode: string;
  templateName: string;
  fileType: 'CSV' | 'XLSX' | 'TXT';
  mapping: ColumnMapping;
  createdAt: string;
  updatedAt: string;
}

export interface ImportPreviewItem {
  id: string;
  tempId: string;
  date: string;
  postingDate?: string;
  description: string;
  normalizedDescription?: string;
  rawAmount: number;
  amount: number;
  type: TransactionType;
  balanceAfter?: number;
  sourceLineNumber?: number;
  fileRowIndex?: number;
  operationType: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  confidence: ConfidenceLevel;
  classificationStatus?: ClassificationStatus;
  isDuplicate: boolean;
  duplicateLevel?: 'EXACT' | 'NO_DOCUMENT' | 'POSSIBLE' | 'FILE_INTERNAL' | 'SIMILAR' | 'NONE';
  duplicateMatchReason?: 'DUPLICIDADE_EXATA' | 'POSSIVEL_DUPLICIDADE' | 'REGISTROS_SEMELHANTES' | 'DUPLICIDADE_INTERNA_ARQUIVO';
  duplicateSource?: 'BANCO' | 'ARQUIVO';
  duplicateReason?: string;
  existingTransaction?: Transaction;
  forceImport?: boolean;
  resolvedDuplicate?: 'KEPT_EXISTING' | 'FORCED_IMPORT';
  hasError: boolean;
  errorMessage?: string;
  isAutoClassified: boolean;
  selected: boolean;
  externalId?: string;
  transactionHash: string;
}

export interface ImportPreviewSummary {
  totalRecords: number;
  newRecords: number;
  duplicateRecords: number;
  errorRecords: number;
  autoClassifiedRecords: number;
  unclassifiedRecords: number;
  totalEntradas: number;
  totalSaidas: number;
  totalEntradasCount?: number;
  totalSaidasCount?: number;
  detectedFileType?: StatementFileType;
  detectedAccountName?: string;
  detectedStatementBalance?: ExtractedStatementBalance;
  extractedBalance?: ExtractedStatementBalance;
  isPreviouslyImportedStatement?: boolean;
  previouslyImportedDetails?: {
    totalDuplicates: number;
    duplicatePercentage: number;
    minDate?: string;
    maxDate?: string;
    existingStatementFileName?: string;
    existingStatementImportedAt?: string;
    reason?: 'SAME_FILENAME' | 'SAME_PERIOD' | 'HIGH_DUPLICATE_RATIO';
  };
  items: ImportPreviewItem[];
}

export type PeriodFilter = 
  | 'hoje'
  | 'ontem'
  | 'ultimos-7-dias'
  | 'ultimos-30-dias'
  | 'este-mes'
  | 'mes-anterior'
  | 'este-ano'
  | 'todos'
  | 'personalizado';

export interface DashboardMetrics {
  currentBalance: number;
  totalEntradas: number;
  totalSaidas: number;
  resultadoFinanceiro: number;
  // Totals by operation / category requested
  totalPix: number;
  totalCartaoDebito: number;
  totalCartaoCredito: number;
  totalDinheiro: number;
  totalPagamentosSaidas: number;
  totalTransferencias: number;
  totalTarifasBancarias: number;
  totalDepositos: number;
  totalBoletosPagos: number;
  totalOutrasOperacoes: number;
  // Calculations requested
  totalTransactionsCount: number;
  entradasCount: number;
  saidasCount: number;
  transferenciasCount: number;
  transferenciasSum: number;
  ticketMedioEntradas: number;
  ticketMedioSaidas: number;
  maiorEntrada: { description: string; amount: number; date: string } | null;
  maiorSaida: { description: string; amount: number; date: string } | null;
  mediaDiariaEntradas: number;
  mediaDiariaSaidas: number;
}

export interface ChartDayData {
  date: string;
  formattedDate: string;
  saldoAnterior?: number;
  entradas: number;
  saidas: number;
  resultado: number;
  resultadoOperacional?: number;
  saldoAcumulado: number;
}

export interface ChartMonthData {
  month: string;
  entradas: number;
  saidas: number;
  resultado: number;
}

export interface CategoryDistribution {
  name: string;
  value: number;
  color?: string;
  percentage: number;
}

export interface OperationDistribution {
  operationType: string;
  count: number;
  total: number;
  percentage: number;
  color?: string;
}

export interface PaymentComparison {
  name: string;
  value: number;
  percentage: number;
  count: number;
}

export interface CategoryBreakdownSubitem {
  id?: string;
  name: string;
  total: number;
  count: number;
}

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  total: number;
  count: number;
  percentage: number;
  subcategories?: CategoryBreakdownSubitem[];
}

export interface StatementBalanceRecord {
  bankAccountId: string;
  bankAccountName: string;
  bankName: string;
  accountType?: string;
  agency?: string;
  accountNumber?: string;
  color?: string;
  statementFileName?: string;
  statementDate?: string;
  statementBalance: number; // Saldo oficial informado no extrato bancário
  initialStatementBalance?: number; // Saldo inicial/anterior informado no extrato
  calculatedBalance: number; // Saldo calculado pelo sistema a partir das movimentações reais
  difference: number; // Diferença entre o saldo das movimentações e o saldo do extrato
  isReconciled: boolean; // Se a diferença é zero (batimento perfeito)
  hasStatement: boolean; // Se há extrato importado registrado para a conta
  lastImportedAt?: string;
}

export interface StatementBalancesSummary {
  totalStatementBalance: number;
  totalCalculatedBalance: number;
  totalDifference: number;
  reconciledAccountsCount: number;
  totalAccountsCount: number;
}

export interface DashboardResponse {
  metrics: DashboardMetrics;
  daysChart: ChartDayData[];
  monthsChart: ChartMonthData[];
  receiptsByOperation: OperationDistribution[];
  expensesByCategory: CategoryDistribution[];
  categoriesBreakdown: CategoryBreakdownItem[];
  balanceEvolution: ChartDayData[];
  paymentComparison: PaymentComparison[];
  statementBalances: StatementBalanceRecord[];
  statementBalancesSummary: StatementBalancesSummary;
  periodTransactions?: Transaction[];
}

export interface DailyMovementGroup {
  date: string;
  formattedDate: string;
  saldoAnterior: number;
  entradas: {
    operationType: string;
    description: string;
    amount: number;
    category: string;
  }[];
  totalEntradas: number;
  saidas: {
    category: string;
    description: string;
    amount: number;
    operationType: string;
  }[];
  totalSaidas: number;
  resultadoDia: number;
  saldoFinal: number;
  transactions: Transaction[];
}

export interface CompanyProfile {
  name: string;
  subtitle: string;
  logoUrl?: string | null;
  cnpj?: string;
  badge?: string;
}

// ==========================================
// CONTROLE DE ACESSO E USUÁRIOS (SUPABASE AUTH)
// ==========================================
export type UserRole = 'ADMINISTRADOR' | 'FINANCEIRO' | 'OPERADOR' | 'CONSULTA';
export type UserStatus = 'ATIVO' | 'BLOQUEADO' | 'PENDENTE';

export interface UserProfile {
  id: string; // UUID do Supabase Auth
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastSignInAt?: string | null;
  inviteCode?: string | null;
  invitedBy?: string | null;
}

export type InviteStatus = 'DISPONIVEL' | 'UTILIZADO' | 'REVOGADO' | 'EXPIRADO';

export interface UserInvite {
  id: string;
  code: string;
  role: UserRole;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedBy?: string | null;
  usedAt?: string | null;
  status: InviteStatus;
  recipientEmail?: string | null;
  autoActivate?: boolean;
  notes?: string | null;
}

export interface AuditLogEntry {
  id: string;
  user: string;
  userName?: string;
  action: string;
  description: string;
  timestamp: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}
