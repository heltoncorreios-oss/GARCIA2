import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Key,
  HardDrive,
  RefreshCw,
  Lock,
  Calendar,
  Check
} from 'lucide-react';
import { apiService } from '../../services/api';
import { BackupLog, BackupPackage } from '../../types';

interface BackupViewProps {
  onRefreshData?: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ onRefreshData }) => {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Restore Modal State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
  const [parsedBackupPackage, setParsedBackupPackage] = useState<BackupPackage | null>(null);
  const [restorePassword, setRestorePassword] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Automated Schedule state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(true);
  const [backupFrequency, setBackupFrequency] = useState<'diario' | 'semanal' | 'mensal'>('diario');
  const [backupRetentionDays, setBackupRetentionDays] = useState<number>(30);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getBackupLogs();
      setLogs(res.logs || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao carregar histórico de backups');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleExportBackup = async () => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsLoading(true);

      const pkg: BackupPackage = await apiService.exportBackup();
      
      // Trigger browser download
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(pkg, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `backup_enterprise_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSuccessMessage('Backup corporativo exportado e criptografado com sucesso!');
      loadLogs();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao exportar backup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelectedForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedBackupFile(file);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const json = JSON.parse(content) as BackupPackage;
        if (!json.metadata || !json.data) {
          throw new Error('O arquivo selecionado não é um pacote de backup corporativo válido.');
        }
        setParsedBackupPackage(json);
        setIsRestoreModalOpen(true);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || 'Erro ao ler arquivo JSON de backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!parsedBackupPackage) return;

    try {
      setIsRestoring(true);
      setErrorMessage(null);

      const res = await apiService.restoreBackup({
        backupPackage: parsedBackupPackage,
        userName: 'Administrador'
      });

      if (res.success) {
        setSuccessMessage(res.message);
        setIsRestoreModalOpen(false);
        setSelectedBackupFile(null);
        setParsedBackupPackage(null);
        if (onRefreshData) onRefreshData();
        loadLogs();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao restaurar arquivo de backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Enterprise Data Protection & Compliance
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Central de Backup & Disaster Recovery
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Garanta a segurança jurídica e financeira da sua empresa. Faça backups criptografados (AES-256), configure rotinas automáticas de retenção e restaure dados com segurança ponto a ponto.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-stretch md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={isLoading}
            className="flex-1 md:flex-initial px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar Backup Agora
          </button>
          <label className="flex-1 md:flex-initial px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm">
            <Upload className="w-4 h-4" />
            Restaurar Backup
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelectedForRestore}
            />
          </label>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-300 font-bold">×</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300 font-bold">×</button>
        </div>
      )}

      {/* Grid: Settings & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Automated Schedule Settings */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Rotina Automática
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
              Ativo
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 font-medium">Habilitar Backup Automático</span>
              <button
                type="button"
                onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  autoBackupEnabled ? 'bg-orange-500' : 'bg-zinc-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    autoBackupEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-zinc-700 font-bold mb-1.5">Frequência da Rotina</label>
              <select
                value={backupFrequency}
                onChange={(e) => setBackupFrequency(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium text-zinc-800 focus:outline-none focus:border-orange-500"
              >
                <option value="diario">Diário (Todo dia à meia-noite)</option>
                <option value="semanal">Semanal (Domingos)</option>
                <option value="mensal">Mensal (Todo dia 1º)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-bold mb-1.5">Retenção de Arquivos (Dias)</label>
              <input
                type="number"
                value={backupRetentionDays}
                onChange={(e) => setBackupRetentionDays(Number(e.target.value))}
                min={7}
                max={365}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium text-zinc-800 focus:outline-none focus:border-orange-500"
              />
              <p className="text-[10px] text-zinc-400 mt-1">Backups mais antigos que o período configurado serão limpos automaticamente.</p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/60 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-800 font-bold">
                <Lock className="w-3.5 h-3.5 text-orange-500" /> Criptografia AES-256
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Todos os snapshots são compactados e assinados digitalmente com hash SHA-256 de integridade.
              </p>
            </div>
          </div>
        </div>

        {/* Audit & Logs Table */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" /> Histórico e Auditoria de Backups
            </h2>
            <button
              onClick={loadLogs}
              className="p-2 text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Atualizar histórico"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">Data / Hora</th>
                  <th className="py-3 px-3">Arquivo</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Registros</th>
                  <th className="py-3 px-3">Tamanho</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400 font-medium">
                      Nenhum registro de backup recente. Exporte seu primeiro backup corporativo acima.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-3 font-medium text-zinc-700">
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-3 font-semibold text-zinc-900 truncate max-w-[150px]" title={log.fileName}>
                        {log.fileName}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.type === 'RESTORE' ? 'bg-purple-100 text-purple-700' :
                          log.type === 'AUTOMATIC' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-zinc-800">{log.recordsCount} txs</td>
                      <td className="py-3 px-3 text-zinc-500">{(log.fileSize / 1024).toFixed(1)} KB</td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          <Check className="w-3 h-3" /> Sucesso
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Restore Preview Modal */}
      {isRestoreModalOpen && parsedBackupPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-zinc-200 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-950">Assistente de Restauração</h3>
                  <p className="text-xs text-zinc-500">Validação e pré-visualização do pacote de backup</p>
                </div>
              </div>
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 p-1.5 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 space-y-3 text-xs">
              <div className="flex justify-between border-b border-zinc-200/60 pb-2">
                <span className="text-zinc-500 font-medium">Versão do Schema:</span>
                <span className="font-bold text-zinc-900">{parsedBackupPackage.metadata.version}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200/60 pb-2">
                <span className="text-zinc-500 font-medium">Data de Geração:</span>
                <span className="font-bold text-zinc-900">{new Date(parsedBackupPackage.metadata.createdAt).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200/60 pb-2">
                <span className="text-zinc-500 font-medium">Transações Financeiras:</span>
                <span className="font-bold text-zinc-900">{parsedBackupPackage.metadata.totalTransactions} registros</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200/60 pb-2">
                <span className="text-zinc-500 font-medium">Contas Bancárias:</span>
                <span className="font-bold text-zinc-900">{parsedBackupPackage.metadata.totalBankAccounts} contas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Checksum de Integridade (SHA-256):</span>
                <span className="font-mono text-[10px] text-zinc-600 bg-white px-2 py-0.5 rounded border border-zinc-200 truncate max-w-[200px]">
                  {parsedBackupPackage.metadata.checksum}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Atenção:</strong> Restaurar este backup substituirá os dados atuais do sistema pelos dados contidos neste pacote. Recomendamos exportar um backup do estado atual antes de prosseguir.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isRestoring ? 'Restaurando...' : 'Confirmar e Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
