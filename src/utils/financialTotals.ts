import { Transaction, CategoryBreakdownItem } from '../types';

export interface FinancialTotals {
  totalEntradas: number;
  entradasCount: number;
  totalSaidas: number;
  saidasCount: number;
  totalTransferencias: number;
  transferenciasCount: number;
  resultadoFinanceiro: number;
}

/**
 * FUNÇÃO ÚNICA DE REFERÊNCIA DE ENTRADAS
 * Recebe os lançamentos e retorna o total e a quantidade de entradas.
 */
export function calculateTotalEntradas(transactions: Transaction[]): { total: number; quantidade: number } {
  let total = 0;
  let quantidade = 0;

  for (const t of transactions) {
    if (t.type === 'ENTRADA') {
      total += Math.abs(Number(t.amount) || 0);
      quantidade++;
    }
  }

  return {
    total: Math.round(total * 100) / 100,
    quantidade
  };
}

/**
 * FUNÇÃO ÚNICA DE REFERÊNCIA DE SAÍDAS
 * Recebe os lançamentos e retorna o total e a quantidade de saídas.
 */
export function calculateTotalSaidas(transactions: Transaction[]): { total: number; quantidade: number } {
  let total = 0;
  let quantidade = 0;

  for (const t of transactions) {
    if (t.type === 'SAIDA') {
      total += Math.abs(Number(t.amount) || 0);
      quantidade++;
    }
  }

  return {
    total: Math.round(total * 100) / 100,
    quantidade
  };
}

export interface DiscrepancyDetail {
  id: string;
  date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  reason: string;
}

export interface ConsistencyValidationResult {
  isConsistent: boolean;
  entradasMetricsTotal: number;
  entradasMetricsCount: number;
  entradasCategoriesTotal: number;
  entradasCategoriesCount: number;
  saidasMetricsTotal: number;
  saidasMetricsCount: number;
  saidasCategoriesTotal: number;
  saidasCategoriesCount: number;
  discrepancies: DiscrepancyDetail[];
}

/**
 * Executa a validação automática de consistência entre
 * Soma de Entradas e Total de Recebimentos por Categoria
 */
export function validateFinancialConsistency(
  metrics: { totalEntradas: number; entradasCount: number; totalSaidas: number; saidasCount: number },
  categories: CategoryBreakdownItem[],
  transactions: Transaction[] = []
): ConsistencyValidationResult {
  const entradaCategories = categories.filter(c => c.type === 'ENTRADA');
  const saidaCategories = categories.filter(c => c.type === 'SAIDA');

  const entradasCategoriesTotal = Math.round(entradaCategories.reduce((s, c) => s + (c.total || 0), 0) * 100) / 100;
  const entradasCategoriesCount = entradaCategories.reduce((s, c) => s + (c.count || 0), 0);

  const saidasCategoriesTotal = Math.round(saidaCategories.reduce((s, c) => s + (c.total || 0), 0) * 100) / 100;
  const saidasCategoriesCount = saidaCategories.reduce((s, c) => s + (c.count || 0), 0);

  const diffEntradasVal = Math.abs((metrics.totalEntradas || 0) - entradasCategoriesTotal);
  const diffEntradasCount = Math.abs((metrics.entradasCount || 0) - entradasCategoriesCount);

  const diffSaidasVal = Math.abs((metrics.totalSaidas || 0) - saidasCategoriesTotal);
  const diffSaidasCount = Math.abs((metrics.saidasCount || 0) - saidasCategoriesCount);

  const isConsistent = diffEntradasVal < 0.01 && diffEntradasCount === 0 && diffSaidasVal < 0.01 && diffSaidasCount === 0;

  const discrepancies: DiscrepancyDetail[] = [];

  if (!isConsistent && transactions.length > 0) {
    for (const t of transactions) {
      if (t.type === 'TRANSFERENCIA_INTERNA') continue;

      const catMatches = categories.filter(c =>
        c.type === t.type &&
        (c.id === t.categoryId || c.name.toLowerCase() === (t.categoryName || '').toLowerCase())
      );

      if (catMatches.length === 0) {
        discrepancies.push({
          id: t.id,
          date: t.date,
          description: t.description,
          category: t.categoryName || 'Não categorizado',
          type: t.type,
          amount: t.amount,
          reason: `Lançamento ${t.type} sem correspondência direta em categoria do demonstrativo.`
        });
      } else if (catMatches.length > 1) {
        discrepancies.push({
          id: t.id,
          date: t.date,
          description: t.description,
          category: t.categoryName || 'Múltiplas categorias',
          type: t.type,
          amount: t.amount,
          reason: `Lançamento associado a mais de uma categoria no agrupamento (${catMatches.map(c => c.name).join(', ')}).`
        });
      }
    }
  }

  return {
    isConsistent,
    entradasMetricsTotal: metrics.totalEntradas || 0,
    entradasMetricsCount: metrics.entradasCount || 0,
    entradasCategoriesTotal,
    entradasCategoriesCount,
    saidasMetricsTotal: metrics.totalSaidas || 0,
    saidasMetricsCount: metrics.saidasCount || 0,
    saidasCategoriesTotal,
    saidasCategoriesCount,
    discrepancies
  };
}
