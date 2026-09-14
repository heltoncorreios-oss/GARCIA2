import React, { useState, useEffect } from 'react';
import { Database, Copy, Check, Terminal, Trash2, RotateCcw, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Github, Download, HardDrive, Server } from 'lucide-react';
import { apiService } from '../../services/api';

interface DatabaseViewProps {
  onResetData?: () => void;
  onRestoreSampleData?: () => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  onResetData,
  onRestoreSampleData
}) => {
  const [sql, setSql] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [sqliteStatus, setSqliteStatus] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [inputUrl, setInputUrl] = useState<string>('');
  const [inputAnonKey, setInputAnonKey] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setConfigError(null);
      setConfigSuccess(null);
      const res = await apiService.configureSupabase({
        supabaseUrl: inputUrl,
        supabaseAnonKey: inputAnonKey
      });
      if (res.success) {
        setConfigSuccess('Supabase configurado e conectado com sucesso!');
        await checkStatus();
      } else {
        setConfigError(res.error || 'Erro ao conectar ao Supabase.');
      }
    } catch (err: any) {
      setConfigError(err.message || 'Erro ao configurar Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const checkStatus = async () => {
    try {
      setCheckingStatus(true);
      const [supa, lite] = await Promise.all([
        apiService.getSupabaseStatus(),
        apiService.getSqliteStatus().catch(() => null)
      ]);
      setSupabaseStatus(supa);
      setSqliteStatus(lite);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [script, supa, lite] = await Promise.all([
          apiService.getSchemaSQL(),
          apiService.getSupabaseStatus(),
          apiService.getSqliteStatus().catch(() => null)
        ]);
        setSql(script);
        setSupabaseStatus(supa);
        setSqliteStatus(lite);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-black shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-orange-700" />
            Banco de Dados & Persistência Local (SQLite)
          </h2>
          <p className="text-xs text-zinc-600 font-medium mt-0.5">
            Armazenamento relacional local nativo (SQLite), backup e sincronização em nuvem
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onResetData && (
            <button
              onClick={onResetData}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Limpar todas as movimentações e deixar o sistema em branco"
            >
              <Trash2 className="w-4 h-4 text-rose-700" />
              <span>Zerar Sistema</span>
            </button>
          )}

          {onRestoreSampleData && (
            <button
              onClick={onRestoreSampleData}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded-xl border border-zinc-300 transition-colors cursor-pointer"
              title="Restaurar dados de demonstração"
            >
              <RotateCcw className="w-4 h-4 text-zinc-700" />
              <span>Restaurar Demo</span>
            </button>
          )}

          <a
            href="/api/sqlite/download"
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            title="Baixar arquivo supermarket.sqlite completo para backup local"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Baixar Banco SQLite</span>
          </a>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar DDL'}</span>
          </button>
        </div>
      </div>

      {/* SQLite Local Engine Card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-950">Motor de Banco de Dados Local: SQLite</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">ATIVO & PERSISTENTE</span>
              </div>
              <p className="text-xs text-zinc-600">
                O sistema roda de forma independente com banco de dados SQLite local, garantindo integridade ACID e modo WAL.
              </p>
            </div>
          </div>

          <button
            onClick={checkStatus}
            disabled={checkingStatus}
            className="px-3.5 py-2 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
            <span>Atualizar Status</span>
          </button>
        </div>

        {sqliteStatus && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border bg-emerald-50 border-emerald-300 text-emerald-950 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Status do SQLite</div>
                  <div className="text-[11px] text-emerald-800 font-medium">Online (WAL Mode)</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-zinc-50 border-zinc-200 text-zinc-900 flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-zinc-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Tamanho do Arquivo</div>
                  <div className="text-[11px] text-zinc-600 font-medium">{sqliteStatus.sizeFormatted || '0 B'}</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-zinc-50 border-zinc-200 text-zinc-900 flex items-center gap-3">
                <Server className="w-5 h-5 text-zinc-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Transações Gravadas</div>
                  <div className="text-[11px] text-zinc-600 font-medium">{sqliteStatus.tables?.transactions ?? 0} registros</div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-mono text-[11px] text-zinc-800 truncate">
                <span className="font-bold text-zinc-950 mr-1">Caminho:</span>
                {sqliteStatus.path || 'data/supermarket.sqlite'}
              </div>
              <a
                href="/api/sqlite/download"
                download
                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-900 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar cópia .sqlite</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Supabase & Cloud Sync Card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950">Nuvem & Backup Supabase (Opcional)</h3>
              <p className="text-xs text-zinc-600">
                Se desejar sincronização com PostgreSQL na nuvem além do SQLite local, configure as credenciais.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={checkStatus}
              disabled={checkingStatus}
              className="px-3.5 py-2 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span>Testar Conexão</span>
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3.5 py-2 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer"
            >
              {showConfig ? 'Fechar' : '⚙️ Configurar Nuvem'}
            </button>
          </div>
        </div>

        {showConfig && (
          <form onSubmit={handleSaveConfig} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-zinc-950">Configurar Credenciais do Supabase no Servidor</h4>
            <p className="text-[11px] text-zinc-600">
              Isso salvará as credenciais no arquivo .env do servidor, garantindo conexão ativa tanto no preview quanto ao abrir em qualquer aba ou navegador.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Supabase URL</label>
              <input
                type="text"
                placeholder="https://seu-projeto.supabase.co"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Supabase Anon / Public Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                value={inputAnonKey}
                onChange={e => setInputAnonKey(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white font-mono"
                required
              />
            </div>
            {configError && <div className="text-xs text-rose-600 font-semibold">{configError}</div>}
            {configSuccess && <div className="text-xs text-emerald-600 font-semibold">{configSuccess}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Salvando e testando...' : 'Salvar e Conectar'}
              </button>
            </div>
          </form>
        )}

        {supabaseStatus && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${supabaseStatus.configured ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-zinc-50 border-zinc-300 text-zinc-700'}`}>
                {supabaseStatus.configured ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-zinc-400 shrink-0" />}
                <div>
                  <div className="text-xs font-bold">Variáveis de Ambiente</div>
                  <div className="text-[11px] opacity-90">{supabaseStatus.configured ? 'Configuradas' : 'Não configuradas (Modo 100% Local)'}</div>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${supabaseStatus.connected ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-zinc-50 border-zinc-300 text-zinc-700'}`}>
                {supabaseStatus.connected ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-zinc-400 shrink-0" />}
                <div>
                  <div className="text-xs font-bold">Conexão Nuvem</div>
                  <div className="text-[11px] opacity-90">{supabaseStatus.connected ? 'Conectado com sucesso' : 'Usando SQLite localmente'}</div>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${supabaseStatus.tablesReady ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-zinc-50 border-zinc-300 text-zinc-700'}`}>
                {supabaseStatus.tablesReady ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-zinc-400 shrink-0" />}
                <div>
                  <div className="text-xs font-bold">Tabelas Nuvem</div>
                  <div className="text-[11px] opacity-90">{supabaseStatus.tablesReady ? 'Sincronizadas' : 'Opcional'}</div>
                </div>
              </div>
            </div>

            {supabaseStatus.configured && !supabaseStatus.connected && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2">
                <div className="font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Atenção: Variáveis configuradas, mas as tabelas ainda não foram criadas no Supabase.</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {supabaseStatus.error ? `Detalhe do erro: ${supabaseStatus.error}` : 'Para habilitar a sincronização em nuvem, copie o script SQL abaixo e execute-o na aba "SQL Editor" do seu painel do Supabase.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SQL Code Box */}
      <div className="bg-white text-zinc-950 rounded-2xl border border-zinc-200 shadow-xl overflow-hidden">
        <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-700 font-semibold">
            <Terminal className="w-4 h-4 text-orange-600" />
            <span className="font-mono text-zinc-950 font-bold">database/schema.sql</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-medium">Estrutura de Tabelas & Migração</span>
        </div>

        <pre className="p-5 overflow-x-auto text-xs font-mono text-zinc-800 leading-relaxed max-h-[600px] select-all">
          {isLoading ? 'Carregando script SQL...' : sql}
        </pre>
      </div>
    </div>
  );
};
