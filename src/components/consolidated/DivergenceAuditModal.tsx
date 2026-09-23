import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { ConsolidatedBalanceDay } from '../../utils/consolidatedBalance';
import { Transaction } from '../../types';
import { formatCurrency, formatDateBR } from '../../utils/formatters';

interface DivergenceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: ConsolidatedBalanceDay | null;
  transactions: Transaction[];
}

export const DivergenceAuditModal: React.FC<DivergenceAuditModalProps> = ({
  isOpen,
  onClose,
  day,
  transactions
}) => {
  if (!isOpen || !day) return null;

  // Filtrar transações do dia específico
  const dayTransactions = transactions.filter((t) => t.date === day.date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <span>Auditoria de Divergência — {day.formattedDate}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  Diferença: {formatCurrency(day.divergenceAmount)}
                </span>
              </h3>
              <p className="text-xs text-zinc-600 mt-0.5">
                Comparação entre o saldo contínuo calculado pelo sistema e o saldo informado pelo extrato bancário
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-zinc-200 p-4 rounded-xl space-y-2 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                Saldo Calculado pelo Sistema
              </div>
              <div className="text-2xl font-black text-orange-600">
                {formatCurrency(day.saldoConsolidado)}
              </div>
              <div className="text-xs text-zinc-500">
                Saldo Anterior ({formatCurrency(day.saldoAnterior)}) + Créditos ({formatCurrency(day.creditos)}) - Débitos ({formatCurrency(day.debitos)})
              </div>
            </div>

            <div className="bg-slate-50 border border-zinc-200 p-4 rounded-xl space-y-2 shadow-2xs">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                Saldo Informado no Extrato
              </div>
              <div className="text-2xl font-black text-zinc-950">
                {day.saldoExtratoInformado !== undefined ? formatCurrency(day.saldoExtratoInformado) : 'Não informado'}
              </div>
              <div className="text-xs text-zinc-500">
                Valor extraído diretamente da coluna de saldo bancário do arquivo importado
              </div>
            </div>
          </div>

          {/* Divergence explanation banner */}
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-900 space-y-1">
              <strong className="text-rose-800 block font-bold">Análise da Divergência de {formatCurrency(day.divergenceAmount)}:</strong>
              <p className="text-zinc-700">
                {day.divergenceDetails || 'O saldo acumulado calculado difere do saldo final informado no extrato para esta data. Verifique se há tarifas bancárias não lançadas, estornos, ou saldo inicial acumulado de datas anteriores divergente.'}
              </p>
            </div>
          </div>

          {/* Transactions list of this day */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-950 uppercase tracking-wider flex items-center justify-between">
              <span>Movimentações do Dia ({dayTransactions.length})</span>
              <span className="text-zinc-500 font-normal">Data: {day.formattedDate}</span>
            </h4>

            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs">
              {dayTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  Nenhuma transação registrada especificamente para esta data.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                      <tr>
                        <th className="p-3">Histórico / Descrição</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3 text-right">Saldo Informado (Extrato)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dayTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-zinc-50/50">
                          <td className="p-3 font-medium text-zinc-950">
                            {tx.description}
                            <div className="text-[10px] text-zinc-500">Op: {tx.operationType || 'N/A'}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-800' :
                              tx.type === 'SAIDA' ? 'bg-rose-50 text-rose-800' :
                              'bg-blue-50 text-blue-800'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-mono font-semibold ${
                            tx.type === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {tx.type === 'ENTRADA' ? '+ ' : '- '}{formatCurrency(tx.amount)}
                          </td>
                          <td className="p-3 text-right font-mono text-zinc-950 font-semibold">
                            {tx.balanceAfter !== undefined ? formatCurrency(tx.balanceAfter) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="text-xs text-zinc-600">
            Dica: Se a divergência persistir, verifique a exatidão do saldo inicial do extrato importado.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Fechar Auditoria
          </button>
        </div>
      </div>
    </div>
  );
};
