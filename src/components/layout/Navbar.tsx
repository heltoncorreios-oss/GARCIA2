import React from 'react';
import {
  Building2,
  Wallet,
  Bell,
  UploadCloud,
  PlusCircle,
  Menu,
  Trash2,
  RotateCcw,
  Camera,
  Image as ImageIcon,
  Edit3,
  LogOut,
  UserCheck,
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
        {/* Left: Mobile Toggle & Health Status Card */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-zinc-900 font-semibold hover:text-zinc-950 font-bold hover:bg-zinc-100 rounded-lg cursor-pointer"
            title="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl shadow-xs">
            <div className={`p-1.5 rounded-lg ${
              consolidatedBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-zinc-800 uppercase tracking-wider">
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

        {/* Center: Consolidated Quick Balance Widget */}
        <div className="hidden md:flex items-center gap-6 px-4 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-500/10 text-orange-600 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-zinc-800 uppercase tracking-wider">
                Saldo Consolidado
              </div>
              <div className="text-sm font-bold text-zinc-950">
                {formatCurrency(consolidatedBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Quick Balance Pill */}
        <div className="flex md:hidden items-center gap-1.5 px-2.5 py-1 bg-zinc-100/90 border border-zinc-200 rounded-xl text-right shrink-0">
          <Wallet className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <div className="flex flex-col text-right">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold leading-none">Saldo</span>
            <span className="text-xs font-black text-zinc-950 leading-tight">
              {formatCurrency(consolidatedBalance)}
            </span>
          </div>
        </div>

        {/* Right: Actions, Reset, Demo & Pending badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {userRole === 'ADMINISTRADOR' && (
            <button
              onClick={onOpenCompanySettings}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 hover:text-orange-700 bg-slate-100 hover:bg-slate-200/80 border border-zinc-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Configurar Logotipo e Nome do Estabelecimento"
            >
              <ImageIcon className="w-3.5 h-3.5 text-orange-700 font-bold" />
              <span>Logo / Empresa</span>
            </button>
          )}

          {/* Import button: Only ADMINISTRADOR and FINANCEIRO */}
          {(userRole === 'ADMINISTRADOR' || userRole === 'FINANCEIRO') && (
            <button
              onClick={onOpenImport}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:text-zinc-950 bg-slate-100 hover:bg-slate-200/80 border border-zinc-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Importar extrato bancário"
            >
              <UploadCloud className="w-4 h-4 text-orange-600" />
              <span>Importar Extrato</span>
            </button>
          )}

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

          {/* Reset System: Only ADMINISTRADOR */}
          {userRole === 'ADMINISTRADOR' && onResetData && (
            <button
              onClick={onResetData}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Limpar todas as movimentações e deixar o sistema em branco para importar extrato real"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-700" />
              <span className="hidden sm:inline">Zerar Sistema</span>
            </button>
          )}

          {/* Restore Demo: Only ADMINISTRADOR */}
          {userRole === 'ADMINISTRADOR' && onRestoreSampleData && (
            <button
              onClick={onRestoreSampleData}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 bg-slate-100 hover:bg-slate-200/80 border border-zinc-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Restaurar movimentações de teste para demonstração"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-600" />
              <span>Restaurar Demo</span>
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

