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
  FileSpreadsheet
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
      <div className="bg-white p-5 rounded-2xl border border border-black shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950 font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-orange-700 font-bold" />
            Controle por Tipo de Operação Financeira
          </h2>
          <p className="text-xs text-zinc-900 font-semibold mt-0.5">
            Acompanhamento analítico da volumetria, quantidade de transações e percentual de participação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Account Filter */}
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-white border border border-black rounded-xl text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="" className="bg-white text-zinc-950 font-bold">Todas as Contas</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id} className="bg-white text-zinc-950 font-bold">
                {acc.accountName}
              </option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1 bg-white px-2 py-1 border border border-black rounded-xl text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-1 py-1 bg-transparent text-zinc-950 font-bold focus:outline-none [color-scheme:dark]"
            />
            <span className="text-zinc-800 font-medium">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-1 py-1 bg-transparent text-zinc-950 font-bold focus:outline-none [color-scheme:dark]"
            />
          </div>

          <button
            onClick={handleExport}
            className="p-2 text-zinc-950 font-bold hover:text-white hover:bg-white/5 border border border-black rounded-xl transition-colors"
            title="Exportar para Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((item) => (
          <div
            key={item.id}
            className="bg-white p-4 rounded-2xl border border border-black shadow-md space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-950 font-bold border border border-black">
                  {item.code}
                </span>
                <span className="text-xs font-bold text-zinc-950 font-bold">{item.name}</span>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  item.nature === 'ENTRADA'
                    ? 'bg-emerald-500/15 text-emerald-700 font-bold border border border-black'
                    : item.nature === 'SAIDA'
                    ? 'bg-rose-500/15 text-rose-700 font-bold border border border-black'
                    : 'bg-zinc-800 text-zinc-950 font-bold border border border-black'
                }`}
              >
                {item.nature}
              </span>
            </div>

            <div>
              <div className="text-xl font-extrabold text-zinc-950 font-bold">
                {formatCurrency(item.total)}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-900 font-semibold mt-1">
                <span>{item.count} movimentações</span>
                <span className="font-bold text-zinc-950 font-bold">{item.percentage}% do total</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-800/60 h-2 rounded-full overflow-hidden">
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

            <p className="text-[11px] text-zinc-800 font-medium italic">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
