import React from 'react';
import { Menu } from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { UserRole } from '../../types';
import {
  Icon3DDashboard,
  Icon3DSaldoConsolidado,
  Icon3DMovimentacoes,
  Icon3DImportarExtrato,
  Icon3DRelatorios
} from './Glowing3DIcons';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onToggleSidebar: () => void;
  pendingCount?: number;
  userRole?: UserRole;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onToggleSidebar,
  pendingCount = 0,
  userRole = 'ADMINISTRADOR'
}) => {
  const canImport = userRole === 'ADMINISTRADOR' || userRole === 'FINANCEIRO';

  return (
    <nav
      aria-label="Navegação móvel"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d14]/95 backdrop-blur-md border-t border-white/10 lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.4)] pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)]"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto items-center px-1">
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-sky-400 font-bold scale-105'
              : 'text-zinc-400 hover:text-zinc-100 opacity-70'
          }`}
        >
          <div className="relative">
            <Icon3DDashboard className="w-6 h-6" />
            {activeTab === 'dashboard' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-400 rounded-full shadow-[0_0_6px_#38bdf8]" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-semibold leading-none">Início</span>
        </button>

        {/* 2. Saldo Consolidado */}
        <button
          type="button"
          onClick={() => onSelectTab('saldo-consolidado')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all cursor-pointer ${
            activeTab === 'saldo-consolidado'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-zinc-400 hover:text-zinc-100 opacity-70'
          }`}
        >
          <div className="relative">
            <Icon3DSaldoConsolidado className="w-6 h-6" />
            {activeTab === 'saldo-consolidado' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_6px_#f59e0b]" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-semibold leading-none">Saldos</span>
        </button>

        {/* 3. Lançamentos / Movimentações */}
        <button
          type="button"
          onClick={() => onSelectTab('movimentacoes')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all cursor-pointer relative ${
            activeTab === 'movimentacoes'
              ? 'text-cyan-400 font-bold scale-105'
              : 'text-zinc-400 hover:text-zinc-100 opacity-70'
          }`}
        >
          <div className="relative">
            <Icon3DMovimentacoes className="w-6 h-6" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 bg-cyan-500 text-zinc-950 font-bold text-[9px] rounded-full flex items-center justify-center shadow-xs">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
            {activeTab === 'movimentacoes' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_6px_#06b6d4]" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-semibold leading-none">Extrato</span>
        </button>

        {/* 4. Importar ou Relatórios */}
        {canImport ? (
          <button
            type="button"
            onClick={() => onSelectTab('importar')}
            className={`flex flex-col items-center justify-center h-full w-full transition-all cursor-pointer ${
              activeTab === 'importar'
                ? 'text-emerald-400 font-bold scale-105'
                : 'text-zinc-400 hover:text-zinc-100 opacity-70'
            }`}
          >
            <div className="relative">
              <Icon3DImportarExtrato className="w-6 h-6" />
              {activeTab === 'importar' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_#10b981]" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-semibold leading-none">Importar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectTab('relatorios')}
            className={`flex flex-col items-center justify-center h-full w-full transition-all cursor-pointer ${
              activeTab === 'relatorios'
                ? 'text-fuchsia-400 font-bold scale-105'
                : 'text-zinc-400 hover:text-zinc-100 opacity-70'
            }`}
          >
            <div className="relative">
              <Icon3DRelatorios className="w-6 h-6" />
              {activeTab === 'relatorios' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-fuchsia-400 rounded-full shadow-[0_0_6px_#c026d3]" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-semibold leading-none">Relatórios</span>
          </button>
        )}

        {/* 5. Menu Lateral Completo */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex flex-col items-center justify-center h-full w-full text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5 text-zinc-300" />
          <span className="text-[10px] mt-0.5 font-semibold leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
};
