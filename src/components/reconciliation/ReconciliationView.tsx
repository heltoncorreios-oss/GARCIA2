import React, { useState, useEffect } from 'react';
import {
  CheckCheck,
  Clock,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Filter,
  CheckSquare,
  Square,
  Search,
  Check,
  X,
  Trash2,
  Edit2
} from 'lucide-react';
import { BankAccount, Category, OperationTypeInfo, Transaction } from '../../types';
import { apiService } from '../../services/api';
import { formatCurrency, formatDateBR } from '../../utils/formatters';

interface ReconciliationViewProps {
  bankAccounts: BankAccount[];
  categories: Category[];
  operationTypes: OperationTypeInfo[];
  onRefreshStats?: () => void;
}

type TabFilter =
  | 'TODOS'
  | 'PENDENTE'
  | 'CONCILIADO'
  | 'NAO_CLASSIFICADO'
  | 'DUPLICADO'
  | 'SUSPEITO'
  | 'ENTRADA'
  | 'SAIDA';

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  bankAccounts,
  categories,
  operationTypes,
  onRefreshStats
}) => {
  const [activeTab, setActiveTab] = useState<TabFilter>('PENDENTE');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getTransactions({
        bankAccountId: selectedAccountId || undefined,
        search: search || undefined
      });
      setTransactions(res.transactions);
      setSelectedIds([]);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedAccountId, search]);

  // Tab Filtering
  const filteredList = transactions.filter((tx) => {
    if (activeTab === 'PENDENTE') return tx.reconciliationStatus === 'PENDENTE';
    if (activeTab === 'CONCILIADO') return tx.reconciliationStatus === 'CONCILIADO';
    if (activeTab === 'NAO_CLASSIFICADO')
      return !tx.categoryId || tx.reconciliationStatus === 'NAO_CLASSIFICADO';
    if (activeTab === 'DUPLICADO') return tx.reconciliationStatus === 'DUPLICADO';
    if (activeTab === 'SUSPEITO') return tx.reconciliationStatus === 'SUSPEITO';
    if (activeTab === 'ENTRADA') return tx.type === 'ENTRADA';
    if (activeTab === 'SAIDA') return tx.type === 'SAIDA';
    return true;
  });

  // Batch actions
  const handleBatchAction = async (action: 'CONCILIAR' | 'PENDENTE' | 'SUSPEITO') => {
    if (selectedIds.length === 0) return;
    try {
      await apiService.batchReconcile(selectedIds, action, 'Sistema');
      setNotification(`${selectedIds.length} lançamentos atualizados com sucesso!`);
      setTimeout(() => setNotification(null), 3000);
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // Single action
  const handleSingleStatus = async (
    id: string,
    status: 'CONCILIADO' | 'PENDENTE' | 'SUSPEITO'
  ) => {
    try {
      await apiService.updateTransaction(id, { reconciliationStatus: status }, 'Sistema');
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleUpdateCategory = async (txId: string, catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    try {
      await apiService.updateTransaction(
        txId,
        {
          categoryId: cat?.id,
          categoryName: cat?.name,
          reconciliationStatus: 'CONCILIADO'
        },
        'Sistema'
      );
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este lançamento duplicado?')) return;
    try {
      await apiService.deleteTransaction(id, 'Sistema');
      fetchTransactions();
      if (onRefreshStats) onRefreshStats();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const toggleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIds(filteredList.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Counters for tabs
  const countPending = transactions.filter((t) => t.reconciliationStatus === 'PENDENTE').length;
  const countConciliated = transactions.filter((t) => t.reconciliationStatus === 'CONCILIADO').length;
  const countUnclassified = transactions.filter(
    (t) => !t.categoryId || t.reconciliationStatus === 'NAO_CLASSIFICADO'
  ).length;
  const countDuplicate = transactions.filter((t) => t.reconciliationStatus === 'DUPLICADO').length;
  const countSuspicious = transactions.filter((t) => t.reconciliationStatus === 'SUSPEITO').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950 tracking-tight flex items-center gap-2">
            <CheckCheck className="w-6 h-6 text-orange-600" />
            Conciliação Bancária de Varejo
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Validação de lançamentos bancários contra fechamentos de PDV, cartões e contas a pagar
          </p>
        </div>

        {/* Account Selector & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-950"
          >
            <option value="" className="bg-white text-zinc-950">Todas as Contas</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id} className="bg-white text-zinc-950">
                {acc.accountName}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-950 placeholder-zinc-400 font-medium"
            />
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {notification}
        </div>
      )}

      {/* Tabs as specified in Section 7 */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-zinc-200 shadow-2xs">
        <button
          onClick={() => setActiveTab('PENDENTE')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'PENDENTE'
              ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-zinc-600" />
          <span>Pendentes</span>
          {countPending > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
              {countPending}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('CONCILIADO')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'CONCILIADO'
              ? 'bg-white text-emerald-900 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <CheckCheck className="w-3.5 h-3.5 text-emerald-600 font-bold" />
          <span>Conciliados</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
            {countConciliated}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('NAO_CLASSIFICADO')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'NAO_CLASSIFICADO'
              ? 'bg-white text-purple-950 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
          <span>Não Classificados</span>
          {countUnclassified > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-purple-100 text-purple-900 border border-purple-300 font-bold">
              {countUnclassified}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('DUPLICADO')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'DUPLICADO'
              ? 'bg-white text-amber-950 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Duplicados</span>
          {countDuplicate > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
              {countDuplicate}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('SUSPEITO')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'SUSPEITO'
              ? 'bg-white text-rose-950 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Suspeitos</span>
          {countSuspicious > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold">
              {countSuspicious}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ENTRADA')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'ENTRADA'
              ? 'bg-white text-blue-900 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
          <span>Entradas</span>
        </button>

        <button
          onClick={() => setActiveTab('SAIDA')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'SAIDA'
              ? 'bg-white text-rose-900 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
          <span>Saídas</span>
        </button>

        <button
          onClick={() => setActiveTab('TODOS')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'TODOS'
              ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/80'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          Todos ({transactions.length})
        </button>
      </div>

      {/* Batch Action Toolbar */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-zinc-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => toggleSelectAll(true)}
            className="font-semibold text-zinc-900 hover:text-emerald-700 flex items-center gap-1"
          >
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            Selecionar Todos ({filteredList.length})
          </button>
          <button
            onClick={() => toggleSelectAll(false)}
            className="font-semibold text-zinc-600 hover:text-zinc-950 flex items-center gap-1"
          >
            <Square className="w-4 h-4 text-zinc-400" />
            Limpar Seleção
          </button>
          <span className="text-zinc-300">|</span>
          <span className="font-bold text-zinc-950">
            {selectedIds.length} selecionados
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={selectedIds.length === 0}
            onClick={() => handleBatchAction('CONCILIAR')}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Marcar Conciliado ({selectedIds.length})</span>
          </button>

          <button
            disabled={selectedIds.length === 0}
            onClick={() => handleBatchAction('SUSPEITO')}
            className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 disabled:opacity-40 text-rose-800 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Marcar Suspeito</span>
          </button>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
              <tr>
                <th className="p-3 w-10 text-center">Sel.</th>
                <th className="p-3">Data</th>
                <th className="p-3 min-w-[220px]">Histórico Bancário</th>
                <th className="p-3">Conta</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3">Operação</th>
                <th className="p-3 min-w-[170px]">Categoria</th>
                <th className="p-3">Status Atual</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-800 font-medium">
                    Carregando dados da conciliação...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-800 font-medium">
                    Nenhum lançamento pendente nesta visualização.
                  </td>
                </tr>
              ) : (
                filteredList.map((tx) => {
                  const isChecked = selectedIds.includes(tx.id);
                  const isCredit = tx.type === 'ENTRADA';
                  const acc = bankAccounts.find((a) => a.id === tx.bankAccountId);

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        isChecked ? 'bg-orange-500/5' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(tx.id)}
                          className="rounded text-orange-600 focus:ring-orange-500 border-zinc-300 cursor-pointer"
                        />
                      </td>

                      <td className="p-3 whitespace-nowrap font-medium text-zinc-950 font-bold">
                        {formatDateBR(tx.date)}
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-zinc-950 font-bold">{tx.description}</div>
                        {tx.documentId && (
                          <div className="text-[10px] text-zinc-800 font-medium">
                            Doc: {tx.documentId}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-zinc-900 font-semibold whitespace-nowrap">
                        {acc?.accountName}
                      </td>

                      <td className="p-3 text-right font-bold whitespace-nowrap">
                        <span className={isCredit ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {isCredit ? '+' : '-'} {formatCurrency(tx.amount)}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {tx.operationType || '-'}
                        </span>
                      </td>

                      {/* Category selector directly in table */}
                      <td className="p-3">
                        <select
                          value={tx.categoryId || ''}
                          onChange={(e) => handleUpdateCategory(tx.id, e.target.value)}
                          className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none ${
                            !tx.categoryId
                              ? 'border-purple-200 bg-purple-50 text-purple-900 font-semibold'
                              : 'border-zinc-200 bg-white text-zinc-900 font-medium'
                          }`}
                        >
                          <option value="" className="bg-white text-zinc-700">Não classificado</option>
                          {categories
                            .filter((c) => c.type === tx.type)
                            .map((cat) => (
                              <option key={cat.id} value={cat.id} className="bg-white text-zinc-900">
                                {cat.name}
                              </option>
                            ))}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            tx.reconciliationStatus === 'CONCILIADO'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : tx.reconciliationStatus === 'SUSPEITO'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : tx.reconciliationStatus === 'DUPLICADO'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {tx.reconciliationStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {tx.reconciliationStatus !== 'CONCILIADO' && (
                            <button
                              onClick={() => handleSingleStatus(tx.id, 'CONCILIADO')}
                              className="p-1.5 text-emerald-700 font-bold hover:bg-emerald-500/15 rounded-lg transition-colors"
                              title="Marcar como Conciliado"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {tx.reconciliationStatus !== 'PENDENTE' && (
                            <button
                              onClick={() => handleSingleStatus(tx.id, 'PENDENTE')}
                              className="p-1.5 text-zinc-900 font-semibold hover:bg-white/5 rounded-lg transition-colors"
                              title="Marcar como Pendente"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {tx.reconciliationStatus === 'DUPLICADO' && (
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="p-1.5 text-rose-700 font-bold hover:bg-rose-500/15 rounded-lg transition-colors"
                              title="Excluir duplicado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
    </div>
  );
};
