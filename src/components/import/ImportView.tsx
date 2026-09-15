import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Save,
  Trash2,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Eye,
  Info,
  CheckSquare,
  Square,
  History,
  Sliders,
  Download,
  AlertCircle,
  FileCheck,
  GitCompare,
  Split,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import {
  BankAccount,
  Category,
  ColumnMapping,
  ImportPreviewItem,
  ImportPreviewSummary,
  OperationTypeInfo,
  StatementFileType,
  TabularAnalysis
} from '../../types';
import { apiService } from '../../services/api';
import { formatCurrency, formatDateBR } from '../../utils/formatters';
import { ColumnMappingModal } from './ColumnMappingModal';
import { StatementHistoryModal } from './StatementHistoryModal';

interface ImportViewProps {
  bankAccounts: BankAccount[];
  categories: Category[];
  operationTypes: OperationTypeInfo[];
  onImportSuccess: () => void;
}

export const ImportView: React.FC<ImportViewProps> = ({
  bankAccounts,
  categories,
  operationTypes,
  onImportSuccess
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    bankAccounts[0]?.id || ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<StatementFileType>('OFX');
  const [rawFileContent, setRawFileContent] = useState<string | null>(null);
  const [rawFileBase64, setRawFileBase64] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfWarning, setPdfWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Conference Preview Data
  const [previewSummary, setPreviewSummary] = useState<ImportPreviewSummary | null>(null);
  const [items, setItems] = useState<ImportPreviewItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    'TODOS' | 'NOVOS' | 'DUPLICADOS' | 'ERROS' | 'AUTO' | 'NAO_CLASSIFICADOS'
  >('TODOS');

  // Mapping Modal State
  const [tabularAnalysis, setTabularAnalysis] = useState<TabularAnalysis | null>(null);
  const [activeMapping, setActiveMapping] = useState<ColumnMapping | undefined>(undefined);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);

  // Statement History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Duplicate Resolution Modal State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);
  const [duplicateIndex, setDuplicateIndex] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) {
      setSelectedAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, selectedAccountId]);

  const selectedAccount = bankAccounts.find((a) => a.id === selectedAccountId);

  // Quick One-Click Template Loader (OFX, CSV, XLSX, TXT)
  const handleLoadSample = async (format: StatementFileType) => {
    try {
      setIsProcessing(true);
      setError(null);
      setPdfWarning(null);
      setSuccessMessage(null);

      const sample = await apiService.getSampleData(format);
      setFileName(sample.fileName);
      setFileType(format);
      setRawFileContent(sample.fileContent || null);
      setRawFileBase64(sample.fileBase64 || null);

      // Process Preview directly
      const res = await apiService.processImportPreview({
        fileContent: sample.fileContent,
        fileBase64: sample.fileBase64,
        fileName: sample.fileName,
        fileType: format,
        bankAccountId: selectedAccountId
      });

      setPreviewSummary(res.preview);
      setItems(res.preview.items);
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Erro ao carregar modelo de extrato.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (uploadedFile: File) => {
    try {
      setIsProcessing(true);
      setError(null);
      setPdfWarning(null);
      setSuccessMessage(null);
      setFile(uploadedFile);
      setFileName(uploadedFile.name);

      // Handle filenames with copy indices like "Bradesco_09092026 (1)" or extensionless files
      const cleanName = uploadedFile.name.replace(/\s*\(\d+\)(\.[a-zA-Z0-9]+)?$/, '$1');
      const ext = cleanName.includes('.') ? (cleanName.split('.').pop()?.toUpperCase() || '') : '';
      let detectedType: StatementFileType = 'CSV';
      if (ext === 'OFX' || ext === 'OFC' || ext === 'QFX') detectedType = 'OFX';
      else if (ext === 'XLSX' || ext === 'XLS' || ext === 'ODS' || ext === 'CSVX') detectedType = 'XLSX';
      else if (ext === 'PDF') detectedType = 'PDF';
      else if (ext === 'TXT' || ext === 'RET' || ext === 'REM' || ext === 'EXT' || ext === 'PRN' || ext === 'DAT' || ext === 'LOG' || ext === 'TSV') detectedType = 'TXT';
      else detectedType = 'CSV'; // Default extensionless or CSV files to CSV/Text parsing
      setFileType(detectedType);

      if (detectedType === 'PDF') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const dataUrl = (e.target?.result as string) || '';
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            setRawFileBase64(base64);

            const res = await apiService.processImportPreview({
              fileBase64: base64,
              fileName: uploadedFile.name,
              fileType: 'PDF',
              bankAccountId: selectedAccountId
            });

            setPreviewSummary(res.preview);
            setItems(res.preview.items);
          } catch (err: unknown) {
            console.warn('PDF parsing error:', err);
            setPdfWarning(
              'Aviso de Extração de PDF: O arquivo não possui camadas textuais estruturadas ou é um documento escaneado/imagem. Conforme boas práticas bancárias, utilize os formatos estruturados nativos (OFX, CSV ou XLSX) para garantir 100% de integridade dos dados.'
            );
            setError((err as Error).message);
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(uploadedFile);
        return;
      }

      if (detectedType === 'XLSX') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const dataUrl = (e.target?.result as string) || '';
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            setRawFileBase64(base64);

            // First analyze structure
            const analysisRes = await apiService.analyzeImport({
              fileBase64: base64,
              fileName: uploadedFile.name,
              fileType: 'XLSX',
              bankAccountId: selectedAccountId
            });

            if (analysisRes.analysis) {
              setTabularAnalysis(analysisRes.analysis);
            }

            // If a saved template was found or confidence is high, process preview
            const mappingToUse = analysisRes.matchingSavedTemplate?.mapping || analysisRes.analysis?.suggestedMapping;
            setActiveMapping(mappingToUse);

            const res = await apiService.processImportPreview({
              fileBase64: base64,
              fileName: uploadedFile.name,
              fileType: 'XLSX',
              bankAccountId: selectedAccountId,
              customMapping: mappingToUse
            });

            setPreviewSummary(res.preview);
            setItems(res.preview.items);
          } catch (err: unknown) {
            console.error(err);
            setError((err as Error).message);
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(uploadedFile);
        return;
      }

      // OFX, CSV, TXT with smart charset detection (UTF-8 with ISO-8859-1 fallback)
      let text = '';
      try {
        const arrayBuffer = await uploadedFile.arrayBuffer();
        try {
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
          text = utf8Decoder.decode(arrayBuffer);
        } catch {
          const latin1Decoder = new TextDecoder('iso-8859-1');
          text = latin1Decoder.decode(arrayBuffer);
        }
      } catch {
        text = await uploadedFile.text();
      }

      setRawFileContent(text);

      // Auto-detect format from content if extension differs
      if (text.includes('<OFX') || text.includes('<STMTTRN') || text.includes('OFXHEADER:')) {
        detectedType = 'OFX';
        setFileType('OFX');
      } else if (detectedType === 'OFX') {
        detectedType = 'CSV';
        setFileType('CSV');
      }

      if (detectedType === 'OFX') {
        const res = await apiService.processImportPreview({
          fileContent: text,
          fileName: uploadedFile.name,
          fileType: 'OFX',
          bankAccountId: selectedAccountId
        });
        setPreviewSummary(res.preview);
        setItems(res.preview.items);
        setIsProcessing(false);
        return;
      }

      // CSV or TXT
      const analysisRes = await apiService.analyzeImport({
        fileContent: text,
        fileName: uploadedFile.name,
        fileType: detectedType,
        bankAccountId: selectedAccountId
      });

      if (analysisRes.analysis) {
        setTabularAnalysis(analysisRes.analysis);
      }

      const mappingToUse = analysisRes.matchingSavedTemplate?.mapping || analysisRes.analysis?.suggestedMapping;
      setActiveMapping(mappingToUse);

      const res = await apiService.processImportPreview({
        fileContent: text,
        fileName: uploadedFile.name,
        fileType: detectedType,
        bankAccountId: selectedAccountId,
        customMapping: mappingToUse
      });

      setPreviewSummary(res.preview);
      setItems(res.preview.items);
      setIsProcessing(false);
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Erro ao processar arquivo de extrato bancário.');
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Re-run preview when custom mapping is applied
  const handleApplyMapping = async (newMapping: ColumnMapping, saveAsTemplate: boolean) => {
    try {
      setIsProcessing(true);
      setError(null);
      setActiveMapping(newMapping);
      setIsMappingModalOpen(false);

      if (saveAsTemplate && selectedAccount) {
        await apiService.saveMappingTemplate(
          {
            bankNameOrCode: selectedAccount.bankCode || selectedAccount.id,
            templateName: `Modelo ${selectedAccount.bankName} (${fileType})`,
            fileType,
            mapping: newMapping
          },
          'Sistema'
        );
      }

      const res = await apiService.processImportPreview({
        fileContent: rawFileContent || undefined,
        fileBase64: rawFileBase64 || undefined,
        fileName,
        fileType,
        bankAccountId: selectedAccountId,
        customMapping: newMapping
      });

      setPreviewSummary(res.preview);
      setItems(res.preview.items);
      setSuccessMessage('Mapeamento aplicado com sucesso! Pré-visualização recalculada.');
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Erro ao reprocessar extrato com novo mapeamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle selection
  const toggleItemSelection = (tempId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, selected: !it.selected } : it))
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setItems((prev) =>
      prev.map((it) => (!it.hasError ? { ...it, selected: select } : it))
    );
  };

  // Re-evaluate validity of an item when edited
  const revalidateItem = (item: ImportPreviewItem): ImportPreviewItem => {
    const errs: string[] = [];

    if (!item.date || isNaN(new Date(item.date).getTime())) {
      errs.push('Data inválida ou ausente');
    }
    if (item.type !== 'SALDO_INICIAL' && (typeof item.amount !== 'number' || isNaN(item.amount) || item.amount <= 0)) {
      errs.push('Valor monetário zerado ou inválido (deve ser > 0)');
    }
    if (!item.description || item.description.trim().length === 0) {
      errs.push('Descrição/Histórico do lançamento vazio');
    }

    const hasError = errs.length > 0;
    const errorMessage = errs.join('; ');

    return {
      ...item,
      hasError,
      errorMessage,
      selected: hasError ? false : (item.hasError ? true : item.selected)
    };
  };

  // Exclude/Delete single operation from the import preview
  const handleExcludeSingleItem = (tempId: string) => {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
    setSuccessMessage('Operação excluída da importação com sucesso.');
  };

  // Exclude/Delete all errored/incomplete operations with 1-click
  const handleExcludeAllErroredItems = () => {
    const errorCount = items.filter((i) => i.hasError).length;
    setItems((prev) => prev.filter((it) => !it.hasError));
    setSuccessMessage(`${errorCount} operação(ões) com colunas vazias ou dados incompletos foram excluídas do lote. Nenhum valor fictício foi adicionado.`);
  };

  // List of all items currently flagged as duplicate or resolved duplicates
  const duplicateItemsList = items.filter(
    (i) => i.isDuplicate || i.forceImport || i.resolvedDuplicate === 'KEPT_EXISTING'
  );

  const handleOpenDuplicateModal = (tempId?: string) => {
    const dups = items.filter((i) => i.isDuplicate || i.forceImport || i.resolvedDuplicate === 'KEPT_EXISTING');
    if (dups.length === 0) return;
    if (tempId) {
      const idx = dups.findIndex((i) => i.tempId === tempId);
      setDuplicateIndex(idx >= 0 ? idx : 0);
    } else {
      const unresolvedIdx = dups.findIndex((i) => i.isDuplicate);
      setDuplicateIndex(unresolvedIdx >= 0 ? unresolvedIdx : 0);
    }
    setIsDuplicateModalOpen(true);
  };

  const handleResolveDuplicateKeepExisting = (tempId: string) => {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.tempId === tempId
          ? {
              ...it,
              selected: false,
              forceImport: false,
              isDuplicate: false,
              resolvedDuplicate: 'KEPT_EXISTING' as const
            }
          : it
      );
      const remaining = next.filter((i) => i.isDuplicate);
      if (remaining.length === 0) {
        setIsDuplicateModalOpen(false);
      } else {
        setDuplicateIndex((oldIdx) => Math.min(oldIdx, remaining.length - 1));
      }
      return next;
    });
  };

  const handleResolveDuplicateForceImport = (tempId: string) => {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.tempId === tempId
          ? {
              ...it,
              selected: true,
              forceImport: true,
              isDuplicate: false,
              resolvedDuplicate: 'FORCED_IMPORT' as const,
              duplicateReason: undefined
            }
          : it
      );
      const remaining = next.filter((i) => i.isDuplicate);
      if (remaining.length === 0) {
        setIsDuplicateModalOpen(false);
      } else {
        setDuplicateIndex((oldIdx) => Math.min(oldIdx, remaining.length - 1));
      }
      return next;
    });
  };

  const handleIgnoreAllDuplicates = () => {
    let count = 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.isDuplicate || it.forceImport) {
          count++;
          return {
            ...it,
            selected: false,
            forceImport: false,
            isDuplicate: false,
            resolvedDuplicate: 'KEPT_EXISTING' as const
          };
        }
        return it;
      })
    );
    setSuccessMessage(`${count} lançamento(s) duplicado(s) foram desmarcados e mantidos apenas os já existentes no sistema.`);
    setIsDuplicateModalOpen(false);
  };

  const handleForceAllDuplicates = () => {
    let count = 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.isDuplicate || it.resolvedDuplicate === 'KEPT_EXISTING' || it.forceImport) {
          count++;
          return {
            ...it,
            isDuplicate: false,
            selected: true,
            forceImport: true,
            resolvedDuplicate: 'FORCED_IMPORT' as const,
            duplicateReason: undefined
          };
        }
        return it;
      })
    );
    setSuccessMessage(`${count} lançamento(s) duplicado(s) foram liberados e habilitados para importação.`);
    setIsDuplicateModalOpen(false);
  };

  // Create duplicate exemption rule for a description / supplier keyword
  const handleCreateDuplicateRuleForDescription = async (
    description: string,
    itemCategoryId?: string,
    itemCategoryName?: string,
    itemOpType?: string
  ) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Extract clean supplier name / meaningful keyword
      let cleanKeyword = description.trim();
      const tokens = cleanKeyword
        .split(/\s+/)
        .filter((t) => !['PAGTO', 'PAGAMENTO', 'ELETRON', 'COBRANCA', 'DOC', 'TED', 'PIX', 'TRANSF', 'PAG', 'DEBITO', 'CREDITO'].includes(t.toUpperCase()));
      if (tokens.length >= 2) {
        cleanKeyword = tokens.join(' ');
      }

      await apiService.allowDuplicateForKeyword({
        keyword: cleanKeyword,
        operationType: itemOpType || 'Boleto pago',
        categoryId: itemCategoryId,
        categoryName: itemCategoryName,
        userName: 'Administrador'
      });

      if (description.trim().toUpperCase() !== cleanKeyword.toUpperCase()) {
        await apiService.allowDuplicateForKeyword({
          keyword: description.trim(),
          operationType: itemOpType || 'Boleto pago',
          categoryId: itemCategoryId,
          categoryName: itemCategoryName,
          userName: 'Administrador'
        });
      }

      const targetKey = cleanKeyword.toUpperCase();
      const origKey = description.trim().toUpperCase();

      let newlyUnlockedCount = 0;

      // Update items state directly and cleanly
      setItems((prev) => {
        const next = prev.map((it) => {
          const itDesc = (it.description || '').toUpperCase();
          const normItDesc = (it.normalizedDescription || '').toUpperCase();

          const matches =
            itDesc.includes(targetKey) ||
            targetKey.includes(itDesc) ||
            itDesc.includes(origKey) ||
            origKey.includes(itDesc) ||
            normItDesc.includes(targetKey) ||
            normItDesc.includes(origKey);

          if (matches) {
            if (it.isDuplicate || !it.selected) {
              newlyUnlockedCount++;
            }
            return {
              ...it,
              isDuplicate: false,
              forceImport: true,
              selected: true,
              duplicateReason: undefined
            };
          }
          return it;
        });

        const remainingDups = next.filter((i) => i.isDuplicate);
        if (remainingDups.length === 0) {
          setIsDuplicateModalOpen(false);
        } else {
          setDuplicateIndex(0);
        }

        return next;
      });

      // Update preview summary metrics
      setPreviewSummary((prevSummary) => {
        if (!prevSummary) return prevSummary;
        return {
          ...prevSummary,
          duplicateRecords: Math.max(0, prevSummary.duplicateRecords - newlyUnlockedCount),
          newRecords: prevSummary.newRecords + newlyUnlockedCount
        };
      });

      setSuccessMessage(`Regra criada com sucesso para "${cleanKeyword}"! Os lançamentos correspondentes foram liberados e ativados para importação.`);
    } catch (err: unknown) {
      console.error(err);
      setError(`Erro ao criar regra de duplicidade: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Inline correction before saving
  const updateItemField = (tempId: string, field: keyof ImportPreviewItem, val: unknown) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.tempId !== tempId) return it;

        let updated = { ...it, [field]: val };

        if (field === 'categoryId') {
          const cat = categories.find((c) => c.id === val);
          updated.categoryName = cat?.name;
          updated.subcategoryId = undefined;
          updated.subcategoryName = undefined;
          if (val) {
            updated.classificationStatus = 'CLASSIFICADO';
          }
        } else if (field === 'subcategoryId') {
          const cat = categories.find((c) => c.id === it.categoryId);
          const sub = cat?.subcategories.find((s) => s.id === val);
          updated.subcategoryName = sub?.name;
        }

        if (field === 'date' || field === 'description' || field === 'amount' || field === 'type') {
          updated = revalidateItem(updated);
        }

        if (updated.operationType !== 'NAO_CLASSIFICADO' && updated.categoryId) {
          updated.isAutoClassified = true;
          updated.confidence = 'ALTA';
        }

        return updated;
      })
    );
  };

  // Final Confirmation
  const handleConfirmImport = async () => {
    const selectedItems = items.filter((it) => it.selected && !it.hasError);
    if (selectedItems.length === 0) {
      setError('Selecione pelo menos um lançamento válido para importar.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const res = await apiService.confirmImport({
        items: selectedItems,
        bankAccountId: selectedAccountId,
        fileName: fileName || 'extrato_bancario',
        fileType,
        userName: 'Sistema',
        fileSize: file?.size,
        extractedBalance: previewSummary?.detectedStatementBalance
      });

      setSuccessMessage(res.message);
      setPreviewSummary(null);
      setItems([]);
      setFile(null);
      setRawFileContent(null);
      setRawFileBase64(null);
      onImportSuccess();
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Falha ao confirmar importação.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter items in preview table
  const filteredItems = items.filter((it) => {
    if (activeFilter === 'NOVOS') return !it.isDuplicate && !it.hasError && it.resolvedDuplicate !== 'KEPT_EXISTING';
    if (activeFilter === 'DUPLICADOS') return it.isDuplicate || it.forceImport || it.resolvedDuplicate === 'KEPT_EXISTING';
    if (activeFilter === 'ERROS') return it.hasError;
    if (activeFilter === 'AUTO') return it.isAutoClassified && !it.hasError;
    if (activeFilter === 'NAO_CLASSIFICADOS') return !it.isAutoClassified || it.operationType === 'NAO_CLASSIFICADO';
    return true;
  });

  const selectedCount = items.filter((it) => it.selected && !it.hasError).length;

  return (
    <div className="space-y-6">
      {/* Title & Bank Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border border-black shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-950 font-bold tracking-tight flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-orange-700 font-bold" />
              Importação & Padronização de Extratos Bancários
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-700 font-bold border border-orange-500/20">
              OFX &bull; CSV &bull; XLSX &bull; TXT &bull; PDF
            </span>
          </div>
          <p className="text-xs text-zinc-900 font-semibold mt-1">
            Recepção direta sem necessidade de conversão manual. Normalização de datas, valores, históricos bancários e detecção rigorosa de duplicidades.
          </p>
        </div>

        {/* Action Buttons: Bank Account Selector & History */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-950 font-bold hover:text-white border border border-black text-xs font-semibold transition-colors shadow-xs"
          >
            <History className="w-4 h-4 text-orange-700 font-bold" />
            <span>Histórico de Lotes</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border border-black rounded-2xl flex items-center justify-between text-emerald-700 font-bold text-xs font-semibold">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 font-bold shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 font-bold hover:text-emerald-200"
          >
            &times;
          </button>
        </div>
      )}

      {pdfWarning && (
        <div className="p-4 bg-amber-500/10 border border border-black rounded-2xl flex items-start gap-3 text-amber-700 font-bold text-xs leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-amber-700 font-bold shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block text-amber-200 font-bold mb-1">Diagnóstico Técnico de PDF</strong>
            <span>{pdfWarning}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border border-black rounded-2xl flex items-center justify-between text-rose-700 font-bold text-xs font-semibold">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-700 font-bold shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 font-bold hover:text-rose-200"
          >
            &times;
          </button>
        </div>
      )}

      {/* Upload Zone & Quick Test Buttons */}
      {!previewSummary && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border border-black hover:border-orange-500/60 bg-white hover:bg-orange-500/[0.02] rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all shadow-md group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              accept=".ofx,.csv,.xlsx,.xls,.txt,.pdf,*"
              className="hidden"
            />

            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/10 text-orange-700 font-bold border border-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UploadCloud className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-zinc-950 font-bold mt-4">
              Clique para selecionar ou arraste o extrato bancário aqui
            </h3>
            <p className="text-xs text-zinc-900 font-semibold mt-1 max-w-lg mx-auto">
              Formatos aceitos: <strong className="text-orange-700 font-bold">OFX</strong> (preferencial), <strong className="text-zinc-950 font-bold">CSV</strong>, <strong className="text-zinc-950 font-bold">XLSX</strong>, <strong className="text-zinc-950 font-bold">TXT</strong> ou <strong className="text-zinc-950 font-bold">PDF</strong> legível.
              Não é necessário converter manualmente para OFX.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-[11px] text-zinc-900 font-semibold">
              <span className="px-2.5 py-1 bg-white border border border-black rounded-md font-semibold text-zinc-950 font-bold">
                Itaú Unibanco
              </span>
              <span className="px-2.5 py-1 bg-white border border border-black rounded-md font-semibold text-zinc-950 font-bold">
                Bradesco
              </span>
              <span className="px-2.5 py-1 bg-white border border border-black rounded-md font-semibold text-zinc-950 font-bold">
                Banco do Brasil
              </span>
              <span className="px-2.5 py-1 bg-white border border border-black rounded-md font-semibold text-zinc-950 font-bold">
                Santander
              </span>
              <span className="px-2.5 py-1 bg-white border border border-black rounded-md font-semibold text-zinc-950 font-bold">
                Sicoob / Sicredi
              </span>
              <span className="px-2.5 py-1 bg-white border border border-black rounded-md font-semibold text-zinc-950 font-bold">
                Stone / PagBank / Cielo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isProcessing && (
        <div className="bg-white p-8 rounded-2xl border border border-black text-center space-y-3 shadow-md">
          <RefreshCw className="w-8 h-8 text-orange-700 font-bold animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-zinc-950 font-bold">
            Processando e normalizando extrato bancário...
          </h4>
          <p className="text-xs text-zinc-900 font-semibold max-w-md mx-auto">
            Identificando colunas, normalizando moeda BRL, verificando duplicidades por hash único e aplicando regras automáticas de conciliação.
          </p>
        </div>
      )}

      {/* Conference Preview Section */}
      {previewSummary && (
        <div className="space-y-6">
          {/* File Header Details & Mapping Button */}
          <div className="bg-white p-4 rounded-2xl border border border-black shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 font-bold flex items-center justify-center shrink-0">
                {fileType === 'XLSX' ? (
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700 font-bold" />
                ) : (
                  <FileText className="w-5 h-5 text-orange-700 font-bold" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-950 font-bold">{fileName}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-700 font-bold font-mono">
                    {fileType}
                  </span>
                </div>
                <p className="text-xs text-zinc-900 font-semibold mt-0.5">
                  Total Entradas: <span className="text-emerald-700 font-bold font-bold">{formatCurrency(previewSummary.totalEntradas)}</span> &bull; Total Saídas: <span className="text-rose-700 font-bold font-bold">{formatCurrency(previewSummary.totalSaidas)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {tabularAnalysis && (fileType === 'CSV' || fileType === 'XLSX' || fileType === 'TXT') && (
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-orange-500/10 border border border-black hover:border-orange-500/30 text-zinc-950 font-bold text-xs font-semibold rounded-xl transition-all"
                >
                  <Sliders className="w-4 h-4 text-orange-700 font-bold" />
                  <span>Ajustar Mapeamento de Colunas</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setPreviewSummary(null);
                  setItems([]);
                  setFile(null);
                }}
                className="px-3 py-1.5 text-xs text-zinc-900 font-semibold hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                Trocar Arquivo
              </button>
            </div>
          </div>

          {/* Destaque do Saldo do Extrato Identificado (Regra Contábil: Saldo isolado, não lançado como entrada) */}
          {previewSummary?.detectedStatementBalance &&
            (typeof previewSummary.detectedStatementBalance.finalBalance === 'number' ||
              typeof previewSummary.detectedStatementBalance.initialBalance === 'number') && (
            <div className="bg-gradient-to-r from-blue-950/40 via-[#141824] to-cyan-950/30 p-4 rounded-2xl border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 shrink-0">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-950 font-bold uppercase tracking-wide">
                      Saldos do Extrato Identificados (Ponto de Partida)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 font-bold border border border-black">
                      Saldo Inicial Preservado
                    </span>
                  </div>
                  <p className="text-xs text-zinc-950 font-bold mt-1 leading-relaxed">
                    O primeiro saldo do documento foi identificado e configurado como <strong className="text-white">ponto de partida da movimentação financeiro-contínua</strong>. Ele é preservado no histórico sem gerar entradas/saídas duplicadas de receitas.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0 self-end md:self-center font-mono">
                {typeof previewSummary.detectedStatementBalance.initialBalance === 'number' && (
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-900 font-semibold uppercase font-sans">Saldo Inicial ({previewSummary.detectedStatementBalance.initialBalanceDate ? formatDateBR(previewSummary.detectedStatementBalance.initialBalanceDate) : 'Início'})</div>
                    <div className="text-base font-bold text-emerald-700 font-bold">
                      {formatCurrency(previewSummary.detectedStatementBalance.initialBalance)}
                    </div>
                  </div>
                )}
                {typeof previewSummary.detectedStatementBalance.finalBalance === 'number' && (
                  <div className="text-right border-l border border-black pl-6">
                    <div className="text-[10px] text-zinc-900 font-semibold uppercase font-sans">Saldo Final ({previewSummary.detectedStatementBalance.finalBalanceDate ? formatDateBR(previewSummary.detectedStatementBalance.finalBalanceDate) : 'Fim'})</div>
                    <div className="text-base font-bold text-blue-300">
                      {formatCurrency(previewSummary.detectedStatementBalance.finalBalance)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary Cards: TOTAL, NOVOS, DUPLICADOS, COM ERRO, CLASSIFICADOS, NÃO CLASSIFICADOS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total */}
            <button
              type="button"
              onClick={() => setActiveFilter('TODOS')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeFilter === 'TODOS'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-950/40'
                  : 'bg-white text-zinc-950 font-bold border border-black hover:border border-black'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Total Registros
              </div>
              <div className="text-xl font-extrabold mt-1">
                {items.length}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                No extrato
              </div>
            </button>

            {/* Novos */}
            <button
              type="button"
              onClick={() => setActiveFilter('NOVOS')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeFilter === 'NOVOS'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                  : 'bg-white text-emerald-700 font-bold border border-black hover:border border-black'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Novos (Aptos)
              </div>
              <div className="text-xl font-extrabold mt-1 text-emerald-700 font-bold">
                {items.filter((i) => !i.isDuplicate && !i.hasError).length}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                Sem duplicidade
              </div>
            </button>

            {/* Duplicados */}
            <button
              type="button"
              onClick={() => setActiveFilter('DUPLICADOS')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeFilter === 'DUPLICADOS'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                  : 'bg-white text-amber-700 font-bold border border-black hover:border border-black'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Duplicados
              </div>
              <div className="text-xl font-extrabold mt-1 text-amber-700 font-bold">
                {items.filter((i) => i.isDuplicate).length}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                Já no banco
              </div>
            </button>

            {/* Com Erro */}
            <button
              type="button"
              onClick={() => setActiveFilter('ERROS')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeFilter === 'ERROS'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                  : 'bg-white text-rose-700 font-bold border border-black hover:border border-black'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Com Erro
              </div>
              <div className="text-xl font-extrabold mt-1 text-rose-700 font-bold">
                {items.filter((i) => i.hasError).length}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                {items.filter((i) => i.hasError).length === 0 ? 'Tudo certo!' : 'Requer ajuste'}
              </div>
            </button>

            {/* Classificados */}
            <button
              type="button"
              onClick={() => setActiveFilter('AUTO')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeFilter === 'AUTO'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-white text-blue-400 border border-black hover:border-blue-500/30'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Classificados
              </div>
              <div className="text-xl font-extrabold mt-1 text-blue-400">
                {items.filter((i) => (i.categoryId || i.operationType !== 'NAO_CLASSIFICADO') && !i.hasError).length}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                Com categoria
              </div>
            </button>

            {/* Não classificados */}
            <button
              type="button"
              onClick={() => setActiveFilter('NAO_CLASSIFICADOS')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeFilter === 'NAO_CLASSIFICADOS'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                  : 'bg-white text-purple-400 border border-black hover:border-purple-500/30'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Sem Categoria
              </div>
              <div className="text-xl font-extrabold mt-1 text-purple-400">
                {items.filter((i) => (!i.categoryId || i.operationType === 'NAO_CLASSIFICADO') && !i.hasError).length}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                Pendentes
              </div>
            </button>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border border-black shadow-md">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(true)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Marcar Válidos
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(false)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>

              <div className="text-xs text-zinc-900 font-semibold border-l border border-black pl-3">
                Selecionados para gravação:{' '}
                <strong className="text-orange-700 font-bold font-bold">{selectedCount}</strong> de{' '}
                {items.filter((i) => !i.hasError).length} válidos
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSaving || selectedCount === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gravando no Banco de Dados...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Importação de {selectedCount} Lançamento(s)</span>
                </>
              )}
            </button>
          </div>

          {/* Detailed Error Diagnostics Banner when invalid records exist */}
          {items.filter((i) => i.hasError).length > 0 && (
            <div className="p-4 bg-rose-950/40 border border border-black rounded-2xl text-rose-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-700 font-bold shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-100 text-sm flex items-center gap-2">
                    <span>{items.filter((i) => i.hasError).length} operação(ões) com colunas em branco ou incompletas</span>
                  </h4>
                  <p className="text-rose-700 font-bold/90 text-xs mt-1">
                    <strong className="font-semibold text-rose-200">Motivos:</strong>{' '}
                    {Array.from(new Set(items.filter((i) => i.hasError).map((i) => i.errorMessage || 'Dados em branco ou zerados'))).join(' • ')}
                  </p>
                  <p className="text-[11px] text-zinc-900 font-semibold mt-1">
                    🔒 Regra ativa: Operações com colunas vazias são excluídas e descartadas sem alimentar valores fictícios.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExcludeAllErroredItems}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  title="Excluir todas as operações com colunas vazias ou dados incompletos"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                  <span>Excluir Todas com Erro ({items.filter((i) => i.hasError).length})</span>
                </button>
                {tabularAnalysis && (
                  <button
                    type="button"
                    onClick={() => setIsMappingModalOpen(true)}
                    className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border border-black rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
                  >
                    Ajustar Colunas
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Detailed Duplicate Diagnostics Banner */}
          {items.filter((i) => i.isDuplicate).length > 0 && (
            <div className="p-4 bg-amber-950/40 border border border-black rounded-2xl text-amber-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 font-bold shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-amber-700 font-bold text-sm flex items-center gap-2">
                    <span>{items.filter((i) => i.isDuplicate).length} lançamento(s) duplicado(s) identificado(s)</span>
                  </h4>
                  <p className="text-amber-200/90 text-xs mt-1">
                    Estes lançamentos já existem no sistema ou aparecem repetidos no arquivo.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenDuplicateModal()}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <GitCompare className="w-4 h-4" />
                  <span>Comparar e Resolver Lado a Lado ({items.filter((i) => i.isDuplicate).length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleIgnoreAllDuplicates}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-amber-200 border border border-black rounded-xl font-bold text-xs transition-all cursor-pointer"
                  title="Desmarcar todos os duplicados para manter os dados atuais"
                >
                  Manter Existentes
                </button>
                <button
                  type="button"
                  onClick={handleForceAllDuplicates}
                  className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border border-black rounded-xl font-bold text-xs transition-all cursor-pointer"
                  title="Forçar a importação de todos os duplicados"
                >
                  Forçar Todos
                </button>
              </div>
            </div>
          )}

          {/* Conference Table */}
          <div className="border border border-black rounded-2xl overflow-hidden bg-white shadow-md">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-white text-zinc-900 font-semibold border-b border border-black">
                  <tr>
                    <th className="p-3 w-10 text-center">Sel.</th>
                    <th className="p-3 whitespace-nowrap">Data Mov. / Lanç.</th>
                    <th className="p-3">Descrição / Histórico Original</th>
                    <th className="p-3 text-right whitespace-nowrap">Valor (R$)</th>
                    <th className="p-3 whitespace-nowrap">Tipo</th>
                    <th className="p-3 whitespace-nowrap">Documento / FITID</th>
                    <th className="p-3 whitespace-nowrap">Categoria / Subcategoria</th>
                    <th className="p-3 whitespace-nowrap">Operação</th>
                    <th className="p-3 text-center whitespace-nowrap">Status & Duplicidade</th>
                    <th className="p-3 text-center whitespace-nowrap">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-950 font-bold">
                  {filteredItems.map((it) => {
                    const availableCats = categories.filter((c) => c.type === it.type);
                    const selectedCat = categories.find((c) => c.id === it.categoryId);

                    return (
                      <tr
                        key={it.tempId}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          it.isDuplicate ? 'bg-amber-500/[0.03]' : ''
                        } ${it.hasError ? 'bg-rose-500/[0.05]' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={it.selected}
                            disabled={it.hasError}
                            onChange={() => toggleItemSelection(it.tempId)}
                            className="rounded bg-white border border-black text-orange-700 font-bold focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Date */}
                        <td className="p-3 whitespace-nowrap font-mono text-[11px]">
                          <input
                            type="date"
                            value={it.date ? it.date.split('T')[0] : ''}
                            onChange={(e) => updateItemField(it.tempId, 'date', e.target.value)}
                            className={`px-2 py-1 bg-white border rounded-lg text-xs font-mono text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                              !it.date || isNaN(new Date(it.date).getTime())
                                ? 'border border-black bg-rose-500/15 text-rose-200'
                                : 'border border-black'
                            }`}
                          />
                          {it.postingDate && it.postingDate !== it.date && (
                            <span className="block text-[10px] text-zinc-800 font-medium mt-0.5">
                              Lanç: {formatDateBR(it.postingDate)}
                            </span>
                          )}
                          {it.sourceLineNumber && (
                            <span className="block text-[9px] text-zinc-900 font-semibold">
                              Linha {it.sourceLineNumber}
                            </span>
                          )}
                        </td>

                        {/* Description */}
                        <td className="p-3 min-w-[220px] max-w-xs">
                          <input
                            type="text"
                            value={it.description}
                            placeholder="Descrição do lançamento..."
                            onChange={(e) => updateItemField(it.tempId, 'description', e.target.value)}
                            className={`w-full px-2 py-1 bg-white border rounded-lg text-xs font-semibold text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                              !it.description || !it.description.trim()
                                ? 'border border-black bg-rose-500/15 text-rose-200 placeholder-rose-300'
                                : 'border border-black'
                            }`}
                          />
                          {it.balanceAfter !== undefined && (
                            <span className="text-[10px] text-zinc-800 font-medium font-mono block mt-0.5">
                              Saldo após: {formatCurrency(it.balanceAfter)}
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="p-3 whitespace-nowrap text-right">
                          {it.type === 'SALDO_INICIAL' ? (
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                                Saldo Inicial
                              </span>
                              <span className="text-xs font-mono font-bold text-cyan-300">
                                {formatCurrency(it.balanceAfter || 0)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <span className={`text-xs font-extrabold ${it.type === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}`}>
                                {it.type === 'ENTRADA' ? '+' : '-'}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={it.amount || ''}
                                placeholder="0.00"
                                onChange={(e) => updateItemField(it.tempId, 'amount', parseFloat(e.target.value) || 0)}
                                className={`w-28 text-right px-2 py-1 bg-white border rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                                  it.type === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                                } ${!it.amount || it.amount <= 0 ? 'border border-black bg-rose-500/15' : 'border border-black'}`}
                              />
                            </div>
                          )}
                        </td>
                        {/* Type toggle */}
                        <td className="p-3 whitespace-nowrap">
                          {it.type === 'SALDO_INICIAL' ? (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wide inline-block">
                              SALDO INICIAL
                            </span>
                          ) : (
                            <select
                              value={it.type}
                              onChange={(e) =>
                                updateItemField(it.tempId, 'type', e.target.value as 'ENTRADA' | 'SAIDA')
                              }
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                                it.type === 'ENTRADA'
                                  ? 'bg-emerald-500/10 text-emerald-700 font-bold border border-black'
                                  : 'bg-rose-500/10 text-rose-700 font-bold border border-black'
                              }`}
                            >
                              <option value="ENTRADA" className="bg-white text-emerald-700 font-bold">
                                ENTRADA (+)
                              </option>
                              <option value="SAIDA" className="bg-white text-rose-700 font-bold">
                                SAÍDA (-)
                              </option>
                            </select>
                          )}
                        </td>

                        {/* Document ID */}
                        <td className="p-3 whitespace-nowrap font-mono text-[11px] text-zinc-900 font-semibold">
                          {it.externalId || '-'}
                        </td>

                        {/* Category & Subcategory */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="space-y-1">
                            <select
                              value={it.categoryId || ''}
                              onChange={(e) => updateItemField(it.tempId, 'categoryId', e.target.value || undefined)}
                              className="w-40 bg-white border border border-black rounded-lg px-2 py-1 text-[11px] text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                              <option value="">(Não classificado)</option>
                              {availableCats.map((c) => (
                                <option key={c.id} value={c.id} className="bg-white text-zinc-950 font-bold">
                                  {c.name}
                                </option>
                              ))}
                            </select>

                            {selectedCat && selectedCat.subcategories.length > 0 && (
                              <select
                                value={it.subcategoryId || ''}
                                onChange={(e) =>
                                  updateItemField(it.tempId, 'subcategoryId', e.target.value || undefined)
                                }
                                className="w-40 bg-white border border border-black rounded-lg px-2 py-1 text-[10px] text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 block"
                              >
                                <option value="">(Subcategoria)</option>
                                {selectedCat.subcategories.map((s) => (
                                  <option key={s.id} value={s.id} className="bg-white text-zinc-950 font-bold">
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* Operation Type */}
                        <td className="p-3 whitespace-nowrap">
                          <select
                            value={it.operationType}
                            onChange={(e) => updateItemField(it.tempId, 'operationType', e.target.value)}
                            className="w-36 bg-white border border border-black rounded-lg px-2 py-1 text-[11px] text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="NAO_CLASSIFICADO">NÃO CLASSIFICADO</option>
                            {operationTypes
                              .filter((o) => (it.type === 'ENTRADA' ? o.defaultType === 'ENTRADA' : o.defaultType === 'SAIDA'))
                              .map((o) => (
                                <option key={o.code} value={o.code} className="bg-white text-zinc-950 font-bold">
                                  {o.label}
                                </option>
                              ))}
                          </select>
                        </td>

                        {/* Status & Duplication / Error alerts */}
                        <td className="p-3 text-center">
                          {it.hasError ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-rose-500/15 border border border-black text-rose-200 max-w-[210px] mx-auto shadow-xs">
                              <div className="flex items-center gap-1 text-[11px] font-extrabold text-rose-700 font-bold uppercase tracking-wider">
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Coluna Vazia</span>
                              </div>
                              <span className="text-[10px] text-rose-200 font-semibold text-center leading-tight">
                                {it.errorMessage || 'Coluna em branco ou valor zerado'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleExcludeSingleItem(it.tempId)}
                                className="mt-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                title="Excluir e descartar esta operação"
                              >
                                <Trash2 className="w-3 h-3 text-white" />
                                <span>Excluir Operação</span>
                              </button>
                            </div>
                          ) : it.isDuplicate ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-amber-500/10 border border border-black text-amber-700 font-bold max-w-[240px] mx-auto text-center shadow-xs">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border flex items-center gap-1 uppercase tracking-wide ${
                                it.duplicateLevel === 'EXACT'
                                  ? 'bg-rose-500/20 text-rose-700 font-bold border border-black'
                                  : it.duplicateLevel === 'FILE_INTERNAL'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : 'bg-amber-500/20 text-amber-700 font-bold border border-black'
                              }`}>
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {it.duplicateLevel === 'EXACT'
                                  ? 'Duplicidade Exata'
                                  : it.duplicateLevel === 'FILE_INTERNAL'
                                  ? 'Repetido no Arquivo'
                                  : 'Duplicidade (Sem Doc)'}
                              </span>

                              {it.existingTransaction && (
                                <div className="w-full text-[10px] text-amber-200/90 bg-amber-950/40 p-1.5 rounded-lg border border border-black text-left my-0.5">
                                  <span className="font-bold text-amber-700 font-bold block">
                                    {it.duplicateSource === 'ARQUIVO' ? 'Outra Linha do Arquivo:' : 'Já no Banco:'}
                                  </span>
                                  <div className="truncate font-semibold">{it.existingTransaction.description}</div>
                                  <div className="flex justify-between font-mono text-[9px] opacity-90 mt-0.5">
                                    <span>{formatDateBR(it.existingTransaction.date)}</span>
                                    <span className="font-extrabold">{formatCurrency(it.existingTransaction.amount)}</span>
                                  </div>
                                  {it.existingTransaction.externalId && (
                                    <div className="text-[9px] font-mono text-zinc-900 font-semibold truncate mt-0.5">
                                      Doc: {it.existingTransaction.externalId}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-1 mt-1 w-full">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDuplicateModal(it.tempId)}
                                  className="flex-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <GitCompare className="w-3 h-3" />
                                  <span>Comparar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResolveDuplicateForceImport(it.tempId)}
                                  className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 font-bold text-[10px] rounded-lg border border border-black cursor-pointer"
                                  title="Forçar importação deste registro (Importar Ambas)"
                                >
                                  Importar Ambas
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCreateDuplicateRuleForDescription(it.description, it.categoryId, it.categoryName, it.operationType)}
                                className="w-full mt-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                title="Criar regra para permitir múltiplos lançamentos deste histórico/fornecedor"
                              >
                                <Sparkles className="w-3 h-3 text-zinc-950" />
                                <span>Criar Regra de Duplicidade</span>
                              </button>
                            </div>
                          ) : it.forceImport ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 max-w-[210px] mx-auto text-center">
                              <span className="text-[10px] font-extrabold text-purple-300 flex items-center gap-1 uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                                Forçado (Ambas)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResolveDuplicateKeepExisting(it.tempId)}
                                className="text-[9px] text-zinc-900 font-semibold hover:text-amber-700 font-bold underline mt-0.5 cursor-pointer"
                              >
                                Desfazer / Manter Existente
                              </button>
                            </div>
                          ) : it.resolvedDuplicate === 'KEPT_EXISTING' ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-300 max-w-[210px] mx-auto text-center">
                              <span className="text-[10px] font-extrabold text-zinc-300 flex items-center gap-1 uppercase tracking-wider">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Mantido Existente
                              </span>
                              <span className="text-[9px] text-zinc-400">Não será importado</span>
                              <button
                                type="button"
                                onClick={() => handleResolveDuplicateForceImport(it.tempId)}
                                className="text-[9px] text-amber-400 font-bold hover:underline mt-0.5 cursor-pointer"
                              >
                                Forçar Importação
                              </button>
                            </div>
                          ) : it.duplicateLevel === 'SIMILAR' ? (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                Apto (Docs Diferentes)
                              </span>
                              <span className="text-[9px] text-zinc-900 font-semibold">Registros semelhantes</span>
                            </div>
                          ) : it.type === 'SALDO_INICIAL' ? (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                              Saldo Inicial Extrato
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-700 font-bold border border border-black inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700 font-bold" />
                              Novo / Apto
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleExcludeSingleItem(it.tempId)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-900 font-semibold hover:text-rose-700 font-bold transition-colors border border-transparent hover:border border-black cursor-pointer"
                            title="Excluir este lançamento da importação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Resolution Side-by-Side Modal */}
      {isDuplicateModalOpen && duplicateItemsList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border border-black rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border border-black pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-700 font-bold border border border-black">
                  <GitCompare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>Resolução de Duplicidades Lado a Lado</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 font-bold border border border-black font-bold">
                      {duplicateIndex + 1} de {duplicateItemsList.length}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-900 font-semibold">
                    Compare o lançamento recém-carregado do extrato com o registro correspondente no sistema.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="p-2 rounded-xl text-zinc-900 font-semibold hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Item being compared */}
            {(() => {
              const currentItem = duplicateItemsList[duplicateIndex] || duplicateItemsList[0];
              if (!currentItem) return null;
              const existing = currentItem.existingTransaction;

              return (
                <div className="space-y-6">
                  {/* Duplicate reason alert & Rule Exemption Action */}
                  <div className="p-4 bg-amber-500/10 border border border-black rounded-2xl text-amber-700 font-bold text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 font-bold mt-0.5" />
                      <div>
                        <strong className="text-amber-200 block text-xs">
                          Motivo da Duplicidade:
                        </strong>
                        <span className="text-zinc-950 font-bold text-xs mt-0.5 block">
                          {currentItem.duplicateReason || 'Já existe registro idêntico cadastrado no banco de dados.'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCreateDuplicateRuleForDescription(
                          currentItem.description,
                          currentItem.categoryId,
                          currentItem.categoryName,
                          currentItem.operationType
                        )
                      }
                      className="w-full md:w-auto px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      title="Criar regra permanente no sistema para permitir múltiplos lançamentos deste histórico/fornecedor"
                    >
                      <Sparkles className="w-4 h-4 text-zinc-950" />
                      <span>Criar Regra p/ Corrigir Duplicidade</span>
                    </button>
                  </div>

                  {/* Side-by-Side Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LEFT COLUMN: EXTRATO ITEM (NEW) */}
                    <div className="bg-white border-2 border border-black rounded-2xl p-4 space-y-4 shadow-lg relative">
                      <div className="flex items-center justify-between border-b border border-black pb-2">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-700 font-bold border border-orange-500/30 flex items-center gap-1.5">
                          <UploadCloud className="w-3.5 h-3.5" />
                          Novo no Extrato
                        </span>
                        <span className="text-[10px] text-zinc-900 font-semibold font-mono">
                          Linha {currentItem.sourceLineNumber || '#'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-900 font-semibold uppercase tracking-wider block mb-1">
                            Data do Lançamento
                          </label>
                          <input
                            type="date"
                            value={currentItem.date ? currentItem.date.split('T')[0] : ''}
                            onChange={(e) => updateItemField(currentItem.tempId, 'date', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border border-black rounded-xl text-xs font-mono text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-900 font-semibold uppercase tracking-wider block mb-1">
                            Descrição / Histórico
                          </label>
                          <input
                            type="text"
                            value={currentItem.description}
                            onChange={(e) => updateItemField(currentItem.tempId, 'description', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border border-black rounded-xl text-xs font-semibold text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-900 font-semibold uppercase tracking-wider block mb-1">
                              Valor (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={currentItem.amount}
                              onChange={(e) => updateItemField(currentItem.tempId, 'amount', parseFloat(e.target.value) || 0)}
                              className={`w-full px-3 py-2 bg-white border border border-black rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                                currentItem.type === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-zinc-900 font-semibold uppercase tracking-wider block mb-1">
                              Tipo
                            </label>
                            <select
                              value={currentItem.type}
                              onChange={(e) => updateItemField(currentItem.tempId, 'type', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border border-black rounded-xl text-xs font-bold text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                              <option value="ENTRADA">ENTRADA (+)</option>
                              <option value="SAIDA">SAÍDA (-)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-900 font-semibold uppercase tracking-wider block mb-1">
                            Categoria
                          </label>
                          <select
                            value={currentItem.categoryId || ''}
                            onChange={(e) => updateItemField(currentItem.tempId, 'categoryId', e.target.value || undefined)}
                            className="w-full px-3 py-2 bg-white border border border-black rounded-xl text-xs text-zinc-950 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="">(Não classificado)</option>
                            {categories
                              .filter((c) => c.type === currentItem.type)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: EXISTING ITEM IN DB OR SAME FILE */}
                    <div className="bg-white border border border-black rounded-2xl p-4 space-y-4 shadow-lg relative">
                      <div className="flex items-center justify-between border-b border border-black pb-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                          currentItem.duplicateSource === 'ARQUIVO'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {currentItem.duplicateSource === 'ARQUIVO' ? 'Linha Anterior no Mesmo Arquivo' : 'Já no Sistema'}
                        </span>
                        {existing && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            existing.reconciliationStatus === 'CONCILIADO'
                              ? 'bg-emerald-500/20 text-emerald-700 font-bold border border border-black'
                              : 'bg-amber-500/20 text-amber-700 font-bold border border border-black'
                          }`}>
                            {currentItem.duplicateSource === 'ARQUIVO'
                              ? `Linha ${existing.sourceLineNumber || '#'}`
                              : (existing.reconciliationStatus === 'CONCILIADO' ? 'CONCILIADO' : 'PENDENTE')}
                          </span>
                        )}
                      </div>

                      {existing ? (
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-800 font-medium uppercase tracking-wider block mb-1">
                              Data
                            </span>
                            <div className="text-xs font-mono font-bold text-zinc-950 font-bold bg-white p-2.5 rounded-xl border border border-black">
                              {formatDateBR(existing.date)}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-zinc-800 font-medium uppercase tracking-wider block mb-1">
                              Descrição / Histórico
                            </span>
                            <div className="text-xs font-semibold text-zinc-950 font-bold bg-white p-2.5 rounded-xl border border border-black truncate">
                              {existing.description}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-zinc-800 font-medium uppercase tracking-wider block mb-1">
                                Valor
                              </span>
                              <div className={`text-xs font-mono font-extrabold bg-white p-2.5 rounded-xl border border border-black ${
                                existing.type === 'ENTRADA' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'
                              }`}>
                                {existing.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(existing.amount)}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-zinc-800 font-medium uppercase tracking-wider block mb-1">
                                Categoria
                              </span>
                              <div className="text-xs font-medium text-zinc-950 font-bold bg-white p-2.5 rounded-xl border border border-black truncate">
                                {existing.categoryName || 'Sem Categoria'}
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-zinc-800 font-medium uppercase tracking-wider block mb-1">
                              ID / Documento
                            </span>
                            <div className="text-[11px] font-mono text-zinc-900 font-semibold bg-white p-2 rounded-xl border border border-black truncate">
                              {existing.externalId || existing.id}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-900 font-semibold space-y-2 h-full">
                          <AlertTriangle className="w-8 h-8 text-amber-700 font-bold" />
                          <p className="text-xs font-semibold text-zinc-950 font-bold">
                            Duplicado interno do próprio arquivo
                          </p>
                          <p className="text-[11px] text-zinc-800 font-medium">
                            Este registro aparece repetido em mais de uma linha dentro deste mesmo extrato enviado.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Bar for Current Duplicate Item */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border border-black">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleResolveDuplicateKeepExisting(currentItem.tempId)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-950 font-bold text-xs font-bold rounded-xl transition-all border border border-black cursor-pointer"
                      >
                        🛑 Manter Existente (Não Importar Este)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveDuplicateForceImport(currentItem.tempId)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        ⚡ Importar Ambas (Forçar Novo)
                      </button>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={duplicateIndex === 0}
                        onClick={() => setDuplicateIndex((prev) => Math.max(0, prev - 1))}
                        className="p-2 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Duplicado Anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-xs text-zinc-900 font-semibold font-mono">
                        {duplicateIndex + 1} / {duplicateItemsList.length}
                      </span>
                      <button
                        type="button"
                        disabled={duplicateIndex >= duplicateItemsList.length - 1}
                        onClick={() => setDuplicateIndex((prev) => Math.min(duplicateItemsList.length - 1, prev + 1))}
                        className="p-2 bg-white/5 hover:bg-white/10 text-zinc-950 font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Próximo Duplicado"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Column Mapping Assistant Modal */}
      {tabularAnalysis && (
        <ColumnMappingModal
          isOpen={isMappingModalOpen}
          onClose={() => setIsMappingModalOpen(false)}
          fileName={fileName}
          fileType={fileType}
          bankAccountName={selectedAccount?.accountName || 'Conta'}
          bankCode={selectedAccount?.bankCode}
          analysis={tabularAnalysis}
          initialMapping={activeMapping}
          onApplyMapping={handleApplyMapping}
        />
      )}

      {/* Statement History Modal */}
      <StatementHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        userName="Sistema"
        onStatementsChanged={() => {
          onImportSuccess();
        }}
      />
    </div>
  );
};
