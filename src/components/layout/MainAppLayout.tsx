import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar, ActiveTab } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { CompanySettingsModal } from './CompanySettingsModal';
import { DashboardView } from '../dashboard/DashboardView';
import { ConsolidatedBalanceView } from '../consolidated/ConsolidatedBalanceView';
import { ImportView } from '../import/ImportView';
import { TransactionsView } from '../transactions/TransactionsView';
import { ReportsView } from '../reports/ReportsView';
import { DatabaseView } from '../database/DatabaseView';
import { AdminUsersView } from '../admin/AdminUsersView';
import { BackupView } from '../settings/BackupView';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BankAccount, Category, OperationTypeInfo, CompanyProfile } from '../../types';
import { apiService } from '../../services/api';
import { safeStorage } from '../../utils/safeStorage';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';

const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: 'Supermercado Central',
  subtitle: 'Gestão Financeira',
  logoUrl: null,
  cnpj: '12.345.678/0001-90',
  badge: 'FINANCEIRO'
};

export const MainAppLayout: React.FC = () => {
  const { user, profile, signOut, enableMaster } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Map current URL path to ActiveTab
  const getTabFromPath = (pathname: string): ActiveTab => {
    if (pathname.includes('/saldo-consolidado')) return 'saldo-consolidado';
    if (pathname.includes('/movimentacoes') || pathname.includes('/lancamentos')) return 'movimentacoes';
    if (pathname.includes('/importar') || pathname.includes('/importacao')) return 'importar';
    if (pathname.includes('/relatorios')) return 'relatorios';
    if (pathname.includes('/usuarios') || pathname.includes('/admin')) return 'usuarios';
    if (pathname.includes('/database')) return 'database';
    if (pathname.includes('/backup')) return 'backup';
    return 'dashboard';
  };

  const activeTab = getTabFromPath(location.pathname);

  const handleSelectTab = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'saldo-consolidado':
        navigate('/saldo-consolidado');
        break;
      case 'movimentacoes':
        navigate('/movimentacoes');
        break;
      case 'importar':
        navigate('/importar');
        break;
      case 'relatorios':
        navigate('/relatorios');
        break;
      case 'usuarios':
        navigate('/usuarios');
        break;
      case 'database':
        navigate('/database');
        break;
      case 'backup':
        navigate('/backup');
        break;
      default:
        navigate('/dashboard');
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleEnableMaster = async () => {
    setIsActionLoading(true);
    try {
      const res = await enableMaster();
      if (res.success) {
        showNotification('Perfil de Administrador Master ativado com sucesso!', 'success');
        await loadGlobalData();
      } else {
        showNotification(res.error || 'Não foi possível ativar perfil master.', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Erro ao comunicar com o servidor.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Company Profile & Custom Logo State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = safeStorage.getItem('supermarket_company_profile');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Fallback para perfil padrão da empresa:', e);
    }
    return DEFAULT_COMPANY_PROFILE;
  });

  // Sincroniza dados cadastrais da empresa com o servidor para persistência unificada
  useEffect(() => {
    let isMounted = true;
    async function syncCompanyProfile() {
      try {
        const res = await apiService.getCompanyProfile();
        if (isMounted && res.profile && res.profile.name) {
          setCompanyProfile(res.profile);
          safeStorage.setItem('supermarket_company_profile', JSON.stringify(res.profile));
        }
      } catch (err) {
        console.warn('Fallback ao carregar perfil da empresa:', err);
      }
    }
    syncCompanyProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveCompanyProfile = async (profile: CompanyProfile) => {
    setCompanyProfile(profile);
    try {
      safeStorage.setItem('supermarket_company_profile', JSON.stringify(profile));
      await apiService.updateCompanyProfile(profile);
      showNotification('Identidade e dados cadastrais do estabelecimento salvos com sucesso!', 'success');
    } catch (e) {
      console.warn('Fallback ao salvar perfil da empresa:', e);
    }
  };

  // Core global collections
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [consolidatedBalance, setConsolidatedBalance] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [operationTypes, setOperationTypes] = useState<OperationTypeInfo[]>([]);
  const [pendingReconciliationCount, setPendingReconciliationCount] = useState<number>(0);

  // Load initial global data ONLY when authenticated
  const loadGlobalData = useCallback(async () => {
    try {
      const [accData, catList, opList, txData] = await Promise.all([
        apiService.getAccounts(),
        apiService.getCategories(),
        apiService.getOperationTypes(),
        apiService.getTransactions({ reconciliationStatus: 'PENDENTE' })
      ]);

      setBankAccounts(accData.accounts || []);
      setConsolidatedBalance(accData.consolidatedBalance || 0);
      setCategories(catList || []);
      setOperationTypes(opList || []);
      setPendingReconciliationCount(txData.total || 0);
    } catch (err) {
      console.error('Erro ao carregar dados do sistema:', err);
    }
  }, []);

  useEffect(() => {
    loadGlobalData();
  }, [loadGlobalData]);

  // Logout handler complying with requirement 5
  const handleSignOut = async () => {
    try {
      // 1. Limpar coleções em memória para garantir sigilo
      setBankAccounts([]);
      setConsolidatedBalance(0);
      setCategories([]);
      setOperationTypes([]);
      setPendingReconciliationCount(0);

      // 2. Executar signOut oficial do Supabase
      await signOut();

      // 3. Redirecionar com replace: true para impedir retorno pelo botão Voltar
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Erro ao efetuar logout:', err);
      navigate('/login', { replace: true });
    }
  };

  const handleConfirmReset = async () => {
    try {
      setIsActionLoading(true);
      await apiService.resetToBlank('Administrador');
      await loadGlobalData();
      setIsResetModalOpen(false);
      showNotification('Sistema zerado com sucesso! Pronto para importação.');
      navigate('/importar');
    } catch (err: unknown) {
      showNotification((err as Error).message || 'Erro ao zerar o sistema', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    try {
      setIsActionLoading(true);
      await apiService.restoreSampleData('Administrador');
      await loadGlobalData();
      setIsRestoreModalOpen(false);
      showNotification('Dados de demonstração restaurados com sucesso!');
    } catch (err: unknown) {
      showNotification((err as Error).message || 'Erro ao restaurar dados', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-zinc-950 font-bold flex selection:bg-orange-500/30 selection:text-orange-900">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        pendingCount={pendingReconciliationCount}
        companyProfile={companyProfile}
        userRole={profile?.role || 'ADMINISTRADOR'}
        userName={profile?.name}
        userEmail={profile?.email || user?.email}
        onOpenCompanySettings={() => setIsCompanyModalOpen(true)}
        onResetData={() => setIsResetModalOpen(true)}
        onRestoreSampleData={() => setIsRestoreModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar
          bankAccounts={bankAccounts}
          consolidatedBalance={consolidatedBalance}
          companyProfile={companyProfile}
          onOpenCompanySettings={() => setIsCompanyModalOpen(true)}
          onOpenImport={() => navigate('/importar')}
          onOpenNewTransaction={() => navigate('/movimentacoes')}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          pendingReconciliationCount={pendingReconciliationCount}
          onResetData={() => setIsResetModalOpen(true)}
          onRestoreSampleData={() => setIsRestoreModalOpen(true)}
          userRole={profile?.role || 'ADMINISTRADOR'}
          userName={profile?.name}
          userEmail={profile?.email || user?.email}
          onSignOut={handleSignOut}
          onEnableMaster={handleEnableMaster}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {/* RBAC Access Denied Fallbacks */}
          {activeTab === 'usuarios' && profile?.role !== 'ADMINISTRADOR' && (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center max-w-md mx-auto space-y-4 my-12 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-950">Acesso Restrito ao Administrador</h2>
                <p className="text-xs text-zinc-600 mt-1">
                  Seu perfil atual está como <strong>{profile?.role || 'CONSULTA'}</strong>. Você pode ativar seus privilégios de Administrador Master agora mesmo:
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleEnableMaster}
                  disabled={isActionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
                >
                  👑 Habilitar Usuário Master
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                >
                  Voltar ao Dashboard
                </button>
              </div>
            </div>
          )}

          {activeTab === 'database' && profile?.role !== 'ADMINISTRADOR' && (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center max-w-md mx-auto space-y-4 my-12 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-950">Acesso ao Banco de Dados</h2>
                <p className="text-xs text-zinc-600 mt-1">
                  Seu perfil atual está como <strong>{profile?.role || 'CONSULTA'}</strong>. Desbloqueie o painel de sincronização ativando seus privilégios de Administrador Master:
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleEnableMaster}
                  disabled={isActionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
                >
                  👑 Habilitar Usuário Master
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                >
                  Voltar ao Dashboard
                </button>
              </div>
            </div>
          )}

          {activeTab === 'importar' && profile?.role !== 'ADMINISTRADOR' && profile?.role !== 'FINANCEIRO' && (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center max-w-md mx-auto space-y-4 my-12 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-950">Permissão Insuficiente</h2>
                <p className="text-xs text-zinc-600 mt-1">
                  Seu perfil atual (<strong>{profile?.role}</strong>) não possui permissão para importar extratos bancários.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleEnableMaster}
                  disabled={isActionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
                >
                  👑 Habilitar Usuário Master
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                >
                  Voltar ao Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Normal Permitted Views */}
          {activeTab === 'dashboard' && (
            <DashboardView
              bankAccounts={bankAccounts}
              onNavigateToImport={() => navigate('/importar')}
              companyProfile={companyProfile}
              userName={profile?.name || (user?.user_metadata as any)?.name}
              userRole={profile?.role || 'ADMINISTRADOR'}
            />
          )}

          {activeTab === 'saldo-consolidado' && (
            <ConsolidatedBalanceView
              bankAccounts={bankAccounts}
            />
          )}

          {activeTab === 'movimentacoes' && (
            <TransactionsView
              bankAccounts={bankAccounts}
              categories={categories}
              operationTypes={operationTypes}
              onRefreshStats={loadGlobalData}
              onNavigateToImport={() => navigate('/importar')}
            />
          )}

          {activeTab === 'importar' && (profile?.role === 'ADMINISTRADOR' || profile?.role === 'FINANCEIRO') && (
            <ImportView
              bankAccounts={bankAccounts}
              categories={categories}
              operationTypes={operationTypes}
              onImportSuccess={() => {
                loadGlobalData();
                navigate('/movimentacoes');
              }}
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView
              bankAccounts={bankAccounts}
              categories={categories}
              operationTypes={operationTypes}
              companyProfile={companyProfile}
            />
          )}

          {activeTab === 'usuarios' && profile?.role === 'ADMINISTRADOR' && (
            <AdminUsersView />
          )}

          {activeTab === 'database' && profile?.role === 'ADMINISTRADOR' && (
            <DatabaseView
              onResetData={() => setIsResetModalOpen(true)}
              onRestoreSampleData={() => setIsRestoreModalOpen(true)}
            />
          )}

          {activeTab === 'backup' && profile?.role === 'ADMINISTRADOR' && (
            <BackupView onRefreshData={loadGlobalData} />
          )}

          {activeTab === 'backup' && profile?.role !== 'ADMINISTRADOR' && (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center max-w-md mx-auto space-y-4 my-12 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-950">Acesso Restrito ao Administrador</h2>
                <p className="text-xs text-zinc-600 mt-1">
                  O módulo Enterprise de Backup & Disaster Recovery é restrito a administradores.
                </p>
              </div>
              <button
                onClick={handleEnableMaster}
                disabled={isActionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                👑 Habilitar Usuário Master
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modal to Upload Logo and Customize Establishment Details */}
      <CompanySettingsModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        companyProfile={companyProfile}
        onSaveProfile={handleSaveCompanyProfile}
      />

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        isOpen={isResetModalOpen}
        title="Zerar Sistema e Limpar Movimentações"
        description="Esta ação removerá permanentemente todas as movimentações financeiras, extratos importados e zerará os saldos das contas bancárias, deixando o sistema limpo para a importação do seu extrato real."
        details={[
          'Todas as transações cadastradas serão apagadas',
          'Saldos iniciais e atuais das contas bancárias voltarão a R$ 0,00',
          'O sistema redirecionará para a tela de importação'
        ]}
        confirmText="Sim, Zerar Sistema"
        cancelText="Cancelar"
        variant="danger"
        icon="trash"
        isLoading={isActionLoading}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetModalOpen(false)}
      />

      {/* Confirm Restore Sample Dialog */}
      <ConfirmDialog
        isOpen={isRestoreModalOpen}
        title="Restaurar Dados Demonstrativos"
        description="Deseja restaurar as movimentações de exemplo e extratos de teste para demonstração das métricas e relatórios?"
        details={[
          'Contas bancárias padrão serão recriadas',
          'Lançamentos de teste de agosto e setembro de 2026 serão carregados'
        ]}
        confirmText="Restaurar Dados Demo"
        cancelText="Cancelar"
        variant="warning"
        icon="restore"
        isLoading={isActionLoading}
        onConfirm={handleConfirmRestore}
        onCancel={() => setIsRestoreModalOpen(false)}
      />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-20 lg:bottom-6 right-3 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 bg-white border border-zinc-300 text-zinc-950 font-bold rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
          {notification.type === 'success' ? (
            <div className="p-1 rounded-xl bg-emerald-500/20 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-1 rounded-xl bg-rose-500/20 text-rose-700">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          <span className="text-xs font-semibold pr-2">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="p-1 text-zinc-900 hover:text-zinc-950 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        pendingCount={pendingReconciliationCount}
        userRole={profile?.role || 'ADMINISTRADOR'}
      />
    </div>
  );
};
