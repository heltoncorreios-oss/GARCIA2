import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  CalendarDays,
  UploadCloud,
  CheckCheck,
  CreditCard,
  Landmark,
  Tags,
  Sliders,
  FileBarChart,
  Database,
  X,
  Building2,
  Camera,
  Trash2,
  RotateCcw,
  LogOut,
  Users,
  ShieldCheck
} from 'lucide-react';
import { CompanyProfile, UserRole } from '../../types';

export type ActiveTab =
  | 'dashboard'
  | 'saldo-consolidado'
  | 'movimentacoes'
  | 'importar'
  | 'relatorios'
  | 'usuarios'
  | 'database';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isOpen: boolean;
  onClose: () => void;
  pendingCount?: number;
  duplicateCount?: number;
  companyProfile?: CompanyProfile;
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
  onOpenCompanySettings?: () => void;
  onResetData?: () => void;
  onRestoreSampleData?: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  pendingCount = 0,
  duplicateCount = 0,
  companyProfile,
  userRole = 'ADMINISTRADOR',
  userName,
  userEmail,
  onOpenCompanySettings,
  onResetData,
  onRestoreSampleData,
  onSignOut
}) => {
  const allMenuItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
    roles?: UserRole[];
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'saldo-consolidado', label: 'Saldo Consolidado', icon: Landmark },
    { id: 'movimentacoes', label: 'Movimentações', icon: ReceiptText },
    { id: 'importar', label: 'Importar Extrato', icon: UploadCloud, roles: ['ADMINISTRADOR', 'FINANCEIRO'] },
    { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
    { id: 'usuarios', label: 'Usuários & Convites', icon: Users, roles: ['ADMINISTRADOR'] },
    { id: 'database', label: 'Banco de Dados (DDL)', icon: Database, roles: ['ADMINISTRADOR'] }
  ];

  // Filtra itens de menu de acordo com o nível de acesso do usuário ativo (Req 10)
  const menuItems = allMenuItems.filter((item) => {
    if (!item.roles) return true;
    return (item.roles as string[]).includes(userRole);
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0a0a0d] text-zinc-200 border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 lg:z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header inside sidebar */}
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-xs shadow-orange-500/50 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Varejo & Supermercado
              </span>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Logo Box in Sidebar */}
          {companyProfile && (
            <div
              onClick={onOpenCompanySettings}
              className="p-2 rounded-xl bg-[#121216] border border-white/5 hover:border-orange-500/30 flex items-center justify-center cursor-pointer group transition-all h-16"
              title="Clique para adicionar/alterar o logotipo"
            >
              <div className="relative w-full h-full rounded-lg bg-[#18181c] border border-dashed border-white/10 flex items-center justify-center overflow-hidden">
                {companyProfile.logoUrl ? (
                  <img
                    src={companyProfile.logoUrl}
                    alt="Logotipo"
                    className="w-full h-full object-contain p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase group-hover:text-orange-400 transition-colors">
                    + Logotipo
                  </span>
                )}
                {companyProfile.logoUrl && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-4 h-4 text-orange-400" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-orange-600/15 text-orange-400 border border-orange-500/30 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-orange-400' : 'text-zinc-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      isActive
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : item.badgeColor || 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Botão Sair Obrigatório */}
          {onSignOut && (
            <div className="pt-2 mt-2 border-t border-white/10">
              <button
                id="btn-sidebar-signout"
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-100 hover:bg-rose-600/20 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                title="Encerrar sessão com segurança"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Sair do Sistema</span>
                </div>
              </button>
            </div>
          )}
        </nav>

        {/* Supermarket info footer card and Development Reset Tools */}
        <div className="p-3 border-t border-white/5 bg-[#0e0e12] space-y-2">
          {/* User profile capsule in sidebar */}
          {userEmail && (
            <div className="p-2.5 rounded-xl bg-[#141418] border border-white/5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-zinc-200 truncate max-w-[130px]">
                  {userName || userEmail}
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                    userRole === 'ADMINISTRADOR'
                      ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30'
                      : userRole === 'FINANCEIRO'
                      ? 'bg-blue-900/50 text-blue-300 border border-blue-500/30'
                      : userRole === 'OPERADOR'
                      ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}
                >
                  {userRole}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 truncate mt-0.5">{userEmail}</div>
            </div>
          )}

          {/* Reset System and Demo tools (ADMINISTRADOR ONLY) */}
          {userRole === 'ADMINISTRADOR' && onResetData && (
            <button
              onClick={() => {
                onResetData();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600/30 border border-rose-500/25 hover:border-rose-500/50 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Limpar todas as movimentações e deixar o sistema em branco para importar extrato real"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Zerar Sistema</span>
            </button>
          )}

          {userRole === 'ADMINISTRADOR' && onRestoreSampleData && (
            <button
              onClick={() => {
                onRestoreSampleData();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-lg transition-colors cursor-pointer"
              title="Restaurar movimentações de teste para demonstração"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Restaurar Dados Demo</span>
            </button>
          )}

          <div className="p-2.5 rounded-xl bg-[#141418] border border-white/5 text-xs">
            <div className="font-semibold text-zinc-200 text-[11px]">
              Módulo Bancário Ativo
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
              Leitura automática de OFX, CSV, XLSX e conciliação diária.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

