import { Transaction } from '../types';

export interface ConsolidatedBalanceDay {
  date: string; // YYYY-MM-DD
  formattedDate: string; // DD/MM/YYYY
  saldoAnterior: number; // SALDO INICIAL / ANTERIOR
  creditos: number; // TOTAL DE CRÉDITOS DO DIA (Entradas)
  debitos: number; // TOTAL DE DÉBITOS DO DIA (Saídas)
  resultadoOperacional: number; // CRÉDITOS - DÉBITOS
  saldoConsolidado: number; // SALDO CONSOLIDADO ACUMULADO
  saldoExtratoInformado?: number; // Saldo bancário informado no extrato (quando disponível)
  hasDivergence?: boolean; // True se houver divergência entre o calculado e o do extrato
  divergenceAmount?: number; // Valor da diferença monetária
  divergenceDetails?: string; // Descrição explicativa para auditoria
}

export interface ConsolidatedBalanceResult {
  initialBalanceOfExtract: number; // Primeiro saldo válido encontrado no extrato (coluna "Saldo (R$)")
  initialDateOfExtract: string; // Data do primeiro saldo válido encontrado no extrato
  foundFirstBalanceInExtract: boolean; // Se encontrou o saldo inicial no extrato
  periodStartDate?: string;
  periodEndDate?: string;
  initialBalanceOfPeriod: number; // Saldo inicial acumulado no início do período
  finalBalanceOfPeriod: number; // Saldo final acumulado ao fim do período
  totalCreditosPeriod: number;
  totalDebitosPeriod: number;
  resultadoLiquidoPeriod: number;
  days: ConsolidatedBalanceDay[]; // Dias dentro do período filtrado
  allDays: ConsolidatedBalanceDay[]; // Todos os dias históricos calculados
  divergencesCount: number; // Total de dias com divergência para auditoria
}

/**
 * Arredondamento monetário de alta precisão (evita erros IEEE 754 de ponto flutuante)
 */
export function roundCurrency(val: number): number {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * REGRAS CENTRALIZADAS DO SALDO CONSOLIDADO DINÂMICO E CONTÍNUO:
 * 1. Identifica automaticamente o primeiro saldo válido na coluna "Saldo (R$)" (balanceAfter).
 * 2. Trata esse valor como SALDO INICIAL DO EXTRATO sem fixar nenhum valor no código.
 * 3. Processa dia a dia em ordem cronológica:
 *    SALDO CONSOLIDADO DO DIA = SALDO CONSOLIDADO DO DIA ANTERIOR + CRÉDITOS DO DIA - DÉBITOS DO DIA
 * 4. NUNCA utiliza valores da coluna "Dcto. Valor (R$)" / documentId como valor financeiro.
 * 5. Se o usuário filtrar um período, localiza o saldo consolidado imediatamente anterior e usa como saldo inicial.
 * 6. Valida o saldo bancário do extrato e sinaliza divergências para auditoria.
 */
export function calculateConsolidatedBalance(
  transactions: Transaction[],
  options?: {
    startDate?: string;
    endDate?: string;
    bankAccountId?: string;
    fallbackInitialBalance?: number;
  }
): ConsolidatedBalanceResult {
  const startDate = options?.startDate;
  const endDate = options?.endDate;
  const bankAccountId = options?.bankAccountId;

  // 1. Filtrar transações por conta bancária se especificado e desconsiderar duplicatas de importação
  let rawTxs = transactions || [];
  if (bankAccountId) {
    rawTxs = rawTxs.filter(t => t.bankAccountId === bankAccountId);
  }

  // Desconsiderar transações sinalizadas como duplicadas
  const nonDuplicateTxs = rawTxs.filter(t => !t.isDuplicateFlag && t.reconciliationStatus !== 'DUPLICADO');

  // Deduplicação inteligente de registros redundantes originários de reimportação de extratos
  const seenTxKeys = new Set<string>();
  const filteredTxs: Transaction[] = [];

  for (const t of nonDuplicateTxs) {
    // Chave única: se houver hash ou combinação única de arquivo/linha ou dados completos
    const fileLineKey = (t.statementFileName && t.sourceLineNumber)
      ? `${t.statementFileName}_L${t.sourceLineNumber}_${t.date}_${t.amount}_${t.type}`
      : null;
    const contentKey = `${t.date}_${t.amount}_${t.type}_${(t.description || '').trim().toUpperCase()}_${t.externalId || ''}_${t.bankAccountId || ''}`;
    const dedupeKey = fileLineKey || t.transactionHash || contentKey;

    if (!seenTxKeys.has(dedupeKey)) {
      seenTxKeys.add(dedupeKey);
      filteredTxs.push(t);
    }
  }

  // 2. Ordenar todas as transações cronologicamente (data crescente YYYY-MM-DD)
  const sortedTxs = [...filteredTxs].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const postingA = a.postingDate || a.date;
    const postingB = b.postingDate || b.date;
    if (postingA !== postingB) {
      return postingA.localeCompare(postingB);
    }
    return (a.sourceLineNumber || 0) - (b.sourceLineNumber || 0);
  });

  // 3. Localizar o PRIMEIRO saldo válido no extrato (coluna "Saldo (R$)" / balanceAfter ou SALDO_INICIAL)
  let initialBalanceOfExtract = options?.fallbackInitialBalance ?? 0;
  let initialDateOfExtract = sortedTxs.length > 0 ? sortedTxs[0].date : '2026-01-01';
  let foundFirstBalanceInExtract = false;

  // Prioridade 1: Lançamento explícito de SALDO_INICIAL
  const saldoInicialTx = sortedTxs.find(
    t => t.type === 'SALDO_INICIAL' || (t.operationType && t.operationType.toUpperCase().includes('SALDO INICIAL'))
  );
  if (saldoInicialTx && typeof saldoInicialTx.balanceAfter === 'number' && !isNaN(saldoInicialTx.balanceAfter)) {
    initialBalanceOfExtract = saldoInicialTx.balanceAfter;
    initialDateOfExtract = saldoInicialTx.date;
    foundFirstBalanceInExtract = true;
  } else {
    // Prioridade 2: Primeiro balanceAfter válido nas transações ordenadas cronologicamente
    for (const tx of sortedTxs) {
      if (typeof tx.balanceAfter === 'number' && !isNaN(tx.balanceAfter)) {
        initialBalanceOfExtract = tx.balanceAfter;
        initialDateOfExtract = tx.date;
        foundFirstBalanceInExtract = true;
        break;
      }
    }
  }

  if (!foundFirstBalanceInExtract && options?.fallbackInitialBalance === undefined) {
    initialBalanceOfExtract = 0;
  }

  // 4. Agrupar movimentações por dia (somar Créditos e Débitos do dia)
  // NUNCA utilizar Dcto. Valor (R$) / documentId como valor financeiro!
  // NUNCA somar SALDO_INICIAL como crédito ou débito!
  const daysMap: Record<string, {
    creditos: number;
    debitos: number;
    lastOperationalBalanceAfter?: number;
    openingBalanceAfter?: number;
    declaredInitialBalance?: number;
    txCount: number;
  }> = {};

  for (const tx of sortedTxs) {
    const d = tx.date;
    if (!daysMap[d]) {
      daysMap[d] = { creditos: 0, debitos: 0, txCount: 0 };
    }

    const amt = Math.abs(Number(tx.amount) || 0);

    if (tx.type === 'TRANSFERENCIA_INTERNA' || tx.type === 'SALDO_INICIAL') {
      // Excluídas das receitas/despesas operacionais - SALDO_INICIAL não é receita nem despesa!
      if (tx.type === 'SALDO_INICIAL' && typeof tx.balanceAfter === 'number' && !isNaN(tx.balanceAfter) && tx.balanceAfter !== 0) {
        daysMap[d].declaredInitialBalance = tx.balanceAfter;
      }
    } else if (tx.type === 'ENTRADA') {
      daysMap[d].creditos = roundCurrency(daysMap[d].creditos + amt);
    } else if (tx.type === 'SAIDA') {
      daysMap[d].debitos = roundCurrency(daysMap[d].debitos + amt);
    }

    daysMap[d].txCount++;

    // Salva o saldo bancário informado no extrato
    if (typeof tx.balanceAfter === 'number' && !isNaN(tx.balanceAfter)) {
      const descUpper = (tx.description || '').toUpperCase();
      const isInitialOrAux = tx.type === 'SALDO_INICIAL' || descUpper.includes('SALDO ANTERIOR') || descUpper.includes('INVEST') || descUpper.includes('APLICACAO');

      if (!isInitialOrAux && (tx.balanceAfter !== 0 || tx.amount !== 0)) {
        // Lançamento operacional com coluna de saldo após a operação
        daysMap[d].lastOperationalBalanceAfter = tx.balanceAfter;
      } else if (tx.type === 'SALDO_INICIAL' || descUpper.includes('SALDO ANTERIOR')) {
        // Saldo de abertura inicial do dia/bloco
        if (tx.balanceAfter !== 0) {
          daysMap[d].openingBalanceAfter = tx.balanceAfter;
        }
      }
    }
  }

  // 5. Construir a linha do tempo cronológica contínua
  const allUniqueDates = Object.keys(daysMap).sort();
  const allDaysCalculated: ConsolidatedBalanceDay[] = [];

  let runningBalance = initialBalanceOfExtract;
  let totalDivergences = 0;

  for (let i = 0; i < allUniqueDates.length; i++) {
    const dateStr = allUniqueDates[i];
    const dayData = daysMap[dateStr];

    // Se o dia possuir um SALDO ANTERIOR declarado explicitamente no extrato (ex: início de novo bloco ou após salto de período)
    let saldoAnterior = roundCurrency(runningBalance);
    if (dayData.declaredInitialBalance !== undefined) {
      saldoAnterior = roundCurrency(dayData.declaredInitialBalance);
    }

    const creditos = dayData.creditos;
    const debitos = dayData.debitos;
    const resultadoOperacional = roundCurrency(creditos - debitos);

    // REGRA: SALDO CONSOLIDADO DO DIA = SALDO CONSOLIDADO DO DIA ANTERIOR + CRÉDITOS DO DIA - DÉBITOS DO DIA
    const saldoConsolidado = roundCurrency(saldoAnterior + creditos - debitos);

    // O saldo acumulado é contínuo, sem reiniciar a cada dia
    runningBalance = saldoConsolidado;

    // Determinar o saldo bancário informado para conciliação e auditoria:
    // 1. Se houve movimentação operacional e alguma informou saldo após o lançamento, esse é o saldo de fechamento
    // 2. Se o dia teve apenas SALDO_INICIAL (sem operações), o saldo de fechamento é o saldo inicial do extrato
    // 3. Se o dia teve operações mas nenhuma informou saldo de fechamento explícito, e veio de um SALDO_INICIAL no mesmo dia, o saldo de fechamento do extrato é a abertura + movimentações do dia
    let saldoExtratoInformado: number | undefined = undefined;
    if (dayData.lastOperationalBalanceAfter !== undefined) {
      saldoExtratoInformado = dayData.lastOperationalBalanceAfter;
    } else if (dayData.creditos === 0 && dayData.debitos === 0 && dayData.openingBalanceAfter !== undefined) {
      saldoExtratoInformado = dayData.openingBalanceAfter;
    } else if (dayData.openingBalanceAfter !== undefined && (dayData.creditos > 0 || dayData.debitos > 0)) {
      saldoExtratoInformado = saldoConsolidado;
    }

    // Formatar data no padrão DD/MM/YYYY
    const parts = dateStr.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;

    // Auditar validação com o saldo bancário informado no extrato
    let hasDivergence = false;
    let divergenceAmount = 0;
    let divergenceDetails: string | undefined = undefined;

    if (saldoExtratoInformado !== undefined) {
      const diff = roundCurrency(saldoConsolidado - saldoExtratoInformado);
      if (Math.abs(diff) > 0.01) {
        hasDivergence = true;
        divergenceAmount = diff;
        totalDivergences++;
        divergenceDetails = `Divergência em ${formattedDate}: Saldo calculado (R$ ${saldoConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do saldo informado no extrato (R$ ${saldoExtratoInformado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Diferença: R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }
    }

    allDaysCalculated.push({
      date: dateStr,
      formattedDate,
      saldoAnterior,
      creditos,
      debitos,
      resultadoOperacional,
      saldoConsolidado,
      saldoExtratoInformado,
      hasDivergence,
      divergenceAmount,
      divergenceDetails
    });
  }

  // 6. Aplicar filtro de período [startDate, endDate] SEM ZERAR O SALDO
  let filteredDays = [...allDaysCalculated];
  let initialBalanceOfPeriod = initialBalanceOfExtract;

  if (startDate) {
    filteredDays = filteredDays.filter(d => d.date >= startDate);

    // Localiza o saldo consolidado imediatamente anterior ao período filtrado
    const previousDays = allDaysCalculated.filter(d => d.date < startDate);
    if (previousDays.length > 0) {
      initialBalanceOfPeriod = previousDays[previousDays.length - 1].saldoConsolidado;
    } else {
      initialBalanceOfPeriod = initialBalanceOfExtract;
    }
  }

  if (endDate) {
    filteredDays = filteredDays.filter(d => d.date <= endDate);
  }

  // Ajustar o saldoAnterior e saldoConsolidado da primeira linha do período filtrado se necessário
  if (filteredDays.length > 0) {
    const firstFilteredDate = filteredDays[0].date;
    const previousDays = allDaysCalculated.filter(d => d.date < firstFilteredDate);
    if (previousDays.length > 0) {
      const prevBal = previousDays[previousDays.length - 1].saldoConsolidado;
      filteredDays[0] = {
        ...filteredDays[0],
        saldoAnterior: prevBal,
        saldoConsolidado: roundCurrency(prevBal + filteredDays[0].creditos - filteredDays[0].debitos)
      };
    }
  }

  const finalBalanceOfPeriod = filteredDays.length > 0
    ? filteredDays[filteredDays.length - 1].saldoConsolidado
    : initialBalanceOfPeriod;

  const totalCreditosPeriod = roundCurrency(filteredDays.reduce((acc, d) => acc + d.creditos, 0));
  const totalDebitosPeriod = roundCurrency(filteredDays.reduce((acc, d) => acc + d.debitos, 0));
  const resultadoLiquidoPeriod = roundCurrency(totalCreditosPeriod - totalDebitosPeriod);

  return {
    initialBalanceOfExtract,
    initialDateOfExtract,
    foundFirstBalanceInExtract,
    periodStartDate: startDate,
    periodEndDate: endDate,
    initialBalanceOfPeriod,
    finalBalanceOfPeriod,
    totalCreditosPeriod,
    totalDebitosPeriod,
    resultadoLiquidoPeriod,
    days: filteredDays,
    allDays: allDaysCalculated,
    divergencesCount: totalDivergences
  };
}
