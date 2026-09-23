import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Tag,
  BookmarkPlus,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  Filter,
  Check,
  Zap,
  HelpCircle,
  Copy
} from 'lucide-react';
import {
  Category,
  OperationTypeInfo,
  Transaction,
  BankAccount,
  ClassificationRule
} from '../../types';
import { apiService } from '../../services/api';
import { formatCurrency, formatDateBR } from '../../utils/formatters';

interface CategorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[]; // Can be 1 or multiple
  categories: Category[];
  operationTypes: OperationTypeInfo[];
  bankAccounts: BankAccount[];
  allTransactions?: Transaction[]; // To preview how many similar transactions exist
  onSuccess: (result: {
    updatedCount: number;
    ruleCreated?: ClassificationRule;
    similarUpdatedCount?: number;
  }) => void;
}

export const CategorizeModal: React.FC<CategorizeModalProps> = ({
  isOpen,
  onClose,
  transactions,
  categories,
  operationTypes,
  bankAccounts,
  allTransactions = [],
  onSuccess
}) => {
  if (!isOpen || transactions.length === 0) return null;

  const isSingle = transactions.length === 1;
  const primaryTx = transactions[0];
  const txType = primaryTx.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA';

  // Filter categories by type
  const availableCategories = useMemo(() => {
    return categories.filter((c) => c.type === txType || c.type === 'AMBOS' as any);
  }, [categories, txType]);

  // Extract smart keyword suggestion from description
  const initialKeyword = useMemo(() => {
    if (!primaryTx?.description) return '';
    const clean = primaryTx.description
      .replace(/^(PIX\s+TRANSF\s+|PIX\s+ENVIADO\s+|PIX\s+RECEBIDO\s+|PAGTO\s+ELETRON\s+|PAGAMENTO\s+|PAGTO\s+|DOC\s+|TED\s+|COMPRA\s+|DEB\s+|CRED\s+)/i, '')
      .replace(/\s+(VALOR|REF|DATA|HORA|DOC|AUT|CONTRATO|NR|NUM).*$/i, '')
      .trim();

    // Pick first 2 to 4 words
    const words = clean.split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
    if (words.length > 0) {
      return words.slice(0, 3).join(' ');
    }
    return primaryTx.description.slice(0, 25).trim();
  }, [primaryTx]);

  const [selectedOpType, setSelectedOpType] = useState<string>(primaryTx.operationType || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(primaryTx.categoryId || '');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(primaryTx.subcategoryId || '');
  
  // Rule generation states
  const [createRule, setCreateRule] = useState<boolean>(true);
  const [ruleKeyword, setRuleKeyword] = useState<string>(initialKeyword);
  const [applyToAllSimilar, setApplyToAllSimilar] = useState<boolean>(true);
  const [allowMultipleSameDay, setAllowMultipleSameDay] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync keyword if transaction changes
  useEffect(() => {
    setRuleKeyword(initialKeyword);
    if (primaryTx) {
      setSelectedOpType(primaryTx.operationType !== 'NAO_CLASSIFICADO' && primaryTx.operationType !== 'OUTRAS' ? primaryTx.operationType : '');
      setSelectedCategoryId(primaryTx.categoryId || '');
      setSelectedSubcategoryId(primaryTx.subcategoryId || '');
    }
  }, [primaryTx, initialKeyword]);

  // Current category object
  const currentCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  // Count similar transactions that will be affected
  const similarCount = useMemo(() => {
    if (!ruleKeyword || ruleKeyword.trim().length < 2 || !allTransactions.length) return 0;
    const normKey = ruleKeyword.toUpperCase().trim();
    const currentIds = new Set(transactions.map((t) => t.id));

    return allTransactions.filter((t) => {
      if (currentIds.has(t.id)) return false;
      if (t.type === 'SALDO_INICIAL') return false;
      const desc = (t.description || '').toUpperCase();
      return desc.includes(normKey);
    }).length;
  }, [ruleKeyword, allTransactions, transactions]);

  // Quick preset operation types for convenient 1-click selection
  const commonOpTypes = useMemo(() => {
    if (txType === 'ENTRADA') {
      return [
        { code: 'Boleto recebido', label: 'Boleto recebido', catName: 'Boleto recebido' },
        { code: 'Cartão recebido', label: 'Cartão recebido', catName: 'Cartão recebido' },
        { code: 'PIX QR Code', label: 'PIX QR Code', catName: 'PIX Recebido' },
        { code: 'PIX CNPJ', label: 'PIX CNPJ', catName: 'PIX Recebido' },
        { code: 'TED / Transf.', label: 'TED / Transf.', catName: 'Transferências Recebidas' },
        { code: 'Rendimento', label: 'Rendimento / Aplicação', catName: 'Rendimentos e Aplicações' }
      ];
    } else {
      return [
        { code: 'Pagamento de Boleto', label: 'Pagamento de Boleto', catName: 'Pagamento de Boleto' },
        { code: 'PIX Enviado', label: 'PIX Enviado', catName: 'PIX Enviado' },
        { code: 'Débito Automático', label: 'Débito Automático', catName: 'Débito Automático' },
        { code: 'Taxas e Tarifas', label: 'Taxas e Tarifas', catName: 'Taxas e Tarifas Bancárias' },
        { code: 'Cheque Compensado', label: 'Cheque', catName: 'Cheque Compensado' },
        { code: 'Transferência Saída', label: 'TED / DOC Saída', catName: 'Transferências Enviadas' }
      ];
    }
  }, [txType]);

  const handleSelectPresetOp = (preset: { code: string; label: string; catName: string }) => {
    setSelectedOpType(preset.code);
    // Try to auto-match category
    const matchedCat = availableCategories.find(
      (c) => c.name.toLowerCase().includes(preset.catName.toLowerCase()) || preset.catName.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matchedCat) {
      setSelectedCategoryId(matchedCat.id);
      if (matchedCat.subcategories && matchedCat.subcategories.length > 0) {
        setSelectedSubcategoryId(matchedCat.subcategories[0].id);
      } else {
        setSelectedSubcategoryId('');
      }
    }
  };

  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat && cat.subcategories && cat.subcategories.length > 0) {
      setSelectedSubcategoryId(cat.subcategories[0].id);
    } else {
      setSelectedSubcategoryId('');
    }
    // If operation type is not set, set it to category name
    if (!selectedOpType && cat) {
      setSelectedOpType(cat.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedOpType && !selectedCategoryId) {
      setErrorMessage('Por favor, selecione ao menos uma categoria ou um tipo de operação.');
      return;
    }

    if (createRule && (!ruleKeyword || ruleKeyword.trim().length < 2)) {
      setErrorMessage('Para criar uma regra para futuros extratos, informe uma palavra-chave com pelo menos 2 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);

      const cat = categories.find((c) => c.id === selectedCategoryId);
      const subcat = cat?.subcategories?.find((s) => s.id === selectedSubcategoryId);

      const res = await apiService.batchCategorizeTransactions({
        transactionIds: transactions.map((t) => t.id),
        categoryId: selectedCategoryId || undefined,
        categoryName: cat?.name,
        subcategoryId: selectedSubcategoryId || undefined,
        subcategoryName: subcat?.name,
        operationType: selectedOpType || cat?.name || 'OUTRAS',
        createRule: createRule,
        ruleKeyword: ruleKeyword.trim(),
        applyToAllSimilar: applyToAllSimilar,
        allowMultipleSameDay: allowMultipleSameDay,
        userName: 'Gestor Financeiro'
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao categorizar movimentações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSelectedAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const bankAccount = isSingle ? bankAccounts.find((a) => a.id === primaryTx.bankAccountId) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-100 border border-orange-200 text-orange-600">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <span>Categorizar {isSingle ? 'Lançamento' : `${transactions.length} Lançamentos`}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  txType === 'ENTRADA' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {txType === 'ENTRADA' ? 'Crédito / Entrada (+)' : 'Débito / Saída (-)'}
                </span>
              </h3>
              <p className="text-xs text-zinc-600">
                Defina a categoria e crie regras automáticas para os próximos extratos importados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Transaction Summary Card */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-zinc-200 space-y-2 shadow-2xs">
            <div className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
              <span>{isSingle ? 'Detalhes da Movimentação' : 'Resumo dos Lançamentos Selecionados'}</span>
              <span className="font-mono text-zinc-950 font-bold">
                {isSingle ? formatDateBR(primaryTx.date) : `${transactions.length} itens`}
              </span>
            </div>

            {isSingle ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="space-y-0.5">
                  <div className="font-semibold text-zinc-950 font-bold text-sm">{primaryTx.description}</div>
                  <div className="text-[11px] text-zinc-900 font-semibold flex items-center gap-2">
                    {bankAccount && <span>Conta: {bankAccount.accountName}</span>}
                    {primaryTx.externalId && <span>• Doc: {primaryTx.externalId}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-base font-extrabold font-mono ${
                    txType === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                  }`}>
                    {txType === 'ENTRADA' ? '+' : '-'} {formatCurrency(primaryTx.amount)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-950 font-bold font-medium">Valor total selecionado:</span>
                  <span className={`text-base font-extrabold font-mono ${
                    txType === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                  }`}>
                    {txType === 'ENTRADA' ? '+' : '-'} {formatCurrency(totalSelectedAmount)}
                  </span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 divide-y divide-white/5">
                  {transactions.slice(0, 5).map((t) => (
                    <div key={t.id} className="text-[11px] text-zinc-950 font-bold flex justify-between pt-1">
                      <span className="truncate max-w-[320px]">{t.description}</span>
                      <span className="font-mono text-zinc-900 font-semibold">{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                  {transactions.length > 5 && (
                    <div className="text-[10px] text-zinc-800 font-medium italic pt-1">
                      + outros {transactions.length - 5} lançamentos...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Preset Operation Types */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-950 font-bold">
              Tipo de Operação Rápido (Sugestões mais comuns)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {commonOpTypes.map((preset) => {
                const isSelected = selectedOpType === preset.code;
                return (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => handleSelectPresetOp(preset)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold shadow-2xs'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="truncate">{preset.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category & Subcategory Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-950">
                Categoria Contábil / Financeira <span className="text-orange-600">*</span>
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-zinc-200 rounded-xl text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
              >
                <option value="">-- Selecione uma Categoria --</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white text-zinc-950">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-950">
                Subcategoria (Opcional)
              </label>
              <select
                value={selectedSubcategoryId}
                disabled={!currentCategory || !currentCategory.subcategories || currentCategory.subcategories.length === 0}
                onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-zinc-200 rounded-xl text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">(Sem subcategoria específica)</option>
                {currentCategory?.subcategories?.map((s) => (
                  <option key={s.id} value={s.id} className="bg-white text-zinc-950">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Operation Type Custom Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-950">
              Nome do Tipo de Operação
            </label>
            <input
              type="text"
              value={selectedOpType}
              onChange={(e) => setSelectedOpType(e.target.value)}
              placeholder="Ex: Boleto recebido, Cartão de Crédito, PIX..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-zinc-200 rounded-xl text-xs text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600"
            />
          </div>

          {/* Section: Create Rule for Future Bank Statements */}
          <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-orange-100 border border-orange-200 rounded-lg text-orange-700 font-bold shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-950 text-xs flex items-center gap-1.5">
                    <span>Criar Regra para os Próximos Extratos</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-200 text-orange-800">
                      Automático
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                    Sempre que novos extratos forem importados contendo este padrão, o sistema aplicará automaticamente esta categoria e tipo de operação.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={createRule}
                  onChange={(e) => setCreateRule(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>

            {createRule && (
              <div className="space-y-3 pt-2 border-t border-orange-200">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-zinc-950">
                      Texto / Palavra-chave a identificar no extrato:
                    </label>
                    <span className="text-[10px] text-zinc-500">Insensível a maiúsculas</span>
                  </div>
                  <input
                    type="text"
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    placeholder="Ex: POSTO IPIRANGA, CIELO, ALELO, COPASA..."
                    className="w-full px-3 py-2 bg-white border border-orange-300 rounded-xl text-xs font-semibold text-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-orange-600 font-mono"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  {/* Option: Apply to other existing transactions */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToAllSimilar}
                      onChange={(e) => setApplyToAllSimilar(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                    />
                    <div className="text-[11px] text-zinc-950">
                      <strong className="text-zinc-950">Aplicar agora a todos os outros lançamentos já importados</strong>
                      {similarCount > 0 ? (
                        <span className="text-orange-700 font-bold ml-1">
                          ({similarCount} outro(s) lançamento(s) encontrado(s) com este termo!)
                        </span>
                      ) : (
                        <span className="text-zinc-500 ml-1">(Nenhum outro pendente no momento)</span>
                      )}
                    </div>
                  </label>

                  {/* Option: Allow multiple same day */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowMultipleSameDay}
                      onChange={(e) => setAllowMultipleSameDay(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                    />
                    <div className="text-[11px] text-zinc-600">
                      <span>Permitir múltiplos lançamentos com mesmo valor no mesmo dia (não acusar duplicidade)</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando e Aplicando...</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4" />
                  <span>Salvar {createRule ? 'e Criar Regra' : 'Categorização'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
