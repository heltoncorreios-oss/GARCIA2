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
  UserCheck
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
  onSignOut
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand (With Logo Slot & Customization Trigger) */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-zinc-900 font-semibold hover:text-zinc-950 font-bold hover:bg-zinc-100 rounded-lg"
            title="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={onOpenCompanySettings}
            className="flex items-center gap-3 group cursor-pointer p-1.5 -m-1.5 rounded-xl hover:bg-zinc-100 transition-all"
            title="Clique para alterar o Logotipo e Nome do Estabelecimento"
          >
            {/* Logo Slot */}
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-md shadow-orange-950/20 overflow-hidden border border-orange-600/20 shrink-0">
              {companyProfile.logoUrl ? (
                <img
                  src={companyProfile.logoUrl}
                  alt={companyProfile.name}
                  className="w-full h-full object-contain p-1 bg-white"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Building2 className="w-5 h-5 group-hover:scale-105 transition-transform" />
              )}
              {/* Hover overlay with camera icon */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-4 h-4 text-orange-700 font-bold" />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-zinc-950 font-bold tracking-tight leading-none group-hover:text-orange-600 transition-colors">
                  {companyProfile.name || 'Supermercado Central'}
                </h1>
                {companyProfile.badge && (
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 text-[9px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20 rounded">
                    {companyProfile.badge}
                  </span>
                )}
                <span className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-800 font-medium flex items-center gap-0.5 transition-opacity hidden md:inline-flex">
                  <Edit3 className="w-3 h-3 text-orange-700 font-bold" />
                  <span>Editar</span>
                </span>
              </div>
              <p className="text-xs text-zinc-800 font-medium leading-tight mt-0.5">
                {companyProfile.subtitle || 'Gestão Financeira'}
              </p>
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
              <div className="text-[11px] font-medium text-zinc-800 font-medium uppercase tracking-wider">
                Saldo Consolidado
              </div>
              <div className="text-sm font-bold text-zinc-950 font-bold">
                {formatCurrency(consolidatedBalance)}
              </div>
            </div>
          </div>

          <div className="h-7 w-px bg-zinc-200" />
        </div>

        {/* Right: Actions, Reset, Demo & Pending badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {userRole === 'ADMINISTRADOR' && (
            <button
              onClick={onOpenCompanySettings}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 font-bold hover:text-orange-700 bg-white/[0.04] hover:bg-white/[0.08] border border-black rounded-lg transition-colors cursor-pointer"
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
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-950 font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-black rounded-lg transition-colors cursor-pointer"
              title="Importar extrato bancário"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Importar Extrato</span>
            </button>
          )}

          {/* New Transaction: Hidden for CONSULTA (read-only) */}
          {userRole !== 'CONSULTA' && (
            <button
              onClick={onOpenNewTransaction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg shadow-md shadow-orange-950/40 border border-orange-500/30 transition-colors cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 font-bold hover:text-white bg-rose-500/10 hover:bg-rose-600/30 border border-black rounded-lg transition-colors cursor-pointer"
              title="Limpar todas as movimentações e deixar o sistema em branco para importar extrato real"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-700 font-bold" />
              <span className="hidden sm:inline">Zerar Sistema</span>
            </button>
          )}

          {/* Restore Demo: Only ADMINISTRADOR */}
          {userRole === 'ADMINISTRADOR' && onRestoreSampleData && (
            <button
              onClick={onRestoreSampleData}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-900 font-semibold hover:text-zinc-950 font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-black rounded-lg transition-colors cursor-pointer"
              title="Restaurar movimentações de teste para demonstração"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-900 font-semibold" />
              <span>Restaurar Demo</span>
            </button>
          )}

          {pendingReconciliationCount > 0 && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 font-bold bg-amber-500/10 border border-black rounded-lg"
              title={`${pendingReconciliationCount} lançamentos pendentes de conciliação`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-700 font-bold animate-pulse" />
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
                </div>
              </div>
            </div>
          )}

          {onSignOut && (
            <button
              id="btn-navbar-signout"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-800 hover:text-white bg-rose-50 hover:bg-rose-700 border border-black rounded-lg transition-colors cursor-pointer shadow-xs"
              title="Encerrar sessão no sistema"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-700 hover:text-white" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

