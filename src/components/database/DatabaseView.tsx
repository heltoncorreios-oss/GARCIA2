import React, { useState, useEffect } from 'react';
import { Database, Copy, Check, Terminal, Trash2, RotateCcw, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Github } from 'lucide-react';
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
  const [checkingSupabase, setCheckingSupabase] = useState<boolean>(false);

  const checkSupabase = async () => {
    try {
      setCheckingSupabase(true);
      const st = await apiService.getSupabaseStatus();
      setSupabaseStatus(st);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingSupabase(false);
    }
  };

  useEffect(() => {
    const fetchSQL = async () => {
      try {
        setIsLoading(true);
        const [script, st] = await Promise.all([
          apiService.getSchemaSQL(),
          apiService.getSupabaseStatus()
        ]);
        setSql(script);
        setSupabaseStatus(st);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSQL();
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
            Arquitetura de Dados PostgreSQL & Supabase
          </h2>
          <p className="text-xs text-zinc-600 font-medium mt-0.5">
            Gerenciamento de banco de dados relacional, migração de repositório e script DDL completo
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

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar DDL Completo'}</span>
          </button>
        </div>
      </div>

      {/* Supabase & GitHub Migration Assistant Card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950">Status de Conexão com o Supabase (Troca de Repositório GitHub)</h3>
              <p className="text-xs text-zinc-600">
                Ao alterar o repositório no GitHub ou migrar de ambiente, certifique-se de atualizar as credenciais do Supabase.
              </p>
            </div>
          </div>

          <button
            onClick={checkSupabase}
            disabled={checkingSupabase}
            className="px-3.5 py-2 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingSupabase ? 'animate-spin' : ''}`} />
            <span>Testar Conexão</span>
          </button>
        </div>

        {supabaseStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${supabaseStatus.configured ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'}`}>
              {supabaseStatus.configured ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              <div>
                <div className="text-xs font-bold">Variáveis de Ambiente</div>
                <div className="text-[11px] opacity-90">{supabaseStatus.configured ? 'Configuradas corretamente' : 'Ausentes ou incompletas'}</div>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${supabaseStatus.connected ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
              {supabaseStatus.connected ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
              <div>
                <div className="text-xs font-bold">Conexão com API Supabase</div>
                <div className="text-[11px] opacity-90">{supabaseStatus.connected ? 'Conectado com sucesso' : (supabaseStatus.error || 'Falha na conexão')}</div>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${supabaseStatus.tablesReady ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-zinc-50 border-zinc-300 text-zinc-800'}`}>
              {supabaseStatus.tablesReady ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-zinc-500 shrink-0" />}
              <div>
                <div className="text-xs font-bold">Tabelas no Banco</div>
                <div className="text-[11px] opacity-90">{supabaseStatus.tablesReady ? 'Prontas e operacionais' : 'Executar script DDL'}</div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 space-y-2">
          <div className="font-bold text-zinc-950 flex items-center gap-1.5">
            <Github className="w-4 h-4 text-zinc-900" />
            <span>Como corrigir o acesso após trocar de repositório no GitHub:</span>
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-zinc-600">
            <li>Acesse o painel do seu projeto no <strong>Supabase</strong> (Project Settings &gt; API) para obter a nova <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-300 font-mono text-[11px]">SUPABASE_URL</code> e <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-300 font-mono text-[11px]">SUPABASE_ANON_KEY</code>.</li>
            <li>Adicione essas credenciais nas configurações de segredos / variáveis de ambiente do seu novo repositório ou plataforma de deploy (ou arquivo <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-300 font-mono text-[11px]">.env</code>).</li>
            <li>Copie o script DDL abaixo e execute-o no <strong>SQL Editor</strong> do seu Supabase para recriar as tabelas de contas, transações e perfis.</li>
          </ol>
        </div>
      </div>

      {/* Schema Highlights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-zinc-500 uppercase">Tabelas Relacionais</div>
          <div className="text-xl font-extrabold text-zinc-950 mt-1">8 Tabelas</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            transactions, bank_accounts, categories, rules...
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-zinc-500 uppercase">Antiduplicação</div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">SHA-256 Hash</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            UNIQUE(transaction_hash, bank_account_id)
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-zinc-500 uppercase">Gatilhos / Triggers</div>
          <div className="text-xl font-extrabold text-blue-600 mt-1">Saldos Automáticos</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Atualização atômica em insert/update/delete
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-zinc-500 uppercase">Segurança & RLS</div>
          <div className="text-xl font-extrabold text-purple-700 mt-1">Políticas Ativas</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Controle de acesso por papéis (RBAC)
          </div>
        </div>
      </div>

      {/* SQL Code Box */}
      <div className="bg-white text-zinc-950 rounded-2xl border border-zinc-200 shadow-xl overflow-hidden">
        <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-700 font-semibold">
            <Terminal className="w-4 h-4 text-orange-600" />
            <span className="font-mono text-zinc-950 font-bold">database/schema.sql</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-medium">PostgreSQL 14+ / Supabase / Neon / RDS</span>
        </div>

        <pre className="p-5 overflow-x-auto text-xs font-mono text-zinc-800 leading-relaxed max-h-[600px] select-all">
          {isLoading ? 'Carregando script SQL...' : sql}
        </pre>
      </div>
    </div>
  );
};
