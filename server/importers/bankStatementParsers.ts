import * as XLSX from 'xlsx';
import path from 'path';
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
import { ColumnMapping, ExtractedStatementBalance, StatementFileType } from '../../src/types/index.ts';

export interface RawParsedTransaction {
  date: string; // YYYY-MM-DD (Data da movimentação)
  postingDate?: string; // Data de lançamento
  description: string;
  amount: number; // positive or negative
  type?: 'ENTRADA' | 'SAIDA' | 'SALDO_INICIAL' | 'TRANSFERENCIA_INTERNA';
  balanceAfter?: number; // Saldo após a movimentação
  documentId?: string;
  sourceLineNumber?: number;
  rawText?: string;
}

export interface AnalysisResult {
  fileType: StatementFileType;
  delimiter?: string;
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: ColumnMapping;
  autoConfidence: 'ALTA' | 'MEDIA' | 'BAIXA';
  totalLinesDetected: number;
}

// Normalizes Brazilian and international dates to ISO format YYYY-MM-DD
export function normalizeDate(dateStr: unknown): string {
  if (dateStr === null || dateStr === undefined) return '';
  if (dateStr instanceof Date) {
    if (!isNaN(dateStr.getTime())) {
      return dateStr.toISOString().substring(0, 10);
    }
    return '';
  }
  if (typeof dateStr === 'number') {
    if (dateStr > 30000 && dateStr < 70000) {
      const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
    }
  }

  const clean = String(dateStr).trim().replace(/["']/g, '');
  if (!clean) return '';

  // OFX format: 20260901 or 20260901120000[-03:EST]
  if (/^\d{8}/.test(clean)) {
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    const yearNum = parseInt(y, 10);
    const monthNum = parseInt(m, 10);
    const dayNum = parseInt(d, 10);
    if (yearNum >= 1990 && yearNum <= 2050 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const brMatch4 = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (brMatch4) {
    const d = brMatch4[1].padStart(2, '0');
    const m = brMatch4[2].padStart(2, '0');
    const y = brMatch4[3];
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YY or DD-MM-YY or DD.MM.YY (2-digit year)
  const brMatch2 = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (brMatch2) {
    const d = brMatch2[1].padStart(2, '0');
    const m = brMatch2[2].padStart(2, '0');
    const yInt = parseInt(brMatch2[3], 10);
    const yStr = yInt < 50 ? `20${brMatch2[3].padStart(2, '0')}` : `19${brMatch2[3].padStart(2, '0')}`;
    return `${yStr}-${m}-${d}`;
  }

  // DD/MM without year (e.g. 05/09 in some bank PDFs or printouts)
  const brShortMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (brShortMatch) {
    const d = brShortMatch[1].padStart(2, '0');
    const m = brShortMatch[2].padStart(2, '0');
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${m}-${d}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Month names in PT/EN
  const monthMap: Record<string, string> = {
    jan: '01', janeiro: '01', january: '01',
    fev: '02', fevereiro: '02', feb: '02', february: '02',
    mar: '03', marco: '03', março: '03', march: '03',
    abr: '04', abril: '04', apr: '04', april: '04',
    mai: '05', maio: '05', may: '05',
    jun: '06', junho: '06', june: '06',
    jul: '07', julho: '07', july: '07',
    ago: '08', agosto: '08', aug: '08', august: '08',
    set: '09', setembro: '09', sep: '09', september: '09',
    out: '10', outubro: '10', oct: '10', october: '10',
    nov: '11', novembro: '11', november: '11',
    dez: '12', dezembro: '12', dec: '12', december: '12'
  };

  const textMonthMatch = clean.match(/^(\d{1,2})[\s\/\-\.]+(?:de\s+)?([a-zçáéíóú]+)[\s\/\-\.]+(?:de\s+)?(\d{2,4})/i);
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, '0');
    const mStr = textMonthMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const m = monthMap[mStr];
    let yStr = textMonthMatch[3];
    if (yStr.length === 2) {
      yStr = parseInt(yStr, 10) < 50 ? `20${yStr}` : `19${yStr}`;
    }
    if (m) {
      return `${yStr}-${m}-${d}`;
    }
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().substring(0, 10);
  }

  return '';
}

// Normalizes Brazilian currency strings to standard number
export function normalizeCurrency(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;

  const rawStr = String(val).trim();
  if (rawStr === '-' || rawStr === '+' || rawStr === '') return 0;

  // Upper case normalized without accents
  const upper = rawStr.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let isNegative = false;

  // Check negative indicators
  if (rawStr.startsWith('(') && rawStr.endsWith(')')) {
    isNegative = true;
  } else if (
    rawStr.includes('-') ||
    upper.includes('-') ||
    upper.endsWith('D') ||
    upper.endsWith('DEB') ||
    upper.includes('DEBITO') ||
    upper.includes('SAIDA') ||
    upper.includes(' PAGTO')
  ) {
    isNegative = true;
  } else if (
    upper.endsWith('C') ||
    upper.includes('+') ||
    upper.endsWith('CRED') ||
    upper.includes('CREDITO') ||
    upper.includes('ENTRADA') ||
    upper.includes('REC')
  ) {
    isNegative = false;
  }

  // Clean string: keep ONLY digits, commas, and dots
  let cleaned = rawStr.replace(/[^0-9,\.]/g, '');
  if (!cleaned) return 0;

  // Handle Brazilian comma vs dot formats
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      // 1.250,50 -> 1250.50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,250.50 -> 1250.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // 208,40 -> 208.40
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

export function classifyTransactionTypeAndAmount(
  rawDesc: string,
  amountInput: number,
  explicitType?: 'ENTRADA' | 'SAIDA' | string
): { amount: number; type: 'ENTRADA' | 'SAIDA' } {
  const descUpper = (rawDesc || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const expUpper = (explicitType || '').toUpperCase();

  if (expUpper.includes('C') || expUpper.includes('ENTRADA') || expUpper.includes('CRED') || expUpper.includes('RECEITA')) {
    return { amount: Math.abs(amountInput), type: 'ENTRADA' };
  }
  if (expUpper.includes('D') || expUpper.includes('SAIDA') || expUpper.includes('DEB') || expUpper.includes('DESPESA') || expUpper.includes('PAG')) {
    return { amount: -Math.abs(amountInput), type: 'SAIDA' };
  }

  const strongInflowKeywords = [
    'RECEBIMENTO', 'REC FORNECEDOR', 'RECEB FORNECEDOR', 'CREDITO', 'PIX RECEBIDO', 'PIX REC',
    'TED REC', 'LIQUIDACAO DE COBRANCA', 'LIQUIDACAO COBRANCA', 'COBRANCA VALOR DISPONIVEL',
    'REMET.', 'REMETENTE', 'RESGATE', 'DEPOSITO', 'RENDIMENTO', 'ESTORNO CRED'
  ];

  const strongOutflowKeywords = [
    'PAGTO', 'PAGAMENTO', 'CHEQUE COMPENSADO', 'TARIFA BANCARIA', 'TARIFA', 'PIX ENVIADO', 'PIX ENV',
    'TED ENV', 'DOC ENV', 'TRANSF ENV', 'TRANSFERENCIA ENVIADA', 'DEBITO AUTOMATICO', 'DEBITO'
  ];

  const hasStrongInflow = strongInflowKeywords.some(kw => descUpper.includes(kw));
  const hasStrongOutflow = strongOutflowKeywords.some(kw => descUpper.includes(kw));

  if (hasStrongInflow && !hasStrongOutflow) {
    return { amount: Math.abs(amountInput), type: 'ENTRADA' };
  }
  if (hasStrongOutflow && !hasStrongInflow) {
    return { amount: -Math.abs(amountInput), type: 'SAIDA' };
  }

  const outflowKeywords = [
    'PAGTO', 'PAGAMENTO', 'TARIFA', 'TAR', 'TED ENV', 'DOC ENV', 'PIX ENV', 'PIX ENVIADO',
    'COMPRA', 'DEBITO', 'DEB', 'SAQUE', 'TRANSF ENV', 'TRANSFERENCIA ENVIADA', 'DARF', 'GPS',
    'FGTS', 'INSS', 'BOLETO', 'CARTAO', 'MANUT', 'ENC', 'ESTORNO DEB', 'IOF', 'JUROS', 'ENV',
    'CPMF', 'CUSTAS', 'TAXA', 'DOC'
  ];

  const inflowKeywords = [
    'CREDITO', 'CRED', 'ENTRADA', 'RECEBIMENTO', 'REC', 'TED REC', 'PIX REC', 'PIX RECEBIDO',
    'RESGATE', 'REND', 'DIVIDENDOS', 'ESTORNO CRED', 'DEPOSITO', 'SALARIO', 'FOLHA'
  ];

  const isOutflow = outflowKeywords.some(kw => descUpper.includes(kw));
  const isInflow = inflowKeywords.some(kw => descUpper.includes(kw));

  if (isOutflow && !isInflow) {
    return { amount: -Math.abs(amountInput), type: 'SAIDA' };
  }
  if (isInflow && !isOutflow) {
    return { amount: Math.abs(amountInput), type: 'ENTRADA' };
  }

  if (amountInput < 0) {
    return { amount: amountInput, type: 'SAIDA' };
  }

  return { amount: amountInput, type: 'ENTRADA' };
}

// ===================== STATEMENT BALANCE DETECTOR & EXTRACTOR =====================
/**
 * Detects if a row represents a statement balance line (Saldo Anterior, Saldo Atual, Saldo do Dia, Invest Fácil, etc.).
 * Rule: Bank statement balance lines must NEVER be imported as transactions (entries/exits) into Movimentações.
 * Instead, they are captured and routed specifically to the Dashboard.
 */
export function isStatementBalanceRow(text: string): boolean {
  if (!text) return false;
  const clean = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return false;

  const balancePhrases = [
    'SALDO ANTERIOR',
    'SALDO INICIAL',
    'SALDO ATUAL',
    'SALDO FINAL',
    'SALDO DO DIA',
    'SALDO DO DIA ANTERIOR',
    'SALDO DISPONIVEL',
    'SALDO DISP',
    'SALDO TOTAL',
    'TOTAL SALDO',
    'SALDO EM C/C',
    'SALDO C/C',
    'SALDO CONTA CORRENTE',
    'SALDO INVEST FACIL',
    'SALDO INVEST FÁCIL',
    'SALDO INVEST',
    'SALDO APLICACAO',
    'SALDO APLICAÇÃO',
    'SALDO POUPANCA',
    'SALDO POUPANÇA',
    'SALDO BLOQUEADO',
    'SALDO PROVISIONADO',
    'SALDO DEVEDOR',
    'SALDO CREDOR',
    'SALDO LIMITE',
    'SALDO CONTA',
    'SDO ANTERIOR',
    'SDO ATUAL',
    'SDO FINAL',
    'SDO INICIAL',
    'SDO DO DIA',
    'SDO DISPONIVEL',
    'SDO BLOQUEADO',
    'SDO PROVISIONADO',
    'SDO C/C',
    'SALDO DISPONIVEL P/ SAQUE',
    'SALDO TRANSPORTE',
    'SALDO A TRANSPORTAR',
    'SALDO INICIAL DO EXTRATO',
    'SALDO DO PERIODO',
    'SALDO DO PERÍODO',
    'SALDO ANTERIOR DO EXTRATO'
  ];

  for (const phrase of balancePhrases) {
    if (clean.includes(phrase)) return true;
  }

  // Regex patterns: starts with SALDO or SDO, or ends with SALDO or SDO
  if (/^(?:TOTAL\s+)?(?:SALDO|SDO)\b/i.test(clean)) {
    return true;
  }
  if (/\b(?:SALDO|SDO)\s*$/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Extracts bank statement balances from OFX content (<LEDGERBAL> and <AVAILBAL>)
 */
export function extractOFXBalance(content: string): ExtractedStatementBalance {
  const result: ExtractedStatementBalance = {};

  const ledgerMatch = content.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i);
  if (ledgerMatch) {
    const balAmtMatch = ledgerMatch[1].match(/<BALAMT>([^<\r\n]+)/i);
    const dtMatch = ledgerMatch[1].match(/<DTASOF>([^<\r\n]+)/i);
    if (balAmtMatch) {
      const parsedAmt = parseFloat(balAmtMatch[1].trim().replace(',', '.'));
      if (!isNaN(parsedAmt)) {
        result.finalBalance = parsedAmt;
        result.sourceDescription = 'Saldo Contábil OFX (LEDGERBAL)';
      }
    }
    if (dtMatch) {
      result.finalBalanceDate = normalizeDate(dtMatch[1].trim());
    }
  }

  // Fallback to AVAILBAL if LEDGERBAL missing
  if (result.finalBalance === undefined) {
    const availMatch = content.match(/<AVAILBAL>([\s\S]*?)<\/AVAILBAL>/i);
    if (availMatch) {
      const balAmtMatch = availMatch[1].match(/<BALAMT>([^<\r\n]+)/i);
      const dtMatch = availMatch[1].match(/<DTASOF>([^<\r\n]+)/i);
      if (balAmtMatch) {
        const parsedAmt = parseFloat(balAmtMatch[1].trim().replace(',', '.'));
        if (!isNaN(parsedAmt)) {
          result.finalBalance = parsedAmt;
          result.sourceDescription = 'Saldo Disponível OFX (AVAILBAL)';
        }
      }
      if (dtMatch) {
        result.finalBalanceDate = normalizeDate(dtMatch[1].trim());
      }
    }
  }

  return result;
}

// ===================== OFX PARSER =====================
export function parseOFX(content: string): RawParsedTransaction[] & { extractedBalance?: ExtractedStatementBalance } {
  const transactions: RawParsedTransaction[] = [];
  const extractedBalance: ExtractedStatementBalance = extractOFXBalance(content);

  // Match all <STMTTRN>...</STMTTRN> blocks or unclosed <STMTTRN> tags
  const trnRegex = /<STMTTRN>([\s\S]*?)(?=(?:<STMTTRN>|<\/BANKTRANLIST>|$))/gi;
  let match: RegExpExecArray | null;
  let lineCounter = 1;

  while ((match = trnRegex.exec(content)) !== null) {
    const block = match[1];

    const getTag = (tag: string): string => {
      const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
      const m = block.match(regex);
      return m ? m[1].trim() : '';
    };

    const trnType = getTag('TRNTYPE').toUpperCase();
    const dtPosted = getTag('DTPOSTED');
    const trnAmt = getTag('TRNAMT');
    const fitId = getTag('FITID') || getTag('CHECKNUM') || getTag('REFNUM');
    const memo = getTag('MEMO') || getTag('NAME') || 'Lançamento Bancário';

    if (!trnAmt || !dtPosted) continue;

    const amountNum = parseFloat(trnAmt.replace(',', '.'));
    if (isNaN(amountNum) || amountNum === 0) continue;

    const normDate = normalizeDate(dtPosted);
    if (!normDate || normDate.trim().length === 0) continue;

    const cleanMemo = memo.trim();
    if (!cleanMemo || cleanMemo.length === 0) continue;

    // Check if this row is actually a bank statement balance line (e.g. SALDO ANTERIOR, SALDO ATUAL)
    if (isStatementBalanceRow(cleanMemo)) {
      const cleanUpper = cleanMemo.toUpperCase();
      if (cleanUpper.includes('ANTERIOR') || cleanUpper.includes('INICIAL') || extractedBalance.initialBalance === undefined) {
        extractedBalance.initialBalance = amountNum;
        extractedBalance.initialBalanceDate = normDate;
        extractedBalance.sourceDescription = cleanMemo;
      } else {
        if (extractedBalance.finalBalance === undefined) {
          extractedBalance.finalBalance = amountNum;
          extractedBalance.finalBalanceDate = normDate;
        }
      }
      extractedBalance.sourceDescription = cleanMemo;
      // Preserve initial balance row as type SALDO_INICIAL with amount 0
      transactions.push({
        date: normDate,
        postingDate: normDate,
        description: cleanMemo,
        amount: 0,
        type: 'SALDO_INICIAL',
        balanceAfter: amountNum,
        documentId: fitId || undefined,
        sourceLineNumber: lineCounter++,
        rawText: block.replace(/\s+/g, ' ').trim()
      });
      continue;
    }

    const isCredit = trnType === 'CREDIT' || amountNum > 0;

    transactions.push({
      date: normDate,
      postingDate: normDate,
      description: cleanMemo,
      amount: amountNum,
      type: isCredit ? 'ENTRADA' : 'SAIDA',
      documentId: fitId || undefined,
      sourceLineNumber: lineCounter++,
      rawText: block.replace(/\s+/g, ' ').trim()
    });
  }

  const result = transactions as RawParsedTransaction[] & { extractedBalance?: ExtractedStatementBalance };
  result.extractedBalance = extractedBalance;
  return result;
}

export function parseOFXWithBalance(content: string): { transactions: RawParsedTransaction[]; extractedBalance: ExtractedStatementBalance } {
  const txs = parseOFX(content);
  return {
    transactions: txs,
    extractedBalance: txs.extractedBalance || {}
  };
}

// ===================== DELIMITER DETECTOR =====================
export function detectDelimiter(lines: string[]): string {
  const testLines = lines.slice(0, Math.min(lines.length, 15)).filter(l => l.trim().length > 0);
  if (testLines.length === 0) return ';';

  const candidates = [';', ',', '\t', '|'];
  let bestDelimiter = ';';
  let bestScore = -1;

  for (const delim of candidates) {
    let totalCols = 0;
    let validRows = 0;
    const colCounts: number[] = [];

    for (const line of testLines) {
      const cols = splitCsvRow(line, delim);
      if (cols.length > 1) {
        validRows++;
        totalCols += cols.length;
        colCounts.push(cols.length);
      }
    }

    if (validRows === 0) continue;

    const avgCols = totalCols / validRows;
    const variance = colCounts.reduce((acc, c) => acc + Math.pow(c - avgCols, 2), 0) / validRows;

    // Prefer delimiters that form consistent column counts (low variance) and reasonable column count (2 to 15)
    const consistencyScore = 100 - (variance * 10);
    const countScore = avgCols >= 2 && avgCols <= 15 ? avgCols * 10 : 0;
    const totalScore = consistencyScore + countScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

// Split CSV line handling quotes
export function splitCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

export function cleanHeaderString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[^\w\s\$\(\)\/\.\-]/g, '')
    .trim();
}

export function isDebitHeader(h?: string): boolean {
  if (!h) return false;
  const c = cleanHeaderString(h);
  return (
    c.includes('deb') ||
    c.includes('dbito') ||
    c.includes('debito') ||
    c.includes('saida') ||
    c.includes('despesa') ||
    /d[\w\s]*b[\w\s]*t/i.test(c) ||
    /^d[\s\$\(\)]*$/i.test(c)
  );
}

export function isCreditHeader(h?: string): boolean {
  if (!h) return false;
  const c = cleanHeaderString(h);
  return (
    c.includes('cred') ||
    c.includes('crdito') ||
    c.includes('credito') ||
    c.includes('entrada') ||
    c.includes('receb') ||
    c.includes('deposito') ||
    /cr[\w\s]*d[\w\s]*t/i.test(c) ||
    /^c[\s\$\(\)]*$/i.test(c)
  );
}

export function isBalanceHeader(h?: string): boolean {
  if (!h) return false;
  const c = cleanHeaderString(h);
  return c.includes('saldo') || c.includes('balance') || c.includes('salto');
}

export function isDocHeader(h?: string): boolean {
  if (!h) return false;
  const c = cleanHeaderString(h);
  return (
    c.includes('dcto') ||
    c.includes('doc') ||
    c.includes('documento') ||
    c.includes('num') ||
    c.includes('id') ||
    c.includes('fitid') ||
    c.includes('ref')
  );
}

export function isPostingDateHeader(h?: string): boolean {
  if (!h) return false;
  const c = cleanHeaderString(h);
  return (
    c.includes('data de lanc') ||
    c.includes('dt lanc') ||
    c.includes('data lanc') ||
    c.includes('data mov') ||
    c.includes('dt mov') ||
    c.includes('data compensacao') ||
    c.includes('dt compensacao')
  );
}

export function isDateHeader(h?: string): boolean {
  if (!h) return false;
  const c = cleanHeaderString(h);
  return (c.includes('data') || c.includes('dt') || c === 'date') && !isPostingDateHeader(h);
}

export function isDescHeader(h?: string): boolean {
  if (!h) return false;
  const c = cleanHeaderString(h);
  return (
    c.includes('desc') ||
    c.includes('hist') ||
    c.includes('lanc') ||
    c.includes('lanamento') ||
    c.includes('mov') ||
    c.includes('detalhe') ||
    c.includes('memo') ||
    c.includes('transa') ||
    c.includes('operacao')
  );
}

// ===================== ANALYZE CSV / XLSX / TXT STRUCTURE =====================
export function analyzeTabularData(
  allRows: string[][],
  fileType: StatementFileType = 'CSV',
  delimiter: string = ';'
): AnalysisResult {
  if (allRows.length === 0) {
    return {
      fileType,
      delimiter,
      headers: [],
      sampleRows: [],
      suggestedMapping: {
        dateCol: 0,
        descCol: 1,
        amountMode: 'SINGLE_COLUMN',
        amountCol: 2,
        hasHeader: false,
        headerRowIndex: 0
      },
      autoConfidence: 'BAIXA',
      totalLinesDetected: 0
    };
  }

  let headerRowIndex = -1;
  let headerRowCount = 1;
  let headers: string[] = [];

  // Search for header in the first 10 rows
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const rawRow = allRows[i];
    const hasDateWord = rawRow.some(c => isDateHeader(c) || isPostingDateHeader(c));
    const hasAmountOrDesc = rawRow.some(
      c =>
        isDescHeader(c) ||
        isDebitHeader(c) ||
        isCreditHeader(c) ||
        isBalanceHeader(c) ||
        isDocHeader(c) ||
        cleanHeaderString(c).includes('valor') ||
        cleanHeaderString(c).includes('amount')
    );

    if (hasDateWord && hasAmountOrDesc) {
      headerRowIndex = i;
      headers = allRows[i].map(c => (c || '').trim());

      if (i + 1 < allRows.length) {
        const nextRaw = allRows[i + 1];
        const nextRow = nextRaw.map(c => cleanHeaderString(c));
        const nextHasData = nextRow.some(c => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(c) || /^\d+[\.,]\d+$/.test(c));
        const nextHasHeaderWords = nextRaw.some(c => isDescHeader(c) || isDebitHeader(c) || isCreditHeader(c) || isDateHeader(c) || c.includes('valor'));
        if (nextHasHeaderWords && !nextHasData) {
          headerRowCount = 2;
          const r2 = allRows[i + 1].map(c => (c || '').trim());
          headers = headers.map((h, idx) => {
            const sub = r2[idx] || '';
            if (sub && !cleanHeaderString(h).includes(cleanHeaderString(sub))) {
              return `${h} ${sub}`.trim();
            }
            return h;
          });
        }
      }
      break;
    }
  }

  const hasHeader = headerRowIndex !== -1;
  const effectiveHeaderIndex = hasHeader ? headerRowIndex : 0;
  if (!hasHeader) {
    headers = allRows[0].map((_, idx) => `Coluna ${String.fromCharCode(65 + (idx % 26))}`);
  }

  // Column detection indices
  let dateCol = -1;
  let postingDateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let balanceCol = -1;
  let typeCol = -1;
  let docCol = -1;

  headers.forEach((h, idx) => {
    const rawLower = (h || '').trim();
    const lower = cleanHeaderString(rawLower);

    if (isBalanceHeader(rawLower)) {
      balanceCol = idx;
    } else if (isDebitHeader(rawLower)) {
      debitCol = idx;
    } else if (isCreditHeader(rawLower)) {
      creditCol = idx;
    } else if (isDocHeader(rawLower)) {
      docCol = idx;
    } else if (isPostingDateHeader(rawLower)) {
      postingDateCol = idx;
    } else if (isDateHeader(rawLower)) {
      if (dateCol === -1) dateCol = idx;
      else if (postingDateCol === -1) postingDateCol = idx;
    } else if (isDescHeader(rawLower)) {
      if (descCol === -1) descCol = idx;
    } else if (
      (lower.includes('valor') ||
       lower.includes('amount') ||
       lower.includes('vl') ||
       lower === 'vlr') &&
      !isDocHeader(rawLower)
    ) {
      if (amountCol === -1) amountCol = idx;
    } else if (
      lower.includes('tipo') ||
      lower.includes('natureza') ||
      lower.includes('d/c') ||
      lower === 'dc'
    ) {
      typeCol = idx;
    }
  });

  // Fallbacks if not found by header name: scan data rows
  const dataStart = hasHeader ? headerRowIndex + 1 : 0;
  const sampleDataRows = allRows.slice(dataStart, dataStart + 8);

  if (dateCol === -1) {
    // Check which column contains date format DD/MM/YYYY or YYYY-MM-DD
    for (let c = 0; c < headers.length; c++) {
      const matchCount = sampleDataRows.filter(r => {
        const val = (r[c] || '').trim();
        return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(val) || /^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(val);
      }).length;
      if (matchCount >= 2) {
        dateCol = c;
        break;
      }
    }
  }

  if (descCol === -1) {
    // Usually the column with longest text strings
    let longestCol = -1;
    let maxAvgLength = 0;
    for (let c = 0; c < headers.length; c++) {
      if (c === dateCol) continue;
      const avgLen = sampleDataRows.reduce((sum, r) => sum + (r[c] || '').length, 0) / (sampleDataRows.length || 1);
      if (avgLen > maxAvgLength && avgLen > 4) {
        maxAvgLength = avgLen;
        longestCol = c;
      }
    }
    if (longestCol !== -1) descCol = longestCol;
  }

  if (amountCol === -1 && (debitCol === -1 || creditCol === -1)) {
    // Look for column containing numbers with comma (monetary values)
    for (let c = 0; c < headers.length; c++) {
      if (c === dateCol || c === descCol || c === balanceCol || c === docCol) continue;
      const numCount = sampleDataRows.filter(r => {
        const val = (r[c] || '').trim();
        return val.includes(',') && /^-?[\d\.\,\s]+[DCdc]?$/.test(val);
      }).length;
      if (numCount >= 2) {
        amountCol = c;
        break;
      }
    }
  }

  if (docCol === -1) {
    // Look for column containing pure numbers or document codes without commas
    for (let c = 0; c < headers.length; c++) {
      if (c === dateCol || c === descCol || c === amountCol || c === creditCol || c === debitCol || c === balanceCol) continue;
      const docCount = sampleDataRows.filter(r => {
        const val = (r[c] || '').trim();
        return val.length > 0 && !val.includes(',') && (/^\d+$/.test(val) || /^[A-Z0-9\-]{3,20}$/.test(val));
      }).length;
      if (docCount >= 2) {
        docCol = c;
        break;
      }
    }
  }

  // Determine amount mode
  const hasSeparateDebitCredit = debitCol !== -1 && creditCol !== -1;
  const amountMode: 'SINGLE_COLUMN' | 'SEPARATE_DEBIT_CREDIT' = hasSeparateDebitCredit
    ? 'SEPARATE_DEBIT_CREDIT'
    : 'SINGLE_COLUMN';

  // Final fallback defaults
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = headers.length > 1 ? 1 : 0;
  if (amountCol === -1 && !hasSeparateDebitCredit) {
    for (let c = 0; c < headers.length; c++) {
      if (c !== dateCol && c !== descCol && c !== docCol && c !== balanceCol && c !== debitCol && c !== creditCol) {
        amountCol = c;
        break;
      }
    }
    if (amountCol === -1) amountCol = headers.length > 2 ? 2 : 1;
  }

  let autoConfidence: 'ALTA' | 'MEDIA' | 'BAIXA' = 'MEDIA';
  if (hasHeader && dateCol !== -1 && descCol !== -1 && (amountCol !== -1 || hasSeparateDebitCredit)) {
    autoConfidence = 'ALTA';
  } else if (dateCol === -1 || (amountCol === -1 && !hasSeparateDebitCredit)) {
    autoConfidence = 'BAIXA';
  }

  const suggestedMapping: ColumnMapping = {
    dateCol,
    dateColumn: dateCol !== -1 ? headers[dateCol] : undefined,
    postingDateCol: postingDateCol !== -1 ? postingDateCol : undefined,
    postingDateColumn: postingDateCol !== -1 ? headers[postingDateCol] : undefined,
    descCol,
    descriptionColumn: descCol !== -1 ? headers[descCol] : undefined,
    amountMode,
    amountCol: amountCol !== -1 ? amountCol : undefined,
    amountColumn: amountCol !== -1 ? headers[amountCol] : undefined,
    debitCol: debitCol !== -1 ? debitCol : undefined,
    debitColumn: debitCol !== -1 ? headers[debitCol] : undefined,
    creditCol: creditCol !== -1 ? creditCol : undefined,
    creditColumn: creditCol !== -1 ? headers[creditCol] : undefined,
    balanceCol: balanceCol !== -1 ? balanceCol : undefined,
    balanceColumn: balanceCol !== -1 ? headers[balanceCol] : undefined,
    typeCol: typeCol !== -1 ? typeCol : undefined,
    typeColumn: typeCol !== -1 ? headers[typeCol] : undefined,
    docCol: docCol !== -1 ? docCol : undefined,
    documentIdColumn: docCol !== -1 ? headers[docCol] : undefined,
    hasHeader,
    headerRowIndex: effectiveHeaderIndex,
    headerRowCount,
    delimiter
  };

  return {
    fileType,
    delimiter,
    headers,
    sampleRows: sampleDataRows,
    suggestedMapping,
    autoConfidence,
    totalLinesDetected: allRows.length
  };
}

export function resolveMapping(
  headers: string[],
  suggestedMapping: ColumnMapping,
  mapping?: ColumnMapping
): ColumnMapping & {
  dateCol: number;
  descCol: number;
  amountCol: number;
  debitCol?: number;
  creditCol?: number;
  docCol?: number;
  balanceCol?: number;
  postingDateCol?: number;
  typeCol?: number;
} {
  const result: any = { ...suggestedMapping, ...(mapping || {}) };

  const findIdx = (colName?: string) => {
    if (!colName) return -1;
    return headers.findIndex(h => h.toLowerCase().trim() === colName.toLowerCase().trim());
  };

  if (mapping?.dateColumn) {
    const idx = findIdx(mapping.dateColumn);
    if (idx !== -1) result.dateCol = idx;
  }
  if (mapping?.descriptionColumn) {
    const idx = findIdx(mapping.descriptionColumn);
    if (idx !== -1) result.descCol = idx;
  }
  if (mapping?.amountColumn) {
    const idx = findIdx(mapping.amountColumn);
    if (idx !== -1) result.amountCol = idx;
  }
  if (mapping?.creditColumn) {
    const idx = findIdx(mapping.creditColumn);
    if (idx !== -1) result.creditCol = idx;
  }
  if (mapping?.debitColumn) {
    const idx = findIdx(mapping.debitColumn);
    if (idx !== -1) result.debitCol = idx;
  }
  if (mapping?.documentIdColumn) {
    const idx = findIdx(mapping.documentIdColumn);
    if (idx !== -1) result.docCol = idx;
  }
  if (mapping?.balanceColumn) {
    const idx = findIdx(mapping.balanceColumn);
    if (idx !== -1) result.balanceCol = idx;
  }
  if (mapping?.postingDateColumn) {
    const idx = findIdx(mapping.postingDateColumn);
    if (idx !== -1) result.postingDateCol = idx;
  }
  if (mapping?.typeColumn) {
    const idx = findIdx(mapping.typeColumn);
    if (idx !== -1) result.typeCol = idx;
  }

  let detectedCreditCol = result.creditCol !== undefined && result.creditCol >= 0 ? result.creditCol : suggestedMapping.creditCol;
  let detectedDebitCol = result.debitCol !== undefined && result.debitCol >= 0 ? result.debitCol : suggestedMapping.debitCol;

  if (detectedCreditCol === undefined || detectedCreditCol < 0 || detectedDebitCol === undefined || detectedDebitCol < 0) {
    headers.forEach((h, idx) => {
      if (isDebitHeader(h) && (detectedDebitCol === undefined || detectedDebitCol < 0)) {
        detectedDebitCol = idx;
      }
      if (isCreditHeader(h) && (detectedCreditCol === undefined || detectedCreditCol < 0)) {
        detectedCreditCol = idx;
      }
    });
  }

  if (
    result.amountMode === 'SEPARATE_DEBIT_CREDIT' ||
    (detectedCreditCol !== undefined && detectedCreditCol >= 0 && detectedDebitCol !== undefined && detectedDebitCol >= 0)
  ) {
    result.amountMode = 'SEPARATE_DEBIT_CREDIT';
    result.creditCol = detectedCreditCol;
    result.debitCol = detectedDebitCol;
  } else {
    result.amountMode = 'SINGLE_COLUMN';
  }

  return result;
}

/**
 * Universal statement line normalizer:
 * 1. Removes BOM
 * 2. Normalizes CRLF, CR-only, and LF line breaks
 * 3. Detects if text lines are joined/collapsed without newlines (e.g. "353.223,0303/08/2026;TED...")
 *    and restores newlines before date stamps or section headers.
 */
export function normalizeStatementLines(content: string): string[] {
  if (!content) return [];
  let text = (content || '').replace(/^\uFEFF/, '');

  // Normalize all newline formats: CRLF -> LF, CR -> LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // If text contains lines joined right after currency amounts or text fields without line break:
  // e.g. "353.223,0303/08/2026;TED..." or "Saldo (R$)31/07/2026;"
  text = text.replace(/([^\n])(\d{2}[\/\-]\d{2}[\/\-]\d{4}[;\t,])/g, '$1\n$2');
  text = text.replace(/([^\n])(\d{4}[\/\-]\d{2}[\/\-]\d{2}[;\t,])/g, '$1\n$2');
  text = text.replace(/([^\n])(;\s*(?:Extrato|Últimos|Ultimos|ltimos|Saldos|Invest|Total))/gi, '$1\n$2');
  text = text.replace(/([^\n])(Total[;\t,]{2,})/gi, '$1\n$2');
  text = text.replace(/([^\n])(Data[;\t,]|DATA[;\t,]|Date[;\t,])/g, '$1\n$2');

  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// ===================== CSV / TXT PARSER WITH MAPPING =====================
export function parseCSVWithMapping(
  content: string,
  mapping?: ColumnMapping
): { transactions: RawParsedTransaction[]; analysis: AnalysisResult; extractedBalance: ExtractedStatementBalance } {
  const rawLines = normalizeStatementLines(content);
  if (rawLines.length === 0) {
    return {
      transactions: [],
      analysis: analyzeTabularData([], 'CSV'),
      extractedBalance: {}
    };
  }

  const delimiter = mapping?.delimiter || detectDelimiter(rawLines);
  const allRows = rawLines.map(l => splitCsvRow(l, delimiter));
  const analysis = analyzeTabularData(allRows, 'CSV', delimiter);

  const effMapping = resolveMapping(analysis.headers, analysis.suggestedMapping, mapping);
  const headerRowsCount = (effMapping as any).headerRowCount || 1;
  const startRow = effMapping.hasHeader ? effMapping.headerRowIndex + headerRowsCount : 0;

  const transactions: RawParsedTransaction[] = [];
  const extractedBalance: ExtractedStatementBalance = {};

  for (let i = startRow; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.length < 2) continue;

    const rawDate = effMapping.dateCol >= 0 && row[effMapping.dateCol] ? row[effMapping.dateCol] : '';
    const rawPostingDate =
      effMapping.postingDateCol !== undefined && effMapping.postingDateCol >= 0 && row[effMapping.postingDateCol]
        ? row[effMapping.postingDateCol]
        : undefined;

    const rawDesc =
      effMapping.descCol >= 0 && row[effMapping.descCol] ? row[effMapping.descCol] : 'Movimentação Bancária';
    const rawDoc =
      effMapping.docCol !== undefined && effMapping.docCol >= 0 && row[effMapping.docCol]
        ? row[effMapping.docCol]
        : undefined;
    const rawBalance =
      effMapping.balanceCol !== undefined && effMapping.balanceCol >= 0 && row[effMapping.balanceCol]
        ? normalizeCurrency(row[effMapping.balanceCol])
        : undefined;

    let amount = 0;
    let type: 'ENTRADA' | 'SAIDA' | undefined;

    if (effMapping.amountMode === 'SEPARATE_DEBIT_CREDIT') {
      const dVal = effMapping.debitCol !== undefined && effMapping.debitCol >= 0 ? normalizeCurrency(row[effMapping.debitCol]) : 0;
      const cVal = effMapping.creditCol !== undefined && effMapping.creditCol >= 0 ? normalizeCurrency(row[effMapping.creditCol]) : 0;

      if (cVal > 0) {
        amount = cVal;
        type = 'ENTRADA';
      } else if (dVal !== 0) {
        amount = -Math.abs(dVal);
        type = 'SAIDA';
      } else {
        amount = 0;
        type = undefined;
      }
    } else if (effMapping.amountCol !== undefined && effMapping.amountCol >= 0 && row[effMapping.amountCol]) {
      const rawAmt = normalizeCurrency(row[effMapping.amountCol]);
      const explicitT = effMapping.typeCol !== undefined && effMapping.typeCol >= 0 && row[effMapping.typeCol] ? row[effMapping.typeCol] : undefined;
      const classified = classifyTransactionTypeAndAmount(rawDesc, rawAmt, explicitT);
      amount = classified.amount;
      type = classified.type;
    }

    // Invert sign if bank flagged debits as positive
    if (effMapping.invertedSigns && amount !== 0) {
      amount = -amount;
    }

    // Check Type Column indicator if present
    if (effMapping.typeCol !== undefined && effMapping.typeCol >= 0 && row[effMapping.typeCol]) {
      const tVal = row[effMapping.typeCol].trim().toUpperCase();
      if (tVal.includes('C') || tVal.includes('ENTRADA') || tVal.includes('CRED')) {
        type = 'ENTRADA';
        amount = Math.abs(amount);
      } else if (tVal.includes('D') || tVal.includes('SAIDA') || tVal.includes('DEB')) {
        type = 'SAIDA';
        amount = -Math.abs(amount);
      }
    }

    if (amount !== 0) {
      const classified = classifyTransactionTypeAndAmount(rawDesc, amount, type);
      amount = classified.amount;
      type = classified.type;
    }

    // Validate date - if empty or invalid, strictly exclude the row
    if (!rawDate || rawDate.trim().length === 0) continue;
    const normalizedDateStr = normalizeDate(rawDate);
    if (!normalizedDateStr || normalizedDateStr.trim().length === 0) continue;

    // Validate description - if empty, check if balance is present
    const cleanDesc = rawDesc ? rawDesc.trim() : (typeof rawBalance === 'number' && !isNaN(rawBalance) ? 'Saldo Inicial' : '');
    if (!cleanDesc || cleanDesc.length === 0) continue;

    // Check if this row represents a bank statement balance line (Saldo Anterior, Saldo Atual, Saldo do Dia, etc.)
    if (isStatementBalanceRow(cleanDesc)) {
      const cleanUpper = cleanDesc.toUpperCase();
      // Ignore auxiliary daily investment balance tables (e.g. Saldos Invest Fácil) from overwriting account balances
      if (cleanUpper.includes('INVEST') || cleanUpper.includes('APLICACAO') || cleanUpper.includes('POUPANCA')) {
        continue;
      }

      const balVal = typeof rawBalance === 'number' && !isNaN(rawBalance) && rawBalance !== 0
        ? rawBalance
        : (typeof amount === 'number' && !isNaN(amount) && amount !== 0 ? Math.abs(amount) : 0);

      if (cleanUpper.includes('ANTERIOR') || cleanUpper.includes('INICIAL') || extractedBalance.initialBalance === undefined) {
        extractedBalance.initialBalance = balVal;
        extractedBalance.initialBalanceDate = normalizedDateStr;
        extractedBalance.sourceDescription = cleanDesc;
      } else {
        if (extractedBalance.finalBalance === undefined) {
          extractedBalance.finalBalance = balVal;
          extractedBalance.finalBalanceDate = normalizedDateStr;
        }
      }
      extractedBalance.sourceDescription = cleanDesc;

      // Only push initial balance transaction if balVal is valid
      if (balVal !== 0) {
        transactions.push({
          date: normalizedDateStr,
          postingDate: rawPostingDate ? (normalizeDate(rawPostingDate) || normalizedDateStr) : normalizedDateStr,
          description: cleanDesc,
          amount: 0,
          type: 'SALDO_INICIAL',
          balanceAfter: balVal,
          documentId: rawDoc,
          sourceLineNumber: i + 1,
          rawText: rawLines[i]
        });
      }
      continue;
    }

    // REGRA FUNDAMENTAL: Linhas com Crédito = 0/vazio e Débito = 0/vazio
    // Nunca criar ENTRADA ou SAÍDA com valor zero
    if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
      if (typeof rawBalance === 'number' && !isNaN(rawBalance)) {
        // Preserva o primeiro saldo válido como Saldo Inicial
        if (extractedBalance.initialBalance === undefined) {
          extractedBalance.initialBalance = rawBalance;
          extractedBalance.initialBalanceDate = normalizedDateStr;
          extractedBalance.sourceDescription = cleanDesc || 'Saldo Inicial Extrato';
          transactions.push({
            date: normalizedDateStr,
            postingDate: rawPostingDate ? (normalizeDate(rawPostingDate) || normalizedDateStr) : normalizedDateStr,
            description: cleanDesc || 'Saldo Inicial Extrato',
            amount: 0,
            type: 'SALDO_INICIAL',
            balanceAfter: rawBalance,
            documentId: rawDoc,
            sourceLineNumber: i + 1,
            rawText: rawLines[i]
          });
        } else {
          // Linhas intermediárias com Crédito = 0 e Débito = 0 (ex: Linhas 181, 182) não geram transações financeiras nem vão para detecção de duplicidades
          if (extractedBalance.finalBalance === undefined || i >= allRows.length - 5) {
            extractedBalance.finalBalance = rawBalance;
            extractedBalance.finalBalanceDate = normalizedDateStr;
          }
        }
      }
      // Pula criação de qualquer transação financeira com valor 0
      continue;
    }

    transactions.push({
      date: normalizedDateStr,
      postingDate: rawPostingDate ? (normalizeDate(rawPostingDate) || normalizedDateStr) : normalizedDateStr,
      description: cleanDesc,
      amount,
      type,
      balanceAfter: rawBalance,
      documentId: rawDoc,
      sourceLineNumber: i + 1,
      rawText: rawLines[i]
    });
  }

  // If ending balance wasn't extracted from a dedicated row, inspect the running balance of the last transaction
  if (extractedBalance.finalBalance === undefined && transactions.length > 0) {
    for (let idx = transactions.length - 1; idx >= 0; idx--) {
      if (typeof transactions[idx].balanceAfter === 'number' && !isNaN(transactions[idx].balanceAfter!)) {
        extractedBalance.finalBalance = transactions[idx].balanceAfter;
        extractedBalance.finalBalanceDate = transactions[idx].date;
        extractedBalance.sourceDescription = 'Saldo Final da Coluna de Saldo do Extrato';
        break;
      }
    }
  }

  // FALLBACK PASS: If mapping produced 0 transactions, attempt generic unstructured text parsing
  if (transactions.length === 0) {
    const fallback = parseGenericUnstructuredText(content);
    if (fallback.transactions.length > 0) {
      return {
        transactions: fallback.transactions,
        analysis,
        extractedBalance: { ...extractedBalance, ...fallback.extractedBalance }
      };
    }
  }

  return { transactions, analysis, extractedBalance };
}

// Legacy helper for backward compatibility
export function parseCSV(content: string): RawParsedTransaction[] {
  return parseCSVWithMapping(content).transactions;
}

// ===================== XLSX / EXCEL PARSER =====================
export function parseXLSXWithMapping(
  buffer: Buffer,
  mapping?: ColumnMapping
): { transactions: RawParsedTransaction[]; analysis: AnalysisResult; extractedBalance: ExtractedStatementBalance } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to array of arrays of strings
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
  const stringRows: string[][] = rawRows.map(r => (r || []).map(cell => String(cell || '').trim()));

  const analysis = analyzeTabularData(stringRows, 'XLSX', ';');
  const effMapping = resolveMapping(analysis.headers, analysis.suggestedMapping, mapping);
  const headerRowsCount = (effMapping as any).headerRowCount || 1;
  const startRow = effMapping.hasHeader ? effMapping.headerRowIndex + headerRowsCount : 0;
  const transactions: RawParsedTransaction[] = [];
  const extractedBalance: ExtractedStatementBalance = {};

  for (let i = startRow; i < stringRows.length; i++) {
    const row = stringRows[i];
    if (row.length < 2) continue;

    const rawDate = effMapping.dateCol >= 0 && row[effMapping.dateCol] ? row[effMapping.dateCol] : '';
    const rawPostingDate =
      effMapping.postingDateCol !== undefined && effMapping.postingDateCol >= 0 && row[effMapping.postingDateCol]
        ? row[effMapping.postingDateCol]
        : undefined;

    const rawDesc =
      effMapping.descCol >= 0 && row[effMapping.descCol] ? row[effMapping.descCol] : 'Movimentação Bancária';
    const rawDoc =
      effMapping.docCol !== undefined && effMapping.docCol >= 0 && row[effMapping.docCol]
        ? row[effMapping.docCol]
        : undefined;
    const rawBalance =
      effMapping.balanceCol !== undefined && effMapping.balanceCol >= 0 && row[effMapping.balanceCol]
        ? normalizeCurrency(row[effMapping.balanceCol])
        : undefined;

    let amount = 0;
    let type: 'ENTRADA' | 'SAIDA' | undefined;

    if (effMapping.amountMode === 'SEPARATE_DEBIT_CREDIT') {
      const dVal = effMapping.debitCol !== undefined && effMapping.debitCol >= 0 ? normalizeCurrency(row[effMapping.debitCol]) : 0;
      const cVal = effMapping.creditCol !== undefined && effMapping.creditCol >= 0 ? normalizeCurrency(row[effMapping.creditCol]) : 0;

      if (cVal > 0) {
        amount = cVal;
        type = 'ENTRADA';
      } else if (dVal !== 0) {
        amount = -Math.abs(dVal);
        type = 'SAIDA';
      } else {
        amount = 0;
        type = undefined;
      }
    } else if (effMapping.amountCol !== undefined && effMapping.amountCol >= 0 && row[effMapping.amountCol]) {
      const rawAmt = normalizeCurrency(row[effMapping.amountCol]);
      const explicitT = effMapping.typeCol !== undefined && effMapping.typeCol >= 0 && row[effMapping.typeCol] ? row[effMapping.typeCol] : undefined;
      const classified = classifyTransactionTypeAndAmount(rawDesc, rawAmt, explicitT);
      amount = classified.amount;
      type = classified.type;
    }

    if (effMapping.invertedSigns && amount !== 0) {
      amount = -amount;
    }

    if (effMapping.typeCol !== undefined && effMapping.typeCol >= 0 && row[effMapping.typeCol]) {
      const tVal = row[effMapping.typeCol].trim().toUpperCase();
      if (tVal.includes('C') || tVal.includes('ENTRADA') || tVal.includes('CRED')) {
        type = 'ENTRADA';
        amount = Math.abs(amount);
      } else if (tVal.includes('D') || tVal.includes('SAIDA') || tVal.includes('DEB')) {
        type = 'SAIDA';
        amount = -Math.abs(amount);
      }
    }

    if (amount !== 0) {
      const classified = classifyTransactionTypeAndAmount(rawDesc, amount, type);
      amount = classified.amount;
      type = classified.type;
    }

    // Validate date - if empty or invalid, strictly exclude the row
    if (!rawDate || rawDate.trim().length === 0) continue;
    const normalizedDateStr = normalizeDate(rawDate);
    if (!normalizedDateStr || normalizedDateStr.trim().length === 0) continue;

    // Validate description - if empty, check if balance is present
    const cleanDesc = rawDesc ? rawDesc.trim() : (typeof rawBalance === 'number' && !isNaN(rawBalance) ? 'Saldo Inicial' : '');
    if (!cleanDesc || cleanDesc.length === 0) continue;

    // Check if this row represents a bank statement balance line (Saldo Anterior, Saldo Atual, Saldo do Dia, etc.)
    if (isStatementBalanceRow(cleanDesc)) {
      const cleanUpper = cleanDesc.toUpperCase();
      // Ignore auxiliary daily investment balance tables (e.g. Saldos Invest Fácil) from overwriting account balances
      if (cleanUpper.includes('INVEST') || cleanUpper.includes('APLICACAO') || cleanUpper.includes('POUPANCA')) {
        continue;
      }

      const balVal = typeof rawBalance === 'number' && !isNaN(rawBalance) && rawBalance !== 0
        ? rawBalance
        : (typeof amount === 'number' && !isNaN(amount) && amount !== 0 ? Math.abs(amount) : 0);

      if (cleanUpper.includes('ANTERIOR') || cleanUpper.includes('INICIAL') || extractedBalance.initialBalance === undefined) {
        extractedBalance.initialBalance = balVal;
        extractedBalance.initialBalanceDate = normalizedDateStr;
        extractedBalance.sourceDescription = cleanDesc;
      } else {
        if (extractedBalance.finalBalance === undefined) {
          extractedBalance.finalBalance = balVal;
          extractedBalance.finalBalanceDate = normalizedDateStr;
        }
      }
      extractedBalance.sourceDescription = cleanDesc;

      // Only push initial balance transaction if balVal is valid
      if (balVal !== 0) {
        transactions.push({
          date: normalizedDateStr,
          postingDate: rawPostingDate ? (normalizeDate(rawPostingDate) || normalizedDateStr) : normalizedDateStr,
          description: cleanDesc,
          amount: 0,
          type: 'SALDO_INICIAL',
          balanceAfter: balVal,
          documentId: rawDoc,
          sourceLineNumber: i + 1,
          rawText: row.join(' | ')
        });
      }
      continue;
    }

    // REGRA FUNDAMENTAL: Linhas com Crédito = 0/vazio e Débito = 0/vazio
    // Nunca criar ENTRADA ou SAÍDA com valor zero
    if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
      if (typeof rawBalance === 'number' && !isNaN(rawBalance)) {
        // Preserva o primeiro saldo válido como Saldo Inicial
        if (extractedBalance.initialBalance === undefined) {
          extractedBalance.initialBalance = rawBalance;
          extractedBalance.initialBalanceDate = normalizedDateStr;
          extractedBalance.sourceDescription = cleanDesc || 'Saldo Inicial Extrato';
          transactions.push({
            date: normalizedDateStr,
            postingDate: rawPostingDate ? (normalizeDate(rawPostingDate) || normalizedDateStr) : normalizedDateStr,
            description: cleanDesc || 'Saldo Inicial Extrato',
            amount: 0,
            type: 'SALDO_INICIAL',
            balanceAfter: rawBalance,
            documentId: rawDoc,
            sourceLineNumber: i + 1,
            rawText: row.join(' | ')
          });
        } else {
          // Linhas intermediárias com Crédito = 0 e Débito = 0 (ex: Linhas 181, 182) não geram transações financeiras nem vão para detecção de duplicidades
          if (extractedBalance.finalBalance === undefined || i >= stringRows.length - 5) {
            extractedBalance.finalBalance = rawBalance;
            extractedBalance.finalBalanceDate = normalizedDateStr;
          }
        }
      }
      // Pula criação de qualquer transação financeira com valor 0
      continue;
    }

    transactions.push({
      date: normalizedDateStr,
      postingDate: rawPostingDate ? (normalizeDate(rawPostingDate) || normalizedDateStr) : normalizedDateStr,
      description: cleanDesc,
      amount,
      type,
      balanceAfter: rawBalance,
      documentId: rawDoc,
      sourceLineNumber: i + 1,
      rawText: row.join(' | ')
    });
  }

  // If ending balance wasn't extracted from a dedicated row, inspect running balance of the last transaction
  if (extractedBalance.finalBalance === undefined && transactions.length > 0) {
    for (let idx = transactions.length - 1; idx >= 0; idx--) {
      if (typeof transactions[idx].balanceAfter === 'number' && !isNaN(transactions[idx].balanceAfter!)) {
        extractedBalance.finalBalance = transactions[idx].balanceAfter;
        extractedBalance.finalBalanceDate = transactions[idx].date;
        extractedBalance.sourceDescription = 'Saldo Final da Coluna de Saldo do Extrato';
        break;
      }
    }
  }

  // FALLBACK PASS: If XLSX mapping produced 0 transactions, attempt generic unstructured text parsing
  if (transactions.length === 0) {
    const textLines = stringRows.map(r => r.join(' ')).join('\n');
    const fallback = parseGenericUnstructuredText(textLines);
    if (fallback.transactions.length > 0) {
      return {
        transactions: fallback.transactions,
        analysis,
        extractedBalance: { ...extractedBalance, ...fallback.extractedBalance }
      };
    }
  }

  return { transactions, analysis, extractedBalance };
}

export function parseXLSX(buffer: Buffer): RawParsedTransaction[] {
  return parseXLSXWithMapping(buffer).transactions;
}

// ===================== GENERIC UNSTRUCTURED TEXT PARSER =====================
export function parseGenericUnstructuredText(
  content: string
): { transactions: RawParsedTransaction[]; extractedBalance: ExtractedStatementBalance } {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const transactions: RawParsedTransaction[] = [];
  const extractedBalance: ExtractedStatementBalance = {};

  // Matches line containing date DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY
  const datePattern = /(?:^|\s)([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.](?:19|20)?\d{2}|\d{4}[\/\-\.][0-1]?\d[\/\-\.][0-3]?\d)(?:\s+|$)/;

  let lineCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isStatementBalanceRow(line)) {
      const currencyRegex = /([\+\-]?\s*R?\$?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\s*[CDcd]?|\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?|[\+\-]?\s*\d+\.\d{2})/g;
      const balMatches = Array.from(line.matchAll(currencyRegex));
      if (balMatches.length > 0) {
        const balVal = normalizeCurrency(balMatches[balMatches.length - 1][0]);
        const cleanUpper = line.toUpperCase();
        if (cleanUpper.includes('ANTERIOR') || cleanUpper.includes('INICIAL')) {
          extractedBalance.initialBalance = balVal;
        } else {
          extractedBalance.finalBalance = balVal;
        }
        extractedBalance.sourceDescription = line;
      }
      continue;
    }

    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];
    const normDate = normalizeDate(rawDate);
    if (!normDate) continue;

    // Search for monetary currency numbers in line:
    // e.g. "1.250,00", "-450,00", "50,00 C", "100,00 D", "R$ 1.500,00", "1500.00"
    const currencyRegex = /([\+\-]?\s*R?\$?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\s*[CDcd]?|\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?|[\+\-]?\s*\d+\.\d{2}\b)/g;
    const matches = Array.from(line.matchAll(currencyRegex));

    if (matches.length > 0) {
      const dateIdx = dateMatch.index || 0;
      const dateEndIdx = dateIdx + dateMatch[0].length;
      const amountIdx = matches[0].index || 0;

      let description = '';
      if (amountIdx > dateEndIdx) {
        description = line.substring(dateEndIdx, amountIdx).trim();
      } else {
        description = line.replace(dateMatch[0], '').replace(matches[0][0], '').trim();
      }

      description = description.replace(/^[;\,\t\|\s\-]+|[;\,\t\|\s\-]+$/g, '').trim();
      if (!description || description.length < 2) {
        description = 'Lançamento Bancário Extrato';
      }

      const rawAmountStr = matches[0][0];
      let balanceAfter: number | undefined;
      if (matches.length >= 2) {
        balanceAfter = normalizeCurrency(matches[1][0]);
      }

      let amount = normalizeCurrency(rawAmountStr);
      if (isNaN(amount) || amount === 0) continue;

      let type: 'ENTRADA' | 'SAIDA' = amount >= 0 ? 'ENTRADA' : 'SAIDA';
      const upperLine = line.toUpperCase();
      if (upperLine.endsWith('C') || upperLine.includes('CREDITO') || upperLine.includes('ENTRADA')) {
        type = 'ENTRADA';
        amount = Math.abs(amount);
      } else if (upperLine.endsWith('D') || upperLine.includes('DEBITO') || upperLine.includes('SAIDA')) {
        type = 'SAIDA';
        amount = -Math.abs(amount);
      }

      transactions.push({
        date: normDate,
        postingDate: normDate,
        description,
        amount,
        type,
        balanceAfter,
        sourceLineNumber: lineCounter++,
        rawText: line
      });
    }
  }

  return { transactions, extractedBalance };
}

// ===================== PDF PARSER & EXTRACTOR =====================
export async function parsePDF(buffer: Buffer): Promise<{
  transactions: RawParsedTransaction[];
  success: boolean;
  textPreview: string;
  extractedBalance?: ExtractedStatementBalance;
  warning?: string;
}> {
  try {
    let pdfParseFunc: any;
    try {
      pdfParseFunc = customRequire('pdf-parse/lib/pdf-parse.js');
    } catch {
      try {
        pdfParseFunc = customRequire('pdf-parse');
      } catch (err) {
        return {
          transactions: [],
          success: false,
          textPreview: '',
          extractedBalance: {},
          warning: 'Processamento de PDF indisponível no ambiente de hospedagem. Por favor, utilize extratos no formato OFX, CSV ou Excel (XLSX).'
        };
      }
    }

    const data = await pdfParseFunc(buffer);
    const rawText = data ? (data.text || '') : '';

    if (!rawText || rawText.trim().length === 0) {
      return {
        transactions: [],
        success: false,
        textPreview: '',
        extractedBalance: {},
        warning:
          'Não foi possível extrair texto legível deste arquivo PDF. O documento pode ser uma imagem escaneada sem OCR. Por favor, baixe o extrato em OFX, CSV ou Excel diretamente do seu Internet Banking.'
      };
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const transactions: RawParsedTransaction[] = [];
    const extractedBalance: ExtractedStatementBalance = {};

    // Regex to match typical bank statement lines:
    // Ex: "01/09/2026 PIX RECEBIDO CLIENTE 1.250,00 C"
    // Ex: "02/09/2026 TARIFA BANCARIA -59,00"
    // Ex: "03/09/2026 BOLETO FORNECEDOR 1.450,00 D 25.000,00"
    const datePattern = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+)$/;

    let lineCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect standalone balance lines in PDF (e.g., "Saldo Anterior: 5.000,00", "Saldo Atual: 12.450,00")
      if (isStatementBalanceRow(line)) {
        const currencyRegex = /([\+\-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[CDcd]?|\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?)/g;
        const balMatches = Array.from(line.matchAll(currencyRegex));
        if (balMatches.length > 0) {
          const balVal = normalizeCurrency(balMatches[balMatches.length - 1][0]);
          const cleanUpper = line.toUpperCase();
          if (cleanUpper.includes('ANTERIOR') || cleanUpper.includes('INICIAL') || extractedBalance.initialBalance === undefined) {
            extractedBalance.initialBalance = balVal;
            if (!extractedBalance.initialBalanceDate) {
              const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/);
              if (dateMatch) {
                extractedBalance.initialBalanceDate = normalizeDate(dateMatch[1]);
              }
            }
          } else {
            if (extractedBalance.finalBalance === undefined) {
              extractedBalance.finalBalance = balVal;
            }
          }
          extractedBalance.sourceDescription = line;
        }
        continue;
      }

      // Ignore common PDF header/footer phrases
      const lower = line.toLowerCase();
      if (
        lower.includes('página') ||
        lower.includes('extrato de conta') ||
        lower.includes('extrato mensal') ||
        lower.includes('agência:') ||
        lower.includes('conta corrente:') ||
        lower.includes('período:') ||
        lower.includes('totalizador') ||
        lower.includes('sac:')
      ) {
        continue;
      }

      const match = line.match(datePattern);
      if (!match) continue;

      const rawDate = match[1];
      const rest = match[2].trim();

      // Find monetary numbers in the rest of the string: e.g. "1.250,00", "-500,00", "500,00 C", "100,00 D"
      const currencyRegex = /([\+\-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[CDcd]?|\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?)/g;
      const matches = Array.from(rest.matchAll(currencyRegex));

      if (matches.length > 0) {
        const firstMatchIndex = (matches[0] as RegExpMatchArray).index || 0;
        const description = rest.substring(0, firstMatchIndex).trim();

        if (description.length >= 2) {
          const rawAmountStr = matches[0][0];
          let balanceAfter: number | undefined;

          // If there's a second match, it's often the running balance!
          if (matches.length >= 2) {
            balanceAfter = normalizeCurrency(matches[1][0]);
          }

          let amount = normalizeCurrency(rawAmountStr);
          let type: 'ENTRADA' | 'SAIDA' = amount >= 0 ? 'ENTRADA' : 'SAIDA';

          const upperRest = rest.toUpperCase();
          if (upperRest.endsWith('C') || upperRest.includes('CRED')) {
            type = 'ENTRADA';
            amount = Math.abs(amount);
          } else if (upperRest.endsWith('D') || upperRest.includes('DEB')) {
            type = 'SAIDA';
            amount = -Math.abs(amount);
          }

          const normDate = normalizeDate(rawDate);
          if (!normDate) {
            continue;
          }
          const cleanDesc = description ? description.trim() : (typeof balanceAfter === 'number' && !isNaN(balanceAfter) ? 'Saldo Inicial' : '');
          if (!cleanDesc || cleanDesc.length === 0) {
            continue;
          }

          // Check if description is a balance row (e.g. "Saldo Anterior", "Saldo Atual")
          if (isStatementBalanceRow(cleanDesc)) {
            const balVal = typeof balanceAfter === 'number' && !isNaN(balanceAfter) ? balanceAfter : amount;
            const cleanUpper = cleanDesc.toUpperCase();
            if (cleanUpper.includes('ANTERIOR') || cleanUpper.includes('INICIAL') || extractedBalance.initialBalance === undefined) {
              extractedBalance.initialBalance = balVal;
              extractedBalance.initialBalanceDate = normDate;
              extractedBalance.sourceDescription = cleanDesc;
            } else {
              if (extractedBalance.finalBalance === undefined) {
                extractedBalance.finalBalance = balVal;
                extractedBalance.finalBalanceDate = normDate;
              }
            }
            extractedBalance.sourceDescription = cleanDesc;

            transactions.push({
              date: normDate,
              postingDate: normDate,
              description: cleanDesc,
              amount: 0,
              type: 'SALDO_INICIAL',
              balanceAfter: balVal,
              sourceLineNumber: lineCounter++,
              rawText: line
            });
            continue;
          }

          if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
            if (typeof balanceAfter === 'number' && !isNaN(balanceAfter)) {
              if (extractedBalance.initialBalance === undefined) {
                extractedBalance.initialBalance = balanceAfter;
                extractedBalance.initialBalanceDate = normDate;
                extractedBalance.sourceDescription = cleanDesc || 'Saldo Inicial Extrato';
                transactions.push({
                  date: normDate,
                  postingDate: normDate,
                  description: cleanDesc || 'Saldo Inicial Extrato',
                  amount: 0,
                  type: 'SALDO_INICIAL',
                  balanceAfter,
                  sourceLineNumber: lineCounter++,
                  rawText: line
                });
              } else {
                extractedBalance.finalBalance = balanceAfter;
                extractedBalance.finalBalanceDate = normDate;
              }
            }
            continue;
          }

          transactions.push({
            date: normDate,
            postingDate: normDate,
            description: cleanDesc,
            amount,
            type,
            balanceAfter,
            sourceLineNumber: lineCounter++,
            rawText: line
          });
        }
      }
    }

    // If ending balance wasn't extracted from a dedicated row, inspect running balance of the last transaction
    if (extractedBalance.finalBalance === undefined && transactions.length > 0) {
      for (let idx = transactions.length - 1; idx >= 0; idx--) {
        if (typeof transactions[idx].balanceAfter === 'number' && !isNaN(transactions[idx].balanceAfter!)) {
          extractedBalance.finalBalance = transactions[idx].balanceAfter;
          extractedBalance.finalBalanceDate = transactions[idx].date;
          extractedBalance.sourceDescription = 'Saldo Final Calculado do Extrato';
          break;
        }
      }
    }

    if (transactions.length === 0) {
      const fallback = parseGenericUnstructuredText(rawText);
      if (fallback.transactions.length > 0) {
        return {
          transactions: fallback.transactions,
          success: true,
          textPreview: lines.slice(0, 15).join('\n'),
          extractedBalance: { ...extractedBalance, ...fallback.extractedBalance }
        };
      }
      return {
        transactions: [],
        success: false,
        textPreview: lines.slice(0, 15).join('\n'),
        extractedBalance,
        warning:
          'Não foi possível interpretar a estrutura de colunas deste PDF com segurança técnica. Como os bancos geram extratos em PDF com layouts gráficos muito distintos e proprietários, por favor utilize a exportação em OFX (preferencial), CSV ou Excel.'
      };
    }

    return {
      transactions,
      success: true,
      textPreview: lines.slice(0, 15).join('\n'),
      extractedBalance
    };
  } catch (err: unknown) {
    return {
      transactions: [],
      success: false,
      textPreview: '',
      warning: `Erro ao processar PDF: ${(err as Error).message}. Recomendamos utilizar arquivo em formato OFX, CSV ou Excel.`
    };
  }
}

// ===================== SAMPLE STATEMENTS GENERATOR =====================
export function getSampleStatement(format: StatementFileType = 'OFX'): {
  fileName: string;
  content: string | Buffer;
  type: StatementFileType;
} {
  if (format === 'OFX') {
    const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260906180000[-03:EST]
<LANGUAGE>POR
<FI>
<ORG>Banco Itau S.A.
<FID>341
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<BRANCHID>1240
<ACCTID>45890-2
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260901000000[-03:EST]
<DTEND>20260906235959[-03:EST]

<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260901
<TRNAMT>18750.40
<FITID>ITAU_20260901_001
<CHECKNUM>001
<MEMO>RECEBIMENTO PIX QR-CODE CAIXAS SUPERMERCADO
</STMTTRN>

<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260901
<TRNAMT>29420.10
<FITID>ITAU_20260901_002
<CHECKNUM>002
<MEMO>CIELO REPASSE CARTAO CREDITO VISA MASTERCARD
</STMTTRN>

<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260901
<TRNAMT>-14200.00
<FITID>ITAU_20260901_003
<CHECKNUM>003
<MEMO>BOLETO AMBEV DISTRIBUIDORA BEBIDAS
</STMTTRN>

<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260902
<TRNAMT>-68.50
<FITID>ITAU_20260902_004
<CHECKNUM>004
<MEMO>TAR MANUTENCAO CONTA CORRENTE PJ
</STMTTRN>

<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260902
<TRNAMT>16300.00
<FITID>ITAU_20260902_005
<CHECKNUM>005
<MEMO>PIX RECEBIDO CLIENTE ENCOMENDA PADARIA
</STMTTRN>

<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260903
<TRNAMT>-9800.00
<FITID>ITAU_20260903_006
<CHECKNUM>006
<MEMO>TED PAGTO FORNECEDOR CEASA HORTIFRUTI LTDA
</STMTTRN>

<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260904
<TRNAMT>-14850.90
<FITID>ITAU_20260904_007
<CHECKNUM>007
<MEMO>DEBITO AUT CPFL ENERGIA ELETRICA CAMARAS FRIAS
</STMTTRN>

<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260905
<TRNAMT>22150.00
<FITID>ITAU_20260905_008
<CHECKNUM>008
<MEMO>STONE LIQUIDACAO CARTAO DEBITO ELO
</STMTTRN>

<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260906
<TRNAMT>3500.00
<FITID>ITAU_20260906_009
<CHECKNUM>009
<MEMO>DEPOSITO DINHEIRO ESPECIE COFRE
</STMTTRN>

<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260906
<TRNAMT>-450.00
<FITID>ITAU_20260906_010
<CHECKNUM>010
<MEMO>PAGTO DIVERSO MANUTENCAO BALANCAO
</STMTTRN>

</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>185420.50
<DTASOF>20260906235959[-03:EST]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
    return {
      fileName: 'EXTRATO_ITAU_SETEMBRO_2026.ofx',
      content: ofx,
      type: 'OFX'
    };
  }

  if (format === 'CSV') {
    const csv = `Data;Histórico;Documento;Valor;Saldo
01/09/2026;RECEBIMENTO PIX CAIXAS FRENTE LOJA;PIX0901;21500,00;121500,00
01/09/2026;REPASSE ADQUIRENCIA CIELO CREDITO;CIELO441;32150,80;153650,80
01/09/2026;PAGAMENTO FORNECEDOR FRIBOI CARNES;DOC9812;-24500,00;129150,80
02/09/2026;PIX TRANSFERENCIA CLIENTE ATACADO;PIX9082;450,00;129600,80
02/09/2026;TARIFA MENSAL PACOTE SERVICOS PJ;TAR99;-89,00;129511,80
03/09/2026;BOLETO NESTLE BRASIL MERCEARIA;BOL1029;-18400,00;111111,80
04/09/2026;LIQUIDACAO STONE CARTAO DEBITO;STN551;19200,00;130311,80
05/09/2026;FOLHA PAGAMENTO SALARIOS EQUIPE LOJA;FOLHA09;-42000,00;88311,80
05/09/2026;SANGRIA CAIXA DEPOSITO EM ESPECIE;DEP09;11200,00;99511,80
06/09/2026;PAGAMENTO CONTA ENEL ENERGIA;BOL772;-12350,00;87161,80
06/09/2026;TAXA PROCESSAMENTO TEF MENSAL;TARTEF;-340,00;86821,80`;
    return {
      fileName: 'EXTRATO_BRADESCO_SETEMBRO_2026.csv',
      content: csv,
      type: 'CSV'
    };
  }

  if (format === 'TXT') {
    const txt = `DATA\tHISTORICO\tVALOR\tTIPO\tDOCUMENTO
01/09/2026\tRECEBIMENTO PIX MERCADO\t15400,00\tC\tPIX01
01/09/2026\tCIELO CARTAO DEBITO\t12300,50\tC\tCIE02
02/09/2026\tPAGAMENTO FORNECEDOR HORTIFRUTI\t-8900,00\tD\tFORN03
02/09/2026\tTARIFA BANCARIA TED\t-18,50\tD\tTAR04
03/09/2026\tBOLETO CERVEJARIA\t-14200,00\tD\tBOL05
04/09/2026\tREPASSE STONE CREDITO\t28500,00\tC\tSTN06
05/09/2026\tDEPOSITO DINHEIRO CAIXAS\t7600,00\tC\tDEP07`;
    return {
      fileName: 'EXTRATO_BANCO_BRASIL_2026.txt',
      content: txt,
      type: 'TXT'
    };
  }

  // Generate Excel workbook buffer
  const wb = XLSX.utils.book_new();
  const data = [
    ['Data da Movimentação', 'Descrição / Histórico', 'Documento', 'Débito', 'Crédito', 'Saldo'],
    ['01/09/2026', 'RECEBIMENTO PIX SUPERMERCADO CAIXA', 'PIX101', '', '25600,00', '125600,00'],
    ['01/09/2026', 'CIELO REPASSE CARTAO CREDITO', 'CIE102', '', '38400,50', '164000,50'],
    ['02/09/2026', 'BOLETO AMBEV CERVEJARIA E BEBIDAS', 'AMB103', '19800,00', '', '144200,50'],
    ['02/09/2026', 'TARIFA BANCARIA MANUTENCAO PJ', 'TAR104', '75,00', '', '144125,50'],
    ['03/09/2026', 'STONE REPASSE CARTAO DEBITO', 'STN105', '', '14500,00', '158625,50'],
    ['04/09/2026', 'FORNECEDOR CEASA HORTIFRUTI LTDA', 'CEA106', '8400,00', '', '150225,50'],
    ['04/09/2026', 'PAGAMENTO CPFL FORCA E LUZ', 'CPF107', '13200,00', '', '137025,50'],
    ['05/09/2026', 'RECEBIMENTO TED CLIENTE EVENTO', 'TED108', '', '5200,00', '142225,50'],
    ['06/09/2026', 'DEPÓSITO EM DINHEIRO FÍSICO LOJA', 'DEP109', '', '9800,00', '152025,50']
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return {
    fileName: 'EXTRATO_SANTANDER_SETEMBRO_2026.xlsx',
    content: buffer,
    type: 'XLSX'
  };
}
