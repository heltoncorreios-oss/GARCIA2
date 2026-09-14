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
      <div className="bg-white p-4 rounded-2xl border border border-black shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Bank Account Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border border-black">
            <Building2 className="w-4 h-4 text-orange-700 font-bold shrink-0" />
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="bg-transparent text-xs text-zinc-950 font-bold focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-white text-zinc-950 font-bold">Todas as Contas Bancárias</option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-white text-zinc-950 font-bold">
                  {acc.bankName || acc.accountName} - {acc.accountNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border border-black">
            <Calendar className="w-4 h-4 text-orange-700 font-bold shrink-0" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-xs text-zinc-950 font-bold focus:outline-none cursor-pointer"
            >
              <option value="todos" className="bg-white text-zinc-950 font-bold">Todos os Períodos</option>
              <option value="mes-atual" className="bg-white text-zinc-950 font-bold">Mês Atual</option>
              <option value="mes-anterior" className="bg-white text-zinc-950 font-bold">Mês Anterior</option>
              <option value="este-ano" className="bg-white text-zinc-950 font-bold">Este Ano</option>
              <option value="personalizado" className="bg-white text-zinc-950 font-bold">Personalizado</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {period === 'personalizado' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white text-xs text-zinc-950 font-bold px-3 py-1.5 rounded-xl border border border-black focus:outline-none focus:border-orange-500"
              />
              <span className="text-zinc-800 font-medium text-xs">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white text-xs text-zinc-950 font-bold px-3 py-1.5 rounded-xl border border border-black focus:outline-none focus:border-orange-500"
              />
            </div>
          )}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-900 font-semibold absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por data ou valor..."
              className="w-full bg-white pl-9 pr-3 py-1.5 rounded-xl border border border-black text-xs text-zinc-950 font-bold placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={loadTransactions}
            className="p-2 bg-white hover:bg-zinc-100 text-zinc-950 font-bold border border border-black rounded-xl transition-colors cursor-pointer shrink-0"
            title="Recarregar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-700 font-bold' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Saldo Inicial do Período */}
        <div className="bg-white p-4 rounded-2xl border border border-black shadow-md">
          <div className="flex items-center justify-between text-zinc-900 font-semibold text-[11px] font-bold uppercase tracking-wider">
            <span>Saldo Inicial / Anterior</span>
            <Wallet className="w-4 h-4 text-amber-700 font-bold" />
          </div>
          <div className="text-xl font-bold text-zinc-950 font-bold mt-2">
            {formatCurrency(calcResult?.initialBalanceOfPeriod)}
          </div>
          <div className="text-[10px] text-zinc-800 font-medium mt-0.5">
            Herdado do acumulado anterior
          </div>
        </div>

        {/* Total Créditos */}
        <div className="bg-white p-4 rounded-2xl border border border-black shadow-md">
          <div className="flex items-center justify-between text-emerald-700 font-bold text-[11px] font-bold uppercase tracking-wider">
            <span>Total Créditos (+)</span>
            <TrendingUp className="w-4 h-4 text-emerald-700 font-bold" />
          </div>
          <div className="text-xl font-bold text-emerald-700 font-bold mt-2">
            + {formatCurrency(calcResult?.totalCreditosPeriod)}
          </div>
          <div className="text-[10px] text-zinc-800 font-medium mt-0.5">
            Entradas no período
          </div>
        </div>

        {/* Total Débitos */}
        <div className="bg-white p-4 rounded-2xl border border border-black shadow-md">
          <div className="flex items-center justify-between text-rose-700 font-bold text-[11px] font-bold uppercase tracking-wider">
            <span>Total Débitos (-)</span>
            <TrendingDown className="w-4 h-4 text-rose-700 font-bold" />
          </div>
          <div className="text-xl font-bold text-rose-700 font-bold mt-2">
            - {formatCurrency(calcResult?.totalDebitosPeriod)}
          </div>
          <div className="text-[10px] text-zinc-800 font-medium mt-0.5">
            Saídas no período
          </div>
        </div>

        {/* Saldo Consolidado Final */}
        <div className="bg-white p-4 rounded-2xl border border-orange-500/30 shadow-md">
          <div className="flex items-center justify-between text-orange-700 font-bold text-[11px] font-bold uppercase tracking-wider">
            <span>Saldo Consolidado Final</span>
            <Scale className="w-4 h-4 text-orange-700 font-bold" />
          </div>
          <div className="text-xl font-black text-orange-700 font-bold mt-2">
            {formatCurrency(calcResult?.finalBalanceOfPeriod)}
          </div>
          <div className="text-[10px] text-zinc-800 font-medium mt-0.5">
            Posição final acumulada
          </div>
        </div>

        {/* Status de Auditoria */}
        <div className={`p-4 rounded-2xl border shadow-md ${
          (calcResult?.divergencesCount || 0) > 0
            ? 'bg-white border border-black'
            : 'bg-white border border-black'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
            <span className={(calcResult?.divergencesCount || 0) > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
              Auditoria Bancária
            </span>
            {(calcResult?.divergencesCount || 0) > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-700 font-bold" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 font-bold" />
            )}
          </div>
          <div className={`text-xl font-bold mt-2 ${
            (calcResult?.divergencesCount || 0) > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'
          }`}>
            {(calcResult?.divergencesCount || 0) > 0 ? `${calcResult?.divergencesCount} Divergência(s)` : '100% Auditado'}
          </div>
          <div className="text-[10px] text-zinc-900 font-semibold mt-0.5">
            {(calcResult?.divergencesCount || 0) > 0 ? 'Atenção: verifique os dias sinalizados' : 'Saldos do extrato batendo com o cálculo'}
          </div>
        </div>
      </div>

      {/* Primary Audit Table: DATA | SALDO INICIAL/ANTERIOR | CRÉDITOS | DÉBITOS | SALDO CONSOLIDADO */}
      <div className="bg-white rounded-2xl border border border-black shadow-md overflow-hidden">
        <div className="p-4 border-b border border-black flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-orange-700 font-bold" />
            <h3 className="text-sm font-bold text-zinc-950 font-bold uppercase tracking-wider">
              Demonstrativo do Saldo Consolidado por Dia
            </h3>
          </div>
          <span className="text-xs text-zinc-900 font-semibold font-mono bg-white px-3 py-1 rounded-xl border border border-black">
            Total de Dias no Extrato: <strong className="text-orange-700 font-bold">{displayedDays.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-zinc-900 font-semibold uppercase text-[10px] tracking-wider border-b border border-black">
              <tr>
                <th className="p-3.5 font-bold">Data</th>
                <th className="p-3.5 font-bold text-right">Saldo Inicial / Anterior</th>
                <th className="p-3.5 font-bold text-right text-emerald-700 font-bold">Créditos (Entradas)</th>
                <th className="p-3.5 font-bold text-right text-rose-700 font-bold">Débitos (Saídas)</th>
                <th className="p-3.5 font-bold text-right text-orange-700 font-bold">Saldo Consolidado</th>
                <th className="p-3.5 font-bold text-center">Auditoria Extrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-950 font-bold font-medium">
              {displayedDays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-800 font-medium text-xs">
                    Nenhuma movimentação ou extrato encontrado no período selecionado.
                  </td>
                </tr>
              ) : (
                displayedDays.map((day, idx) => (
                  <tr
                    key={day.date}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      day.hasDivergence ? 'bg-rose-950/20' : (idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]')
                    }`}
                  >
                    {/* DATA */}
                    <td className="p-3.5 font-mono font-bold text-zinc-950 font-bold">
                      {day.formattedDate}
                    </td>

                    {/* SALDO INICIAL / ANTERIOR */}
                    <td className="p-3.5 text-right font-mono text-zinc-950 font-bold">
                      {formatCurrency(day.saldoAnterior)}
                    </td>

                    {/* CRÉDITOS */}
                    <td className="p-3.5 text-right font-mono text-emerald-700 font-bold font-semibold">
                      {day.creditos > 0 ? `+ ${formatCurrency(day.creditos)}` : 'R$ 0,00'}
                    </td>

                    {/* DÉBITOS */}
                    <td className="p-3.5 text-right font-mono text-rose-700 font-bold font-semibold">
                      {day.debitos > 0 ? `- ${formatCurrency(day.debitos)}` : 'R$ 0,00'}
                    </td>

                    {/* SALDO CONSOLIDADO */}
                    <td className="p-3.5 text-right font-mono font-black text-orange-700 font-bold bg-orange-500/5">
                      {formatCurrency(day.saldoConsolidado)}
                    </td>

                    {/* AUDITORIA BANCÁRIA */}
                    <td className="p-3.5 text-center">
                      {day.hasDivergence ? (
                        <button
                          onClick={() => setAuditingDay(day)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 font-bold border border border-black transition-all cursor-pointer shadow-md"
                          title="Clique para auditar e verificar a origem desta divergência"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-700 font-bold shrink-0 animate-pulse" />
                          <span>Divergência ({formatCurrency(day.divergenceAmount)})</span>
                        </button>
                      ) : day.saldoExtratoInformado !== undefined ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 font-bold border border border-black" title={`Saldo do Extrato: ${formatCurrency(day.saldoExtratoInformado)}`}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-700 font-bold shrink-0" />
                          <span>Confirmado no Extrato</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-800 font-medium italic">
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
      <div className="bg-white p-4 rounded-xl border border border-black flex items-start gap-3 text-xs text-zinc-900 font-semibold">
        <Info className="w-5 h-5 text-orange-700 font-bold shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-zinc-950 font-bold block font-semibold">
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
