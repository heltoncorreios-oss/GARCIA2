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

  // Already Imported Statement Warning Modal State
  const [isAlreadyImportedModalOpen, setIsAlreadyImportedModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyPreviewResult = (preview: ImportPreviewSummary) => {
    setPreviewSummary(preview);
    setItems(preview.items);
    if (preview.isPreviouslyImportedStatement) {
      setIsAlreadyImportedModalOpen(true);
    }
  };

  const handleCancelImport = () => {
    setPreviewSummary(null);
    setItems([]);
    setFile(null);
    setRawFileContent(null);
    setRawFileBase64(null);
    setIsAlreadyImportedModalOpen(false);
    setError(null);
    setPdfWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

      applyPreviewResult(res.preview);
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

            applyPreviewResult(res.preview);
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

            applyPreviewResult(res.preview);
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
        applyPreviewResult(res.preview);
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

      applyPreviewResult(res.preview);
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

      applyPreviewResult(res.preview);
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
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-950 tracking-tight flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-orange-600" />
              Importação & Padronização de Extratos Bancários
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
              OFX &bull; CSV &bull; XLSX &bull; TXT &bull; PDF
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            Recepção direta sem necessidade de conversão manual. Normalização de datas, valores, históricos bancários e detecção rigorosa de duplicidades.
          </p>
        </div>

        {/* Action Buttons: Bank Account Selector & History */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <History className="w-4 h-4 text-orange-600" />
            <span>Histórico de Lotes</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs font-semibold shadow-2xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 cursor-pointer text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {pdfWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 text-xs leading-relaxed shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block text-amber-950 font-bold mb-1">Diagnóstico Técnico de PDF</strong>
            <span>{pdfWarning}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs font-semibold shadow-2xs">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-950 cursor-pointer text-base leading-none"
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
            className="border-2 border-dashed border-zinc-300 hover:border-orange-500/60 bg-slate-50 hover:bg-orange-500/[0.02] rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all shadow-2xs group"
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

            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UploadCloud className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-zinc-950 mt-4">
              Clique para selecionar ou arraste o extrato bancário aqui
            </h3>
            <p className="text-xs text-zinc-600 mt-1 max-w-lg mx-auto">
              Formatos aceitos: <strong className="text-orange-600">OFX</strong> (preferencial), <strong className="text-zinc-950">CSV</strong>, <strong className="text-zinc-950">XLSX</strong>, <strong className="text-zinc-950">TXT</strong> ou <strong className="text-zinc-950">PDF</strong> legível.
              Não é necessário converter manualmente para OFX.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-[11px] text-zinc-600">
              <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded-md font-semibold text-zinc-800 shadow-2xs">
                Itaú Unibanco
              </span>
              <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded-md font-semibold text-zinc-800 shadow-2xs">
                Bradesco
              </span>
              <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded-md font-semibold text-zinc-800 shadow-2xs">
                Banco do Brasil
              </span>
              <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded-md font-semibold text-zinc-800 shadow-2xs">
                Santander
              </span>
              <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded-md font-semibold text-zinc-800 shadow-2xs">
                Sicoob / Sicredi
              </span>
              <span className="px-2.5 py-1 bg-white border border-zinc-200 rounded-md font-semibold text-zinc-800 shadow-2xs">
                Stone / PagBank / Cielo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isProcessing && (
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center space-y-3 shadow-2xs">
          <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-zinc-950">
            Processando e normalizando extrato bancário...
          </h4>
          <p className="text-xs text-zinc-600 max-w-md mx-auto">
            Identificando colunas, normalizando moeda BRL, verificando duplicidades por hash único e aplicando regras automáticas de conciliação.
          </p>
        </div>
      )}

      {/* Conference Preview Section */}
      {previewSummary && (
        <div className="space-y-6">
          {/* File Header Details & Mapping Button */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
                {fileType === 'XLSX' ? (
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                ) : (
                  <FileText className="w-5 h-5 text-orange-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-950">{fileName}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 font-mono">
                    {fileType}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Total Entradas: <span className="text-emerald-700 font-bold">{formatCurrency(previewSummary.totalEntradas)}</span> &bull; Total Saídas: <span className="text-rose-700 font-bold">{formatCurrency(previewSummary.totalSaidas)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {tabularAnalysis && (fileType === 'CSV' || fileType === 'XLSX' || fileType === 'TXT') && (
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  <Sliders className="w-4 h-4 text-orange-600" />
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
                className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-950 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Trocar Arquivo
              </button>
            </div>
          </div>

          {/* Destaque do Saldo do Extrato Identificado (Regra Contábil: Saldo isolado, não lançado como entrada) */}
          {previewSummary?.detectedStatementBalance &&
            (typeof previewSummary.detectedStatementBalance.finalBalance === 'number' ||
              typeof previewSummary.detectedStatementBalance.initialBalance === 'number') && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-blue-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-100 border border-blue-200 rounded-xl text-blue-600 shrink-0">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-950 uppercase tracking-wide">
                      Saldos do Extrato Identificados (Ponto de Partida)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Saldo Inicial Preservado
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                    O primeiro saldo do documento foi identificado e configurado como <strong className="text-zinc-950">ponto de partida da movimentação financeiro-contínua</strong>. Ele é preservado no histórico sem gerar entradas/saídas duplicadas de receitas.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0 self-end md:self-center font-mono">
                {typeof previewSummary.detectedStatementBalance.initialBalance === 'number' && (
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase font-sans">Saldo Inicial ({previewSummary.detectedStatementBalance.initialBalanceDate ? formatDateBR(previewSummary.detectedStatementBalance.initialBalanceDate) : 'Início'})</div>
                    <div className="text-base font-bold text-emerald-700">
                      {formatCurrency(previewSummary.detectedStatementBalance.initialBalance)}
                    </div>
                  </div>
                )}
                {typeof previewSummary.detectedStatementBalance.finalBalance === 'number' && (
                  <div className="text-right border-l border-zinc-200 pl-6">
                    <div className="text-[10px] text-zinc-500 uppercase font-sans">Saldo Final ({previewSummary.detectedStatementBalance.finalBalanceDate ? formatDateBR(previewSummary.detectedStatementBalance.finalBalanceDate) : 'Fim'})</div>
                    <div className="text-base font-bold text-blue-700">
                      {formatCurrency(previewSummary.detectedStatementBalance.finalBalance)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerta de Extrato Já Importado Anteriormente */}
          {previewSummary?.isPreviouslyImportedStatement && (
            <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-100 border border-amber-200 rounded-xl text-amber-700 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                      Atenção: Extrato Já Importado Anteriormente
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      {previewSummary.previouslyImportedDetails?.duplicatePercentage || 0}% de Duplicidade
                    </span>
                    {previewSummary.previouslyImportedDetails?.reason === 'SAME_FILENAME' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                        Mesmo Nome de Arquivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-700 mt-1.5 leading-relaxed">
                    {previewSummary.previouslyImportedDetails?.reason === 'SAME_FILENAME'
                      ? `O arquivo "${previewSummary.previouslyImportedDetails?.existingStatementFileName || fileName}" já consta registrado nas importações anteriores desta conta.`
                      : `Este extrato (${previewSummary.previouslyImportedDetails?.minDate || ''} a ${previewSummary.previouslyImportedDetails?.maxDate || ''}) possui lançamentos idênticos aos já registrados nesta conta.`}{' '}
                    Para preservar a integridade contábil, os lançamentos coincidentes foram automaticamente <strong>desmarcados</strong> para evitar duplicidade de saldos.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsAlreadyImportedModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Ver Alerta
                </button>
                <button
                  type="button"
                  onClick={handleCancelImport}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-rose-50 text-zinc-700 hover:text-rose-700 border border-zinc-200 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Cancelar e Trocar Arquivo
                </button>
              </div>
            </div>
          )}

          {/* Summary Cards: TOTAL, NOVOS, DUPLICADOS, COM ERRO, CLASSIFICADOS, NÃO CLASSIFICADOS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total */}
            <button
              type="button"
              onClick={() => setActiveFilter('TODOS')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeFilter === 'TODOS'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                  : 'bg-slate-50 text-zinc-950 border-zinc-200 hover:bg-zinc-100'
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
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeFilter === 'NOVOS'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-50 text-emerald-700 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Novos (Aptos)
              </div>
              <div className="text-xl font-extrabold mt-1 text-emerald-700">
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
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeFilter === 'DUPLICADOS'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                  : 'bg-slate-50 text-amber-700 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Duplicados
              </div>
              <div className="text-xl font-extrabold mt-1 text-amber-700">
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
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeFilter === 'ERROS'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-50 text-rose-700 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Com Erro
              </div>
              <div className="text-xl font-extrabold mt-1 text-rose-700">
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
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeFilter === 'AUTO'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                  : 'bg-slate-50 text-blue-700 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Classificados
              </div>
              <div className="text-xl font-extrabold mt-1 text-blue-700">
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
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-2xs ${
                activeFilter === 'NAO_CLASSIFICADOS'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : 'bg-slate-50 text-purple-700 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Sem Categoria
              </div>
              <div className="text-xl font-extrabold mt-1 text-purple-700">
                {items.filter((i) => (!i.categoryId || i.operationType === 'NAO_CLASSIFICADO') && !i.hasError).length}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                Pendentes
              </div>
            </button>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Marcar Válidos
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(false)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Desmarcar Todos
                </button>
              </div>

              <div className="text-xs text-zinc-600 border-l border-zinc-200 pl-3">
                Selecionados para gravação:{' '}
                <strong className="text-orange-600 font-bold">{selectedCount}</strong> de{' '}
                {items.filter((i) => !i.hasError).length} válidos
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSaving || selectedCount === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
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
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-950 text-sm flex items-center gap-2">
                    <span>{items.filter((i) => i.hasError).length} operação(ões) com colunas em branco ou incompletas</span>
                  </h4>
                  <p className="text-rose-700 text-xs mt-1">
                    <strong className="font-semibold text-rose-900">Motivos:</strong>{' '}
                    {Array.from(new Set(items.filter((i) => i.hasError).map((i) => i.errorMessage || 'Dados em branco ou zerados'))).join(' • ')}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    🔒 Regra ativa: Operações com colunas vazias são excluídas e descartadas sem alimentar valores fictícios.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExcludeAllErroredItems}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  title="Excluir todas as operações com colunas vazias ou dados incompletos"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                  <span>Excluir Todas com Erro ({items.filter((i) => i.hasError).length})</span>
                </button>
                {tabularAnalysis && (
                  <button
                    type="button"
                    onClick={() => setIsMappingModalOpen(true)}
                    className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer"
                  >
                    Ajustar Colunas
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Detailed Duplicate Diagnostics Banner */}
          {items.filter((i) => i.isDuplicate).length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                    <span>{items.filter((i) => i.isDuplicate).length} lançamento(s) duplicado(s) identificado(s)</span>
                  </h4>
                  <p className="text-amber-800/90 text-xs mt-1">
                    Estes lançamentos já existem no sistema ou aparecem repetidos no arquivo.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenDuplicateModal()}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <GitCompare className="w-4 h-4" />
                  <span>Comparar e Resolver Lado a Lado ({items.filter((i) => i.isDuplicate).length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleIgnoreAllDuplicates}
                  className="px-3 py-2 bg-white hover:bg-zinc-50 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs"
                  title="Desmarcar todos os duplicados para manter os dados atuais"
                >
                  Manter Existentes
                </button>
                <button
                  type="button"
                  onClick={handleForceAllDuplicates}
                  className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs"
                  title="Forçar a importação de todos os duplicados"
                >
                  Forçar Todos
                </button>
              </div>
            </div>
          )}

          {/* Conference Table */}
          <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 text-zinc-700 font-semibold border-b border-zinc-200">
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
                <tbody className="divide-y divide-zinc-200 text-zinc-900">
                  {filteredItems.map((it) => {
                    const availableCats = categories.filter((c) => c.type === it.type);
                    const selectedCat = categories.find((c) => c.id === it.categoryId);

                    return (
                      <tr
                        key={it.tempId}
                        className={`hover:bg-zinc-50/80 transition-colors ${
                          it.isDuplicate ? 'bg-amber-50/40' : ''
                        } ${it.hasError ? 'bg-rose-50/40' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={it.selected}
                            disabled={it.hasError}
                            onChange={() => toggleItemSelection(it.tempId)}
                            className="rounded bg-white border border-zinc-300 text-orange-600 focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Date */}
                        <td className="p-3 whitespace-nowrap font-mono text-[11px]">
                          <input
                            type="date"
                            value={it.date ? it.date.split('T')[0] : ''}
                            onChange={(e) => updateItemField(it.tempId, 'date', e.target.value)}
                            className={`px-2 py-1 bg-white border rounded-lg text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                              !it.date || isNaN(new Date(it.date).getTime())
                                ? 'border-rose-300 bg-rose-50 text-rose-800'
                                : 'border-zinc-300'
                            }`}
                          />
                          {it.postingDate && it.postingDate !== it.date && (
                            <span className="block text-[10px] text-zinc-500 font-medium mt-0.5">
                              Lanç: {formatDateBR(it.postingDate)}
                            </span>
                          )}
                          {it.sourceLineNumber && (
                            <span className="block text-[9px] text-zinc-400">
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
                            className={`w-full px-2 py-1 bg-white border rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                              !it.description || !it.description.trim()
                                ? 'border-rose-300 bg-rose-50 text-rose-800 placeholder-rose-400'
                                : 'border-zinc-300'
                            }`}
                          />
                          {it.balanceAfter !== undefined && (
                            <span className="text-[10px] text-zinc-500 font-medium font-mono block mt-0.5">
                              Saldo após: {formatCurrency(it.balanceAfter)}
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="p-3 whitespace-nowrap text-right">
                          {it.type === 'SALDO_INICIAL' ? (
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider block">
                                Saldo Inicial
                              </span>
                              <span className="text-xs font-mono font-bold text-cyan-800">
                                {formatCurrency(it.balanceAfter || 0)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <span className={`text-xs font-extrabold ${it.type === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'}`}>
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
                                  it.type === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'
                                } ${!it.amount || it.amount <= 0 ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-zinc-300'}`}
                              />
                            </div>
                          )}
                        </td>
                        {/* Type toggle */}
                        <td className="p-3 whitespace-nowrap">
                          {it.type === 'SALDO_INICIAL' ? (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 uppercase tracking-wide inline-block">
                              SALDO INICIAL
                            </span>
                          ) : (
                            <select
                              value={it.type}
                              onChange={(e) =>
                                updateItemField(it.tempId, 'type', e.target.value as 'ENTRADA' | 'SAIDA')
                              }
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                it.type === 'ENTRADA'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              <option value="ENTRADA" className="bg-white text-emerald-700">
                                ENTRADA (+)
                              </option>
                              <option value="SAIDA" className="bg-white text-rose-700">
                                SAÍDA (-)
                              </option>
                            </select>
                          )}
                        </td>

                        {/* Document ID */}
                        <td className="p-3 whitespace-nowrap font-mono text-[11px] text-zinc-600">
                          {it.externalId || '-'}
                        </td>

                        {/* Category & Subcategory */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="space-y-1">
                            <select
                              value={it.categoryId || ''}
                              onChange={(e) => updateItemField(it.tempId, 'categoryId', e.target.value || undefined)}
                              className="w-40 bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                            >
                              <option value="">(Não classificado)</option>
                              {availableCats.map((c) => (
                                <option key={c.id} value={c.id} className="bg-white text-zinc-900">
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
                                className="w-40 bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[10px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500 block cursor-pointer"
                              >
                                <option value="">(Subcategoria)</option>
                                {selectedCat.subcategories.map((s) => (
                                  <option key={s.id} value={s.id} className="bg-white text-zinc-900">
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
                            className="w-36 bg-white border border-zinc-300 rounded-lg px-2 py-1 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                          >
                            <option value="NAO_CLASSIFICADO">NÃO CLASSIFICADO</option>
                            {operationTypes
                              .filter((o) => (it.type === 'ENTRADA' ? o.defaultType === 'ENTRADA' : o.defaultType === 'SAIDA'))
                              .map((o) => (
                                <option key={o.code} value={o.code} className="bg-white text-zinc-900">
                                  {o.label}
                                </option>
                              ))}
                          </select>
                        </td>

                        {/* Status & Duplication / Error alerts */}
                        <td className="p-3 text-center">
                          {it.hasError ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 max-w-[210px] mx-auto shadow-2xs">
                              <div className="flex items-center gap-1 text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Coluna Vazia</span>
                              </div>
                              <span className="text-[10px] text-rose-700 font-semibold text-center leading-tight">
                                {it.errorMessage || 'Coluna em branco ou valor zerado'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleExcludeSingleItem(it.tempId)}
                                className="mt-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Excluir e descartar esta operação"
                              >
                                <Trash2 className="w-3 h-3 text-white" />
                                <span>Excluir Operação</span>
                              </button>
                            </div>
                          ) : it.isDuplicate ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 max-w-[240px] mx-auto text-center shadow-2xs">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border flex items-center gap-1 uppercase tracking-wide ${
                                it.duplicateLevel === 'EXACT'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : it.duplicateLevel === 'FILE_INTERNAL'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}>
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {it.duplicateLevel === 'EXACT'
                                  ? 'Duplicidade Exata'
                                  : it.duplicateLevel === 'FILE_INTERNAL'
                                  ? 'Repetido no Arquivo'
                                  : 'Duplicidade (Sem Doc)'}
                              </span>

                              {it.existingTransaction && (
                                <div className="w-full text-[10px] text-amber-900 bg-white/90 p-1.5 rounded-lg border border-amber-200 text-left my-0.5 shadow-2xs">
                                  <span className="font-bold text-amber-800 block">
                                    {it.duplicateSource === 'ARQUIVO' ? 'Outra Linha do Arquivo:' : 'Já no Banco:'}
                                  </span>
                                  <div className="truncate font-semibold">{it.existingTransaction.description}</div>
                                  <div className="flex justify-between font-mono text-[9px] text-zinc-600 mt-0.5">
                                    <span>{formatDateBR(it.existingTransaction.date)}</span>
                                    <span className="font-extrabold text-zinc-900">{formatCurrency(it.existingTransaction.amount)}</span>
                                  </div>
                                  {it.existingTransaction.externalId && (
                                    <div className="text-[9px] font-mono text-zinc-500 truncate mt-0.5">
                                      Doc: {it.existingTransaction.externalId}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-1 mt-1 w-full">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDuplicateModal(it.tempId)}
                                  className="flex-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <GitCompare className="w-3 h-3" />
                                  <span>Comparar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResolveDuplicateForceImport(it.tempId)}
                                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] rounded-lg border border-amber-200 cursor-pointer shadow-2xs"
                                  title="Forçar importação deste registro (Importar Ambas)"
                                >
                                  Importar Ambas
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCreateDuplicateRuleForDescription(it.description, it.categoryId, it.categoryName, it.operationType)}
                                className="w-full mt-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                title="Criar regra para permitir múltiplos lançamentos deste histórico/fornecedor"
                              >
                                <Sparkles className="w-3 h-3 text-zinc-950" />
                                <span>Criar Regra de Duplicidade</span>
                              </button>
                            </div>
                          ) : it.forceImport ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 max-w-[210px] mx-auto text-center shadow-2xs">
                              <span className="text-[10px] font-extrabold text-purple-800 flex items-center gap-1 uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                                Forçado (Ambas)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResolveDuplicateKeepExisting(it.tempId)}
                                className="text-[9px] text-zinc-600 hover:text-amber-800 underline mt-0.5 cursor-pointer"
                              >
                                Desfazer / Manter Existente
                              </button>
                            </div>
                          ) : it.resolvedDuplicate === 'KEPT_EXISTING' ? (
                            <div className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-slate-100 border border-zinc-200 text-zinc-700 max-w-[210px] mx-auto text-center shadow-2xs">
                              <span className="text-[10px] font-extrabold text-zinc-800 flex items-center gap-1 uppercase tracking-wider">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                Mantido Existente
                              </span>
                              <span className="text-[9px] text-zinc-500">Não será importado</span>
                              <button
                                type="button"
                                onClick={() => handleResolveDuplicateForceImport(it.tempId)}
                                className="text-[9px] text-amber-700 font-bold hover:underline mt-0.5 cursor-pointer"
                              >
                                Forçar Importação
                              </button>
                            </div>
                          ) : it.duplicateLevel === 'SIMILAR' ? (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                Apto (Docs Diferentes)
                              </span>
                              <span className="text-[9px] text-zinc-500">Registros semelhantes</span>
                            </div>
                          ) : it.type === 'SALDO_INICIAL' ? (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-cyan-600" />
                              Saldo Inicial Extrato
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Novo / Apto
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleExcludeSingleItem(it.tempId)}
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-zinc-500 hover:text-rose-700 transition-colors border border-zinc-200 hover:border-rose-300 cursor-pointer shadow-2xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                  <GitCompare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                    <span>Resolução de Duplicidades Lado a Lado</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                      {duplicateIndex + 1} de {duplicateItemsList.length}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Compare o lançamento recém-carregado do extrato com o registro correspondente no sistema.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
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
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong className="text-amber-950 block text-xs">
                          Motivo da Duplicidade:
                        </strong>
                        <span className="text-zinc-800 text-xs mt-0.5 block">
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
                      className="w-full md:w-auto px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      title="Criar regra permanente no sistema para permitir múltiplos lançamentos deste histórico/fornecedor"
                    >
                      <Sparkles className="w-4 h-4 text-zinc-950" />
                      <span>Criar Regra p/ Corrigir Duplicidade</span>
                    </button>
                  </div>

                  {/* Side-by-Side Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LEFT COLUMN: EXTRATO ITEM (NEW) */}
                    <div className="bg-slate-50/70 border border-zinc-200 rounded-2xl p-4 space-y-4 shadow-2xs relative">
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1.5">
                          <UploadCloud className="w-3.5 h-3.5" />
                          Novo no Extrato
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Linha {currentItem.sourceLineNumber || '#'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">
                            Data do Lançamento
                          </label>
                          <input
                            type="date"
                            value={currentItem.date ? currentItem.date.split('T')[0] : ''}
                            onChange={(e) => updateItemField(currentItem.tempId, 'date', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">
                            Descrição / Histórico
                          </label>
                          <input
                            type="text"
                            value={currentItem.description}
                            onChange={(e) => updateItemField(currentItem.tempId, 'description', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">
                              Valor (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={currentItem.amount}
                              onChange={(e) => updateItemField(currentItem.tempId, 'amount', parseFloat(e.target.value) || 0)}
                              className={`w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                                currentItem.type === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">
                              Tipo
                            </label>
                            <select
                              value={currentItem.type}
                              onChange={(e) => updateItemField(currentItem.tempId, 'type', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                            >
                              <option value="ENTRADA">ENTRADA (+)</option>
                              <option value="SAIDA">SAÍDA (-)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">
                            Categoria
                          </label>
                          <select
                            value={currentItem.categoryId || ''}
                            onChange={(e) => updateItemField(currentItem.tempId, 'categoryId', e.target.value || undefined)}
                            className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
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
                    <div className="bg-slate-50/70 border border-zinc-200 rounded-2xl p-4 space-y-4 shadow-2xs relative">
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                          currentItem.duplicateSource === 'ARQUIVO'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {currentItem.duplicateSource === 'ARQUIVO' ? 'Linha Anterior no Mesmo Arquivo' : 'Já no Sistema'}
                        </span>
                        {existing && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                            existing.reconciliationStatus === 'CONCILIADO'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
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
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                              Data
                            </span>
                            <div className="text-xs font-mono font-bold text-zinc-900 bg-white p-2.5 rounded-xl border border-zinc-200">
                              {formatDateBR(existing.date)}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                              Descrição / Histórico
                            </span>
                            <div className="text-xs font-semibold text-zinc-900 bg-white p-2.5 rounded-xl border border-zinc-200 truncate">
                              {existing.description}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                                Valor
                              </span>
                              <div className={`text-xs font-mono font-extrabold bg-white p-2.5 rounded-xl border border-zinc-200 ${
                                existing.type === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                {existing.type === 'ENTRADA' ? '+' : '-'} {formatCurrency(existing.amount)}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                                Categoria
                              </span>
                              <div className="text-xs font-medium text-zinc-800 bg-white p-2.5 rounded-xl border border-zinc-200 truncate">
                                {existing.categoryName || 'Sem Categoria'}
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                              ID / Documento
                            </span>
                            <div className="text-[11px] font-mono text-zinc-600 bg-white p-2 rounded-xl border border-zinc-200 truncate">
                              {existing.externalId || existing.id}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-2 h-full">
                          <AlertTriangle className="w-8 h-8 text-amber-500" />
                          <p className="text-xs font-semibold text-zinc-800">
                            Duplicado interno do próprio arquivo
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Este registro aparece repetido em mais de uma linha dentro deste mesmo extrato enviado.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Bar for Current Duplicate Item */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-zinc-200">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleResolveDuplicateKeepExisting(currentItem.tempId)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold rounded-xl transition-all border border-zinc-300 shadow-2xs cursor-pointer"
                      >
                        🛑 Manter Existente (Não Importar Este)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveDuplicateForceImport(currentItem.tempId)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black rounded-xl transition-all shadow-2xs cursor-pointer"
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
                        className="p-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                        title="Duplicado Anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-xs text-zinc-600 font-mono">
                        {duplicateIndex + 1} / {duplicateItemsList.length}
                      </span>
                      <button
                        type="button"
                        disabled={duplicateIndex >= duplicateItemsList.length - 1}
                        onClick={() => setDuplicateIndex((prev) => Math.min(duplicateItemsList.length - 1, prev + 1))}
                        className="p-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
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

      {/* Modal de Confirmação: Extrato Já Importado Anteriormente */}
      {isAlreadyImportedModalOpen && previewSummary?.isPreviouslyImportedStatement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full p-6 shadow-xl relative text-zinc-900 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200 shrink-0 shadow-2xs">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                    Aviso de Duplicidade
                  </span>
                  {previewSummary.previouslyImportedDetails?.reason === 'SAME_FILENAME' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-zinc-700 border border-zinc-200">
                      Mesmo Nome de Arquivo
                    </span>
                  )}
                  {previewSummary.previouslyImportedDetails?.reason === 'SAME_PERIOD' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-zinc-700 border border-zinc-200">
                      Mesmo Período
                    </span>
                  )}
                  {previewSummary.previouslyImportedDetails?.reason === 'HIGH_DUPLICATE_RATIO' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-zinc-700 border border-zinc-200">
                      Lançamentos Coincidentes
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mt-1">
                  Este extrato bancário já foi importado anteriormente?
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Identificamos fortes indícios de que esta movimentação já foi processada nesta conta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAlreadyImportedModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Fechar aviso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informative Box */}
            <div className="bg-slate-50 border border-zinc-200 rounded-xl p-4 space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-zinc-200 shadow-2xs">
                  <span className="text-zinc-500 block uppercase text-[10px] font-bold">Conta Bancária</span>
                  <span className="text-zinc-900 font-semibold">{selectedAccount?.accountName || 'Conta Selecionada'}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-zinc-200 shadow-2xs">
                  <span className="text-zinc-500 block uppercase text-[10px] font-bold">Arquivo Carregado</span>
                  <span className="text-zinc-900 font-semibold truncate block" title={fileName}>{fileName}</span>
                </div>
              </div>

              {previewSummary.previouslyImportedDetails && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                  {previewSummary.previouslyImportedDetails.reason === 'SAME_FILENAME' && (
                    <p className="text-amber-900 leading-relaxed">
                      📁 O arquivo <strong className="text-zinc-950">"{previewSummary.previouslyImportedDetails.existingStatementFileName || fileName}"</strong> já consta registrado nas importações anteriores desta conta
                      {previewSummary.previouslyImportedDetails.existingStatementImportedAt && (
                        <span> (importado em {new Date(previewSummary.previouslyImportedDetails.existingStatementImportedAt).toLocaleDateString('pt-BR')} às {new Date(previewSummary.previouslyImportedDetails.existingStatementImportedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
                      )}.
                    </p>
                  )}
                  {previewSummary.previouslyImportedDetails.minDate && previewSummary.previouslyImportedDetails.maxDate && (
                    <p className="text-amber-900">
                      📅 <strong>Período detectado:</strong> de {previewSummary.previouslyImportedDetails.minDate} até {previewSummary.previouslyImportedDetails.maxDate}.
                    </p>
                  )}
                  <p className="text-amber-900">
                    ⚡ <strong>{previewSummary.previouslyImportedDetails.duplicatePercentage}% dos lançamentos</strong> ({previewSummary.previouslyImportedDetails.totalDuplicates} de {previewSummary.totalRecords}) coincidem com registros já cadastrados.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-zinc-600 bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Proteção Contábil Ativa:</strong> Todos os lançamentos idênticos já foram automaticamente <strong>desmarcados</strong> para evitar duplicidade de receitas, despesas e saldos.
                </p>
              </div>
            </div>

            {/* Question Callout */}
            <div className="text-center py-1">
              <p className="text-sm font-bold text-zinc-800">
                Deseja revisar e importar este extrato mesmo assim?
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-zinc-200">
              <button
                type="button"
                onClick={handleCancelImport}
                className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-rose-50 text-zinc-700 hover:text-rose-700 hover:border-rose-300 border border-zinc-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <XCircle className="w-4 h-4" />
                Cancelar e Trocar Arquivo
              </button>

              <div className="flex-1 w-full flex flex-col sm:flex-row items-center justify-end gap-2.5">
                {previewSummary.duplicateRecords > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAlreadyImportedModalOpen(false);
                      handleOpenDuplicateModal();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <GitCompare className="w-4 h-4" />
                    Comparar Duplicados Lado a Lado ({previewSummary.duplicateRecords})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsAlreadyImportedModalOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Sim, Continuar e Revisar
                </button>
              </div>
            </div>
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
