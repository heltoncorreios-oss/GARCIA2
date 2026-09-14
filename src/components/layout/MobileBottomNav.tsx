import React from 'react';
import {
  LayoutDashboard,
  Landmark,
  ReceiptText,
  UploadCloud,
  FileBarChart,
  Menu
} from 'lucide-react';
import { ActiveTab } from './Sidebar';
import { UserRole } from '../../types';

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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)]"
    >
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto items-center px-1">
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center h-full w-full transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-orange-600 font-bold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <div className="relative">
            <LayoutDashboard className="w-5 h-5" />
            {activeTab === 'dashboard' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-semibold leading-none">Início</span>
        </button>

        {/* 2. Saldo Consolidado */}
        <button
          type="button"
          onClick={() => onSelectTab('saldo-consolidado')}
          className={`flex flex-col items-center justify-center h-full w-full transition-colors cursor-pointer ${
            activeTab === 'saldo-consolidado'
              ? 'text-orange-600 font-bold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <div className="relative">
            <Landmark className="w-5 h-5" />
            {activeTab === 'saldo-consolidado' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-semibold leading-none">Saldos</span>
        </button>

        {/* 3. Lançamentos / Movimentações */}
        <button
          type="button"
          onClick={() => onSelectTab('movimentacoes')}
          className={`flex flex-col items-center justify-center h-full w-full transition-colors cursor-pointer relative ${
            activeTab === 'movimentacoes'
              ? 'text-orange-600 font-bold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <div className="relative">
            <ReceiptText className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 bg-amber-500 text-zinc-950 font-bold text-[9px] rounded-full flex items-center justify-center shadow-xs">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
            {activeTab === 'movimentacoes' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-semibold leading-none">Extrato</span>
        </button>

        {/* 4. Importar ou Relatórios */}
        {canImport ? (
          <button
            type="button"
            onClick={() => onSelectTab('importar')}
            className={`flex flex-col items-center justify-center h-full w-full transition-colors cursor-pointer ${
              activeTab === 'importar'
                ? 'text-orange-600 font-bold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <div className="relative">
              <UploadCloud className="w-5 h-5" />
              {activeTab === 'importar' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-600 rounded-full" />
              )}
            </div>
            <span className="text-[10px] mt-1 font-semibold leading-none">Importar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectTab('relatorios')}
            className={`flex flex-col items-center justify-center h-full w-full transition-colors cursor-pointer ${
              activeTab === 'relatorios'
                ? 'text-orange-600 font-bold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <div className="relative">
              <FileBarChart className="w-5 h-5" />
              {activeTab === 'relatorios' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-600 rounded-full" />
              )}
            </div>
            <span className="text-[10px] mt-1 font-semibold leading-none">Relatórios</span>
          </button>
        )}

        {/* 5. Menu Lateral Completo */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex flex-col items-center justify-center h-full w-full transition-colors cursor-pointer text-zinc-500 hover:text-zinc-800"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-semibold leading-none">Mais</span>
        </button>
      </div>
    </nav>
  );
};
