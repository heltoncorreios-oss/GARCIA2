import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Wallet,
  QrCode,
  CreditCard,
  Banknote,
  Send,
  Receipt,
  PiggyBank,
  Percent,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  UploadCloud,
  Building2,
  UserCheck,
  FileText,
  Zap,
  ArrowDownLeft,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Table,
  Search,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { BankAccount, DashboardResponse, PeriodFilter, CategoryBreakdownItem } from '../../types';
import { apiService } from '../../services/api';
import { formatCurrency, formatDateBR } from '../../utils/formatters';
import { validateFinancialConsistency } from '../../utils/financialTotals';

interface DashboardViewProps {
  bankAccounts: BankAccount[];
  onNavigateToImport: () => void;
}

const COLORS = ['#10b981', '#0d9488', '#3b82f6', '#6366f1', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b'];

// Category Icon Helper for the 10 official categories
const renderCategoryIcon = (name: string, type?: string) => {
  const n = name.toLowerCase();
  if (n.includes('boleto recebido') || n.includes('cobrança') || n.includes('cobranca')) {
    return <FileText className="w-4 h-4 text-emerald-700 font-bold" />;
  }
  if (n.includes('cartão') || n.includes('cartao') || n.includes('cielo') || n.includes('voucher') || n.includes('alelo')) {
    return <CreditCard className="w-4 h-4 text-indigo-400" />;
  }
  if (n.includes('pix qr') || n.includes('qr code')) {
    return <QrCode className="w-4 h-4 text-sky-400" />;
  }
  if (n.includes('pix cnpj') || n.includes('cnpj')) {
    return <Building2 className="w-4 h-4 text-teal-400" />;
  }
  if (n.includes('transferencia') || n.includes('transferência') || n.includes('ted')) {
    return <ArrowDownLeft className="w-4 h-4 text-blue-400" />;
  }
  if (n.includes('rendimento') || n.includes('aplicação') || n.includes('aplicacao') || n.includes('facilcred')) {
    return <TrendingUp className="w-4 h-4 text-violet-400" />;
  }
  if (n.includes('pagto de boleto') || n.includes('pagamento boleto') || n.includes('boletos')) {
    return <Receipt className="w-4 h-4 text-rose-700 font-bold" />;
  }
  if (n.includes('cheque')) {
    return <Banknote className="w-4 h-4 text-amber-700 font-bold" />;
  }
  if (n.includes('débito automático') || n.includes('debito automatico') || n.includes('água') || n.includes('luz') || n.includes('cpfl') || n.includes('sabesp')) {
    return <Zap className="w-4 h-4 text-cyan-400" />;
  }
  if (n.includes('taxa') || n.includes('tarifa')) {
    return <Percent className="w-4 h-4 text-red-400" />;
  }
  if (type === 'ENTRADA') {
    return <ArrowUpRight className="w-4 h-4 text-emerald-700 font-bold" />;
  }
  return <ArrowDownRight className="w-4 h-4 text-rose-700 font-bold" />;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  bankAccounts,
  onNavigateToImport
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('todos');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-08-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-09-06');
  const [categoryTab, setCategoryTab] = useState<'ALL' | 'ENTRADA' | 'SAIDA'>('ALL');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados da Janela do Dashboard: 'ENTRADAS' | 'SAIDAS' | 'ALL'
  const [activeWindow, setActiveWindow] = useState<'ENTRADAS' | 'SAIDAS' | 'ALL'>('ALL');

  const handleSelectWindow = (win: 'ENTRADAS' | 'SAIDAS' | 'ALL') => {
    setActiveWindow(win);
    if (win === 'ENTRADAS') {
      setCategoryTab('ENTRADA');
      setTxTypeFilter('ENTRADA');
    } else if (win === 'SAIDAS') {
      setCategoryTab('SAIDA');
      setTxTypeFilter('SAIDA');
    } else {
      setCategoryTab('ALL');
      setTxTypeFilter('ALL');
    }
  };

  // Estados de Organização por Data no Dashboard
  const [dateSortOrder, setDateSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' = Mais recentes primeiro, 'asc' = Mais antigos primeiro

  // Lançamentos do Período no Dashboard
  const [showPeriodTxs, setShowPeriodTxs] = useState<boolean>(false);
  const [txSearch, setTxSearch] = useState<string>('');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'ENTRADA' | 'SAIDA'>('ALL');
  const [txPage, setTxPage] = useState<number>(1);
  const TXS_PER_PAGE = 15;

  const handleDateSortChange = (newOrder: 'desc' | 'asc') => {
    setDateSortOrder(newOrder);
  };

  const getDayOfWeek = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return days[d.getDay()];
      }
    } catch {}
    return '';
  };

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiService.getDashboardData({
        period,
        startDate: period === 'personalizado' ? customStartDate : undefined,
        endDate: period === 'personalizado' ? customEndDate : undefined,
        bankAccountId: selectedAccountId || undefined,
        dateSortOrder
      });
      setData(res);
    } catch (err: unknown) {
      console.error(err);
      setError('Não foi possível carregar as informações financeiras.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [period, selectedAccountId, customStartDate, customEndDate, dateSortOrder]);

  const metrics = data?.metrics;

  // Lançamentos filtrados para o card de lançamentos do período
  const filteredPeriodTxs = (data?.periodTransactions || []).filter((tx) => {
    if (txTypeFilter === 'ENTRADA' && tx.type !== 'ENTRADA') return false;
    if (txTypeFilter === 'SAIDA' && tx.type !== 'SAIDA') return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      const matchDesc = (tx.description || '').toLowerCase().includes(q);
      const matchCat = (tx.categoryName || '').toLowerCase().includes(q);
      const matchOp = (tx.operationType || '').toLowerCase().includes(q);
      const matchBank = (tx.bankAccountName || '').toLowerCase().includes(q);
      if (!matchDesc && !matchCat && !matchOp && !matchBank) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredPeriodTxs.length / TXS_PER_PAGE) || 1;
  const paginatedTxs = filteredPeriodTxs.slice((txPage - 1) * TXS_PER_PAGE, txPage * TXS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header Bar with Period, Bank and Date Organization */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border border-black shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-zinc-950 font-bold tracking-tight">
              Visão Geral Financeira do Supermercado
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/15 text-orange-700 font-bold border border-orange-500/30 flex items-center gap-1.5 shadow-xs">
              <ArrowUpDown className="w-3 h-3 text-orange-700 font-bold" />
              {dateSortOrder === 'desc' ? 'Organizado por Data: Mais Recentes Primeiro' : 'Organizado por Data: Mais Antigos Primeiro'}
            </span>
          </div>
          <p className="text-xs text-zinc-900 font-semibold mt-0.5">
            Métricas consolidadas, fluxo de caixa diário por data, conferência de saldos e recebíveis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Period Selector */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border border-black">
            <Calendar className="w-3.5 h-3.5 text-zinc-900 font-semibold shrink-0" />
            <select
              aria-label="Selecionar período do relatório"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className="bg-transparent text-xs font-semibold text-zinc-950 font-bold focus:outline-none cursor-pointer"
            >
              <option value="todos" className="bg-white text-zinc-950 font-bold">Todo o Período</option>
              <option value="hoje" className="bg-white text-zinc-950 font-bold">Hoje</option>
              <option value="ontem" className="bg-white text-zinc-950 font-bold">Ontem</option>
              <option value="ultimos-7-dias" className="bg-white text-zinc-950 font-bold">Últimos 7 dias</option>
              <option value="ultimos-30-dias" className="bg-white text-zinc-950 font-bold">Últimos 30 dias</option>
              <option value="este-mes" className="bg-white text-zinc-950 font-bold">Este mês</option>
              <option value="mes-anterior" className="bg-white text-zinc-950 font-bold">Mês anterior</option>
              <option value="este-ano" className="bg-white text-zinc-950 font-bold">Este ano</option>
              <option value="personalizado" className="bg-white text-zinc-950 font-bold">Período personalizado</option>
            </select>
          </div>

          {/* CONTROLE PRINCIPAL: Organizar por Data */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-orange-500/30 shadow-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-orange-700 font-bold shrink-0" />
            <span className="text-[11px] font-bold text-zinc-900 font-semibold hidden sm:inline">Data:</span>
            <select
              aria-label="Organizar dashboard por data"
              value={dateSortOrder}
              onChange={(e) => handleDateSortChange(e.target.value as 'desc' | 'asc')}
              className="bg-transparent text-xs font-bold text-orange-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="desc" className="bg-white text-zinc-950 font-bold">Mais Recentes Primeiro (↓)</option>
              <option value="asc" className="bg-white text-zinc-950 font-bold">Mais Antigos Primeiro (↑)</option>
            </select>
            <button
              onClick={() => handleDateSortChange(dateSortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-1 text-orange-700 font-bold hover:text-orange-200 hover:bg-orange-500/15 rounded transition-colors"
              title={dateSortOrder === 'desc' ? 'Inverter para Mais Antigos Primeiro' : 'Inverter para Mais Recentes Primeiro'}
            >
              {dateSortOrder === 'desc' ? (
                <ArrowDownWideNarrow className="w-3.5 h-3.5" />
              ) : (
                <ArrowUpNarrowWide className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {period === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <input
                aria-label="Data inicial"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-white text-zinc-950 font-bold border border border-black rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <span className="text-xs text-zinc-800 font-medium">até</span>
              <input
                aria-label="Data final"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-white text-zinc-950 font-bold border border border-black rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          )}

          <button
            onClick={fetchDashboard}
            className="p-2 text-zinc-900 font-semibold hover:text-zinc-950 font-bold hover:bg-white/5 rounded-xl transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border border-black rounded-xl text-xs text-rose-700 font-bold">
          {error}
        </div>
      )}

      {/* Blank State Onboarding Banner */}
      {metrics?.totalTransactionsCount === 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 via-[#18181c] to-emerald-500/10 p-6 rounded-2xl border border-orange-500/30 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-600/20 text-orange-700 font-bold border border-orange-500/30 rounded-2xl shrink-0">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-950 font-bold">
                  Sistema em branco pronto para o seu extrato real
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-700 font-bold border border-orange-500/30">
                  Pronto para Teste
                </span>
              </div>
              <p className="text-xs text-zinc-950 font-bold mt-1 max-w-2xl leading-relaxed">
                Todas as movimentações demonstrativas foram limpas. Selecione uma conta bancária e faça o upload do seu extrato bancário (<strong className="text-white">OFX, CSV, Excel ou TXT</strong>). O sistema fará a leitura, antiduplicação por hash SHA-256 e pré-classificação automática das receitas e despesas.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToImport}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-950/40 transition-colors shrink-0"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Extrato Agora</span>
          </button>
        </div>
      )}

      {/* CONTROLE PRINCIPAL DE JANELAS DO DASHBOARD: [ ENTRADAS ] [ SAÍDAS ] [ VISÃO CONSOLIDADA ] */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border border-black shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
            activeWindow === 'ENTRADAS'
              ? 'bg-emerald-500/20 text-emerald-700 font-bold border border-black'
              : activeWindow === 'SAIDAS'
              ? 'bg-rose-500/20 text-rose-700 font-bold border border-black'
              : 'bg-orange-500/20 text-orange-700 font-bold border-orange-500/30'
          }`}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-950 font-bold">
                Alternar Janela do Dashboard
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                activeWindow === 'ENTRADAS'
                  ? 'bg-emerald-500/20 text-emerald-700 font-bold border border-black'
                  : activeWindow === 'SAIDAS'
                  ? 'bg-rose-500/20 text-rose-700 font-bold border border-black'
                  : 'bg-orange-500/20 text-orange-700 font-bold border-orange-500/30'
              }`}>
                {activeWindow === 'ENTRADAS' && 'Janela de Entradas Ativa'}
                {activeWindow === 'SAIDAS' && 'Janela de Saídas Ativa'}
                {activeWindow === 'ALL' && 'Visão Consolidada Ativa'}
              </span>
            </div>
            <p className="text-xs text-zinc-900 font-semibold mt-0.5">
              {activeWindow === 'ENTRADAS' && 'Exibindo dados, métricas, gráficos e lançamentos de Crédito (Receitas)'}
              {activeWindow === 'SAIDAS' && 'Exibindo dados, métricas, gráficos e lançamentos de Débito (Despesas)'}
              {activeWindow === 'ALL' && 'Exibindo visão financeira completa consolidada'}
            </p>
          </div>
        </div>

        {/* BOTOES DE ALTERNANCIA: [ ENTRADAS ] [ SAIDAS ] [ CONSOLIDADO ] */}
        <div className="grid grid-cols-3 gap-2 bg-white p-1.5 rounded-xl border border border-black w-full md:w-auto">
          <button
            onClick={() => handleSelectWindow('ENTRADAS')}
            className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeWindow === 'ENTRADAS'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 border border-emerald-400/40 ring-1 ring-emerald-400/30 scale-[1.02]'
                : 'text-zinc-900 font-semibold hover:text-emerald-700 font-bold hover:bg-emerald-500/10'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-700 font-bold" />
            <span>ENTRADAS</span>
          </button>

          <button
            onClick={() => handleSelectWindow('SAIDAS')}
            className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeWindow === 'SAIDAS'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60 border border-rose-400/40 ring-1 ring-rose-400/30 scale-[1.02]'
                : 'text-zinc-900 font-semibold hover:text-rose-700 font-bold hover:bg-rose-500/10'
            }`}
          >
            <TrendingDown className="w-4 h-4 text-rose-700 font-bold" />
            <span>SAÍDAS</span>
          </button>

          <button
            onClick={() => handleSelectWindow('ALL')}
            className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeWindow === 'ALL'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/60 border border-orange-400/40 ring-1 ring-orange-400/30 scale-[1.02]'
                : 'text-zinc-900 font-semibold hover:text-orange-700 font-bold hover:bg-orange-500/10'
            }`}
          >
            <Scale className="w-4 h-4 text-orange-700 font-bold" />
            <span>CONSOLIDADO</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Cards (Adaptados para ENTRADAS / SAIDAS / ALL) */}
      {activeWindow === 'ENTRADAS' ? (
        /* JANELA ENTRADAS: CARDS DEDICADOS A CRÉDITOS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border border-black shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 font-bold uppercase tracking-wider">
                Total de Entradas (Crédito)
              </span>
              <div className="p-2 bg-emerald-500/20 text-emerald-700 font-bold border border border-black rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-emerald-700 font-bold tracking-tight">
                {formatCurrency(metrics?.totalEntradas)}
              </span>
              <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold mt-1 font-bold">
                <ArrowUpRight className="w-4 h-4" />
                <span>{metrics?.entradasCount || 0} lançamentos de entrada</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Média Diária de Entradas
              </span>
              <div className="p-2 bg-emerald-500/10 text-emerald-700 font-bold rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-zinc-950 font-bold tracking-tight">
                {formatCurrency(metrics?.mediaDiariaEntradas)}
              </span>
              <div className="text-xs text-zinc-800 font-medium mt-1">Entrada média por dia trabalhado</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Ticket Médio das Entradas
              </span>
              <div className="p-2 bg-emerald-500/10 text-emerald-700 font-bold rounded-xl">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-zinc-950 font-bold tracking-tight">
                {formatCurrency(metrics?.ticketMedioEntradas)}
              </span>
              <div className="text-xs text-zinc-800 font-medium mt-1">Média por lançamento de crédito</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Maior Entrada do Período
              </span>
              <div className="p-2 bg-emerald-500/10 text-emerald-700 font-bold rounded-xl">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl font-bold text-emerald-700 font-bold tracking-tight truncate block" title={metrics?.maiorEntrada?.description}>
                + {formatCurrency(metrics?.maiorEntrada?.amount)}
              </span>
              <div className="text-xs text-zinc-900 font-semibold truncate mt-1" title={metrics?.maiorEntrada?.description}>
                {metrics?.maiorEntrada?.description || 'Nenhum registro'}
              </div>
            </div>
          </div>
        </div>
      ) : activeWindow === 'SAIDAS' ? (
        /* JANELA SAÍDAS: CARDS DEDICADOS A DÉBITOS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border border-black shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 font-bold uppercase tracking-wider">
                Total de Saídas (Débito)
              </span>
              <div className="p-2 bg-rose-500/20 text-rose-700 font-bold border border border-black rounded-xl">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-rose-700 font-bold tracking-tight">
                {formatCurrency(metrics?.totalSaidas)}
              </span>
              <div className="flex items-center gap-1 text-xs text-rose-700 font-bold mt-1 font-bold">
                <ArrowDownRight className="w-4 h-4" />
                <span>{metrics?.saidasCount || 0} lançamentos de saída</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Média Diária de Saídas
              </span>
              <div className="p-2 bg-rose-500/10 text-rose-700 font-bold rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-zinc-950 font-bold tracking-tight">
                {formatCurrency(metrics?.mediaDiariaSaidas)}
              </span>
              <div className="text-xs text-zinc-800 font-medium mt-1">Desembolso médio por dia</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Ticket Médio das Saídas
              </span>
              <div className="p-2 bg-rose-500/10 text-rose-700 font-bold rounded-xl">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-zinc-950 font-bold tracking-tight">
                {formatCurrency((metrics?.totalSaidas || 0) / (metrics?.saidasCount || 1))}
              </span>
              <div className="text-xs text-zinc-800 font-medium mt-1">Média por lançamento de débito</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Maior Saída do Período
              </span>
              <div className="p-2 bg-rose-500/10 text-rose-700 font-bold rounded-xl">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl font-bold text-rose-700 font-bold tracking-tight truncate block" title={metrics?.maiorSaida?.description}>
                - {formatCurrency(metrics?.maiorSaida?.amount)}
              </span>
              <div className="text-xs text-zinc-900 font-semibold truncate mt-1" title={metrics?.maiorSaida?.description}>
                {metrics?.maiorSaida?.description || 'Nenhum registro'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* JANELA CONSOLIDADA */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Saldo Atual em Caixa & Bancos
              </span>
              <div className="p-2 bg-emerald-500/10 text-emerald-700 font-bold border border border-black rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-zinc-950 font-bold tracking-tight">
                {formatCurrency(metrics?.currentBalance)}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mt-1 font-medium">
                <span>Posição consolidada ativa</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Total de Entradas
              </span>
              <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-blue-400 tracking-tight">
                {formatCurrency(metrics?.totalEntradas)}
              </span>
              <div className="flex items-center gap-1 text-xs text-blue-400/80 mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{metrics?.entradasCount || 0} lançamentos de receita</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Total de Saídas
              </span>
              <div className="p-2 bg-rose-500/10 text-rose-700 font-bold border border border-black rounded-xl">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-rose-700 font-bold tracking-tight">
                {formatCurrency(metrics?.totalSaidas)}
              </span>
              <div className="flex items-center gap-1 text-xs text-rose-700 font-bold/80 mt-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>{metrics?.saidasCount || 0} lançamentos de despesa</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border border-black shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Resultado do Período
              </span>
              <div
                className={`p-2 rounded-xl border ${
                  (metrics?.resultadoFinanceiro || 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-700 font-bold border border-black'
                    : 'bg-rose-500/10 text-rose-700 font-bold border border-black'
                }`}
              >
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span
                className={`text-2xl font-bold tracking-tight ${
                  (metrics?.resultadoFinanceiro || 0) >= 0
                    ? 'text-emerald-700 font-bold'
                    : 'text-rose-700 font-bold'
                }`}
              >
                {formatCurrency(metrics?.resultadoFinanceiro)}
              </span>
              <div className="text-xs text-zinc-800 font-medium mt-1">
                <span>{metrics?.totalTransactionsCount || 0} lançamentos totais analisados</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recebimentos & Operações Detalhadas por Categoria (Reflete as Categorias do Supermercado) */}
      <div className="bg-white p-5 rounded-2xl border border border-black shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border border-black pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-700 font-bold" />
              <h3 className="text-sm font-bold text-zinc-950 font-bold uppercase tracking-wider">
                Recebimentos & Operações Detalhadas por Categoria
              </h3>
            </div>
            <p className="text-xs text-zinc-900 font-semibold mt-0.5">
              Demonstrativo consolidado por categoria oficial (Boleto, Cartões, PIX CPF/CNPJ/QR, Tarifas, Débitos e Pagamentos)
            </p>
          </div>

          {/* Sub-tabs / Filter Buttons */}
          <div className="flex items-center bg-white p-1 rounded-xl border border border-black self-start sm:self-auto">
            <button
              onClick={() => setCategoryTab('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                categoryTab === 'ALL'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-zinc-900 font-semibold hover:text-zinc-950 font-bold'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setCategoryTab(categoryTab === 'ENTRADA' ? 'ALL' : 'ENTRADA')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                categoryTab === 'ENTRADA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-900 font-semibold hover:text-emerald-700 font-bold'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Recebimentos (Entradas)</span>
            </button>
            <button
              onClick={() => setCategoryTab(categoryTab === 'SAIDA' ? 'ALL' : 'SAIDA')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                categoryTab === 'SAIDA'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-900 font-semibold hover:text-rose-700 font-bold'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              <span>Operações (Saídas)</span>
            </button>
          </div>
        </div>

        {/* Categories Section with Clear Separation between Entradas and Saídas */}
        {(() => {
          const rawCategories = data?.categoriesBreakdown || [];
          const entradaCategories = rawCategories.filter(c => c.type === 'ENTRADA');
          const saidaCategories = rawCategories.filter(c => c.type === 'SAIDA');

          const totalEntradasVal = entradaCategories.reduce((sum, c) => sum + c.total, 0);
          const totalEntradasCount = entradaCategories.reduce((sum, c) => sum + c.count, 0);

          const totalSaidasVal = saidaCategories.reduce((sum, c) => sum + c.total, 0);
          const totalSaidasCount = saidaCategories.reduce((sum, c) => sum + c.count, 0);

          const renderCard = (cat: CategoryBreakdownItem) => {
            const isEntrada = cat.type === 'ENTRADA';
            const isExpanded = expandedCategoryId === cat.id;
            const hasSubs = cat.subcategories && cat.subcategories.length > 0;

            return (
              <div
                key={cat.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isEntrada
                    ? 'bg-white/80 hover:bg-white border border-black hover:border border-black'
                    : 'bg-white/80 hover:bg-white border border-black hover:border border-black'
                }`}
              >
                <div>
                  {/* Card Header: Icon + Name + Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg border shrink-0 ${
                          isEntrada
                            ? 'bg-emerald-500/10 text-emerald-700 font-bold border border-black'
                            : 'bg-rose-500/10 text-rose-700 font-bold border border-black'
                        }`}
                      >
                        {renderCategoryIcon(cat.name, cat.type)}
                      </div>
                      <span className="font-bold text-xs text-zinc-950 font-bold truncate" title={cat.name}>
                        {cat.name}
                      </span>
                    </div>

                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                        isEntrada
                          ? 'bg-emerald-500/15 text-emerald-700 font-bold border border border-black'
                          : 'bg-rose-500/15 text-rose-700 font-bold border border border-black'
                      }`}
                    >
                      {isEntrada ? 'Entrada' : 'Saída'}
                    </span>
                  </div>

                  {/* Amount & Count */}
                  <div className="mt-3">
                    <div
                      className={`text-lg font-extrabold tracking-tight ${
                        isEntrada ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                      }`}
                    >
                      {formatCurrency(cat.total)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-900 font-semibold mt-1 font-medium">
                      <span>{cat.count} {cat.count === 1 ? 'lançamento' : 'lançamentos'}</span>
                      <span className="text-zinc-800 font-medium font-bold">
                        {cat.percentage}% do total
                      </span>
                    </div>
                  </div>

                  {/* Subcategories preview tags */}
                  {hasSubs && (
                    <div className="mt-3 pt-2.5 border-t border border-black flex flex-wrap gap-1">
                      {cat.subcategories?.slice(0, 3).map((sub, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-900 font-semibold border border border-black truncate max-w-[150px]"
                          title={sub.name}
                        >
                          {sub.name}
                        </span>
                      ))}
                      {(cat.subcategories?.length || 0) > 3 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-800 font-medium border border border-black">
                          +{(cat.subcategories?.length || 0) - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Subcategories Accordion Trigger */}
                {hasSubs && (
                  <div className="mt-3 pt-2 border-t border border-black">
                    <button
                      onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                      className="w-full flex items-center justify-between text-[10px] font-semibold text-zinc-900 font-semibold hover:text-zinc-950 font-bold transition-colors"
                    >
                      <span>{isExpanded ? 'Ocultar detalhes' : 'Ver subcategorias'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pt-2 border-t border border-black bg-black/20 p-2 rounded-lg">
                        {cat.subcategories?.map((sub, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center justify-between text-[10px] text-zinc-950 font-bold"
                          >
                            <span className="truncate pr-2 text-zinc-900 font-semibold">{sub.name}</span>
                            <span className="font-bold text-zinc-950 font-bold shrink-0">
                              {formatCurrency(sub.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          const showEntradas = categoryTab === 'ENTRADA';
          const showSaidas = categoryTab === 'SAIDA';

          if (rawCategories.length === 0) {
            return (
              <div className="p-8 text-center text-xs text-zinc-800 font-medium bg-white rounded-xl border border border-black">
                Nenhuma categoria localizada para o período selecionado.
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div 
                  onClick={() => setCategoryTab(categoryTab === 'ENTRADA' ? 'ALL' : 'ENTRADA')}
                  className={`p-3.5 rounded-xl bg-white border border border-black flex items-center justify-between cursor-pointer transition-all hover:bg-zinc-50 ${categoryTab === 'ENTRADA' ? 'ring-2 ring-emerald-600' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-700 font-bold">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-emerald-700 font-bold uppercase tracking-wider">
                        Total Recebimentos (Entradas)
                      </div>
                      <div className="text-xs text-zinc-900 font-semibold">
                        {entradaCategories.length} categorias • {totalEntradasCount} lançamentos
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-700 font-bold">
                      {formatCurrency(totalEntradasVal)}
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => setCategoryTab(categoryTab === 'SAIDA' ? 'ALL' : 'SAIDA')}
                  className={`p-3.5 rounded-xl bg-white border border border-black flex items-center justify-between cursor-pointer transition-all hover:bg-zinc-50 ${categoryTab === 'SAIDA' ? 'ring-2 ring-rose-600' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/20 text-rose-700 font-bold">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-rose-700 font-bold uppercase tracking-wider">
                        Total Operações (Saídas)
                      </div>
                      <div className="text-xs text-zinc-900 font-semibold">
                        {saidaCategories.length} categorias • {totalSaidasCount} lançamentos
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-rose-700 font-bold">
                      {formatCurrency(totalSaidasVal)}
                    </div>
                  </div>
                </div>
              </div>

              {categoryTab === 'ALL' && (
                <div className="p-8 text-center bg-white rounded-2xl border border border-black shadow-xs space-y-2">
                  <p className="text-sm font-bold text-zinc-950 font-bold">
                    Selecione "Recebimentos (Entradas)" ou "Operações (Saídas)" acima (ou clique nos cards acima) para exibir os detalhes das categorias.
                  </p>
                </div>
              )}

              {/* SEÇÃO 1: RECEBIMENTOS & ENTRADAS */}
              {showEntradas && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-emerald-950/30 p-3 rounded-xl border border border-black">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 className="text-xs font-black text-emerald-700 font-bold uppercase tracking-wider">
                        Recebimentos & Entradas ({entradaCategories.length} Categoria{entradaCategories.length !== 1 ? 's' : ''})
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border border-black">
                      Subtotal: {formatCurrency(totalEntradasVal)}
                    </span>
                  </div>

                  {entradaCategories.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-800 font-medium bg-white rounded-xl border border border-black">
                      Nenhuma categoria de entrada registrada.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {entradaCategories.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* SEÇÃO 2: OPERAÇÕES & SAÍDAS */}
              {showSaidas && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-rose-950/30 p-3 rounded-xl border border border-black">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <h4 className="text-xs font-black text-rose-700 font-bold uppercase tracking-wider">
                        Operações & Saídas ({saidaCategories.length} Categoria{saidaCategories.length !== 1 ? 's' : ''})
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-rose-700 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg border border border-black">
                      Subtotal: {formatCurrency(totalSaidasVal)}
                    </span>
                  </div>

                  {saidaCategories.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-800 font-medium bg-white rounded-xl border border border-black">
                      Nenhuma categoria de saída registrada.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {saidaCategories.map(renderCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Key Supermarket Operational Calculations (Section 17) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border border-black shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-900 font-semibold uppercase">
            Média Diária Entradas
          </div>
          <div className="text-lg font-bold text-zinc-950 font-bold mt-1">
            {formatCurrency(metrics?.mediaDiariaEntradas)}
          </div>
          <div className="text-[10px] text-zinc-800 font-medium mt-0.5">Faturamento médio/dia</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border border-black shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-900 font-semibold uppercase">
            Média Diária Saídas
          </div>
          <div className="text-lg font-bold text-rose-700 font-bold mt-1">
            {formatCurrency(metrics?.mediaDiariaSaidas)}
          </div>
          <div className="text-[10px] text-zinc-800 font-medium mt-0.5">Desembolso médio/dia</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border border-black shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-900 font-semibold uppercase">
            Ticket Médio Entradas
          </div>
          <div className="text-lg font-bold text-blue-400 mt-1">
            {formatCurrency(metrics?.ticketMedioEntradas)}
          </div>
          <div className="text-[10px] text-zinc-800 font-medium mt-0.5">Valor médio por crédito</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border border-black shadow-xs">
          <div className="text-[11px] font-semibold text-zinc-900 font-semibold uppercase">
            Maior Entrada / Maior Saída
          </div>
          <div className="text-xs font-bold text-emerald-700 font-bold mt-1 truncate" title={metrics?.maiorEntrada?.description}>
            + {formatCurrency(metrics?.maiorEntrada?.amount)}
          </div>
          <div className="text-xs font-bold text-rose-700 font-bold mt-0.5 truncate" title={metrics?.maiorSaida?.description}>
            - {formatCurrency(metrics?.maiorSaida?.amount)}
          </div>
        </div>
      </div>

      {/* SEÇÃO: Lançamentos do Período Organizados por Data (Auditoria Direta no Dashboard) */}
      <div className="bg-white p-5 rounded-2xl border border border-black shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border border-black pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-500/10 text-orange-700 font-bold border border-orange-500/20 rounded-xl shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-zinc-950 font-bold uppercase tracking-wider">
                  Lançamentos do Período Organizados por Data
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-700 font-bold border border-orange-500/30">
                  {filteredPeriodTxs.length} Lançamentos
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-900 font-semibold border border border-black flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-orange-700 font-bold" />
                  {dateSortOrder === 'desc' ? 'Mais Recentes Primeiro (↓)' : 'Mais Antigos Primeiro (↑)'}
                </span>
              </div>
              <p className="text-xs text-zinc-900 font-semibold mt-0.5">
                Consulte e audite individualmente os lançamentos financeiros sem sair do Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPeriodTxs(!showPeriodTxs)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border border-black text-zinc-950 font-bold hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
            >
              {showPeriodTxs ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-zinc-900 font-semibold" />
                  <span>Ocultar Detalhamento</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-orange-700 font-bold" />
                  <span>Ver Lançamentos ({filteredPeriodTxs.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {showPeriodTxs && (
          <div className="space-y-4 pt-1">
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border border-black">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-900 font-semibold" />
                <input
                  type="text"
                  placeholder="Buscar por histórico, categoria, operação..."
                  value={txSearch}
                  onChange={(e) => {
                    setTxSearch(e.target.value);
                    setTxPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-white text-xs text-zinc-950 font-bold border border border-black rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-white p-1 rounded-lg border border border-black text-xs">
                  <button
                    onClick={() => {
                      setTxTypeFilter('ALL');
                      setTxPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded font-semibold transition-colors ${
                      txTypeFilter === 'ALL'
                        ? 'bg-orange-600 text-white'
                        : 'text-zinc-900 font-semibold hover:text-zinc-950 font-bold'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => {
                      setTxTypeFilter('ENTRADA');
                      setTxPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded font-semibold transition-colors ${
                      txTypeFilter === 'ENTRADA'
                        ? 'bg-emerald-600 text-white'
                        : 'text-zinc-900 font-semibold hover:text-emerald-700 font-bold'
                    }`}
                  >
                    Entradas
                  </button>
                  <button
                    onClick={() => {
                      setTxTypeFilter('SAIDA');
                      setTxPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded font-semibold transition-colors ${
                      txTypeFilter === 'SAIDA'
                        ? 'bg-rose-600 text-white'
                        : 'text-zinc-900 font-semibold hover:text-rose-700 font-bold'
                    }`}
                  >
                    Saídas
                  </button>
                </div>

                <span className="text-[11px] text-zinc-800 font-medium font-mono">
                  {filteredPeriodTxs.length} encontrados
                </span>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto rounded-xl border border border-black bg-white/50">
              <table className="w-full text-left text-xs">
                <thead className="bg-white text-zinc-900 font-semibold font-semibold border-b border border-black">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Descrição / Histórico</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Tipo de Operação</th>
                    <th className="p-3">Conta Bancária</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {paginatedTxs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-zinc-800 font-medium">
                        Nenhum lançamento encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedTxs.map((tx) => {
                      const isCredit = tx.type === 'ENTRADA';
                      return (
                        <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-mono text-zinc-950 font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-zinc-800 font-medium" />
                              <span>{formatDateBR(tx.date)}</span>
                            </div>
                          </td>
                          <td className="p-3 max-w-[280px]">
                            <div className="font-semibold text-zinc-950 font-bold truncate" title={tx.description}>
                              {tx.description}
                            </div>
                            {tx.documentNumber && (
                              <div className="text-[10px] text-zinc-800 font-medium font-mono">
                                Doc: {tx.documentNumber}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-zinc-950 font-bold border border border-black truncate max-w-[140px] inline-block">
                              {tx.categoryName || 'Geral'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-[11px] font-medium text-zinc-900 font-semibold">
                              {tx.operationType || 'Outros'}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-900 font-semibold text-[11px]">
                            {tx.bankAccountName || '-'}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                            isCredit ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                          }`}>
                            {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {tx.reconciliationStatus === 'DUPLICADO' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 font-bold border border border-black">
                                <AlertTriangle className="w-3 h-3 text-amber-700 font-bold" />
                                Duplicado
                              </span>
                            ) : (
                              <span className="text-zinc-900 font-semibold text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-zinc-900 font-semibold pt-2 px-1">
                <span>
                  Mostrando {(txPage - 1) * TXS_PER_PAGE + 1} a{' '}
                  {Math.min(txPage * TXS_PER_PAGE, filteredPeriodTxs.length)} de{' '}
                  {filteredPeriodTxs.length} lançamentos
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={txPage <= 1}
                    onClick={() => setTxPage(txPage - 1)}
                    className="px-2.5 py-1 rounded-lg border border border-black bg-white disabled:opacity-40 hover:bg-white/5 transition-colors font-semibold"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-mono text-zinc-950 font-bold">
                    {txPage} / {totalPages}
                  </span>
                  <button
                    disabled={txPage >= totalPages}
                    onClick={() => setTxPage(txPage + 1)}
                    className="px-2.5 py-1 rounded-lg border border border-black bg-white disabled:opacity-40 hover:bg-white/5 transition-colors font-semibold"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 3. Distribuição das Receitas por Tipo de Operação */}
        <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 font-bold">
                Receitas por Tipo de Operação
              </h3>
              <p className="text-xs text-zinc-900 font-semibold">
                Participação de PIX, cartões e depósitos no faturamento
              </p>
            </div>
          </div>
          <div className="h-72 flex flex-col md:flex-row items-center justify-center gap-4">
            {data?.receiptsByOperation && data.receiptsByOperation.length > 0 ? (
              <>
                <div className="w-full md:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.receiptsByOperation}
                        dataKey="total"
                        nameKey="operationType"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {data.receiptsByOperation.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#f4f4f5' }}
                        formatter={(val: number | string | Array<number | string> | undefined) => {
                          const num = typeof val === 'number' ? val : Number(val) || 0;
                          return [formatCurrency(num), 'Total'];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full md:w-1/2 space-y-2 overflow-y-auto max-h-64 pr-2">
                  {data.receiptsByOperation.map((op, idx) => (
                    <div key={op.operationType} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="font-medium text-zinc-950 font-bold">{op.operationType}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-zinc-950 font-bold">
                          {formatCurrency(op.total)}
                        </span>
                        <span className="text-[10px] text-zinc-800 font-medium ml-1.5">
                          ({op.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-zinc-800 font-medium">Nenhuma receita registrada.</div>
            )}
          </div>
        </div>

        {/* 4. Distribuição das Despesas por Categoria */}
        <div className="bg-white p-5 rounded-2xl border border border-black shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 font-bold">
                Distribuição das Despesas por Categoria
              </h3>
              <p className="text-xs text-zinc-900 font-semibold">
                Fornecedores, folha, energia, tributos e manutenção
              </p>
            </div>
          </div>
          <div className="h-72 flex flex-col md:flex-row items-center justify-center gap-4">
            {data?.expensesByCategory && data.expensesByCategory.length > 0 ? (
              <>
                <div className="w-full md:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.expensesByCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {data.expensesByCategory.map((entry, index) => (
                          <Cell
                            key={`cat-cell-${index}`}
                            fill={entry.color || COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#f4f4f5' }}
                        formatter={(val: number | string | Array<number | string> | undefined) => {
                          const num = typeof val === 'number' ? val : Number(val) || 0;
                          return [formatCurrency(num), 'Gasto'];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full md:w-1/2 space-y-2 overflow-y-auto max-h-64 pr-2">
                  {data.expensesByCategory.map((cat, idx) => (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: cat.color || COLORS[idx % COLORS.length]
                          }}
                        />
                        <span className="font-medium text-zinc-950 font-bold truncate">{cat.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-zinc-950 font-bold">
                          {formatCurrency(cat.value)}
                        </span>
                        <span className="text-[10px] text-zinc-800 font-medium ml-1.5">
                          ({cat.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-zinc-800 font-medium">Nenhuma despesa registrada.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
