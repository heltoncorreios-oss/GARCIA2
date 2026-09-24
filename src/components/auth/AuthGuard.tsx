import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, ShieldAlert, Clock, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { safeStorage } from '../../utils/safeStorage';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { session, user, profile, loading, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const savedProfile = React.useMemo(() => {
    try {
      const raw = safeStorage.getItem('supermarket_company_profile');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, []);

  // Enquanto a sessão está sendo checada, exibe tela de carregamento oficial e NUNCA o dashboard
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-zinc-950">
        <div className="w-full max-w-sm p-8 rounded-2xl border border-zinc-200 shadow-xl bg-white flex flex-col items-center text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-600/30">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-zinc-950 tracking-tight">
              {savedProfile?.name || 'Supermercado Central'}
            </h2>
            <p className="text-xs text-zinc-600 font-medium">
              {savedProfile?.subtitle || 'Gestão Financeira & Conciliação Bancária'}
            </p>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-700 font-semibold pt-2">
            <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
            <span>Validando credenciais e perfil de acesso...</span>
          </div>
        </div>
      </div>
    );
  }

  // Se não houver sessão ativa válida, redireciona imediatamente para /login
  if (!session || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 1. Tratamento de Usuário BLOQUEADO
  if (profile && profile.status === 'BLOQUEADO') {
    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-6 text-zinc-950">
        <div className="w-full max-w-md p-8 rounded-3xl border border-rose-300 shadow-2xl bg-white flex flex-col items-center text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-300">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold uppercase tracking-wider">
              Acesso Desativado
            </span>
            <h2 className="text-xl font-black text-zinc-950 pt-2 tracking-tight">
              Acesso Bloqueado
            </h2>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed max-w-xs mx-auto">
              Seu usuário foi desativado por um administrador do sistema. Entre em contato com a gerência para regularizar sua liberação.
            </p>
          </div>

          <div className="w-full p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left space-y-1 text-xs">
            <div className="text-zinc-500 font-medium">Conta:</div>
            <div className="font-bold text-zinc-900">{profile.email}</div>
            <div className="text-[11px] text-zinc-500">Nome: {profile.name}</div>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Tratamento de Usuário PENDENTE de Aprovação
  if (profile && profile.status === 'PENDENTE') {
    const handleCheckStatus = async () => {
      try {
        setIsRefreshing(true);
        await refreshProfile();
      } finally {
        setIsRefreshing(false);
      }
    };

    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-6 text-zinc-950">
        <div className="w-full max-w-md p-8 rounded-3xl border border-amber-300 shadow-2xl bg-white flex flex-col items-center text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-300">
            <Clock className="w-9 h-9" />
          </div>
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
              Aguardando Liberação
            </span>
            <h2 className="text-xl font-black text-zinc-950 pt-2 tracking-tight">
              Cadastro Pendente de Aprovação
            </h2>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed max-w-xs mx-auto">
              Seu cadastro foi realizado com sucesso através do convite de acesso. Para sua segurança e conformidade, um administrador do sistema precisa aprovar sua conta antes de liberar o acesso aos dados financeiros.
            </p>
          </div>

          <div className="w-full p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-zinc-600">
              <span>Nome:</span>
              <strong className="text-zinc-900">{profile.name}</strong>
            </div>
            <div className="flex justify-between items-center text-zinc-600">
              <span>E-mail:</span>
              <strong className="text-zinc-900">{profile.email}</strong>
            </div>
            <div className="flex justify-between items-center text-zinc-600">
              <span>Nível atribuído:</span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                {profile.role}
              </span>
            </div>
            {profile.inviteCode && (
              <div className="flex justify-between items-center text-zinc-600 pt-1 border-t border-zinc-200">
                <span>Convite utilizado:</span>
                <span className="font-mono font-bold text-orange-600">{profile.inviteCode}</span>
              </div>
            )}
          </div>

          <div className="w-full space-y-2 pt-2">
            <button
              onClick={handleCheckStatus}
              disabled={isRefreshing}
              className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Verificando...' : 'Verificar Status de Aprovação'}</span>
            </button>

            <button
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 text-zinc-600 hover:text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
