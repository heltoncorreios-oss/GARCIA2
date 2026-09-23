import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HelpCircle,
  FileSpreadsheet,
  X,
  Save,
  CheckCheck,
  AlertCircle,
  UploadCloud,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Tag,
  Sparkles,
  Zap,
  CheckSquare,
  Square,
  BookmarkPlus,
  BarChart2,
  Table,
  TrendingUp,
  Calendar,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import {
  BankAccount,
  Category,
  ClassificationRule,
  OperationTypeInfo,
  ReconciliationStatus,
  Transaction
} from '../../types';
import { apiService } from '../../services/api';
import {
  formatCurrency,
  formatDateBR,
  exportToExcel,
  exportToCSV
} from '../../utils/formatters';
import { calculateConsolidatedBalance } from '../../utils/consolidatedBalance';
import { CategorizeModal } from './CategorizeModal';

export type SortField =
  | 'date'
  | 'amount'
  | 'description'
  | 'operationType'
  | 'categoryName'
  | 'origin'
  | 'reconciliationStatus';

export type SortOrder = 'asc' | 'desc';

interface TransactionsViewProps {
  bankAccounts: BankAccount[];
  categories: Category[];
  operationTypes: OperationTypeInfo[];
  onRefreshStats?: () => void;
  onNavigateToImport?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  bankAccounts,
  categories,
  operationTypes,
  onRefreshStats,
  onNavigateToImport
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedOpType, setSelectedOpType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [onlyUncategorized, setOnlyUncategorized] = useState<boolean>(false);

  // Selection for Batch Actions
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Categorize Modal States
  const [categorizeModalOpen, setCategorizeModalOpen] = useState<boolean>(false);
  const [categorizeTargets, setCategorizeTargets] = useState<Transaction[]>([]);
  const [isApplyingRules, setIsApplyingRules] = useState<boolean>(false);

  // Ordenação das movimentações
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Selected row for Edit Modal
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  // Learn Rule checkbox when editing
  const [learnRule, setLearnRule] = useState<boolean>(true);

  // New Transaction Modal
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newTx, setNewTx] = useState<Partial<Transaction>>({
    type: 'ENTRADA',
    date: new Date().toISOString().substring(0, 10),
    bankAccountId: bankAccounts[0]?.id || '',
    amount: 0,
    description: '',
    operationType: 'PIX'
  });

  const [notification, setNotification] = useState<string | null>(null);

  // Sub-aba: Lançamentos Detalhados vs Movimentação Diária & Fluxo de Caixa
  const [viewTab, setViewTab] = useState<'LIST' | 'DAILY_FLOW'>('LIST');
  const [dailyViewMode, setDailyViewMode] = useState<'BOTH' | 'CHARTS' | 'TABLE'>('BOTH');
  const [dailySortField, setDailySortField] = useState<'date' | 'saldoAnterior' | 'entradas' | 'saidas' | 'resultado' | 'saldoAcumulado'>('date');
  const [dailySortOrder, setDailySortOrder] = useState<'desc' | 'asc'>('desc');
  const [chartChronological, setChartChronological] = useState<boolean>(true);
  const [allPeriodTransactions, setAllPeriodTransactions] = useState<Transaction[]>([]);

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

  const isTxUncategorized = (t: Transaction): boolean => {
    if (t.type === 'SALDO_INICIAL') return false;
    if (!t.categoryId || t.categoryId === '') return true;
    if (!t.operationType || t.operationType === 'NAO_CLASSIFICADO' || t.operationType === 'OUTRAS') return true;
    if (t.categoryName && (t.categoryName.includes('Não classificado') || t.categoryName.includes('Não Categorizado') || t.categoryName.includes('Sem Categoria'))) return true;
    return false;
  };

  const uncategorizedList = useMemo(() => {
    return transactions.filter(isTxUncategorized);
  }, [transactions]);

  const uncategorizedCount = uncategorizedList.length;

  const handleOpenCategorize = (targets: Transaction[]) => {
    if (targets.length === 0) return;
    setCategorizeTargets(targets);
    setCategorizeModalOpen(true);
  };

  const handleCategorizeSuccess = (result: {
    updatedCount: number;
    ruleCreated?: ClassificationRule;
    similarUpdatedCount?: number;
  }) => {
    let msg = `✅ ${result.updatedCount} lançamento(s) categorizado(s) com sucesso!`;
    if (result.similarUpdatedCount && result.similarUpdatedCount > 0) {
      msg += ` E mais ${result.similarUpdatedCount} lançamento(s) semelhantes atualizados automaticamente.`;
    }
    if (result.ruleCreated) {
      msg += ` ⚡ Regra salva para os próximos extratos: "${result.ruleCreated.keyword}" -> ${result.ruleCreated.operationType}`;
    }
    setNotification(msg);
    setSelectedTxIds(new Set());
    fetchTransactions();
    if (onRefreshStats) onRefreshStats();
  };

  const handleApplyAllRules = async () => {
    try {
      setIsApplyingRules(true);
      const res = await apiService.applyRulesToExisting('Gestor Financeiro');
      if (res.updatedCount > 0) {
        setNotification(`⚡ Sucesso! ${res.updatedCount} lançamento(s) sem categoria foram classificados automaticamente com as regras existentes.`);
        fetchTransactions();
        if (onRefreshStats) onRefreshStats();
      } else {
        setNotification('ℹ️ Nenhuma nova correspondência encontrada para os lançamentos pendentes com as regras ativas atuais.');
      }
    } catch (err: any) {
      setNotification(`Erro ao aplicar regras: ${err.message}`);
    } finally {
      setIsApplyingRules(false);
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.size >= sortedTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(sortedTransactions.map((t) => t.id)));
    }
  };

  const handleSelectAllUncategorized = () => {
    const ids = uncategorizedList.map((t) => t.id);
    setSelectedTxIds(new Set(ids));
    setOnlyUncategorized(true);
  };

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getTransactions({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        bankAccountId: selectedAccountId || undefined,
        type: (selectedType as 'ENTRADA' | 'SAIDA') || undefined,
        categoryId: selectedCategory || undefined,
        operationType: selectedOpType || undefined,
        reconciliationStatus: selectedStatus || undefined,
        search: search || undefined
      });
      setTransactions(res.transactions);

      // Se houver filtros de busca/tipo/categoria, carrega os lançamentos completos do período para cálculo exato do fluxo diário
      if (selectedType || selectedCategory || selectedOpType || selectedStatus || search) {
        const fullRes = await apiService.getTransactions({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          bankAccountId: selectedAccountId || undefined
        });
        setAllPeriodTransactions(fullRes.transactions);
      } else {
        setAllPeriodTransactions(res.transactions);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [
    startDate,
    endDate,
    selectedAccountId,
    selectedType,
    selectedCategory,
    selectedOpType,
    selectedStatus,
    search
  ]);

  // Manipulação coordenada e inteligente dos filtros para evitar estados mutuamente exclusivos
  const handleOpTypeChange = (opValue: string) => {
    setSelectedOpType(opValue);
    if (opValue) {
      const op = operationTypes.find(
        (o) => o.code === opValue || o.name === opValue || o.id === opValue
      );
      if (op) {
        // Se a categoria atualmente selecionada for de sentido oposto, desmarca para não zerar os resultados
        if (selectedCategory) {
          const currentCat = categories.find((c) => c.id === selectedCategory);
          if (currentCat && currentCat.type !== op.defaultType) {
            setSelectedCategory('');
          }
        }
        // Se o tipo (Entrada/Saída) estiver oposto, ajusta para o tipo da operação
        if (selectedType && selectedType !== op.defaultType) {
          setSelectedType(op.defaultType);
        }
      }
    }
  };

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    if (catId) {
      const cat = categories.find((c) => c.id === catId);
      if (cat) {
        // Se o tipo de operação selecionado for de sentido oposto, desmarca
        if (selectedOpType) {
          const op = operationTypes.find(
            (o) => o.code === selectedOpType || o.name === selectedOpType
          );
          if (op && op.defaultType !== cat.type) {
            setSelectedOpType('');
          }
        }
        // Se o tipo (Entrada/Saída) estiver oposto, ajusta
        if (selectedType && selectedType !== cat.type) {
          setSelectedType(cat.type);
        }
      }
    }
  };

  const handleTypeChange = (typeVal: string) => {
    setSelectedType(typeVal);
    if (typeVal) {
      if (selectedCategory) {
        const currentCat = categories.find((c) => c.id === selectedCategory);
        if (currentCat && currentCat.type !== typeVal) {
          setSelectedCategory('');
        }
      }
      if (selectedOpType) {
        const op = operationTypes.find(
          (o) => o.code === selectedOpType || o.name === selectedOpType
        );
        if (op && op.defaultType !== typeVal) {
          setSelectedOpType('');
        }
      }
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedAccountId('');
    setSelectedType('');
    setSelectedCategory('');
    setSelectedOpType('');
    setSelectedStatus('');
    setOnlyUncategorized(false);
  };

  const activeFiltersCount =
    (search ? 1 : 0) +
    (selectedAccountId ? 1 : 0) +
    (selectedType ? 1 : 0) +
    (selectedOpType ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (onlyUncategorized ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0;

  // Ações de conciliação (em lote e individual)
  const handleBatchReconcile = async (action: 'CONCILIAR' | 'PENDENTE') => {
    if (selectedTxIds.size === 0) return;
    try {
      await apiService.batchReconcile(Array.from(selectedTxIds), action, 'Financeiro');
      const label = action === 'CONCILIAR' ? 'CONCILIADO' : 'PENDENTE';
      setNotification(`⚡ Status atualizado para "${label}" em ${selectedTxIds.size} lançamento(s)!`);
      setTimeout(() => setNotification(null), 3500);
      setSelectedTxIds(new Set());
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar conciliação.');
    }
  };

  const handleToggleSingleReconciliation = async (tx: Transaction) => {
    const nextStatus = tx.reconciliationStatus === 'CONCILIADO' ? 'PENDENTE' : 'CONCILIADO';
    try {
      await apiService.updateTransaction(tx.id, { reconciliationStatus: nextStatus }, 'Financeiro');
      setNotification(`Lançamento "${tx.description}" marcado como ${nextStatus}!`);
      setTimeout(() => setNotification(null), 3000);
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar conciliação.');
    }
  };

  // Cálculo consolidado de fluxo diário
  const dailyConsolidated = useMemo(() => {
    const txSource = allPeriodTransactions.length > 0 ? allPeriodTransactions : transactions;
    return calculateConsolidatedBalance(txSource, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      bankAccountId: selectedAccountId || undefined
    });
  }, [allPeriodTransactions, transactions, startDate, endDate, selectedAccountId]);

  // Ordenação da tabela consolidada de movimentação diária
  const sortedDailyDays = useMemo(() => {
    const list = [...(dailyConsolidated?.days || [])];
    return list.sort((a, b) => {
      let comp = 0;
      if (dailySortField === 'date') {
        comp = a.date.localeCompare(b.date);
      } else if (dailySortField === 'saldoAnterior') {
        comp = (a.saldoAnterior || 0) - (b.saldoAnterior || 0);
      } else if (dailySortField === 'entradas') {
        comp = a.creditos - b.creditos;
      } else if (dailySortField === 'saidas') {
        comp = a.debitos - b.debitos;
      } else if (dailySortField === 'resultado') {
        comp = a.resultadoOperacional - b.resultadoOperacional;
      } else if (dailySortField === 'saldoAcumulado') {
        comp = a.saldoConsolidado - b.saldoConsolidado;
      }
      return dailySortOrder === 'desc' ? -comp : comp;
    });
  }, [dailyConsolidated?.days, dailySortField, dailySortOrder]);

  const handleDailySort = (field: 'date' | 'saldoAnterior' | 'entradas' | 'saidas' | 'resultado' | 'saldoAcumulado') => {
    if (dailySortField === field) {
      setDailySortOrder(dailySortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setDailySortField(field);
      setDailySortOrder('desc');
    }
  };

  // Dados para gráficos diários
  const chartDays = useMemo(() => {
    const list = (dailyConsolidated?.days || []).map((d) => ({
      date: d.date,
      formattedDate: d.formattedDate,
      entradas: d.creditos,
      saidas: d.debitos,
      saldoAnterior: d.saldoAnterior,
      resultado: d.resultadoOperacional,
      saldoAcumulado: d.saldoConsolidado
    }));
    return list.sort((a, b) => {
      if (chartChronological) {
        return a.date.localeCompare(b.date);
      }
      return b.date.localeCompare(a.date);
    });
  }, [dailyConsolidated?.days, chartChronological]);

  // Exportar dados da movimentação diária
  const handleExportDaily = (format: 'XLSX' | 'CSV') => {
    if (!sortedDailyDays || sortedDailyDays.length === 0) return;
    const exportData = sortedDailyDays.map((d) => ({
      Data: d.formattedDate,
      'Dia da Semana': getDayOfWeek(d.date),
      'Saldo Anterior (R$)': d.saldoAnterior || 0,
      'Entradas (Créditos R$)': d.creditos,
      'Saídas (Débitos R$)': d.debitos,
      'Resultado Líquido do Dia (R$)': d.resultadoOperacional,
      'Saldo Consolidado (R$)': d.saldoConsolidado
    }));
    if (format === 'XLSX') {
      exportToExcel(exportData, `fluxo_diario_${startDate}_a_${endDate}`);
    } else {
      exportToCSV(exportData, `fluxo_diario_${startDate}_a_${endDate}`);
    }
  };

  // Lista de transações reordenadas de acordo com o campo e direção selecionados
  const sortedTransactions = useMemo(() => {
    let list = [...transactions];
    if (onlyUncategorized) {
      list = list.filter(isTxUncategorized);
    }
    return list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date': {
          const valA = a.date || '';
          const valB = b.date || '';
          comparison = valA.localeCompare(valB);
          if (comparison === 0) {
            comparison = (a.id || '').localeCompare(b.id || '');
          }
          break;
        }
        case 'amount': {
          const valA = Number(a.amount) || 0;
          const valB = Number(b.amount) || 0;
          comparison = valA - valB;
          break;
        }
        case 'description': {
          const valA = a.description || '';
          const valB = b.description || '';
          comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case 'operationType': {
          const valA = a.operationType || '';
          const valB = b.operationType || '';
          comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case 'categoryName': {
          const valA = a.categoryName || '';
          const valB = b.categoryName || '';
          comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case 'origin': {
          const valA = a.origin || '';
          const valB = b.origin || '';
          comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case 'reconciliationStatus': {
          const valA = a.reconciliationStatus || '';
          const valB = b.reconciliationStatus || '';
          comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortField, sortOrder, onlyUncategorized]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Para data e valor, ordenação inicial mais natural é decrescente (mais recente / maior)
      if (field === 'date' || field === 'amount') {
        setSortOrder('desc');
      } else {
        setSortOrder('asc');
      }
    }
  };

  const handleSelectCombinedSort = (value: string) => {
    const [field, order] = value.split(':') as [SortField, SortOrder];
    if (field && order) {
      setSortField(field);
      setSortOrder(order);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    try {
      await apiService.updateTransaction(
        editingTx.id,
        {
          date: editingTx.date,
          description: editingTx.description,
          amount: editingTx.amount,
          type: editingTx.type,
          categoryId: editingTx.categoryId,
          categoryName: editingTx.categoryName,
          subcategoryId: editingTx.subcategoryId,
          subcategoryName: editingTx.subcategoryName,
          operationType: editingTx.operationType,
          reconciliationStatus: editingTx.reconciliationStatus,
          observation: editingTx.observation
        },
        'Sistema'
      );

      // If learnRule is checked and category is defined, also create classification rule
      if (learnRule && editingTx.categoryId && editingTx.operationType) {
        const keyword = editingTx.description.split(' ').slice(0, 3).join(' ');
        if (keyword.length >= 3) {
          try {
            await apiService.createRule(
              {
                keyword,
                operationType: editingTx.operationType,
                categoryId: editingTx.categoryId,
                categoryName: editingTx.categoryName,
                subcategoryId: editingTx.subcategoryId,
                subcategoryName: editingTx.subcategoryName,
                confidence: 'ALTA',
                priority: 20
              },
              'Sistema'
            );
          } catch (ruleErr) {
            console.warn('Could not auto-create rule', ruleErr);
          }
        }
      }

      setEditingTx(null);
      setNotification('Lançamento atualizado com sucesso!');
      setTimeout(() => setNotification(null), 3000);
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleSaveNew = async () => {
    if (!newTx.description || !newTx.amount || !newTx.bankAccountId || !newTx.date) {
      alert('Preencha os campos obrigatórios: Conta, Data, Descrição e Valor.');
      return;
    }

    try {
      await apiService.createTransaction(newTx, 'Sistema');
      setIsCreating(false);
      setNewTx({
        type: 'ENTRADA',
        date: new Date().toISOString().substring(0, 10),
        bankAccountId: bankAccounts[0]?.id || '',
        amount: 0,
        description: '',
        operationType: 'PIX'
      });
      setNotification('Novo lançamento manual cadastrado!');
      setTimeout(() => setNotification(null), 3000);
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) return;
    try {
      await apiService.deleteTransaction(id, 'Sistema');
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleExport = (format: 'XLSX' | 'CSV') => {
    const exportData = sortedTransactions.map((t) => {
      const acc = bankAccounts.find((a) => a.id === t.bankAccountId);
      return {
        ID: t.id,
        Data: formatDateBR(t.date),
        Competência: formatDateBR(t.competenceDate),
        Conta: acc?.accountName || t.bankAccountId,
        Descrição: t.description,
        Tipo: t.type,
        Valor: t.amount,
        'Tipo Operação': t.operationType,
        Categoria: t.categoryName || 'Não classificado',
        Subcategoria: t.subcategoryName || '-',
        'Status Conciliação': t.reconciliationStatus,
        Origem: t.origin,
        'Usuário Responsável': t.responsibleUser || '-'
      };
    });

    const name = `movimentacoes_supermercado_${startDate}_${endDate}`;
    if (format === 'XLSX') exportToExcel(exportData, name);
    else exportToCSV(exportData, name);
  };

  const totalEntradas = transactions
    .filter((t) => t.type === 'ENTRADA')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSaidas = transactions
    .filter((t) => t.type === 'SAIDA')
    .reduce((sum, t) => sum + t.amount, 0);

  const saldoLiquido = totalEntradas - totalSaidas;

  return (
    <div className="space-y-5">
      {/* Navegação entre Visão de Lançamentos Detalhados e Movimentação Diária & Fluxo de Caixa */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-zinc-200/90 shadow-2xs">
        <button
          onClick={() => setViewTab('LIST')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            viewTab === 'LIST'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/80'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Lançamentos Detalhados</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            viewTab === 'LIST' ? 'bg-black/20 text-white' : 'bg-zinc-200/80 text-zinc-700'
          }`}>
            {sortedTransactions.length}
          </span>
        </button>

        <button
          onClick={() => setViewTab('DAILY_FLOW')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            viewTab === 'DAILY_FLOW'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/80'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Movimentação Diária & Fluxo de Caixa</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            viewTab === 'DAILY_FLOW' ? 'bg-black/20 text-white' : 'bg-zinc-200/80 text-zinc-700'
          }`}>
            {dailyConsolidated.days.length} dias
          </span>
        </button>
      </div>

      {/* ABA 1: LANÇAMENTOS DETALHADOS */}
      {viewTab === 'LIST' && (
        <>
      {/* Uncategorized Warning Banner & Quick Action */}
      {uncategorizedCount > 0 && (
        <div className="bg-gradient-to-r from-purple-950/30 via-orange-950/20 to-transparent border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-950 font-bold flex items-center gap-2">
                <span>{uncategorizedCount} lançamento(s) sem categoria identificados</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/30 text-purple-200 border border-purple-500/40">
                  Pendente
                </span>
              </h4>
              <p className="text-xs text-zinc-900 font-semibold mt-0.5">
                Você pode categorizá-los diretamente aqui e criar regras automáticas para os próximos extratos bancários.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setOnlyUncategorized(!onlyUncategorized);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                onlyUncategorized
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-purple-300 border border-purple-500/30'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyUncategorized ? 'Mostrar Todos' : 'Ver Apenas Sem Categoria'}</span>
            </button>

            <button
              onClick={() => handleOpenCategorize(uncategorizedList)}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-950/40 transition-colors flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Categorizar Todos ({uncategorizedCount})</span>
            </button>
          </div>
        </div>
      )}

      {notification && (
        <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 text-orange-700 font-bold text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-orange-700 font-bold" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar histórico, fornecedor, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium text-zinc-950 placeholder:text-zinc-400"
            />
          </div>

          {/* Bank Account */}
          <div>
            <select
              aria-label="Filtrar por Conta Bancária"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium text-zinc-950"
            >
              <option value="" className="bg-white text-zinc-950 font-bold">Todas as Contas ({bankAccounts.length})</option>
              {bankAccounts.map((acc, idx) => (
                <option key={`bank-filter-opt-${acc.id || idx}`} value={acc.id} className="bg-white text-zinc-950 font-bold">
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <select
              aria-label="Filtrar por Tipo de Lançamento"
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium text-zinc-950"
            >
              <option value="" className="bg-white text-zinc-950 font-bold">Entrada & Saída</option>
              <option value="ENTRADA" className="bg-white text-zinc-950 font-bold">Apenas Entradas (+)</option>
              <option value="SAIDA" className="bg-white text-zinc-950 font-bold">Apenas Saídas (-)</option>
            </select>
          </div>

          {/* Operation Type */}
          <div>
            <select
              aria-label="Filtrar por Tipo de Operação"
              value={selectedOpType}
              onChange={(e) => handleOpTypeChange(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium text-zinc-950"
            >
              <option value="" className="bg-white text-zinc-950 font-bold">Todos Tipos Operação</option>
              <optgroup key="opgroup-in" label="Operações de Entrada (+)" className="bg-white text-emerald-700 font-semibold">
                {operationTypes.filter((op) => op.defaultType === 'ENTRADA').map((op, idx) => (
                  <option key={`optype-in-${op.id || op.code || idx}`} value={op.name} className="bg-white text-zinc-950">
                    {op.name}
                  </option>
                ))}
              </optgroup>
              <optgroup key="opgroup-out" label="Operações de Saída (-)" className="bg-white text-rose-700 font-semibold">
                {operationTypes.filter((op) => op.defaultType === 'SAIDA').map((op, idx) => (
                  <option key={`optype-out-${op.id || op.code || idx}`} value={op.name} className="bg-white text-zinc-950">
                    {op.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Category */}
          <div>
            <select
              aria-label="Filtrar por Categoria Financeira"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium text-zinc-950"
            >
              <option value="" className="bg-white text-zinc-950 font-bold">Todas as Categorias</option>
              <optgroup key="catgroup-in" label="Categorias de Entrada (+)" className="bg-white text-emerald-700 font-semibold">
                {categories.filter((c) => c.type === 'ENTRADA').map((c, idx) => (
                  <option key={`cat-in-${c.id || idx}`} value={c.id} className="bg-white text-zinc-950">
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup key="catgroup-out" label="Categorias de Saída (-)" className="bg-white text-rose-700 font-semibold">
                {categories.filter((c) => c.type === 'SAIDA').map((c, idx) => (
                  <option key={`cat-out-${c.id || idx}`} value={c.id} className="bg-white text-zinc-950">
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Status Duplicado */}
          <div>
            <select
              aria-label="Filtrar por Duplicidade"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-2.5 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium text-zinc-950"
            >
              <option value="" className="bg-white text-zinc-950 font-bold">Todos os Lançamentos</option>
              <option value="DUPLICADO" className="bg-white text-zinc-950 font-bold">Somente Duplicados</option>
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-zinc-100 text-xs text-zinc-700 font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-950">Período de:</span>
            <input
              aria-label="Data inicial do filtro"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-lg text-zinc-950 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <span>até:</span>
            <input
              aria-label="Data final do filtro"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-lg text-zinc-950 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
            />

            {/* Clear Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors shadow-2xs"
                title="Limpar todos os filtros ativos"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar Filtros ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span>
              Entradas: <strong className="text-emerald-700 font-bold">{formatCurrency(totalEntradas)}</strong>
            </span>
            <span>
              Saídas: <strong className="text-rose-700 font-bold">{formatCurrency(totalSaidas)}</strong>
            </span>
            <span>
              Saldo: <strong className={saldoLiquido >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                {formatCurrency(saldoLiquido)}
              </strong>
            </span>
          </div>
        </div>

        {/* Sorting & Reordering Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-zinc-100 text-xs text-zinc-700 font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-950">
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-600" />
              <span>Ordenar por:</span>
            </div>

            {/* Quick Combined Select */}
            <select
              aria-label="Critério e direção de ordenação"
              value={`${sortField}:${sortOrder}`}
              onChange={(e) => handleSelectCombinedSort(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium text-zinc-950"
            >
              <option value="date:desc" className="bg-white text-zinc-950 font-bold">
                Data (Mais recente primeiro)
              </option>
              <option value="date:asc" className="bg-white text-zinc-950 font-bold">
                Data (Mais antigo primeiro)
              </option>
              <option value="amount:desc" className="bg-white text-zinc-950 font-bold">
                Valor (Maior valor primeiro)
              </option>
              <option value="amount:asc" className="bg-white text-zinc-950 font-bold">
                Valor (Menor valor primeiro)
              </option>
              <option value="description:asc" className="bg-white text-zinc-950 font-bold">
                Descrição (A → Z)
              </option>
              <option value="description:desc" className="bg-white text-zinc-950 font-bold">
                Descrição (Z → A)
              </option>
              <option value="operationType:asc" className="bg-white text-zinc-950 font-bold">
                Tipo de Operação (A → Z)
              </option>
              <option value="categoryName:asc" className="bg-white text-zinc-950 font-bold">
                Categoria (A → Z)
              </option>
              <option value="origin:asc" className="bg-white text-zinc-950 font-bold">
                Origem (Extrato / Manual)
              </option>
              <option value="reconciliationStatus:asc" className="bg-white text-zinc-950 font-bold">
                Status de Conciliação
              </option>
            </select>

            {/* Invert direction button */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-zinc-200 rounded-xl text-zinc-800 font-semibold transition-colors shadow-2xs"
              title={sortOrder === 'asc' ? 'Ordem atual: Crescente. Clique para inverter para decrescente.' : 'Ordem atual: Decrescente. Clique para inverter para crescente.'}
            >
              {sortOrder === 'asc' ? (
                <>
                  <ArrowUp className="w-3.5 h-3.5 text-orange-600 font-bold" />
                  <span>Crescente (A-Z / Menor)</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3.5 h-3.5 text-orange-600 font-bold" />
                  <span>Decrescente (Z-A / Maior)</span>
                </>
              )}
            </button>

            {/* Quick shortcuts */}
            <div className="hidden sm:flex items-center gap-1 border-l border-zinc-200 pl-2">
              <button
                type="button"
                onClick={() => {
                  setSortField('date');
                  setSortOrder('desc');
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  sortField === 'date' && sortOrder === 'desc'
                    ? 'bg-orange-100 text-orange-800 font-bold border border-orange-200'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                }`}
                title="Ordenar por data mais recente primeiro"
              >
                Mais Recentes
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortField('date');
                  setSortOrder('asc');
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  sortField === 'date' && sortOrder === 'asc'
                    ? 'bg-orange-100 text-orange-800 font-bold border border-orange-200'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                }`}
                title="Ordenar por data mais antiga primeiro"
              >
                Mais Antigos
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortField('amount');
                  setSortOrder('desc');
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  sortField === 'amount' && sortOrder === 'desc'
                    ? 'bg-orange-100 text-orange-800 font-bold border border-orange-200'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                }`}
                title="Ordenar por maior valor primeiro"
              >
                Maior Valor
              </button>
            </div>

            {/* Reset button if custom sort */}
            {(sortField !== 'date' || sortOrder !== 'desc') && (
              <button
                type="button"
                onClick={() => {
                  setSortField('date');
                  setSortOrder('desc');
                }}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-orange-700 font-semibold transition-colors ml-1"
                title="Restaurar ordenação padrão (Data mais recente)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar padrão</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-zinc-600 font-medium">
            Exibindo <strong className="text-zinc-950 font-bold">{sortedTransactions.length}</strong> {sortedTransactions.length === 1 ? 'lançamento' : 'lançamentos'}
          </div>
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden relative pb-16">
        {/* Batch Action Floating Bar */}
        {selectedTxIds.size > 0 && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-[#1e1e26] border border-orange-500/40 rounded-2xl p-3 px-5 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-700 font-bold font-bold text-xs flex items-center justify-center">
                {selectedTxIds.size}
              </span>
              <span className="text-xs font-bold text-zinc-950 font-bold">
                {selectedTxIds.size} movimentação(ões) selecionada(s)
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedTxIds(new Set())}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold rounded-xl text-xs font-semibold transition-colors"
              >
                Limpar Seleção
              </button>
              <button
                onClick={() => {
                  const targets = transactions.filter((t) => selectedTxIds.has(t.id));
                  handleOpenCategorize(targets);
                }}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-950/40 transition-all flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Categorizar Selecionados</span>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-zinc-300 shadow-sm bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[11px] tracking-wider border-b-2 border-zinc-300">
              <tr>
                {/* Checkbox All */}
                <th className="py-3.5 px-3 w-10 text-center border-r border-zinc-200">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                    title="Selecionar todos"
                  >
                    {selectedTxIds.size > 0 && selectedTxIds.size >= sortedTransactions.length ? (
                      <CheckSquare className="w-4 h-4 text-orange-600" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                </th>

                {/* Data */}
                <th
                  onClick={() => handleSort('date')}
                  className={`py-3.5 px-3.5 cursor-pointer select-none transition-colors border-r border-zinc-200 group ${
                    sortField === 'date' ? 'text-orange-600 bg-orange-50/50' : 'hover:text-zinc-900'
                  }`}
                  title="Clique para ordenar por data"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Data</span>
                    {sortField === 'date' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-orange-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Descrição / Histórico */}
                <th
                  onClick={() => handleSort('description')}
                  className={`py-3.5 px-3.5 min-w-[220px] cursor-pointer select-none transition-colors border-r border-zinc-200 group ${
                    sortField === 'description' ? 'text-orange-600 bg-orange-50/50' : 'hover:text-zinc-900'
                  }`}
                  title="Clique para ordenar por descrição"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Descrição / Histórico</span>
                    {sortField === 'description' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-orange-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Valor */}
                <th
                  onClick={() => handleSort('amount')}
                  className={`py-3.5 px-3.5 text-right cursor-pointer select-none transition-colors border-r border-zinc-200 group ${
                    sortField === 'amount' ? 'text-orange-600 bg-orange-50/50' : 'hover:text-zinc-900'
                  }`}
                  title="Clique para ordenar por valor"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Valor</span>
                    {sortField === 'amount' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-orange-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Operação */}
                <th
                  onClick={() => handleSort('operationType')}
                  className={`py-3.5 px-3.5 cursor-pointer select-none transition-colors border-r border-zinc-200 group ${
                    sortField === 'operationType' ? 'text-orange-600 bg-orange-50/50' : 'hover:text-zinc-900'
                  }`}
                  title="Clique para ordenar por tipo de operação"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Operação</span>
                    {sortField === 'operationType' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-orange-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Categoria */}
                <th
                  onClick={() => handleSort('categoryName')}
                  className={`py-3.5 px-3.5 cursor-pointer select-none transition-colors border-r border-zinc-200 group ${
                    sortField === 'categoryName' ? 'text-orange-600 bg-orange-50/50' : 'hover:text-zinc-900'
                  }`}
                  title="Clique para ordenar por categoria"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Categoria</span>
                    {sortField === 'categoryName' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-orange-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Origem */}
                <th
                  onClick={() => handleSort('origin')}
                  className={`py-3.5 px-3.5 cursor-pointer select-none transition-colors border-r border-zinc-200 group ${
                    sortField === 'origin' ? 'text-orange-600 bg-orange-50/50' : 'hover:text-zinc-900'
                  }`}
                  title="Clique para ordenar por origem"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Origem</span>
                    {sortField === 'origin' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-orange-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                    )}
                  </div>
                </th>

                {/* Status */}
                <th
                  onClick={() => handleSort('reconciliationStatus')}
                  className={`py-3.5 px-3.5 cursor-pointer select-none transition-colors border-r border-zinc-200 group ${
                    sortField === 'reconciliationStatus' ? 'text-orange-600 bg-orange-50/50' : 'hover:text-zinc-900'
                  }`}
                  title="Clique para ordenar por status de conciliação"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    {sortField === 'reconciliationStatus' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-orange-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                    )}
                  </div>
                </th>

                <th className="py-3.5 px-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-900 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-600">
                    Carregando movimentações...
                  </td>
                </tr>
              ) : sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 border border-orange-500/20 flex items-center justify-center mb-3">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-zinc-900">
                        Nenhum lançamento no sistema
                      </h4>
                      <p className="text-xs text-zinc-600 mt-1 mb-4 leading-relaxed">
                        O sistema está em branco e pronto para receber o seu extrato bancário real. Faça o upload do arquivo OFX, CSV, Excel ou TXT.
                      </p>
                      <div className="flex items-center gap-2">
                        {onNavigateToImport && (
                          <button
                            onClick={onNavigateToImport}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Importar Extrato Bancário</span>
                          </button>
                        )}
                        <button
                          onClick={() => setIsCreating(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-semibold rounded-xl transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-orange-400" />
                          <span>Lançamento Manual</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((tx, idx) => {
                  const isSaldoInicial = tx.type === 'SALDO_INICIAL' || tx.operationType?.toUpperCase().includes('SALDO INICIAL');
                  const isCredit = tx.type === 'ENTRADA';
                  const isSelected = selectedTxIds.has(tx.id);

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isSaldoInicial
                          ? 'bg-blue-50/70 hover:bg-blue-100/50 border-l-4 border-l-blue-500'
                          : isSelected
                          ? 'bg-orange-100/60 hover:bg-orange-100/80 border-l-4 border-l-orange-500'
                          : idx % 2 === 0
                          ? 'bg-white hover:bg-orange-50/40'
                          : 'bg-zinc-50/70 hover:bg-orange-50/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center border-r border-zinc-200/80">
                        <button
                          type="button"
                          onClick={() => toggleSelectTx(tx.id)}
                          className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-orange-600" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>
                      </td>

                      {/* Data */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-zinc-900 border-r border-zinc-200/80 tabular-nums">
                        {formatDateBR(tx.date)}
                      </td>

                      {/* Descrição */}
                      <td className="py-3 px-3.5 border-r border-zinc-200/80">
                        <div className="font-semibold text-zinc-900 flex items-center gap-2">
                          <span>{tx.description}</span>
                          {isSaldoInicial && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Saldo Inicial
                            </span>
                          )}
                        </div>
                        {tx.documentId && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            Doc: {tx.documentId}
                          </span>
                        )}
                        {tx.observation && (
                          <div className="text-[10px] text-zinc-600 italic mt-0.5">
                            Obs: {tx.observation}
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap border-r border-zinc-200/80 tabular-nums font-mono">
                        {isSaldoInicial ? (
                          <span className="font-bold text-blue-700">
                            {formatCurrency(tx.balanceAfter !== undefined ? tx.balanceAfter : tx.amount)}
                          </span>
                        ) : (
                          <span
                            className={`font-bold ${
                              isCredit ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isCredit ? '+' : '-'} {formatCurrency(tx.amount)}
                          </span>
                        )}
                      </td>

                      {/* Operação */}
                      <td className="py-3 px-3.5 whitespace-nowrap border-r border-zinc-200/80">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${
                          isSaldoInicial
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                        }`}>
                          {tx.operationType || (isSaldoInicial ? 'Saldo Inicial' : '-')}
                        </span>
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-3.5 border-r border-zinc-200/80">
                        {tx.categoryName && !isTxUncategorized(tx) ? (
                          <div>
                            <span className="font-semibold text-zinc-900">
                              {tx.categoryName}
                            </span>
                            {tx.subcategoryName && (
                              <div className="text-[10px] text-zinc-500">
                                {tx.subcategoryName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                              Não classificado
                            </span>
                            {!isSaldoInicial && (
                              <button
                                onClick={() => handleOpenCategorize([tx])}
                                className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Categorizar este lançamento agora"
                              >
                                <Tag className="w-3 h-3" />
                                <span>Categorizar</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Origem */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-zinc-700 border-r border-zinc-200/80">
                        <span className="text-[11px] font-medium">
                          {tx.origin === 'EXTRATO' ? 'Extrato' : 'Manual'}
                        </span>
                      </td>

                      {/* Status / Duplicidade */}
                      <td className="py-3 px-3.5 whitespace-nowrap border-r border-zinc-200/80">
                        {tx.reconciliationStatus === 'DUPLICADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Duplicado
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingTx(tx)}
                            className="p-1.5 text-zinc-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar lançamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* ABA 2: MOVIMENTAÇÃO DIÁRIA & FLUXO DE CAIXA */}
      {viewTab === 'DAILY_FLOW' && (
        <div className="space-y-4">
          {/* Filtros rápidos do Fluxo Diário */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900">Conta Bancária:</span>
                <select
                  aria-label="Conta Bancária"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="py-1.5 px-3 bg-white border border-zinc-300 rounded-xl text-zinc-900 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">Todas as Contas ({bankAccounts.length})</option>
                  {bankAccounts.map((acc, idx) => (
                    <option key={`daily-bank-opt-${acc.id || idx}`} value={acc.id}>
                      {acc.name} ({acc.bankName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-950">Período de:</span>
                <input
                  aria-label="Data inicial"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-xl text-zinc-950 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <span className="text-zinc-600 font-medium">até:</span>
                <input
                  aria-label="Data final"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-xl text-zinc-950 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportDaily('XLSX')}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200/80 border border-zinc-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                title="Exportar tabela diária para Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Excel</span>
              </button>
              <button
                onClick={() => handleExportDaily('CSV')}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/80 border border-zinc-200 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                title="Exportar tabela diária para CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Cards de Resumo KPI do Período */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200/90 shadow-sm">
              <div className="text-[11px] font-semibold text-sky-950">Saldo Inicial do Período</div>
              <div className="text-base sm:text-lg font-bold text-sky-900 font-mono mt-1">
                {formatCurrency(dailyConsolidated.initialBalanceOfPeriod)}
              </div>
              <div className="text-[10px] text-sky-700/80 font-medium mt-0.5">Saldo base no início</div>
            </div>
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/90 shadow-sm">
              <div className="text-[11px] font-semibold text-emerald-950">Total Entradas (Créditos)</div>
              <div className="text-base sm:text-lg font-bold text-emerald-800 font-mono mt-1">
                + {formatCurrency(dailyConsolidated.totalCreditosPeriod)}
              </div>
              <div className="text-[10px] text-emerald-700/80 mt-0.5">Faturamento no período</div>
            </div>
            <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/90 shadow-sm">
              <div className="text-[11px] font-semibold text-rose-950">Total Saídas (Débitos)</div>
              <div className="text-base sm:text-lg font-bold text-rose-800 font-mono mt-1">
                - {formatCurrency(dailyConsolidated.totalDebitosPeriod)}
              </div>
              <div className="text-[10px] text-rose-700/80 mt-0.5">Despesas no período</div>
            </div>
            <div className="bg-gradient-to-br from-violet-50/80 to-indigo-50/40 p-4 rounded-2xl border border-violet-200/90 shadow-sm">
              <div className="text-[11px] font-semibold text-violet-950">Resultado Operacional</div>
              <div className={`text-base sm:text-lg font-bold font-mono mt-1 ${
                dailyConsolidated.resultadoLiquidoPeriod >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                {dailyConsolidated.resultadoLiquidoPeriod >= 0 ? '+' : ''}
                {formatCurrency(dailyConsolidated.resultadoLiquidoPeriod)}
              </div>
              <div className="text-[10px] text-violet-700/80 font-medium mt-0.5">Créditos - Débitos</div>
            </div>
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/90 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-semibold text-amber-950">Saldo Consolidado Final</div>
              <div className="text-base sm:text-lg font-bold text-amber-950 font-mono mt-1">
                {formatCurrency(dailyConsolidated.finalBalanceOfPeriod)}
              </div>
              <div className="text-[10px] text-amber-700/80 font-medium mt-0.5">Saldo final acumulado</div>
            </div>
          </div>

          {/* Seção Principal: Movimentação Diária & Fluxo de Caixa por Data */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/90 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
                    Movimentação Diária & Fluxo de Caixa por Data
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-orange-600" />
                    {dailySortField === 'date'
                      ? `Dias Organizados por Data (${dailySortOrder === 'desc' ? 'Mais Recentes Primeiro ↓' : 'Mais Antigos Primeiro ↑'})`
                      : `Ordenado por ${dailySortField} (${dailySortOrder === 'desc' ? 'Maior ↓' : 'Menor ↑'})`}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Acompanhe dia a dia o faturamento, saídas operacionais e resultado líquido em ordem cronológica ou pelos dias mais recentes
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Switcher de visualização */}
                <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-zinc-200 text-xs">
                  <button
                    onClick={() => setDailyViewMode('BOTH')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      dailyViewMode === 'BOTH'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-zinc-700 hover:text-zinc-950'
                    }`}
                  >
                    Ambos
                  </button>
                  <button
                    onClick={() => setDailyViewMode('TABLE')}
                    className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                      dailyViewMode === 'TABLE'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-zinc-700 hover:text-zinc-950'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabela Diária</span>
                  </button>
                  <button
                    onClick={() => setDailyViewMode('CHARTS')}
                    className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                      dailyViewMode === 'CHARTS'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-zinc-700 hover:text-zinc-950'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Gráficos</span>
                  </button>
                </div>

                {/* Botões Rápidos de Ordem de Datas */}
                <div className="flex items-center gap-1 bg-slate-100/90 px-2 py-1 rounded-xl border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase px-1">Ordem dos Dias:</span>
                  <button
                    onClick={() => {
                      setDailySortField('date');
                      setDailySortOrder('desc');
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                      dailySortField === 'date' && dailySortOrder === 'desc'
                        ? 'bg-orange-600 text-white'
                        : 'text-zinc-700 hover:text-zinc-950'
                    }`}
                    title="Mostrar os dias mais recentes primeiro"
                  >
                    <ArrowDownWideNarrow className="w-3 h-3" />
                    <span>Recentes Primeiro</span>
                  </button>
                  <button
                    onClick={() => {
                      setDailySortField('date');
                      setDailySortOrder('asc');
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                      dailySortField === 'date' && dailySortOrder === 'asc'
                        ? 'bg-orange-500/20 text-orange-700 font-bold border border-orange-500/30'
                        : 'text-zinc-900 font-semibold hover:text-zinc-950 font-bold'
                    }`}
                    title="Mostrar os dias mais antigos primeiro (cronológico)"
                  >
                    <ArrowUpNarrowWide className="w-3 h-3" />
                    <span>Antigos Primeiro</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TABELA DIÁRIA CONSOLIDADA POR DATA */}
            {(dailyViewMode === 'TABLE' || dailyViewMode === 'BOTH') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-900 font-semibold px-1">
                  <span className="font-semibold text-zinc-950 font-bold">
                    Detalhamento Dia a Dia ({sortedDailyDays.length} dias no período)
                  </span>
                  <span className="text-[11px] text-zinc-800 font-medium">
                    Clique nos cabeçalhos para ordenar por Data, Saldo Inicial, Entradas, Saídas, Resultado ou Saldo Acumulado
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-zinc-300 shadow-sm bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[11px] tracking-wider border-b-2 border-zinc-300">
                      <tr>
                        <th className="py-3 px-3.5 border-r border-zinc-200">
                          <button
                            onClick={() => handleDailySort('date')}
                            className="flex items-center gap-1.5 hover:text-orange-600 text-orange-600 font-bold transition-colors cursor-pointer"
                            title="Clique para organizar por data"
                          >
                            <span>Data / Dia da Semana</span>
                            {dailySortField === 'date' ? (
                              <span className="text-orange-600 text-[11px] font-extrabold">{dailySortOrder === 'desc' ? '▼ (Recentes)' : '▲ (Antigos)'}</span>
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-orange-400" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-3.5 text-right border-r border-zinc-200">
                          <button
                            onClick={() => handleDailySort('saldoAnterior')}
                            className="flex items-center gap-1.5 ml-auto hover:text-sky-700 text-sky-800 font-bold transition-colors cursor-pointer"
                            title="Saldo Inicial (R$) do Dia"
                          >
                            <span>Saldo Inicial (R$)</span>
                            {dailySortField === 'saldoAnterior' ? (
                              <span className="text-[10px]">{dailySortOrder === 'desc' ? '▼' : '▲'}</span>
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-3.5 text-right border-r border-zinc-200">
                          <button
                            onClick={() => handleDailySort('entradas')}
                            className="flex items-center gap-1.5 ml-auto hover:text-emerald-800 text-emerald-700 font-bold transition-colors cursor-pointer"
                            title="Total de Créditos do Dia"
                          >
                            <span>Crédito (R$)</span>
                            {dailySortField === 'entradas' ? (
                              <span className="text-[10px]">{dailySortOrder === 'desc' ? '▼' : '▲'}</span>
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-3.5 text-right border-r border-zinc-200">
                          <button
                            onClick={() => handleDailySort('saidas')}
                            className="flex items-center gap-1.5 ml-auto hover:text-rose-800 text-rose-700 font-bold transition-colors cursor-pointer"
                            title="Total de Débitos do Dia"
                          >
                            <span>Débito (R$)</span>
                            {dailySortField === 'saidas' ? (
                              <span className="text-[10px]">{dailySortOrder === 'desc' ? '▼' : '▲'}</span>
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-3.5 text-right border-r border-zinc-200">
                          <button
                            onClick={() => handleDailySort('resultado')}
                            className="flex flex-col items-end ml-auto hover:text-zinc-900 transition-colors font-semibold cursor-pointer"
                            title="RESULTADO LÍQUIDO DO DIA = CRÉDITOS DO DIA - DÉBITOS DO DIA"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-800 font-extrabold uppercase">RESULTADO LÍQUIDO</span>
                              {dailySortField === 'resultado' ? (
                                <span className="text-orange-600 text-[10px]">{dailySortOrder === 'desc' ? '▼' : '▲'}</span>
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                              )}
                            </div>
                            <span className="text-[9px] text-zinc-500 font-normal">
                              Entradas - Saídas
                            </span>
                          </button>
                        </th>
                        <th className="py-3 px-3.5 text-right bg-orange-100/50 text-orange-950 border-r border-zinc-200">
                          <button
                            onClick={() => handleDailySort('saldoAcumulado')}
                            className="flex items-center gap-1.5 ml-auto hover:text-orange-950 text-orange-950 font-black transition-colors cursor-pointer"
                          >
                            <span>Saldo Consolidado</span>
                            {dailySortField === 'saldoAcumulado' ? (
                              <span className="text-orange-700 text-[10px]">{dailySortOrder === 'desc' ? '▼' : '▲'}</span>
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-orange-400" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-3.5 text-center min-w-[120px]">Balanço Diário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-zinc-900 font-medium">
                      {sortedDailyDays.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-zinc-600">
                            Nenhuma movimentação diária registrada no período selecionado.
                          </td>
                        </tr>
                      ) : (
                        sortedDailyDays.map((day, idx) => {
                          const dayOfWeek = getDayOfWeek(day.date);
                          const isWeekend = dayOfWeek === 'Sáb' || dayOfWeek === 'Dom';
                          const isLatest = idx === 0 && dailySortField === 'date' && dailySortOrder === 'desc';
                          const totalMov = day.creditos + day.debitos;
                          const entPercent = totalMov > 0 ? Math.round((day.creditos / totalMov) * 100) : 50;

                          return (
                            <tr
                              key={day.date}
                              className={`transition-colors ${
                                isLatest
                                  ? 'bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                                  : idx % 2 === 0
                                  ? 'bg-white hover:bg-orange-50/40'
                                  : 'bg-zinc-50/70 hover:bg-orange-50/40'
                              }`}
                            >
                              <td className="py-3 px-3.5 border-r border-zinc-200/80 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-zinc-900">
                                    {day.formattedDate || formatDateBR(day.date)}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                    isWeekend
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                  }`}>
                                    {dayOfWeek}
                                  </span>
                                  {isLatest && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300">
                                      Mais Recente
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-zinc-800 border-r border-zinc-200/80 tabular-nums">
                                {formatCurrency(day.saldoAnterior || 0)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 border-r border-zinc-200/80 tabular-nums">
                                {day.creditos > 0 ? `+ ${formatCurrency(day.creditos)}` : 'R$ 0,00'}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-700 border-r border-zinc-200/80 tabular-nums">
                                {day.debitos > 0 ? `- ${formatCurrency(day.debitos)}` : 'R$ 0,00'}
                              </td>
                              <td className="py-3 px-3.5 text-right border-r border-zinc-200/80 tabular-nums">
                                <div className="flex flex-col items-end">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono font-bold ${
                                    day.resultadoOperacional >= 0
                                      ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                                      : 'text-rose-800 bg-rose-50 border border-rose-200'
                                  }`}>
                                    {day.resultadoOperacional >= 0 ? '+' : ''}{formatCurrency(day.resultadoOperacional)}
                                  </span>
                                  <span className="text-[9px] font-mono text-zinc-500 mt-0.5">
                                    {formatCurrency(day.saldoAnterior || 0)} + {formatCurrency(day.creditos)} - {formatCurrency(day.debitos)}
                                  </span>
                                </div>
                              </td>
                              <td className={`py-3 px-3.5 text-right font-mono font-black border-r border-zinc-200/80 tabular-nums ${
                                day.saldoConsolidado >= 0 ? 'text-zinc-950 bg-orange-50/50' : 'text-rose-700 bg-rose-50/50'
                              }`}>
                                {formatCurrency(day.saldoConsolidado)}
                              </td>
                              <td className="py-3 px-3.5 text-center">
                                <div className="w-24 mx-auto bg-zinc-200 rounded-full h-2.5 overflow-hidden flex" title={`Entradas: ${entPercent}% | Saídas: ${100 - entPercent}%`}>
                                  <div
                                    style={{ width: `${entPercent}%` }}
                                    className="bg-emerald-500 h-full"
                                  />
                                  <div
                                    style={{ width: `${100 - entPercent}%` }}
                                    className="bg-rose-500 h-full"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* GRÁFICOS DIÁRIOS (Entradas x Saídas & Evolução do Saldo) */}
            {(dailyViewMode === 'CHARTS' || dailyViewMode === 'BOTH') && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-xs border-t border-zinc-200 pt-3">
                  <span className="font-semibold text-zinc-950">
                    Visualização Gráfica Temporal
                  </span>
                  <button
                    onClick={() => setChartChronological(!chartChronological)}
                    className="text-[11px] font-semibold text-orange-700 hover:text-orange-900 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 transition-colors cursor-pointer"
                    title="Alternar sentido do eixo de tempo no gráfico"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>Eixo do Gráfico: {chartChronological ? 'Cronológico (Passado → Recente)' : 'Invertido (Recente → Passado)'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 1. Entradas x Saídas por Dia */}
                  <div className="bg-white p-4 rounded-xl border border-zinc-200/90 shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-950">
                          Entradas x Saídas por Dia
                        </h4>
                        <p className="text-[11px] text-zinc-600 font-medium">
                          Comparativo diário de receitas (créditos) e despesas (débitos)
                        </p>
                      </div>
                    </div>
                    <div className="h-64">
                      {chartDays && chartDays.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDays}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                            <XAxis dataKey="formattedDate" stroke="#71717a" fontSize={11} />
                            <YAxis
                              stroke="#71717a"
                              fontSize={11}
                              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '12px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(val: number | string | Array<number | string> | undefined) => {
                                const num = typeof val === 'number' ? val : Number(val) || 0;
                                return [formatCurrency(num), ''];
                              }}
                              labelFormatter={(label) => `Data: ${label}`}
                            />
                            <Legend verticalAlign="top" height={32} wrapperStyle={{ color: '#3f3f46', fontSize: '11px' }} />
                            <Bar dataKey="entradas" name="Entradas (Crédito)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="saidas" name="Saídas (Débito)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-medium">
                          Nenhuma movimentação registrada no período selecionado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Evolução do Saldo Acumulado */}
                  <div className="bg-white p-4 rounded-xl border border-zinc-200/90 shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-950">
                          Evolução do Saldo Acumulado
                        </h4>
                        <p className="text-[11px] text-zinc-600 font-medium">
                          Curva patrimonial acumulada no período
                        </p>
                      </div>
                    </div>
                    <div className="h-64">
                      {chartDays && chartDays.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartDays}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                            <XAxis dataKey="formattedDate" stroke="#71717a" fontSize={11} />
                            <YAxis
                              stroke="#71717a"
                              fontSize={11}
                              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderRadius: '12px', color: '#18181b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(val: number | string | Array<number | string> | undefined) => {
                                const num = typeof val === 'number' ? val : Number(val) || 0;
                                return [formatCurrency(num), 'Saldo Acumulado'];
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="saldoAcumulado"
                              name="Saldo Acumulado"
                              stroke="#ea580c"
                              strokeWidth={3}
                              dot={{ r: 3, fill: '#ea580c' }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-medium">
                          Sem dados suficientes para curva de saldo.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200/90 shadow-2xl p-6 space-y-4 text-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">
                Editar Lançamento Financeiro
              </h3>
              <button
                onClick={() => setEditingTx(null)}
                className="p-1 text-zinc-500 hover:text-zinc-950 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-950 font-bold mb-1">
                  Descrição / Histórico:
                </label>
                <input
                  type="text"
                  value={editingTx.description}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Tipo:
                  </label>
                  <select
                    value={editingTx.type}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        type: e.target.value as 'ENTRADA' | 'SAIDA'
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                  >
                    <option value="ENTRADA">ENTRADA (+)</option>
                    <option value="SAIDA">SAÍDA (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Valor (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTx.amount}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        amount: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Tipo de Operação:
                  </label>
                  <select
                    value={editingTx.operationType}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        operationType: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                  >
                    {operationTypes.map((op) => (
                      <option key={op.id} value={op.code}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Duplicidade / Status:
                  </label>
                  <select
                    value={editingTx.reconciliationStatus === 'DUPLICADO' ? 'DUPLICADO' : 'PENDENTE'}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        reconciliationStatus: e.target.value as ReconciliationStatus
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                  >
                    <option value="PENDENTE">Normal</option>
                    <option value="DUPLICADO">Duplicado</option>
                  </select>
                </div>
              </div>

              {/* Category selector */}
              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Categoria:
                </label>
                <select
                  value={editingTx.categoryId || ''}
                  onChange={(e) => {
                    const cat = categories.find((c) => c.id === e.target.value);
                    setEditingTx({
                      ...editingTx,
                      categoryId: cat?.id,
                      categoryName: cat?.name,
                      subcategoryId: undefined,
                      subcategoryName: undefined
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                >
                  <option value="">Não classificado</option>
                  {categories
                    .filter((c) => c.type === editingTx.type)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Subcategory selector */}
              {editingTx.categoryId && (
                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Subcategoria:
                  </label>
                  <select
                    value={editingTx.subcategoryId || ''}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === editingTx.categoryId);
                      const sub = cat?.subcategories.find((s) => s.id === e.target.value);
                      setEditingTx({
                        ...editingTx,
                        subcategoryId: sub?.id,
                        subcategoryName: sub?.name
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                  >
                    <option value="">Nenhuma</option>
                    {categories
                      .find((c) => c.id === editingTx.categoryId)
                      ?.subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Observação */}
              <div>
                <label className="block font-semibold text-zinc-950 font-bold mb-1">
                  Observação Interna:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nota fiscal 4820, autorização de diretoria..."
                  value={editingTx.observation || ''}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, observation: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                />
              </div>

              {/* Learn Rule Checkbox (Requirement from Prompt) */}
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2">
                <input
                  type="checkbox"
                  id="learnRuleCheck"
                  checked={learnRule}
                  onChange={(e) => setLearnRule(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 bg-white border-zinc-300"
                />
                <label
                  htmlFor="learnRuleCheck"
                  className="text-orange-950 font-semibold cursor-pointer select-none text-xs"
                >
                  Memorizar e aplicar esta classificação aos futuros extratos
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-xs"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-2xl p-6 space-y-4 text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-base font-bold text-zinc-950">
                Novo Lançamento Manual
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                className="p-1 text-zinc-500 hover:text-zinc-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Data da Movimentação:
                </label>
                <input
                  type="date"
                  value={newTx.date}
                  onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Descrição / Histórico:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sangria do Caixa 04, Pagamento Fornecedor..."
                  value={newTx.description}
                  onChange={(e) =>
                    setNewTx({ ...newTx, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Tipo:
                  </label>
                  <select
                    value={newTx.type}
                    onChange={(e) =>
                      setNewTx({
                        ...newTx,
                        type: e.target.value as 'ENTRADA' | 'SAIDA'
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                  >
                    <option value="ENTRADA">ENTRADA (+)</option>
                    <option value="SAIDA">SAÍDA (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Valor (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newTx.amount || ''}
                    onChange={(e) =>
                      setNewTx({
                        ...newTx,
                        amount: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Tipo de Operação:
                  </label>
                  <select
                    value={newTx.operationType}
                    onChange={(e) =>
                      setNewTx({ ...newTx, operationType: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                  >
                    {operationTypes.map((op) => (
                      <option key={op.id} value={op.code}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Categoria:
                  </label>
                  <select
                    value={newTx.categoryId || ''}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      setNewTx({
                        ...newTx,
                        categoryId: cat?.id,
                        categoryName: cat?.name
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                  >
                    <option value="">Selecione categoria</option>
                    {categories
                      .filter((c) => c.type === newTx.type)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Observação:
                </label>
                <input
                  type="text"
                  placeholder="Opcional"
                  value={newTx.observation || ''}
                  onChange={(e) =>
                    setNewTx({ ...newTx, observation: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNew}
                className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-xs"
              >
                Cadastrar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORIZE MODAL */}
      <CategorizeModal
        isOpen={categorizeModalOpen}
        onClose={() => setCategorizeModalOpen(false)}
        transactions={categorizeTargets}
        categories={categories}
        operationTypes={operationTypes}
        onSuccess={handleCategorizeSuccess}
      />
    </div>
  );
};
