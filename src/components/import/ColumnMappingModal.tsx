import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Save,
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';
import { ColumnMapping, StatementFileType, TabularAnalysis } from '../../types';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileType: StatementFileType;
  bankAccountName: string;
  bankCode?: string;
  analysis: TabularAnalysis;
  initialMapping?: ColumnMapping;
  onApplyMapping: (mapping: ColumnMapping, saveAsTemplate: boolean) => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  fileName,
  fileType,
  bankAccountName,
  analysis,
  initialMapping,
  onApplyMapping
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateColumn: '',
    descriptionColumn: '',
    amountColumn: '',
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: ',',
    headerRowIndex: 0
  });

  const [useSeparateAmountCols, setUseSeparateAmountCols] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);

  useEffect(() => {
    if (initialMapping) {
      setMapping(initialMapping);
      setUseSeparateAmountCols(Boolean(initialMapping.creditColumn && initialMapping.debitColumn));
    } else if (analysis.suggestedMapping) {
      setMapping(analysis.suggestedMapping);
      setUseSeparateAmountCols(Boolean(analysis.suggestedMapping.creditColumn && analysis.suggestedMapping.debitColumn));
    }
  }, [initialMapping, analysis]);

  if (!isOpen) return null;

  const headers = analysis.headers || [];
  const previewRows = (analysis.sampleRows || []).slice(0, 4);

  const handleApply = () => {
    const finalMapping: ColumnMapping = { ...mapping };
    if (!useSeparateAmountCols) {
      delete finalMapping.creditColumn;
      delete finalMapping.debitColumn;
    } else {
      delete finalMapping.amountColumn;
    }
    onApplyMapping(finalMapping, saveAsTemplate);
  };

  const isFormValid =
    Boolean(mapping.dateColumn) &&
    Boolean(mapping.descriptionColumn) &&
    (useSeparateAmountCols
      ? Boolean(mapping.creditColumn && mapping.debitColumn)
      : Boolean(mapping.amountColumn));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                Assistente de Mapeamento de Colunas
                <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-mono">
                  {fileType}
                </span>
              </h3>
              <p className="text-xs text-zinc-600 mt-0.5">
                Arquivo: <span className="text-zinc-950 font-mono">{fileName}</span> | Conta: <strong className="text-zinc-950">{bankAccountName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Diagnostic Banner */}
          <div className="p-3.5 bg-slate-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-950">
              <FileSpreadsheet className="w-4 h-4 text-orange-600" />
              <span>
                Delimitador detectado:{' '}
                <strong className="text-zinc-950 font-mono">
                  {analysis.delimiter === ';' ? 'Ponto e vírgula (;)' : (analysis.delimiter === ',' ? 'Vírgula (,)' : analysis.delimiter)}
                </strong>
                {' '}&bull; Colunas: <strong>{headers.length}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-600">Confiança da IA:</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  analysis.autoConfidence === 'ALTA'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {analysis.autoConfidence}
              </span>
            </div>
          </div>

          {/* Sample preview table */}
          <div>
            <label className="text-xs font-bold text-zinc-950 mb-2 block">
              Amostra do Arquivo Original (Primeiras Linhas)
            </label>
            <div className="border border-zinc-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-700 border-b border-zinc-200">
                    <th className="p-2.5 font-bold text-zinc-500 w-12 text-center">#</th>
                    {headers.map((h, i) => (
                      <th key={i} className="p-2.5 font-semibold text-zinc-950 whitespace-nowrap">
                        {h || `Coluna ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono text-[11px] text-zinc-950">
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-zinc-50/50">
                      <td className="p-2 text-center text-zinc-500 font-sans">{rIdx + 1}</td>
                      {row.map((val, cIdx) => (
                        <td key={cIdx} className="p-2 whitespace-nowrap text-zinc-950 max-w-xs truncate">
                          {val || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mapping Configuration Form */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-600">
              Associação de Campos Obrigatórios & Opcionais
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Column */}
              <div>
                <label className="text-xs font-semibold text-zinc-950 block mb-1">
                  Coluna de Data da Movimentação <span className="text-rose-600">*</span>
                </label>
                <select
                  value={mapping.dateColumn}
                  onChange={(e) => setMapping({ ...mapping, dateColumn: e.target.value })}
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                >
                  <option value="">Selecione a coluna...</option>
                  {headers.map((h, i) => (
                    <option key={i} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Description Column */}
              <div>
                <label className="text-xs font-semibold text-zinc-950 block mb-1">
                  Coluna de Histórico / Descrição <span className="text-rose-600">*</span>
                </label>
                <select
                  value={mapping.descriptionColumn}
                  onChange={(e) => setMapping({ ...mapping, descriptionColumn: e.target.value })}
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                >
                  <option value="">Selecione a coluna...</option>
                  {headers.map((h, i) => (
                    <option key={i} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount Configuration */}
            <div className="p-4 bg-slate-50 border border-zinc-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-950">
                  Estrutura de Valores Monetários <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-zinc-950">
                    <input
                      type="radio"
                      name="amountType"
                      checked={!useSeparateAmountCols}
                      onChange={() => setUseSeparateAmountCols(false)}
                      className="text-orange-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Coluna Única (+/-)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-zinc-950">
                    <input
                      type="radio"
                      name="amountType"
                      checked={useSeparateAmountCols}
                      onChange={() => setUseSeparateAmountCols(true)}
                      className="text-orange-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Entrada e Saída Separadas</span>
                  </label>
                </div>
              </div>

              {!useSeparateAmountCols ? (
                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                    Coluna de Valor Único
                  </label>
                  <select
                    value={mapping.amountColumn || ''}
                    onChange={(e) => setMapping({ ...mapping, amountColumn: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                  >
                    <option value="">Selecione a coluna de valor...</option>
                    {headers.map((h, i) => (
                      <option key={i} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Suporta valores positivos (Entrada) e negativos com sinal ou entre parênteses (Saída).
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-emerald-700 block mb-1">
                      Coluna de Entradas / Créditos (+)
                    </label>
                    <select
                      value={mapping.creditColumn || ''}
                      onChange={(e) => setMapping({ ...mapping, creditColumn: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                    >
                      <option value="">Selecione a coluna de créditos...</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-rose-700 block mb-1">
                      Coluna de Saídas / Débitos (-)
                    </label>
                    <select
                      value={mapping.debitColumn || ''}
                      onChange={(e) => setMapping({ ...mapping, debitColumn: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                    >
                      <option value="">Selecione a coluna de débitos...</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Fields: Document ID, Balance After, Posting Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                  Coluna de Documento / FITID (Opcional)
                </label>
                <select
                  value={mapping.documentIdColumn || ''}
                  onChange={(e) => setMapping({ ...mapping, documentIdColumn: e.target.value || undefined })}
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                >
                  <option value="">Nenhuma (Não mapear)</option>
                  {headers.map((h, i) => (
                    <option key={i} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                  Coluna de Saldo Após (Opcional)
                </label>
                <select
                  value={mapping.balanceColumn || ''}
                  onChange={(e) => setMapping({ ...mapping, balanceColumn: e.target.value || undefined })}
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                >
                  <option value="">Nenhuma (Não mapear)</option>
                  {headers.map((h, i) => (
                    <option key={i} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                  Coluna Data de Lançamento (Opcional)
                </label>
                <select
                  value={mapping.postingDateColumn || ''}
                  onChange={(e) => setMapping({ ...mapping, postingDateColumn: e.target.value || undefined })}
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                >
                  <option value="">Nenhuma (Mesma data)</option>
                  {headers.map((h, i) => (
                    <option key={i} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Number Formats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                  Formato de Data
                </label>
                <select
                  value={mapping.dateFormat || 'DD/MM/YYYY'}
                  onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value })}
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                >
                  <option value="DD/MM/YYYY">DD/MM/AAAA (ex: 28/02/2026)</option>
                  <option value="YYYY-MM-DD">AAAA-MM-DD (ex: 2026-02-28)</option>
                  <option value="DD-MM-YYYY">DD-MM-AAAA (ex: 28-02-2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/AAAA (ex: 02/28/2026)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                  Separador Decimal
                </label>
                <select
                  value={mapping.decimalSeparator || ','}
                  onChange={(e) => setMapping({ ...mapping, decimalSeparator: e.target.value as ',' | '.' })}
                  className="w-full bg-slate-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
                >
                  <option value=",">Vírgula (Padrão Brasil - ex: 1.250,50)</option>
                  <option value=".">Ponto (Padrão Internacional - ex: 1250.50)</option>
                </select>
              </div>
            </div>

            {/* Save Template Checkbox */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-950">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  className="rounded border-zinc-300 text-orange-600 focus:ring-orange-600 w-4 h-4 cursor-pointer"
                />
                <span>
                  Salvar este mapeamento como modelo automático para a conta <strong>{bankAccountName}</strong>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!isFormValid}
            onClick={handleApply}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span>Aplicar Mapeamento e Gerar Prévia</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
