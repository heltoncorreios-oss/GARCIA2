import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
  RefreshCw,
  Search,
  Scale,
  Building2,
  Info
} from 'lucide-react';
import { BankAccount, Transaction } from '../../types';
import { apiService } from '../../services/api';
import {
  calculateConsolidatedBalance,
  ConsolidatedBalanceResult,
  ConsolidatedBalanceDay
} from '../../utils/consolidatedBalance';
import { DivergenceAuditModal } from './DivergenceAuditModal';

interface ConsolidatedBalanceViewProps {
  bankAccounts: BankAccount[];
}

export const ConsolidatedBalanceView: React.FC<ConsolidatedBalanceViewProps> = ({ bankAccounts }) => {
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [period, setPeriod] = useState<string>('todos');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [calcResult, setCalcResult] = useState<ConsolidatedBalanceResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Audit Modal State
  const [auditingDay, setAuditingDay] = useState<ConsolidatedBalanceDay | null>(null);

  // Formatar valores monetários BRL
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Carregar lançamentos do sistema
  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await apiService.getTransactions({ limit: '10000' });
      setAllTransactions(res.transactions || []);
    } catch (err) {
      console.error('Erro ao carregar lançamentos para Saldo Consolidado:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // Recalcular saldo consolidado dinamicamente usando o motor central
  useEffect(() => {
    if (!allTransactions) return;

    let startFilter = startDate;
    let endFilter = endDate;

    if (period === 'mes-atual') {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      startFilter = `${year}-${month}-01`;
      endFilter = `${year}-${month}-31`;
    } else if (period === 'mes-anterior') {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = prev.getFullYear();
      const month = String(prev.getMonth() + 1).padStart(2, '0');
      startFilter = `${year}-${month}-01`;
      endFilter = `${year}-${month}-31`;
    } else if (period === 'este-ano') {
      const now = new Date();
      startFilter = `${now.getFullYear()}-01-01`;
      endFilter = `${now.getFullYear()}-12-31`;
    } else if (period === 'todos') {
      startFilter = '';
      endFilter = '';
    }

    const result = calculateConsolidatedBalance(allTransactions, {
      startDate: startFilter || undefined,
      endDate: endFilter || undefined,
      bankAccountId: selectedBankAccountId || undefined
    });

    setCalcResult(result);
  }, [allTransactions, period, startDate, endDate, selectedBankAccountId]);

  // Filtragem por busca na tabela
  const displayedDays = (calcResult?.days || []).filter(day => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      day.formattedDate.toLowerCase().includes(query) ||
      day.date.toLowerCase().includes(query) ||
      formatCurrency(day.saldoAnterior).toLowerCase().includes(query) ||
      formatCurrency(day.saldoConsolidado).toLowerCase().includes(query)
    );
  });

  // Exportar dados da tabela em CSV
  const handleExportCSV = () => {
    if (!calcResult || calcResult.days.length === 0) return;

    const headers = ['Data', 'Saldo Inicial / Anterior', 'Créditos (R$)', 'Débitos (R$)', 'Saldo Consolidado (R$)', 'Auditoria Extrato'];
    const rows = calcResult.days.map(d => [
      d.formattedDate,
      d.saldoAnterior.toFixed(2),
      d.creditos.toFixed(2),
      d.debitos.toFixed(2),
      d.saldoConsolidado.toFixed(2),
      d.hasDivergence ? 'Divergência Encontrada' : (d.saldoExtratoInformado !== undefined ? 'Confirmado' : 'Sem Saldo no Extrato')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `saldo_consolidado_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Bank Account Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-zinc-200">
            <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="bg-transparent text-xs text-zinc-950 font-medium focus:outline-none cursor-pointer"
            >
              <option key="all-accounts" value="" className="bg-white text-zinc-950 font-bold">Todas as Contas Bancárias</option>
              {bankAccounts.filter(Boolean).map((acc, index) => (
                <option
                  key={acc.id ? `acc-${acc.id}` : `acc-idx-${index}`}
                  value={acc.id || ''}
                  className="bg-white text-zinc-950"
                >
                  {(acc.bankName || acc.accountName || 'Conta')} - {acc.accountNumber || 'S/N'}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-zinc-200">
            <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-xs text-zinc-950 font-medium focus:outline-none cursor-pointer"
            >
              <option key="period-todos" value="todos" className="bg-white text-zinc-950">Todos os Períodos</option>
              <option key="period-mes-atual" value="mes-atual" className="bg-white text-zinc-950">Mês Atual</option>
              <option key="period-mes-anterior" value="mes-anterior" className="bg-white text-zinc-950">Mês Anterior</option>
              <option key="period-este-ano" value="este-ano" className="bg-white text-zinc-950">Este Ano</option>
              <option key="period-personalizado" value="personalizado" className="bg-white text-zinc-950">Personalizado</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {period === 'personalizado' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 text-xs text-zinc-950 font-medium px-3 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-orange-500"
              />
              <span className="text-zinc-600 font-medium text-xs">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 text-xs text-zinc-950 font-medium px-3 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-orange-500"
              />
            </div>
          )}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por data ou valor..."
              className="w-full bg-slate-50 pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 text-xs text-zinc-950 font-medium placeholder-zinc-400 focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={loadTransactions}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-zinc-700 border border-zinc-200 rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Recarregar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-600' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Saldo Inicial do Período */}
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/90 shadow-sm">
          <div className="flex items-center justify-between text-amber-950 font-semibold text-[11px] uppercase tracking-wider">
            <span>Saldo Inicial / Anterior</span>
            <Wallet className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-xl font-bold text-amber-950 font-mono mt-2">
            {formatCurrency(calcResult?.initialBalanceOfPeriod)}
          </div>
          <div className="text-[10px] text-amber-700/80 font-medium mt-0.5">
            Herdado do acumulado anterior
          </div>
        </div>

        {/* Total Créditos */}
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/90 shadow-sm">
          <div className="flex items-center justify-between text-emerald-950 font-semibold text-[11px] uppercase tracking-wider">
            <span>Total Créditos (+)</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold text-emerald-800 font-mono mt-2">
            + {formatCurrency(calcResult?.totalCreditosPeriod)}
          </div>
          <div className="text-[10px] text-emerald-700/80 font-medium mt-0.5">
            Entradas no período
          </div>
        </div>

        {/* Total Débitos */}
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/90 shadow-sm">
          <div className="flex items-center justify-between text-rose-950 font-semibold text-[11px] uppercase tracking-wider">
            <span>Total Débitos (-)</span>
            <TrendingDown className="w-4 h-4 text-rose-700" />
          </div>
          <div className="text-xl font-bold text-rose-800 font-mono mt-2">
            - {formatCurrency(calcResult?.totalDebitosPeriod)}
          </div>
          <div className="text-[10px] text-rose-700/80 font-medium mt-0.5">
            Saídas no período
          </div>
        </div>

        {/* Saldo Consolidado Final com fundo dinâmico conforme a saúde */}
        <div className={`p-4 rounded-2xl border shadow-sm transition-all duration-200 ${
          (calcResult?.finalBalanceOfPeriod ?? 0) >= 0
            ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border-emerald-300/90 text-emerald-950'
            : 'bg-gradient-to-br from-rose-50/90 to-amber-50/60 border-rose-300/90 text-rose-950'
        }`}>
          <div className="flex items-center justify-between font-semibold text-[11px] uppercase tracking-wider">
            <span className={(calcResult?.finalBalanceOfPeriod ?? 0) >= 0 ? 'text-emerald-950 font-bold' : 'text-rose-950 font-bold'}>
              Saldo Consolidado Final
            </span>
            <Scale className={`w-4 h-4 ${
              (calcResult?.finalBalanceOfPeriod ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`} />
          </div>
          <div className={`text-xl font-black font-mono mt-2 ${
            (calcResult?.finalBalanceOfPeriod ?? 0) >= 0 ? 'text-emerald-900' : 'text-rose-900'
          }`}>
            {formatCurrency(calcResult?.finalBalanceOfPeriod)}
          </div>
          <div className={`text-[10px] font-medium mt-0.5 ${
            (calcResult?.finalBalanceOfPeriod ?? 0) >= 0 ? 'text-emerald-700/90' : 'text-rose-700/90'
          }`}>
            {(calcResult?.finalBalanceOfPeriod ?? 0) >= 0 ? '🟢 Caixa Saudável (Positivo)' : '🔴 Caixa em Atenção (Negativo)'}
          </div>
        </div>

        {/* Status de Auditoria */}
        <div className={`p-4 rounded-2xl border shadow-sm ${
          (calcResult?.divergencesCount || 0) > 0
            ? 'bg-rose-50/80 border-rose-200/90 text-rose-950'
            : 'bg-emerald-50/80 border-emerald-200/90 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
            <span className={(calcResult?.divergencesCount || 0) > 0 ? 'text-rose-900 font-bold' : 'text-emerald-900 font-bold'}>
              Auditoria Bancária
            </span>
            {(calcResult?.divergencesCount || 0) > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className={`text-xl font-bold mt-2 ${
            (calcResult?.divergencesCount || 0) > 0 ? 'text-rose-800' : 'text-emerald-800'
          }`}>
            {(calcResult?.divergencesCount || 0) > 0 ? `${calcResult?.divergencesCount} Divergência(s)` : '100% Auditado'}
          </div>
          <div className="text-[10px] text-zinc-600 font-medium mt-0.5">
            {(calcResult?.divergencesCount || 0) > 0 ? 'Atenção: verifique os dias sinalizados' : 'Saldos do extrato batendo com o cálculo'}
          </div>
        </div>
      </div>

      {/* Primary Audit Table: DATA | SALDO INICIAL/ANTERIOR | CRÉDITOS | DÉBITOS | SALDO CONSOLIDADO */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden">
        <div className="p-4 bg-zinc-50/90 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-orange-600" />
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
              Demonstrativo do Saldo Consolidado por Dia
            </h3>
          </div>
          <span className="text-xs text-zinc-700 font-mono bg-white px-3 py-1 rounded-xl border border-zinc-200 shadow-xs">
            Total de Dias no Extrato: <strong className="text-orange-600 font-bold">{displayedDays.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[11px] tracking-wider border-b-2 border-zinc-300">
              <tr>
                <th className="py-3.5 px-4 font-bold border-r border-zinc-200">Data</th>
                <th className="py-3.5 px-4 font-bold text-right border-r border-zinc-200">Saldo Inicial / Anterior</th>
                <th className="py-3.5 px-4 font-bold text-right text-emerald-800 border-r border-zinc-200">Créditos (Entradas)</th>
                <th className="py-3.5 px-4 font-bold text-right text-rose-800 border-r border-zinc-200">Débitos (Saídas)</th>
                <th className="py-3.5 px-4 font-bold text-right text-orange-950 bg-orange-100/50 border-r border-zinc-200">Saldo Consolidado</th>
                <th className="py-3.5 px-4 font-bold text-center">Auditoria Extrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-900 font-medium">
              {displayedDays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-600 text-xs">
                    Nenhuma movimentação ou extrato encontrado no período selecionado.
                  </td>
                </tr>
              ) : (
                displayedDays.map((day, idx) => (
                  <tr
                    key={day.date}
                    className={`transition-colors ${
                      day.hasDivergence
                        ? 'bg-rose-50/90 hover:bg-rose-100/70 border-l-4 border-l-rose-500'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-orange-50/40'
                        : 'bg-zinc-50/70 hover:bg-orange-50/40'
                    }`}
                  >
                    {/* DATA */}
                    <td className="py-3 px-4 font-mono font-bold text-zinc-900 border-r border-zinc-200/80 whitespace-nowrap">
                      {day.formattedDate}
                    </td>

                    {/* SALDO INICIAL / ANTERIOR */}
                    <td className="py-3 px-4 text-right font-mono text-zinc-800 border-r border-zinc-200/80 tabular-nums">
                      {formatCurrency(day.saldoAnterior)}
                    </td>

                    {/* CRÉDITOS */}
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold border-r border-zinc-200/80 tabular-nums">
                      {day.creditos > 0 ? `+ ${formatCurrency(day.creditos)}` : 'R$ 0,00'}
                    </td>

                    {/* DÉBITOS */}
                    <td className="py-3 px-4 text-right font-mono text-rose-700 font-bold border-r border-zinc-200/80 tabular-nums">
                      {day.debitos > 0 ? `- ${formatCurrency(day.debitos)}` : 'R$ 0,00'}
                    </td>

                    {/* SALDO CONSOLIDADO */}
                    <td className={`py-3 px-4 text-right font-mono font-black border-r border-zinc-200/80 tabular-nums ${
                      day.saldoConsolidado >= 0 ? 'text-zinc-950 bg-orange-50/50' : 'text-rose-700 bg-rose-50/50'
                    }`}>
                      {formatCurrency(day.saldoConsolidado)}
                    </td>

                    {/* AUDITORIA BANCÁRIA */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {day.hasDivergence ? (
                        <button
                          onClick={() => setAuditingDay(day)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 transition-all cursor-pointer shadow-xs"
                          title="Clique para auditar e verificar a origem desta divergência"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                          <span>Divergência ({formatCurrency(day.divergenceAmount)})</span>
                        </button>
                      ) : day.saldoExtratoInformado !== undefined ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300" title={`Saldo do Extrato: ${formatCurrency(day.saldoExtratoInformado)}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Confirmado no Extrato</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500 italic">
                          Saldo Contínuo Calculado
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Information Box on Calculation Rules */}
      <div className="bg-slate-50 border border-zinc-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-zinc-600 shadow-2xs">
        <Info className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-zinc-950 block font-semibold">
            Entenda a Regra de Cálculo do Saldo Consolidado:
          </strong>
          <p>
            • <strong>Identificação Automática:</strong> O sistema localiza a primeira linha válida com valor informado na coluna "Saldo (R$)" do extrato como <strong>Saldo Inicial</strong>.
          </p>
          <p>
            • <strong>Cálculo Cronológico Contínuo:</strong> A cada dia, o saldo é calculado como <code>Saldo Anterior + Créditos do Dia - Débitos do Dia</code>. O saldo não reinicia a cada dia.
          </p>
          <p>
            • <strong>Uso estrito de colunas financeiras:</strong> Apenas os valores de <em>Crédito (R$)</em> e <em>Débito (R$)</em> são processados financeiramente. A coluna <em>Dcto. Valor (R$)</em> é tratada unicamente como identificador numérico de documento.
          </p>
          <p>
            • <strong>Preservação no Filtro de Período:</strong> Ao filtrar um período específico (ex: 25/08 a 30/08), o sistema consulta o saldo acumulado de 24/08 como saldo inicial em vez de zerar o valor.
          </p>
        </div>
      </div>

      {/* DIVERGENCE AUDIT MODAL */}
      <DivergenceAuditModal
        isOpen={Boolean(auditingDay)}
        onClose={() => setAuditingDay(null)}
        day={auditingDay}
        transactions={allTransactions}
      />
    </div>
  );
};
