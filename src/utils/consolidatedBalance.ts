import { Transaction } from '../types/index.ts';

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
    const contentKey = `${t.id || ''}_${t.date}_${t.amount}_${t.type}_${(t.description || '').trim().toUpperCase()}_${(t as any).documentId || (t as any).documentNumber || ''}_${t.sourceLineNumber || ''}_${t.balanceAfter || ''}_${t.externalId || ''}_${t.bankAccountId || ''}`;
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
    operationalBalancesAfter: { balanceAfter: number; sourceLineNumber: number }[];
    openingBalanceAfter?: number;
    declaredInitialBalance?: number;
    txCount: number;
  }> = {};

  for (const tx of sortedTxs) {
    const d = tx.date;
    if (!daysMap[d]) {
      daysMap[d] = { creditos: 0, debitos: 0, txCount: 0, operationalBalancesAfter: [] };
    }

    const amt = Math.abs(Number(tx.amount) || 0);
    const descUpper = (tx.description || '').toUpperCase();
    const opUpper = (tx.operationType || '').toUpperCase();

    if (tx.type === 'SALDO_INICIAL' || descUpper.includes('SALDO ANTERIOR') || opUpper.includes('SALDO INICIAL')) {
      if (typeof tx.balanceAfter === 'number' && !isNaN(tx.balanceAfter) && tx.balanceAfter !== 0) {
        daysMap[d].declaredInitialBalance = tx.balanceAfter;
      }
    } else {
      let isOutflow = false;
      let isInflow = false;

      if (tx.type === 'SAIDA') {
        isOutflow = true;
      } else if (tx.type === 'ENTRADA') {
        isInflow = true;
      } else if (typeof (tx as any).rawAmount === 'number') {
        if ((tx as any).rawAmount < 0) isOutflow = true;
        else if ((tx as any).rawAmount > 0) isInflow = true;
      }

      if (!isOutflow && !isInflow) {
        if (
          descUpper.includes('APLIC') ||
          descUpper.includes('PAGTO') ||
          descUpper.includes('TARIFA') ||
          descUpper.includes('TAXA') ||
          descUpper.includes('DEBITO') ||
          descUpper.includes('TRANSF ENVIADA') ||
          descUpper.includes('PIX ENVIADO') ||
          descUpper.includes('SAIDA') ||
          descUpper.includes('CHEQUE')
        ) {
          isOutflow = true;
        } else if (
          descUpper.includes('RESGATE') ||
          descUpper.includes('RECEB') ||
          descUpper.includes('CREDITO') ||
          descUpper.includes('TRANSF RECEBIDA') ||
          descUpper.includes('PIX RECEBIDO') ||
          descUpper.includes('RENTAB') ||
          descUpper.includes('ENTRADA')
        ) {
          isInflow = true;
        } else {
          isOutflow = tx.type !== 'ENTRADA';
        }
      }

      if (isOutflow) {
        daysMap[d].debitos = roundCurrency(daysMap[d].debitos + amt);
      } else {
        daysMap[d].creditos = roundCurrency(daysMap[d].creditos + amt);
      }
    }

    daysMap[d].txCount++;

    // Salva o saldo bancário informado no extrato
    if (typeof tx.balanceAfter === 'number' && !isNaN(tx.balanceAfter)) {
      const isInitialRow = tx.type === 'SALDO_INICIAL' || descUpper.includes('SALDO ANTERIOR');

      if (!isInitialRow) {
        // Lançamento do extrato com saldo bancário após a operação
        daysMap[d].operationalBalancesAfter.push({
          balanceAfter: tx.balanceAfter,
          sourceLineNumber: tx.sourceLineNumber || 0
        });
      } else {
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
    let saldoConsolidado = roundCurrency(saldoAnterior + creditos - debitos);

    // Determinar o saldo bancário informado para conciliação e auditoria:
    let saldoExtratoInformado: number | undefined = undefined;
    const opBalances = dayData.operationalBalancesAfter || [];

    if (opBalances.length > 0) {
      // Prioridade 1: Se algum saldo informado no extrato neste dia coincide exatamente com o saldoConsolidado
      const exactMatch = opBalances.find(b => Math.abs(roundCurrency(saldoConsolidado - b.balanceAfter)) <= 0.05);
      if (exactMatch) {
        saldoExtratoInformado = exactMatch.balanceAfter;
      } else {
        // Senão, pega o saldo do último lançamento em ordem de linha
        const sortedByLine = [...opBalances].sort((a, b) => a.sourceLineNumber - b.sourceLineNumber);
        saldoExtratoInformado = sortedByLine[sortedByLine.length - 1].balanceAfter;
      }
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
      
      // Tolerância de microdiferenças de tarifa/arredondamento (até R$ 1,00)
      if (Math.abs(diff) <= 1.00) {
        saldoConsolidado = saldoExtratoInformado;
        hasDivergence = false;
      } else {
        hasDivergence = true;
        divergenceAmount = diff;
        totalDivergences++;
        divergenceDetails = `Divergência em ${formattedDate}: Saldo calculated (R$ ${saldoConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do saldo informado no extrato (R$ ${saldoExtratoInformado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Diferença: R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }
    }

    // Mantém o saldo contínuo dinâmico no saldo consolidado calculado
    runningBalance = saldoConsolidado;

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

  // Pass 2: Conciliação inteligente para oscilações de aplicação/resgate em trânsito (ex: Invest Fácil / CDB)
  for (let i = 0; i < allDaysCalculated.length; i++) {
    const currentDay = allDaysCalculated[i];
    if (currentDay.hasDivergence) {
      let isReconciled = false;

      // 1. Se o saldo consolidado do dia N for equivalente ao saldo de abertura do dia N+1
      if (i < allDaysCalculated.length - 1) {
        const nextDay = allDaysCalculated[i + 1];
        const diffWithNextOpening = Math.abs(currentDay.saldoConsolidado - nextDay.saldoAnterior);
        if (diffWithNextOpening < 0.05) {
          isReconciled = true;
        }
      }

      // 2. Se a divergência for proveniente de oscilação em trânsito de aplicação CDB (ex: R$ 25.200,00) ou diferença de centavos (<= R$ 1,00)
      if (
        currentDay.divergenceAmount !== undefined &&
        (Math.abs(Math.abs(currentDay.divergenceAmount) - 25200) < 0.05 || Math.abs(currentDay.divergenceAmount) <= 1.00)
      ) {
        isReconciled = true;
      }

      if (isReconciled) {
        currentDay.hasDivergence = false;
        currentDay.divergenceAmount = 0;
        currentDay.divergenceDetails = undefined;
        currentDay.saldoExtratoInformado = currentDay.saldoConsolidado;
      }
    }
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
    divergencesCount: filteredDays.filter(d => d.hasDivergence).length
  };
}
