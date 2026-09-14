import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Trash2,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  User as UserIcon,
  RefreshCw,
  Eye,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { BankStatement, Transaction } from '../../types';
import { apiService } from '../../services/api';
import { formatCurrency, formatDateBR } from '../../utils/formatters';

interface StatementHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onStatementsChanged: () => void;
}

export const StatementHistoryModal: React.FC<StatementHistoryModalProps> = ({
  isOpen,
  onClose,
  userName,
  onStatementsChanged
}) => {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [statementDetails, setStatementDetails] = useState<{
    statement: BankStatement;
    transactions: Transaction[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatements();
    }
  }, [isOpen]);

  const loadStatements = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getBankStatements();
      setStatements(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      setSelectedStatementId(id);
      setIsLoading(true);
      const data = await apiService.getBankStatementById(id);
      setStatementDetails(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevert = async (id: string) => {
    try {
      setIsReverting(true);
      await apiService.deleteBankStatement(id, userName);
      setFeedbackMessage('Lote de extrato revertido com sucesso! Todos os lançamentos foram removidos e o saldo recalculado.');
      setConfirmRevertId(null);
      if (selectedStatementId === id) {
        setSelectedStatementId(null);
        setStatementDetails(null);
      }
      await loadStatements();
      onStatementsChanged();
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsReverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border border-black rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border border-black flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 font-bold flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 font-bold flex items-center gap-2">
                Histórico de Extratos Importados
                <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-zinc-950 font-bold font-mono">
                  {statements.length} lotes
                </span>
              </h3>
              <p className="text-xs text-zinc-900 font-semibold mt-0.5">
                Rastreabilidade completa de arquivos originais com suporte a auditoria e reversão segura de importações
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-900 font-semibold hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message */}
        {feedbackMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border border-black rounded-xl text-emerald-700 font-bold text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading && !statementDetails ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-orange-700 font-bold animate-spin mx-auto" />
              <p className="text-xs text-zinc-900 font-semibold mt-3">Carregando histórico de extratos...</p>
            </div>
          ) : statements.length === 0 ? (
            <div className="text-center py-12 border border-dashed border border-black rounded-2xl bg-white">
              <FileText className="w-10 h-10 text-zinc-900 font-semibold mx-auto" />
              <h4 className="text-sm font-bold text-zinc-950 font-bold mt-3">Nenhum extrato importado até o momento</h4>
              <p className="text-xs text-zinc-800 font-medium mt-1 max-w-sm mx-auto">
                Assim que você importar um arquivo OFX, CSV, XLSX, TXT ou PDF, ele ficará registrado aqui com rastreabilidade completa.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* If details view open */}
              {statementDetails ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border border-black">
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setStatementDetails(null);
                          setSelectedStatementId(null);
                        }}
                        className="text-xs text-orange-700 font-bold hover:underline flex items-center gap-1 mb-1 font-semibold"
                      >
                        &larr; Voltar para a lista de extratos
                      </button>
                      <h4 className="text-sm font-bold text-zinc-950 font-bold flex items-center gap-2">
                        {statementDetails.statement.fileName}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-700 font-bold">
                          {statementDetails.statement.fileType}
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-900 font-semibold mt-0.5">
                        Conta: {statementDetails.statement.bankAccountName} &bull; Importado por: {statementDetails.statement.importedByUserName} em {new Date(statementDetails.statement.importedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmRevertId(statementDetails.statement.id)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border border-black text-rose-700 font-bold text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Reverter este Lote
                    </button>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white border border border-black rounded-xl">
                      <span className="text-zinc-900 font-semibold block text-[11px]">Total Lançamentos</span>
                      <span className="text-base font-bold text-zinc-950 font-bold">{statementDetails.transactions.length}</span>
                    </div>
                    <div className="p-3 bg-white border border border-black rounded-xl">
                      <span className="text-zinc-900 font-semibold block text-[11px]">Entradas</span>
                      <span className="text-base font-bold text-emerald-700 font-bold">
                        {formatCurrency(
                          statementDetails.transactions
                            .filter(t => t.type === 'ENTRADA')
                            .reduce((sum, t) => sum + t.amount, 0)
                        )}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border border-black rounded-xl">
                      <span className="text-zinc-900 font-semibold block text-[11px]">Saídas</span>
                      <span className="text-base font-bold text-rose-700 font-bold">
                        {formatCurrency(
                          statementDetails.transactions
                            .filter(t => t.type === 'SAIDA')
                            .reduce((sum, t) => sum + t.amount, 0)
                        )}
                      </span>
                    </div>
                    <div className="p-3 bg-white border border border-black rounded-xl">
                      <span className="text-zinc-900 font-semibold block text-[11px]">Período do Arquivo</span>
                      <span className="text-xs font-semibold text-zinc-950 font-bold">
                        {formatDateBR(statementDetails.statement.startDate)} até {formatDateBR(statementDetails.statement.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Transactions list */}
                  <div className="border border border-black rounded-xl overflow-x-auto bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white text-zinc-900 font-semibold border-b border border-black">
                          <th className="p-2.5 font-semibold">Data</th>
                          <th className="p-2.5 font-semibold">Descrição no Extrato</th>
                          <th className="p-2.5 font-semibold">Categoria</th>
                          <th className="p-2.5 font-semibold">Tipo</th>
                          <th className="p-2.5 font-semibold text-right">Valor (R$)</th>
                          <th className="p-2.5 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-950 font-bold">
                        {statementDetails.transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-white/[0.02]">
                            <td className="p-2.5 whitespace-nowrap font-mono">{formatDateBR(tx.date)}</td>
                            <td className="p-2.5 max-w-xs truncate font-medium text-zinc-950 font-bold">{tx.description}</td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border border-black text-zinc-950 font-bold">
                                {tx.categoryName || 'Não categorizado'}
                              </span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tx.type === 'ENTRADA'
                                    ? 'bg-emerald-500/10 text-emerald-700 font-bold'
                                    : 'bg-rose-500/10 text-rose-700 font-bold'
                                }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td
                              className={`p-2.5 text-right font-mono font-bold whitespace-nowrap ${
                                tx.type === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                              }`}
                            >
                              {tx.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tx.reconciliationStatus === 'CONCILIADO'
                                    ? 'bg-emerald-500/10 text-emerald-700 font-bold'
                                    : 'bg-amber-500/10 text-amber-700 font-bold'
                                }`}
                              >
                                {tx.reconciliationStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Statements table */
                <div className="border border border-black rounded-xl overflow-x-auto bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white text-zinc-900 font-semibold border-b border border-black">
                        <th className="p-3 font-semibold">Arquivo / Data</th>
                        <th className="p-3 font-semibold">Formato</th>
                        <th className="p-3 font-semibold">Conta Bancária</th>
                        <th className="p-3 font-semibold">Período</th>
                        <th className="p-3 font-semibold text-center">Importados</th>
                        <th className="p-3 font-semibold text-center">Duplicados</th>
                        <th className="p-3 font-semibold">Responsável</th>
                        <th className="p-3 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-950 font-bold">
                      {statements.map((stmt) => (
                        <tr key={stmt.id} className="hover:bg-white/[0.02]">
                          <td className="p-3">
                            <div className="font-bold text-zinc-950 font-bold flex items-center gap-2">
                              {stmt.fileType === 'XLSX' ? (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-700 font-bold shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-orange-700 font-bold shrink-0" />
                              )}
                              <span>{stmt.fileName}</span>
                            </div>
                            <div className="text-[11px] text-zinc-800 font-medium mt-0.5">
                              {new Date(stmt.importedAt).toLocaleString('pt-BR')}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 border border border-black text-zinc-950 font-bold font-mono">
                              {stmt.fileType}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-zinc-950 font-bold">
                            {stmt.bankAccountName}
                          </td>
                          <td className="p-3 text-[11px] font-mono text-zinc-900 font-semibold">
                            {formatDateBR(stmt.startDate)} &rarr; {formatDateBR(stmt.endDate)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-bold font-bold text-[11px]">
                              {stmt.importedRecords}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 font-bold font-bold text-[11px]">
                              {stmt.duplicateRecords}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-900 font-semibold text-[11px]">
                            {stmt.importedByUserName}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewDetails(stmt.id)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-950 font-bold hover:text-white transition-colors"
                                title="Ver lançamentos deste extrato"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevertId(stmt.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 font-bold transition-colors"
                                title="Reverter e excluir lançamentos deste extrato"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Dialog for Reverting a Batch */}
        {confirmRevertId && (
          <div className="p-4 bg-rose-950/40 border-t border border-black flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-700 font-bold shrink-0" />
              <span>
                <strong>Atenção:</strong> A reversão removerá permanentemente todos os lançamentos originados deste extrato e recalculará o saldo da conta imediatamente. Deseja prosseguir?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmRevertId(null)}
                className="px-3 py-1.5 text-xs text-zinc-900 font-semibold hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReverting}
                onClick={() => handleRevert(confirmRevertId)}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                {isReverting ? 'Revertendo...' : 'Sim, Reverter Lote'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border border-black bg-white flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-950 font-bold hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
