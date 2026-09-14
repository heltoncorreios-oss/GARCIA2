import React, { useState, useEffect, useCallback } from 'react';
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
  Lock
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('FINANCEIRO');
  const [newInviteDays, setNewInviteDays] = useState<number>(7);
  const [isCreatingInvite, setIsCreatingInvite] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
      const res = await apiService.createAdminInvite(newInviteRole, Number(newInviteDays));
      setIsInviteModalOpen(false);
      showNotification(`Código de convite ${res.invite?.code} gerado com sucesso!`);
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

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
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
            Gestão restrita de perfis, ativação de colaboradores, geração de convites e auditoria de segurança.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
            <span>Gerar Convite</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600" />
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
          <div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              Convites emitidos permitem que novos funcionários se cadastrem no sistema com perfis previamente autorizados.
            </p>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Novo Convite</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Código de Convite</th>
                    <th className="py-3 px-4">Perfil Concedido</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4">Utilizado Por</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {invites.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                        Nenhum convite gerado até o momento.
                      </td>
                    </tr>
                  ) : (
                    invites.map((inv) => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      const statusDisplay =
                        inv.status === 'UTILIZADO'
                          ? 'UTILIZADO'
                          : isExpired
                          ? 'EXPIRADO'
                          : 'DISPONÍVEL';

                      const statusColor =
                        statusDisplay === 'UTILIZADO'
                          ? 'bg-blue-100 text-blue-900 border-blue-200'
                          : statusDisplay === 'EXPIRADO'
                          ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300';

                      return (
                        <tr key={inv.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-zinc-950 flex items-center gap-2">
                            <span className="text-sm bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-300">
                              {inv.code}
                            </span>
                            <button
                              onClick={() => handleCopyCode(inv.code)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-950 rounded hover:bg-zinc-200 transition-colors cursor-pointer"
                              title="Copiar código para enviar ao colaborador"
                            >
                              {copiedCode === inv.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(
                                inv.role
                              )}`}
                            >
                              {inv.role}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${statusColor}`}
                            >
                              {statusDisplay}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[11px] text-zinc-600">
                            {new Date(inv.expiresAt).toLocaleDateString('pt-BR')} (
                            {Math.ceil(
                              (new Date(inv.expiresAt).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                            )}{' '}
                            dias)
                          </td>

                          <td className="py-3.5 px-4 text-zinc-700 text-xs">
                            {inv.usedByEmail ? (
                              <span className="font-mono text-zinc-950 font-bold">{inv.usedByEmail}</span>
                            ) : (
                              <span className="text-zinc-400 font-italic">Nenhum</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {inv.status === 'DISPONIVEL' && !isExpired && (
                              <button
                                onClick={() => handleRevokeInvite(inv.id, inv.code)}
                                className="p-1.5 text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Revogar convite"
                              >
                                <Trash2 className="w-4 h-4" />
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
          <div className="w-full max-w-md bg-white rounded-2xl border border-black p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-bold text-zinc-950">Gerar Novo Convite</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-900 uppercase">
                  Perfil de Acesso Pré-definido
                </label>
                <select
                  value={newInviteRole}
                  onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 focus:outline-hidden"
                >
                  <option value="FINANCEIRO">FINANCEIRO (Importação, Conciliação, Relatórios)</option>
                  <option value="OPERADOR">OPERADOR (Lançamentos manuais, Visualização)</option>
                  <option value="CONSULTA">CONSULTA (Apenas Leitura)</option>
                  <option value="ADMINISTRADOR">ADMINISTRADOR (Acesso Total)</option>
                </select>
                <p className="text-[10px] text-zinc-500">
                  O colaborador assumirá este perfil imediatamente ao concluir o cadastro.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-900 uppercase">
                  Prazo de Validade do Convite
                </label>
                <select
                  value={newInviteDays}
                  onChange={(e) => setNewInviteDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-xs font-semibold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-orange-600 focus:outline-hidden"
                >
                  <option value={1}>24 horas (1 dia)</option>
                  <option value={3}>3 dias</option>
                  <option value={7}>7 dias (Recomendado)</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
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
                  className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isCreatingInvite ? 'Gerando...' : 'Gerar Código de Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
