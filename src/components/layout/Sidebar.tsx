import React from 'react';
import {
  X,
  Camera,
  Trash2,
  RotateCcw,
  ChevronDown,
  Users,
  Database,
  ShieldCheck
} from 'lucide-react';
import { CompanyProfile, UserRole } from '../../types';
import {
  Icon3DDashboard,
  Icon3DSaldoConsolidado,
  Icon3DMovimentacoes,
  Icon3DImportarExtrato,
  Icon3DRelatorios,
  Icon3DAdministracao,
  Icon3DSairDoSistema
} from './Glowing3DIcons';

export type ActiveTab =
  | 'dashboard'
  | 'saldo-consolidado'
  | 'movimentacoes'
  | 'importar'
  | 'relatorios'
  | 'usuarios'
  | 'database'
  | 'backup';

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
  // Configuração dos itens operacionais com os novos ícones 3D destacados
  const operationalItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon3D: Icon3DDashboard,
      activeBorder: 'border-sky-400',
      inactiveBorder: 'border-sky-500/30 hover:border-sky-400',
      activeBg: 'bg-gradient-to-r from-sky-950/80 to-blue-950/40',
      activeShadow: 'shadow-[0_0_16px_rgba(56,189,248,0.45)]',
      hoverShadow: 'hover:shadow-[0_0_12px_rgba(56,189,248,0.25)]'
    },
    {
      id: 'saldo-consolidado' as ActiveTab,
      label: 'Saldo Consolidado',
      icon3D: Icon3DSaldoConsolidado,
      activeBorder: 'border-amber-400',
      inactiveBorder: 'border-amber-500/30 hover:border-amber-400',
      activeBg: 'bg-gradient-to-r from-amber-950/80 to-yellow-950/40',
      activeShadow: 'shadow-[0_0_16px_rgba(245,158,11,0.45)]',
      hoverShadow: 'hover:shadow-[0_0_12px_rgba(245,158,11,0.25)]'
    },
    {
      id: 'movimentacoes' as ActiveTab,
      label: 'Movimentações',
      icon3D: Icon3DMovimentacoes,
      activeBorder: 'border-cyan-400',
      inactiveBorder: 'border-cyan-500/30 hover:border-cyan-400',
      activeBg: 'bg-gradient-to-r from-cyan-950/80 to-blue-950/40',
      activeShadow: 'shadow-[0_0_16px_rgba(34,211,238,0.45)]',
      hoverShadow: 'hover:shadow-[0_0_12px_rgba(34,211,238,0.25)]',
      badge: pendingCount > 0 ? pendingCount : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
    },
    {
      id: 'importar' as ActiveTab,
      label: 'Importar Extrato',
      icon3D: Icon3DImportarExtrato,
      activeBorder: 'border-emerald-400',
      inactiveBorder: 'border-emerald-500/30 hover:border-emerald-400',
      activeBg: 'bg-gradient-to-r from-emerald-950/80 to-teal-950/40',
      activeShadow: 'shadow-[0_0_16px_rgba(52,211,153,0.45)]',
      hoverShadow: 'hover:shadow-[0_0_12px_rgba(52,211,153,0.25)]',
      roles: ['ADMINISTRADOR', 'FINANCEIRO'] as UserRole[]
    },
    {
      id: 'relatorios' as ActiveTab,
      label: 'Relatórios',
      icon3D: Icon3DRelatorios,
      activeBorder: 'border-fuchsia-400',
      inactiveBorder: 'border-fuchsia-500/30 hover:border-fuchsia-400',
      activeBg: 'bg-gradient-to-r from-fuchsia-950/80 to-purple-950/40',
      activeShadow: 'shadow-[0_0_16px_rgba(217,70,239,0.45)]',
      hoverShadow: 'hover:shadow-[0_0_12px_rgba(217,70,239,0.25)]'
    }
  ].filter((item) => {
    if (!item.roles) return true;
    return (item.roles as string[]).includes(userRole);
  });

  const adminSubItems = [
    { id: 'usuarios' as ActiveTab, label: 'Usuários & Convites', icon: Users, roles: ['ADMINISTRADOR'] as UserRole[] },
    { id: 'database' as ActiveTab, label: 'Banco de Dados (DDL)', icon: Database, roles: ['ADMINISTRADOR'] as UserRole[] },
    { id: 'backup' as ActiveTab, label: 'Backup & Recovery', icon: ShieldCheck, roles: ['ADMINISTRADOR'] as UserRole[] }
  ].filter((item) => (item.roles as string[]).includes(userRole));

  const [isAdminOpen, setIsAdminOpen] = React.useState<boolean>(
    ['usuarios', 'database', 'backup'].includes(activeTab)
  );

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
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#090a0f] text-zinc-200 border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 lg:z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header inside sidebar - Compact layout */}
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center justify-between gap-2">
            {companyProfile && (
              <div
                onClick={onOpenCompanySettings}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded-xl hover:bg-white/[0.04] cursor-pointer group transition-all min-w-0 flex-1"
                title="Clique para alterar o logotipo e nome da empresa"
              >
                <div className="relative w-8 h-8 rounded-lg bg-[#141722] border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                  {companyProfile.logoUrl ? (
                    <img
                      src={companyProfile.logoUrl}
                      alt="Logotipo"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Camera className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs font-bold text-zinc-100 group-hover:text-orange-400 transition-colors truncate leading-tight">
                    {companyProfile.name || 'Supermercado Central'}
                  </h2>
                  <span className="text-[10px] text-zinc-500 block truncate">Módulo Financeiro</span>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="lg:hidden p-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {operationalItems.map((item) => {
            const Icon3D = item.icon3D;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-150 cursor-pointer group relative ${
                  isActive
                    ? `${item.activeBg} ${item.activeBorder} ${item.activeShadow} border`
                    : `bg-[#0d0f17]/90 ${item.inactiveBorder} ${item.hoverShadow} border hover:bg-[#131722]`
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* 3D Glowing Icon - Ajustado para encaixe perfeito */}
                  <div className="relative shrink-0 flex items-center justify-center w-7 h-7 group-hover:scale-105 transition-transform duration-200">
                    <Icon3D className="w-7 h-7 drop-shadow-sm" />
                  </div>

                  {/* Nome da aba */}
                  <span
                    className={`text-xs font-semibold tracking-tight truncate ${
                      isActive ? 'text-white font-bold' : 'text-zinc-200 group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full shrink-0 ml-1 ${
                      isActive
                        ? 'bg-white/20 text-white border border-white/30'
                        : item.badgeColor || 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Admin Collapsible Section with 3D Gear Cog & Violet Glow */}
          {adminSubItems.length > 0 && (
            <div className="pt-1.5 mt-1.5 border-t border-white/5 space-y-1">
              <button
                onClick={() => setIsAdminOpen(!isAdminOpen)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer group ${
                  isAdminOpen || ['usuarios', 'database', 'backup'].includes(activeTab)
                    ? 'bg-gradient-to-r from-purple-950/80 to-violet-950/40 border-purple-500 border shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                    : 'bg-[#0d0f17]/90 border-purple-500/30 hover:border-purple-400 hover:shadow-[0_0_8px_rgba(168,85,247,0.2)] hover:bg-[#131722]'
                }`}
                title="Configurações Avançadas e Administração"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0 flex items-center justify-center w-7 h-7 group-hover:scale-105 transition-transform duration-200">
                    <Icon3DAdministracao className="w-7 h-7 drop-shadow-sm" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-100 group-hover:text-white truncate">
                    Administração
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-purple-400 transition-transform duration-200 shrink-0 ml-1 ${
                    isAdminOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isAdminOpen && (
                <div className="pl-3 space-y-1 pt-1">
                  {adminSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-purple-600/25 text-purple-200 border border-purple-400/50 shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`w-3.5 h-3.5 ${
                              isActive ? 'text-purple-300' : 'text-zinc-500'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Zerar Sistema (Exclusivo Administrador na lateral) */}
                  {userRole === 'ADMINISTRADOR' && onResetData && (
                    <button
                      onClick={() => {
                        onResetData();
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-500/15 border border-rose-500/25 hover:border-rose-500/40 transition-all cursor-pointer mt-1"
                      title="Limpar todas as movimentações e deixar o sistema em branco para importar extrato real"
                    >
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span className="truncate">Zerar Sistema</span>
                      </div>
                    </button>
                  )}

                  {/* Restaurar Dados Demo (Exclusivo Administrador na lateral) */}
                  {userRole === 'ADMINISTRADOR' && onRestoreSampleData && (
                    <button
                      onClick={() => {
                        onRestoreSampleData();
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent transition-all cursor-pointer"
                      title="Restaurar movimentações de teste para demonstração"
                    >
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="truncate">Restaurar Dados Demo</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Botão Sair do Sistema com 3D Red Exit Door Portal & Arrow */}
          {onSignOut && (
            <div className="pt-1.5 mt-1.5 border-t border-white/10">
              <button
                id="btn-sidebar-signout"
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#0d0f17]/90 border border-rose-500/35 hover:border-rose-500 hover:shadow-[0_0_12px_rgba(244,63,94,0.35)] hover:bg-rose-950/30 transition-all duration-150 cursor-pointer group"
                title="Encerrar sessão com segurança"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0 flex items-center justify-center w-7 h-7 group-hover:scale-105 transition-transform duration-200">
                    <Icon3DSairDoSistema className="w-7 h-7 drop-shadow-sm" />
                  </div>
                  <span className="text-xs font-semibold text-rose-300 group-hover:text-rose-100 truncate">
                    Sair do Sistema
                  </span>
                </div>
              </button>
            </div>
          )}
        </nav>

        {/* Supermarket info footer card */}
        <div className="p-2.5 border-t border-white/5 bg-[#0b0c10] space-y-1.5">
          {/* User profile capsule in sidebar */}
          {userEmail && (
            <div className="p-2 rounded-lg bg-[#12141c] border border-white/5">
              <div className="flex items-center justify-between gap-1">
                <div className="text-[11px] font-bold text-zinc-200 truncate max-w-[140px]">
                  {userName || userEmail}
                </div>
                <span
                  className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase shrink-0 ${
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
        </div>
      </aside>
    </>
  );
};


