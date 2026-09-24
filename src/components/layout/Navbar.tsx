import React from 'react';
import {
  Wallet,
  Bell,
  PlusCircle,
  Menu,
  LogOut,
  TrendingUp
} from 'lucide-react';
import { BankAccount, CompanyProfile, UserRole } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface NavbarProps {
  bankAccounts: BankAccount[];
  consolidatedBalance: number;
  companyProfile: CompanyProfile;
  onOpenCompanySettings: () => void;
  onOpenImport: () => void;
  onOpenNewTransaction: () => void;
  onToggleSidebar: () => void;
  pendingReconciliationCount: number;
  onResetData?: () => void;
  onRestoreSampleData?: () => void;
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
  onSignOut?: () => void;
  onEnableMaster?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  bankAccounts,
  consolidatedBalance,
  companyProfile,
  onOpenCompanySettings,
  onOpenImport,
  onOpenNewTransaction,
  onToggleSidebar,
  pendingReconciliationCount,
  onResetData,
  onRestoreSampleData,
  userRole = 'ADMINISTRADOR',
  userName,
  userEmail,
  onSignOut,
  onEnableMaster
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Card de Saúde do Caixa */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-zinc-900 font-semibold hover:text-zinc-950 font-bold hover:bg-zinc-100 rounded-lg cursor-pointer"
            title="Abrir menu lateral"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Card de Saúde do Caixa com fundo dinâmico */}
          <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl shadow-xs transition-all duration-200 ${
            consolidatedBalance >= 0
              ? 'bg-emerald-50/90 border-emerald-300/80 text-emerald-950'
              : 'bg-rose-50/90 border-rose-300/80 text-rose-950'
          }`}>
            <div className={`p-1.5 rounded-lg border transition-colors ${
              consolidatedBalance >= 0
                ? 'bg-emerald-500/20 text-emerald-700 border-emerald-300/50'
                : 'bg-rose-500/20 text-rose-700 border-rose-300/50'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${
                consolidatedBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                Saúde Caixa
              </div>
              <div className={`text-xs font-black ${
                consolidatedBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {consolidatedBalance >= 0 ? '🟢 Saudável' : '🔴 Atenção'}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Consolidated Quick Balance Widget com fundo dinâmico conforme a saúde */}
        <div className={`hidden md:flex items-center gap-3 px-4 py-1.5 border rounded-xl shadow-xs transition-all duration-200 ${
          consolidatedBalance >= 0
            ? 'bg-emerald-50/90 border-emerald-300/90 text-emerald-950 hover:bg-emerald-100/80'
            : 'bg-rose-50/90 border-rose-300/90 text-rose-950 hover:bg-rose-100/80'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border transition-colors ${
              consolidatedBalance >= 0
                ? 'bg-emerald-500/20 text-emerald-700 border-emerald-300/60'
                : 'bg-rose-500/20 text-rose-700 border-rose-300/60'
            }`}>
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  consolidatedBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
                }`}>
                  Saldo Consolidado
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${
                  consolidatedBalance >= 0
                    ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100/90 text-rose-800 border-rose-300'
                }`}>
                  {consolidatedBalance >= 0 ? '🟢 Saudável' : '🔴 Atenção'}
                </span>
              </div>
              <div className={`text-sm font-black tracking-tight ${
                consolidatedBalance >= 0 ? 'text-emerald-950' : 'text-rose-950'
              }`}>
                {formatCurrency(consolidatedBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Quick Balance Pill com fundo dinâmico conforme a saúde */}
        <div className={`flex md:hidden items-center gap-1.5 px-2.5 py-1 border rounded-xl text-right shrink-0 transition-all duration-200 ${
          consolidatedBalance >= 0
            ? 'bg-emerald-50/90 border-emerald-300/90 text-emerald-950'
            : 'bg-rose-50/90 border-rose-300/90 text-rose-950'
        }`}>
          <Wallet className={`w-3.5 h-3.5 shrink-0 ${
            consolidatedBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`} />
          <div className="flex flex-col text-right">
            <span className={`text-[8px] uppercase tracking-wider font-bold leading-none ${
              consolidatedBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              {consolidatedBalance >= 0 ? '🟢 Saldo' : '🔴 Saldo'}
            </span>
            <span className={`text-xs font-black leading-tight ${
              consolidatedBalance >= 0 ? 'text-emerald-950' : 'text-rose-950'
            }`}>
              {formatCurrency(consolidatedBalance)}
            </span>
          </div>
        </div>

        {/* Right: Quick Action, Pending badge & User Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* New Transaction: Hidden for CONSULTA (read-only) */}
          {userRole !== 'CONSULTA' && (
            <button
              onClick={onOpenNewTransaction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg shadow-sm border border-orange-500/30 transition-colors cursor-pointer"
              title="Novo lançamento manual"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Lançamento</span>
            </button>
          )}

          {pendingReconciliationCount > 0 && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 font-bold bg-amber-50 border border-amber-200 rounded-lg shadow-2xs"
              title={`${pendingReconciliationCount} lançamentos pendentes de conciliação`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span className="hidden md:inline">Pendentes:</span>
              <span className="font-bold">{pendingReconciliationCount}</span>
            </div>
          )}

          {/* User Info & Role Badge */}
          {userEmail && (
            <div className="hidden md:flex items-center gap-2.5 pl-2.5 border-l border-zinc-200">
              <div className="text-right">
                <div className="text-xs font-bold text-zinc-950 truncate max-w-[140px]">
                  {userName || userEmail}
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                      userRole === 'ADMINISTRADOR'
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : userRole === 'FINANCEIRO'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : userRole === 'OPERADOR'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-zinc-100 text-zinc-800 border border-zinc-300'
                    }`}
                  >
                    {userRole}
                  </span>
                  {userRole !== 'ADMINISTRADOR' && onEnableMaster && (
                    <button
                      onClick={onEnableMaster}
                      className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer"
                      title="Ativar privilégios de Administrador Master para esta conta"
                    >
                      👑 Ativar Master
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {onSignOut && (
            <button
              id="btn-navbar-signout"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Encerrar sessão no sistema"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600 hover:text-white" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

