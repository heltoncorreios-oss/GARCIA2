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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border border-black rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border border-black flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-700 font-bold border border border-black rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 font-bold flex items-center gap-2">
                <span>Auditoria de Divergência — {day.formattedDate}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 text-rose-200 border border border-black">
                  Diferença: {formatCurrency(day.divergenceAmount)}
                </span>
              </h3>
              <p className="text-xs text-zinc-900 font-semibold mt-0.5">
                Comparação entre o saldo contínuo calculado pelo sistema e o saldo informado pelo extrato bancário
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-900 font-semibold hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border border-black space-y-2">
              <div className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Saldo Calculado pelo Sistema
              </div>
              <div className="text-2xl font-black text-orange-700 font-bold">
                {formatCurrency(day.saldoConsolidado)}
              </div>
              <div className="text-xs text-zinc-900 font-semibold">
                Saldo Anterior ({formatCurrency(day.saldoAnterior)}) + Créditos ({formatCurrency(day.creditos)}) - Débitos ({formatCurrency(day.debitos)})
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border border-black space-y-2">
              <div className="text-xs font-semibold text-zinc-900 font-semibold uppercase tracking-wider">
                Saldo Informado no Extrato
              </div>
              <div className="text-2xl font-black text-zinc-950 font-bold">
                {day.saldoExtratoInformado !== undefined ? formatCurrency(day.saldoExtratoInformado) : 'Não informado'}
              </div>
              <div className="text-xs text-zinc-900 font-semibold">
                Valor extraído diretamente da coluna de saldo bancário do arquivo importado
              </div>
            </div>
          </div>

          {/* Divergence explanation banner */}
          <div className="p-4 bg-rose-950/20 border border border-black rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-700 font-bold shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-950 font-bold space-y-1">
              <strong className="text-rose-700 font-bold block font-bold">Análise da Divergência de {formatCurrency(day.divergenceAmount)}:</strong>
              <p>
                {day.divergenceDetails || 'O saldo acumulado calculado difere do saldo final informado no extrato para esta data. Verifique se há tarifas bancárias não lançadas, estornos, ou saldo inicial acumulado de datas anteriores divergente.'}
              </p>
            </div>
          </div>

          {/* Transactions list of this day */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-950 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Movimentações do Dia ({dayTransactions.length})</span>
              <span className="text-zinc-800 font-medium font-normal">Data: {day.formattedDate}</span>
            </h4>

            <div className="bg-white rounded-xl border border border-black overflow-hidden">
              {dayTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-800 font-medium">
                  Nenhuma transação registrada especificamente para esta data.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-zinc-900 font-semibold font-semibold border-b border border-black">
                      <tr>
                        <th className="p-3">Histórico / Descrição</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3 text-right">Saldo Informado (Extrato)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {dayTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-medium text-zinc-950 font-bold">
                            {tx.description}
                            <div className="text-[10px] text-zinc-800 font-medium">Op: {tx.operationType || 'N/A'}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.type === 'ENTRADA' ? 'bg-emerald-500/20 text-emerald-700 font-bold' :
                              tx.type === 'SAIDA' ? 'bg-rose-500/20 text-rose-700 font-bold' :
                              'bg-blue-500/20 text-blue-300'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-mono font-semibold ${
                            tx.type === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                          }`}>
                            {tx.type === 'ENTRADA' ? '+ ' : '- '}{formatCurrency(tx.amount)}
                          </td>
                          <td className="p-3 text-right font-mono text-zinc-950 font-bold">
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
        <div className="p-4 border-t border border-black bg-white flex items-center justify-between">
          <div className="text-xs text-zinc-900 font-semibold">
            Dica: Se a divergência persistir, verifique a exatidão do saldo inicial do extrato importado.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-colors shadow-md"
          >
            Fechar Auditoria
          </button>
        </div>
      </div>
    </div>
  );
};
