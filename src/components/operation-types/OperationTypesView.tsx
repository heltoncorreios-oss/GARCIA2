import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  Banknote,
  Send,
  Receipt,
  Percent,
  PiggyBank,
  CheckCircle,
  Sparkles,
  Filter,
  Calendar,
  FileSpreadsheet,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { BankAccount, OperationTypeInfo, Transaction } from '../../types';
import { apiService } from '../../services/api';
import { formatCurrency, exportToExcel } from '../../utils/formatters';

interface OperationTypesViewProps {
  bankAccounts: BankAccount[];
  operationTypes: OperationTypeInfo[];
}

export const OperationTypesView: React.FC<OperationTypesViewProps> = ({
  bankAccounts,
  operationTypes
}) => {
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-09-06');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await apiService.getTransactions({
          startDate,
          endDate,
          bankAccountId: selectedAccountId || undefined
        });
        setTransactions(res.transactions);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [startDate, endDate, selectedAccountId]);

  // Aggregate by operation type
  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalCount = transactions.length;

  const stats = operationTypes.map((op) => {
    const matching = transactions.filter((t) => t.operationType === op.code);
    const count = matching.length;
    const total = matching.reduce((sum, t) => sum + t.amount, 0);
    const percentage = totalVolume > 0 ? ((total / totalVolume) * 100).toFixed(1) : '0';

    return {
      ...op,
      count,
      total,
      percentage: parseFloat(percentage)
    };
  });

  const handleExport = () => {
    const data = stats.map((s) => ({
      'Código': s.code,
      'Tipo de Operação': s.name,
      'Natureza': s.nature,
      'Qtd Transações': s.count,
      'Total (R$)': s.total,
      'Participação (%)': `${s.percentage}%`,
      'Descrição': s.description
    }));
    exportToExcel(data, `tipos_operacao_${startDate}_${endDate}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-orange-600" />
            Controle por Tipo de Operação Financeira
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5 font-medium">
            Acompanhamento analítico da volumetria, quantidade de transações e percentual de participação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle View Mode */}
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200">
            <button
              onClick={() => setDisplayMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                displayMode === 'TABLE'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setDisplayMode('CARDS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                displayMode === 'CARDS'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="text-xs font-medium px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">Todas as Contas ({bankAccounts.length})</option>
            {bankAccounts.map((acc, idx) => (
              <option key={`op-acc-${acc.id || idx}`} value={acc.id}>
                {acc.accountName}
              </option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1 bg-zinc-50 px-2.5 py-1.5 border border-zinc-200 rounded-xl text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-zinc-900 font-medium focus:outline-none cursor-pointer"
            />
            <span className="text-zinc-400 font-medium">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-zinc-900 font-medium focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleExport}
            className="p-2 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 rounded-xl transition-colors cursor-pointer"
            title="Exportar para Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      </div>

      {/* Main Content: Table or Cards */}
      {displayMode === 'TABLE' ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-300 shadow-sm bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[11px] tracking-wider border-b-2 border-zinc-300">
              <tr>
                <th className="py-3 px-3.5 border-r border-zinc-200">Código</th>
                <th className="py-3 px-3.5 border-r border-zinc-200">Tipo de Operação</th>
                <th className="py-3 px-3.5 border-r border-zinc-200">Natureza</th>
                <th className="py-3 px-3.5 border-r border-zinc-200 min-w-[200px]">Descrição / Finalidade</th>
                <th className="py-3 px-3.5 text-right border-r border-zinc-200">Qtd. Lançamentos</th>
                <th className="py-3 px-3.5 text-right border-r border-zinc-200">Volume Total (R$)</th>
                <th className="py-3 px-3.5 text-right border-r border-zinc-200">Participação (%)</th>
                <th className="py-3 px-3.5 text-center min-w-[140px]">Distribuição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-900 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    Calculando estatísticas por tipo de operação...
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    Nenhum tipo de operação cadastrado.
                  </td>
                </tr>
              ) : (
                stats.map((item, idx) => (
                  <tr
                    key={item.id || item.code}
                    className={`transition-colors ${
                      idx % 2 === 0 ? 'bg-white hover:bg-orange-50/40' : 'bg-zinc-50/70 hover:bg-orange-50/40'
                    }`}
                  >
                    <td className="py-3 px-3.5 border-r border-zinc-200/80 whitespace-nowrap font-mono font-bold text-zinc-900">
                      <span className="px-2 py-0.5 rounded-lg text-xs bg-zinc-100 text-zinc-800 border border-zinc-200">
                        {item.code}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 border-r border-zinc-200/80 font-bold text-zinc-900 whitespace-nowrap">
                      {item.name}
                    </td>
                    <td className="py-3 px-3.5 border-r border-zinc-200/80 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block ${
                          item.nature === 'ENTRADA'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : item.nature === 'SAIDA'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                        }`}
                      >
                        {item.nature}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 border-r border-zinc-200/80 text-zinc-600 text-xs">
                      {item.description || '-'}
                    </td>
                    <td className="py-3 px-3.5 text-right border-r border-zinc-200/80 tabular-nums font-mono font-bold text-zinc-800 whitespace-nowrap">
                      {item.count} movs
                    </td>
                    <td className="py-3 px-3.5 text-right border-r border-zinc-200/80 tabular-nums font-mono font-bold text-zinc-900 whitespace-nowrap">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="py-3 px-3.5 text-right border-r border-zinc-200/80 tabular-nums font-mono font-bold text-orange-600 whitespace-nowrap">
                      {item.percentage}%
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <div className="w-24 mx-auto bg-zinc-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.nature === 'ENTRADA'
                              ? 'bg-emerald-500'
                              : item.nature === 'SAIDA'
                              ? 'bg-rose-500'
                              : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Totals */}
            <tfoot className="bg-zinc-100 font-bold border-t-2 border-zinc-300 text-zinc-900 text-xs">
              <tr>
                <td colSpan={4} className="py-3 px-3.5 border-r border-zinc-200 uppercase tracking-wide">
                  Total Geral
                </td>
                <td className="py-3 px-3.5 text-right border-r border-zinc-200 tabular-nums font-mono font-black">
                  {totalCount} movs
                </td>
                <td className="py-3 px-3.5 text-right border-r border-zinc-200 tabular-nums font-mono font-black text-orange-700">
                  {formatCurrency(totalVolume)}
                </td>
                <td className="py-3 px-3.5 text-right border-r border-zinc-200 tabular-nums font-mono font-black">
                  100%
                </td>
                <td className="py-3 px-3.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                    {item.code}
                  </span>
                  <span className="text-xs font-bold text-zinc-950">{item.name}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    item.nature === 'ENTRADA'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : item.nature === 'SAIDA'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                  }`}
                >
                  {item.nature}
                </span>
              </div>

              <div>
                <div className="text-xl font-extrabold text-zinc-950 font-mono">
                  {formatCurrency(item.total)}
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-600 font-medium mt-1">
                  <span>{item.count} movimentações</span>
                  <span className="font-bold text-orange-600">{item.percentage}% do total</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.nature === 'ENTRADA'
                      ? 'bg-emerald-500'
                      : item.nature === 'SAIDA'
                      ? 'bg-rose-500'
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                />
              </div>

              <p className="text-[11px] text-zinc-500 italic">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
