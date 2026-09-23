import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Ticket,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  PlusCircle,
  Copy,
  Check,
  Clock,
  History,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Lock,
  Share2,
  Mail,
  Link2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Info
} from 'lucide-react';
import { UserProfile, UserInvite, AuditLogEntry, UserRole, UserStatus } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const AdminUsersView: React.FC = () => {
  const { user: currentAuthUser, profile: currentProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'audit'>('users');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Collections
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Search & Filter state for Users
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Search & Filter state for Invites
  const [inviteSearchQuery, setInviteSearchQuery] = useState<string>('');
  const [inviteStatusFilter, setInviteStatusFilter] = useState<string>('ALL');
  const [inviteRoleFilter, setInviteRoleFilter] = useState<string>('ALL');

  // New Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('FINANCEIRO');
  const [newInviteDays, setNewInviteDays] = useState<number>(7);
  const [newInviteCustomCode, setNewInviteCustomCode] = useState<string>('');
  const [newInviteRecipientEmail, setNewInviteRecipientEmail] = useState<string>('');
  const [newInviteAutoActivate, setNewInviteAutoActivate] = useState<boolean>(true);
  const [newInviteNotes, setNewInviteNotes] = useState<string>('');
  const [isCreatingInvite, setIsCreatingInvite] = useState<boolean>(false);

  // Success Created Invite Dialog State
  const [createdInviteDialog, setCreatedInviteDialog] = useState<UserInvite | null>(null);

  // Copy tracking states
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);

  const showNotification = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [usersRes, invitesRes, auditRes] = await Promise.all([
        apiService.getAdminUsers(),
        apiService.getAdminInvites(),
        apiService.getAdminAuditLogs(100)
      ]);

      setUsers(usersRes.users || []);
      setInvites(invitesRes.invites || []);
      setAuditLogs(auditRes.logs || []);
    } catch (err: any) {
      console.error('Erro ao carregar dados administrativos:', err);
      setError(err.message || 'Erro ao comunicar com o servidor administrativo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // User Actions: Update Status (Ativar / Bloquear)
  const handleToggleStatus = async (userItem: UserProfile) => {
    if (userItem.id === currentAuthUser?.id) {
      alert('Você não pode alterar o status da sua própria conta de administrador.');
      return;
    }

    const newStatus: UserStatus = userItem.status === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO';
    try {
      setLoading(true);
      await apiService.updateUserStatus(userItem.id, newStatus);
      showNotification(`Status do usuário ${userItem.name} alterado para ${newStatus}.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar status do usuário.');
    } finally {
      setLoading(false);
    }
  };

  // User Actions: Update Role
  const handleChangeRole = async (userItem: UserProfile, newRole: UserRole) => {
    if (userItem.id === currentAuthUser?.id && newRole !== 'ADMINISTRADOR') {
      alert('Você não pode rebaixar seu próprio nível de administrador.');
      return;
    }

    try {
      setLoading(true);
      await apiService.updateUserRole(userItem.id, newRole);
      showNotification(`Nível de acesso de ${userItem.name} atualizado para ${newRole}.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar nível de acesso.');
    } finally {
      setLoading(false);
    }
  };

  // Invite Actions: Create
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingInvite(true);
      const res = await apiService.createAdminInvite({
        role: newInviteRole,
        expirationDays: Number(newInviteDays),
        customCode: newInviteCustomCode.trim() || undefined,
        recipientEmail: newInviteRecipientEmail.trim() || undefined,
        autoActivate: newInviteAutoActivate,
        notes: newInviteNotes.trim() || undefined
      });

      setIsInviteModalOpen(false);
      // Reset form
      setNewInviteCustomCode('');
      setNewInviteRecipientEmail('');
      setNewInviteNotes('');
      setNewInviteAutoActivate(true);

      if (res.invite) {
        setCreatedInviteDialog(res.invite);
        showNotification(`Código de convite ${res.invite.code} gerado com sucesso!`);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao gerar código de convite.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  // Invite Actions: Revoke
  const handleRevokeInvite = async (inviteId: string, code: string) => {
    if (!confirm(`Deseja revogar permanentemente o convite ${code}?`)) return;
    try {
      setLoading(true);
      await apiService.revokeAdminInvite(inviteId);
      showNotification(`Convite ${code} revogado com sucesso.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao revogar convite.');
    } finally {
      setLoading(false);
    }
  };

  // Get Registration Link for Invite
  const getInviteLink = (code: string) => {
    const origin = window.location.origin;
    return `${origin}/login?invite=${encodeURIComponent(code)}`;
  };

  // Generate Message template
  const getInviteMessage = (invite: UserInvite) => {
    const link = getInviteLink(invite.code);
    return `Olá! Você foi convidado para acessar o Sistema Financeiro do Supermercado com perfil de acesso: ${invite.role}.\n\nPara concluir seu cadastro e definir sua senha, acesse o link:\n${link}\n\nCódigo do Convite: ${invite.code}`;
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Copy registration link to clipboard
  const handleCopyLink = (code: string) => {
    const link = getInviteLink(code);
    navigator.clipboard.writeText(link);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  // Copy full invite message to clipboard
  const handleCopyFullMessage = (invite: UserInvite) => {
    const msg = getInviteMessage(invite);
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  // Open WhatsApp with invite
  const handleShareWhatsApp = (invite: UserInvite) => {
    const msg = getInviteMessage(invite);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Open Email client with invite
  const handleShareEmail = (invite: UserInvite) => {
    const subject = encodeURIComponent(`Convite de Acesso - Sistema Financeiro Supermercado (${invite.role})`);
    const body = encodeURIComponent(getInviteMessage(invite));
    const to = invite.recipientEmail ? encodeURIComponent(invite.recipientEmail) : '';
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.inviteCode || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filtered Invites
  const filteredInvites = useMemo(() => {
    return invites.filter((inv) => {
      const isExpired = new Date(inv.expiresAt) < new Date();
      const status = inv.status === 'UTILIZADO' ? 'UTILIZADO' : isExpired ? 'EXPIRADO' : inv.status;

      const matchesSearch =
        (inv.code || '').toLowerCase().includes(inviteSearchQuery.toLowerCase()) ||
        (inv.recipientEmail || '').toLowerCase().includes(inviteSearchQuery.toLowerCase()) ||
        (inv.usedBy || '').toLowerCase().includes(inviteSearchQuery.toLowerCase()) ||
        (inv.createdBy || '').toLowerCase().includes(inviteSearchQuery.toLowerCase()) ||
        (inv.notes || '').toLowerCase().includes(inviteSearchQuery.toLowerCase());

      const matchesRole = inviteRoleFilter === 'ALL' || inv.role === inviteRoleFilter;
      const matchesStatus =
        inviteStatusFilter === 'ALL' ||
        (inviteStatusFilter === 'DISPONIVEL' && status === 'DISPONIVEL') ||
        (inviteStatusFilter === 'UTILIZADO' && status === 'UTILIZADO') ||
        (inviteStatusFilter === 'EXPIRADO' && status === 'EXPIRADO') ||
        (inviteStatusFilter === 'REVOGADO' && inv.status === 'REVOGADO');

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [invites, inviteSearchQuery, inviteRoleFilter, inviteStatusFilter]);

  // Invites statistics
  const inviteStats = useMemo(() => {
    const total = invites.length;
    let available = 0;
    let used = 0;
    let expired = 0;
    let revoked = 0;

    invites.forEach((inv) => {
      const isExpired = new Date(inv.expiresAt) < new Date();
      if (inv.status === 'REVOGADO') {
        revoked++;
      } else if (inv.status === 'UTILIZADO') {
        used++;
      } else if (isExpired) {
        expired++;
      } else {
        available++;
      }
    });

    return { total, available, used, expired, revoked };
  }, [invites]);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMINISTRADOR':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'FINANCEIRO':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'OPERADOR':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'CONSULTA':
        return 'bg-zinc-100 text-zinc-800 border-zinc-300';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'ATIVO':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'PENDENTE':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'BLOQUEADO':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-100 text-orange-700">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
              Controle de Usuários & Convites
            </h1>
          </div>
          <p className="text-xs text-zinc-600 font-medium mt-1">
            Gestão restrita de perfis, ativação de colaboradores, geração e envio de convites de acesso.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={async () => {
              try {
                const res = await apiService.enableMasterUser({
                  email: currentAuthUser?.email || currentProfile?.email,
                  userId: currentAuthUser?.id || currentProfile?.id,
                  name: currentProfile?.name
                });
                if (res.success) {
                  showNotification('Perfil Master confirmado com sucesso no Supabase e no banco local!');
                  await loadData();
                } else {
                  setError(res.error || 'Erro ao habilitar master.');
                }
              } catch (e: any) {
                setError(e.message);
              }
            }}
            className="px-3 py-2 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Forçar permissões de Administrador Master no Supabase e no SQLite local"
          >
            <span>👑 Sincronizar Master</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Gerar Novo Convite</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sub-tabs navigation */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários do Sistema ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invites')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'invites'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Códigos de Convite ({invites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Auditoria de Operações ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters and search */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-xl border border-zinc-200">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou código de convite..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden"
              >
                <option value="ALL">Todos os Perfis</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="OPERADOR">Operador</option>
                <option value="CONSULTA">Consulta</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden"
              >
                <option value="ALL">Todos os Status</option>
                <option value="ATIVO">Ativos</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="BLOQUEADO">Bloqueados</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Perfil de Acesso</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Convite Utilizado</th>
                    <th className="py-3 px-4">Data Cadastro</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                        Nenhum usuário encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.id === currentAuthUser?.id;
                      return (
                        <tr key={u.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-orange-100 text-orange-800 font-bold border border-orange-200">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono">{u.email}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <select
                              value={u.role}
                              disabled={isSelf}
                              onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${getRoleBadge(
                                u.role
                              )} focus:outline-hidden disabled:opacity-80`}
                            >
                              <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                              <option value="FINANCEIRO">FINANCEIRO</option>
                              <option value="OPERADOR">OPERADOR</option>
                              <option value="CONSULTA">CONSULTA</option>
                            </select>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusBadge(
                                u.status
                              )}`}
                            >
                              {u.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {u.inviteCode ? (
                              <span className="font-mono text-xs font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                {u.inviteCode}
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-italic text-[11px]">Direto / Inicial</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-zinc-600 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {!isSelf && (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                  u.status === 'ATIVO'
                                    ? 'text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200'
                                    : 'text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200'
                                }`}
                              >
                                {u.status === 'ATIVO' ? 'Bloquear' : 'Ativar Acesso'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVITES LIST */}
      {activeTab === 'invites' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-zinc-200 flex flex-col shadow-2xs">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Total de Convites</span>
              <span className="text-lg font-black text-zinc-950 mt-0.5">{inviteStats.total}</span>
            </div>
            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/90 flex flex-col shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Disponíveis / Ativos</span>
              <span className="text-lg font-black text-emerald-900 mt-0.5">{inviteStats.available}</span>
            </div>
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/90 flex flex-col shadow-2xs">
              <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Utilizados</span>
              <span className="text-lg font-black text-blue-900 mt-0.5">{inviteStats.used}</span>
            </div>
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-zinc-200 flex flex-col shadow-2xs">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Expirados / Revogados</span>
              <span className="text-lg font-black text-zinc-700 mt-0.5">{inviteStats.expired + inviteStats.revoked}</span>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-xl border border-zinc-200">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por código, e-mail do destinatário, usuário ou observação..."
                value={inviteSearchQuery}
                onChange={(e) => setInviteSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={inviteRoleFilter}
                onChange={(e) => setInviteRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden"
              >
                <option value="ALL">Todos os Perfis</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="OPERADOR">Operador</option>
                <option value="CONSULTA">Consulta</option>
              </select>

              <select
                value={inviteStatusFilter}
                onChange={(e) => setInviteStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden"
              >
                <option value="ALL">Todos os Status</option>
                <option value="DISPONIVEL">Disponíveis</option>
                <option value="UTILIZADO">Utilizados</option>
                <option value="EXPIRADO">Expirados</option>
                <option value="REVOGADO">Revogados</option>
              </select>

              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Novo Convite</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Código do Convite</th>
                    <th className="py-3 px-4">Perfil Concedido</th>
                    <th className="py-3 px-4">Destinatário / Obs</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4">Utilizado Por</th>
                    <th className="py-3 px-4 text-right">Ações de Envio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredInvites.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500 font-medium">
                        Nenhum convite encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredInvites.map((inv) => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      const statusDisplay =
                        inv.status === 'UTILIZADO'
                          ? 'UTILIZADO'
                          : inv.status === 'REVOGADO'
                          ? 'REVOGADO'
                          : isExpired
                          ? 'EXPIRADO'
                          : 'DISPONÍVEL';

                      const statusColor =
                        statusDisplay === 'UTILIZADO'
                          ? 'bg-blue-100 text-blue-900 border-blue-200'
                          : statusDisplay === 'REVOGADO'
                          ? 'bg-rose-100 text-rose-900 border-rose-200'
                          : statusDisplay === 'EXPIRADO'
                          ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300';

                      const isAvailable = statusDisplay === 'DISPONÍVEL';

                      return (
                        <tr key={inv.id} className="hover:bg-zinc-50/80 transition-colors">
                          {/* Code */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-950">
                              <span className="bg-orange-50 text-orange-950 px-2.5 py-1 rounded-lg border border-orange-200 text-xs">
                                {inv.code}
                              </span>
                              <button
                                onClick={() => handleCopyCode(inv.code)}
                                className="p-1.5 text-zinc-500 hover:text-zinc-950 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                                title="Copiar código"
                              >
                                {copiedCode === inv.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(
                                inv.role
                              )}`}
                            >
                              {inv.role}
                            </span>
                          </td>

                          {/* Recipient / Notes */}
                          <td className="py-3.5 px-4 text-zinc-600">
                            {inv.recipientEmail ? (
                              <div className="font-medium text-zinc-900 text-xs flex items-center gap-1">
                                <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                                <span>{inv.recipientEmail}</span>
                              </div>
                            ) : null}
                            {inv.notes ? (
                              <div className="text-[11px] text-zinc-500 truncate max-w-xs">{inv.notes}</div>
                            ) : null}
                            {!inv.recipientEmail && !inv.notes && (
                              <span className="text-zinc-400 text-[11px] italic">Geral / Não especificado</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${statusColor}`}
                            >
                              {statusDisplay}
                            </span>
                          </td>

                          {/* Expiration */}
                          <td className="py-3.5 px-4 text-[11px] text-zinc-600 whitespace-nowrap">
                            {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                            {!isExpired && inv.status === 'DISPONIVEL' && (
                              <span className="text-zinc-400 ml-1">
                                ({Math.max(0, Math.ceil(
                                  (new Date(inv.expiresAt).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                                ))}{' '}
                                d)
                              </span>
                            )}
                          </td>

                          {/* Used By */}
                          <td className="py-3.5 px-4 text-zinc-700 text-xs">
                            {inv.usedBy ? (
                              <span className="font-mono text-zinc-950 font-bold">{inv.usedBy}</span>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">Nenhum ainda</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Copy Link */}
                              <button
                                onClick={() => handleCopyLink(inv.code)}
                                className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                                title="Copiar link direto de cadastro"
                              >
                                {copiedLink === inv.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Link2 className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* WhatsApp Share */}
                              {isAvailable && (
                                <button
                                  onClick={() => handleShareWhatsApp(inv)}
                                  className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="Enviar pelo WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Email Share */}
                              {isAvailable && (
                                <button
                                  onClick={() => handleShareEmail(inv)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Enviar por E-mail"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Revoke */}
                              {isAvailable && (
                                <button
                                  onClick={() => handleRevokeInvite(inv.id, inv.code)}
                                  className="p-1.5 text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                                  title="Revogar este convite"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-zinc-200">
            <h2 className="text-sm font-bold text-zinc-950">Registro Imutável de Auditoria</h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              Rastreabilidade de todas as ações administrativas, importações bancárias, cadastros de colaboradores e modificações críticas.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500 font-medium">
                        Nenhum registro de auditoria registrado ainda.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3 px-4 text-zinc-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-950">
                          {log.userName || log.userEmail || 'Sistema'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 max-w-md truncate">
                          {log.details ? JSON.stringify(log.details) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE INVITE MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-zinc-200 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-bold text-zinc-950">Gerar Novo Convite de Acesso</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              {/* Profile / Role */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Perfil de Acesso Autorizado *
                </label>
                <select
                  value={newInviteRole}
                  onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 focus:outline-hidden"
                >
                  <option value="FINANCEIRO">FINANCEIRO — Acesso a Conciliação, Extratos, Importações e Relatórios</option>
                  <option value="OPERADOR">OPERADOR — Lançamentos manuais de despesas/receitas e consultas</option>
                  <option value="CONSULTA">CONSULTA — Apenas leitura de relatórios e extratos</option>
                  <option value="ADMINISTRADOR">ADMINISTRADOR — Acesso total e gerenciamento de usuários</option>
                </select>
              </div>

              {/* Expiration Days */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Prazo de Validade do Convite *
                </label>
                <select
                  value={newInviteDays}
                  onChange={(e) => setNewInviteDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 focus:outline-hidden"
                >
                  <option value={1}>24 horas (1 dia)</option>
                  <option value={3}>3 dias</option>
                  <option value={7}>7 dias (Recomendado)</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                  <option value={90}>90 dias</option>
                </select>
              </div>

              {/* Optional Recipient Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  E-mail do Colaborador (Opcional)
                </label>
                <input
                  type="email"
                  placeholder="Ex: colaborador@supermercado.com"
                  value={newInviteRecipientEmail}
                  onChange={(e) => setNewInviteRecipientEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 focus:outline-hidden placeholder:text-zinc-400"
                />
                <p className="text-[10px] text-zinc-500">
                  Ajuda a identificar para quem o convite foi emitido e facilita o envio direto por e-mail.
                </p>
              </div>

              {/* Optional Custom Code */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Código Personalizado (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: FIN-LOJA01-2026 (deixe em branco para gerar aleatório)"
                  value={newInviteCustomCode}
                  onChange={(e) => setNewInviteCustomCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 text-xs font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 focus:outline-hidden placeholder:text-zinc-400 placeholder:font-sans"
                />
              </div>

              {/* Optional Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Observações Internas (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Analista de tesouraria recém-contratado"
                  value={newInviteNotes}
                  onChange={(e) => setNewInviteNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 focus:outline-hidden placeholder:text-zinc-400"
                />
              </div>

              {/* Immediate Activation Toggle */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="chk-auto-activate"
                  checked={newInviteAutoActivate}
                  onChange={(e) => setNewInviteAutoActivate(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-600 cursor-pointer"
                />
                <label htmlFor="chk-auto-activate" className="text-xs text-zinc-800 font-medium cursor-pointer">
                  <strong>Ativação Imediata:</strong> Liberar acesso completo ao sistema assim que o colaborador concluir o cadastro (recomendado).
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingInvite}
                  className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isCreatingInvite ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Gerando Convite...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gerar Código de Convite</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATED INVITE SUCCESS & SHARE DIALOG */}
      {createdInviteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-zinc-200 p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-950">Convite Gerado com Sucesso!</h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Envie o código ou link de acesso direto para o colaborador.
                </p>
              </div>
            </div>

            {/* Code Box */}
            <div className="p-4 bg-orange-50/70 rounded-2xl border border-orange-200 space-y-2">
              <span className="text-[10px] font-bold text-orange-900 uppercase tracking-wider">
                Código de Convite
              </span>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xl sm:text-2xl font-mono font-black text-orange-950 tracking-wider">
                  {createdInviteDialog.code}
                </span>
                <button
                  onClick={() => handleCopyCode(createdInviteDialog.code)}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode === createdInviteDialog.code ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Direct Link Box */}
            <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">
                  Link Direto de Cadastro
                </span>
                <button
                  onClick={() => handleCopyLink(createdInviteDialog.code)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink === createdInviteDialog.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Link Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Copiar Link</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2 bg-white rounded-lg border border-zinc-200 text-zinc-700 font-mono text-[11px] break-all select-all">
                {getInviteLink(createdInviteDialog.code)}
              </div>
            </div>

            {/* Details Summary */}
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Perfil Concedido:</span>
                <span className="font-bold text-zinc-900">{createdInviteDialog.role}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Validade:</span>
                <span className="font-bold text-zinc-900">
                  {new Date(createdInviteDialog.expiresAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Compartilhar com o Colaborador
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleShareWhatsApp(createdInviteDialog)}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => handleShareEmail(createdInviteDialog)}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>E-mail</span>
                </button>

                <button
                  onClick={() => handleCopyFullMessage(createdInviteDialog)}
                  className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedMessage ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mensagem Copiada!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 flex justify-end gap-2 border-t border-zinc-100">
              <button
                onClick={() => {
                  setCreatedInviteDialog(null);
                  setIsInviteModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
              >
                Gerar Outro Convite
              </button>
              <button
                onClick={() => setCreatedInviteDialog(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-black rounded-xl shadow-xs cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
