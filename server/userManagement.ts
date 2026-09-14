import crypto from 'crypto';
import { getSupabaseClient } from './supabaseService.js';
import {
  loadUserProfilesSqlite,
  saveUserProfileSqlite,
  loadUserInvitesSqlite,
  saveUserInviteSqlite,
  loadAuditLogsSqlite,
  saveAuditLogSqlite
} from './sqliteService.js';
import { UserProfile, UserRole, UserStatus, UserInvite, InviteStatus, AuditLogEntry } from '../src/types';

// In-memory cache for fast, reliable access and local fallback
let cachedProfiles: Map<string, UserProfile> = new Map();
let cachedInvites: Map<string, UserInvite> = new Map();
let cachedAuditLogs: AuditLogEntry[] = [];
let isInitialized = false;

// Gera códigos no padrão estrito FIN-XXXX-XXXX (ex: FIN-8K4P-X92M)
export function generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[crypto.randomInt(0, chars.length)];
    part2 += chars[crypto.randomInt(0, chars.length)];
  }
  return `FIN-${part1}-${part2}`;
}

export async function addAuditLog(entry: {
  user: string;
  userName?: string;
  action: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}): Promise<AuditLogEntry> {
  const log: AuditLogEntry = {
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    user: entry.user,
    userName: entry.userName,
    action: entry.action,
    description: entry.description,
    timestamp: new Date().toISOString(),
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata
  };

  cachedAuditLogs.unshift(log);
  if (cachedAuditLogs.length > 500) {
    cachedAuditLogs = cachedAuditLogs.slice(0, 500);
  }

  // Persistir no SQLite local
  try {
    saveAuditLogSqlite(log);
  } catch (err) {
    console.error('[SQLite] Erro ao persistir log de auditoria no SQLite:', err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('audit_logs').insert([{
        id: log.id,
        data: log,
        updated_at: log.timestamp
      }]);
    } catch (err) {
      console.error('[Auditoria] Falha ao persistir no Supabase:', err);
    }
  }

  return log;
}

export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  await ensureInitialized();
  return cachedAuditLogs.slice(0, limit);
}

export async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;

  // 1. Carregar primeiro dados do SQLite local
  try {
    const sqliteProfiles = loadUserProfilesSqlite();
    for (const p of sqliteProfiles) {
      cachedProfiles.set(p.id, p);
    }

    const sqliteInvites = loadUserInvitesSqlite();
    for (const inv of sqliteInvites) {
      cachedInvites.set(inv.id, inv);
    }

    const sqliteLogs = loadAuditLogsSqlite(200);
    if (sqliteLogs && sqliteLogs.length > 0) {
      cachedAuditLogs = sqliteLogs;
    }
  } catch (err) {
    console.error('[SQLite] Erro ao carregar dados iniciais de usuários do SQLite:', err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Carregar perfis existentes do Supabase
      const { data: profRows, error: profErr } = await supabase.from('user_profiles').select('*');
      if (!profErr && profRows) {
        for (const row of profRows) {
          if (row.data) {
            cachedProfiles.set(row.data.id, row.data);
            saveUserProfileSqlite(row.data);
          }
        }
      }

      // Carregar convites existentes do Supabase
      const { data: invRows, error: invErr } = await supabase.from('user_invites').select('*');
      if (!invErr && invRows) {
        for (const row of invRows) {
          if (row.data) {
            cachedInvites.set(row.data.id, row.data);
            saveUserInviteSqlite(row.data);
          }
        }
      }

      // Carregar logs de auditoria
      const { data: auditRows, error: auditErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (!auditErr && auditRows) {
        const remoteLogs = auditRows.map(r => r.data).filter(Boolean);
        if (remoteLogs.length > 0) {
          cachedAuditLogs = remoteLogs;
        }
      }
    } catch (err) {
      console.error('[UserManagement] Erro ao sincronizar com Supabase:', err);
    }
  }

  // Garantir administradores iniciais padrão
  await seedInitialAdmins();

  // Garantir convites iniciais ativos se não houver convites
  await seedInitialInvitesIfEmpty();

  isInitialized = true;
}

async function seedInitialAdmins(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    if (cachedProfiles.size === 0) {
      const defaultAdmin: UserProfile = {
        id: 'user_admin_local',
        name: 'Administrador Financeiro',
        email: 'admin@supermercado.com',
        role: 'ADMINISTRADOR',
        status: 'ATIVO',
        createdAt: new Date().toISOString(),
        lastSignInAt: null
      };
      cachedProfiles.set(defaultAdmin.id, defaultAdmin);
      try {
        saveUserProfileSqlite(defaultAdmin);
      } catch {}
    }
    return;
  }

  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr || !authData?.users) return;

    for (const authUser of authData.users) {
      const email = (authUser.email || '').toLowerCase();
      // Administradores autorizados
      const isInitialAdmin =
        email === 'admin@supermercado.com' ||
        email === 'heltoncorreios@gmail.com' ||
        cachedProfiles.size === 0;

      let existing = Array.from(cachedProfiles.values()).find(
        p => p.id === authUser.id || p.email.toLowerCase() === email
      );

      if (!existing && isInitialAdmin) {
        const adminProfile: UserProfile = {
          id: authUser.id,
          name: authUser.user_metadata?.name || (email === 'admin@supermercado.com' ? 'Administrador Financeiro' : 'Helton'),
          email: authUser.email!,
          role: 'ADMINISTRADOR',
          status: 'ATIVO',
          createdAt: authUser.created_at || new Date().toISOString(),
          lastSignInAt: authUser.last_sign_in_at || null
        };

        cachedProfiles.set(adminProfile.id, adminProfile);
        try {
          saveUserProfileSqlite(adminProfile);
        } catch {}

        await supabase.from('user_profiles').upsert([{
          id: adminProfile.id,
          data: adminProfile,
          updated_at: new Date().toISOString()
        }]);

        await addAuditLog({
          user: 'SISTEMA',
          userName: 'Sistema Automático',
          action: 'USUARIO_INICIALIZADO',
          description: `Perfil de ADMINISTRADOR configurado para ${adminProfile.email}`,
          entityType: 'USER',
          entityId: adminProfile.id
        });
      }
    }
  } catch (err) {
    console.warn('[UserManagement] Erro ao sincronizar administradores iniciais:', err);
  }
}

async function seedInitialInvitesIfEmpty(): Promise<void> {
  if (cachedInvites.size > 0) return;

  const initialInvites = [
    {
      code: 'FIN-8K4P-X92M',
      role: 'FINANCEIRO' as UserRole,
      expirationDays: 30
    },
    {
      code: 'FIN-OPER-7B3Q',
      role: 'OPERADOR' as UserRole,
      expirationDays: 30
    },
    {
      code: 'FIN-CONS-9L1W',
      role: 'CONSULTA' as UserRole,
      expirationDays: 30
    }
  ];

  for (const inv of initialInvites) {
    await createInviteWithCode(
      inv.code,
      'admin@supermercado.com',
      inv.role,
      inv.expirationDays
    );
  }
}

export async function getUserProfiles(): Promise<UserProfile[]> {
  await ensureInitialized();

  // Atualizar last_sign_in_at dinamicamente a partir do Supabase Auth
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: authData } = await supabase.auth.admin.listUsers();
      if (authData?.users) {
        for (const authUser of authData.users) {
          const prof = cachedProfiles.get(authUser.id);
          if (prof && authUser.last_sign_in_at) {
            prof.lastSignInAt = authUser.last_sign_in_at;
          }
        }
      }
    } catch {}
  }

  return Array.from(cachedProfiles.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getUserProfileById(id: string): Promise<UserProfile | null> {
  await ensureInitialized();
  return cachedProfiles.get(id) || null;
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  await ensureInitialized();
  const cleanEmail = email.trim().toLowerCase();
  for (const prof of cachedProfiles.values()) {
    if (prof.email.toLowerCase() === cleanEmail) {
      return prof;
    }
  }
  return null;
}

export async function updateUserStatus(
  userId: string,
  newStatus: UserStatus,
  adminUserEmail: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  await ensureInitialized();
  const target = cachedProfiles.get(userId);
  if (!target) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  // Não permitir bloquear o último administrador ativo
  if (target.role === 'ADMINISTRADOR' && newStatus === 'BLOQUEADO') {
    const activeAdmins = Array.from(cachedProfiles.values()).filter(
      p => p.role === 'ADMINISTRADOR' && p.status === 'ATIVO' && p.id !== userId
    );
    if (activeAdmins.length === 0) {
      return { success: false, error: 'Não é permitido bloquear o único administrador ativo do sistema.' };
    }
  }

  const prevStatus = target.status;
  target.status = newStatus;
  cachedProfiles.set(target.id, target);

  // Persistir no SQLite local
  try {
    saveUserProfileSqlite(target);
  } catch (err) {
    console.error('[SQLite] Erro ao salvar status de perfil no SQLite:', err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('user_profiles').upsert([{
      id: target.id,
      data: target,
      updated_at: new Date().toISOString()
    }]);
  }

  const actionName = newStatus === 'ATIVO' ? 'USUARIO_ATIVADO' : newStatus === 'BLOQUEADO' ? 'USUARIO_BLOQUEADO' : 'USUARIO_PENDENTE';
  const desc = `Administrador ${adminUserEmail} alterou o status do usuário ${target.name} (${target.email}) de ${prevStatus} para ${newStatus}.`;

  await addAuditLog({
    user: adminUserEmail,
    action: actionName,
    description: desc,
    entityType: 'USER',
    entityId: target.id,
    metadata: { previousStatus: prevStatus, newStatus }
  });

  return { success: true, profile: target };
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  adminUserEmail: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  await ensureInitialized();
  const target = cachedProfiles.get(userId);
  if (!target) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  // Não permitir rebaixar o único administrador ativo
  if (target.role === 'ADMINISTRADOR' && newRole !== 'ADMINISTRADOR') {
    const activeAdmins = Array.from(cachedProfiles.values()).filter(
      p => p.role === 'ADMINISTRADOR' && p.status === 'ATIVO' && p.id !== userId
    );
    if (activeAdmins.length === 0) {
      return { success: false, error: 'O sistema deve possuir pelo menos um administrador ativo.' };
    }
  }

  const prevRole = target.role;
  target.role = newRole;
  cachedProfiles.set(target.id, target);

  // Persistir no SQLite local
  try {
    saveUserProfileSqlite(target);
  } catch (err) {
    console.error('[SQLite] Erro ao salvar novo perfil no SQLite:', err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('user_profiles').upsert([{
      id: target.id,
      data: target,
      updated_at: new Date().toISOString()
    }]);
  }

  await addAuditLog({
    user: adminUserEmail,
    action: 'PERFIL_ALTERADO',
    description: `Administrador ${adminUserEmail} alterou o perfil de ${target.name} (${target.email}) de ${prevRole} para ${newRole}.`,
    entityType: 'USER',
    entityId: target.id,
    metadata: { previousRole: prevRole, newRole }
  });

  return { success: true, profile: target };
}

// Gerenciamento de Convites
export async function getInvites(): Promise<UserInvite[]> {
  await ensureInitialized();
  const now = new Date();

  // Atualiza status dinamicamente para EXPIRADO se a data passou e ainda estava DISPONIVEL
  for (const inv of cachedInvites.values()) {
    if (inv.status === 'DISPONIVEL' && !inv.used && new Date(inv.expiresAt) < now) {
      inv.status = 'EXPIRADO';
    }
  }

  return Array.from(cachedInvites.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createInvite(
  adminEmail: string,
  role: UserRole = 'CONSULTA',
  expirationDays: number = 7,
  customCode?: string,
  recipientEmail?: string,
  autoActivate: boolean = true,
  notes?: string
): Promise<UserInvite> {
  const code = (customCode && customCode.trim())
    ? customCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    : generateInviteCode();
  return createInviteWithCode(code, adminEmail, role, expirationDays, recipientEmail, autoActivate, notes);
}

async function createInviteWithCode(
  code: string,
  adminEmail: string,
  role: UserRole = 'CONSULTA',
  expirationDays: number = 7,
  recipientEmail?: string,
  autoActivate: boolean = true,
  notes?: string
): Promise<UserInvite> {
  await ensureInitialized();

  const id = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000).toISOString();

  const invite: UserInvite = {
    id,
    code,
    role,
    createdBy: adminEmail,
    createdAt: now.toISOString(),
    expiresAt,
    used: false,
    usedBy: null,
    usedAt: null,
    status: 'DISPONIVEL',
    recipientEmail: recipientEmail?.trim() || null,
    autoActivate: autoActivate !== false,
    notes: notes?.trim() || null
  };

  cachedInvites.set(id, invite);

  // Persistir no SQLite local
  try {
    saveUserInviteSqlite(invite);
  } catch (err) {
    console.error('[SQLite] Erro ao salvar convite no SQLite:', err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('user_invites').upsert([{
        id,
        data: invite,
        updated_at: now.toISOString()
      }]);
    } catch (err) {
      console.error('[UserManagement] Erro ao salvar convite no Supabase:', err);
    }
  }

  await addAuditLog({
    user: adminEmail,
    action: 'CONVITE_GERADO',
    description: `Administrador ${adminEmail} gerou convite de acesso ${code} para o perfil ${role} (Validade: ${expirationDays} dias, Ativação imediata: ${invite.autoActivate ? 'SIM' : 'NÃO'}).`,
    entityType: 'INVITE',
    entityId: id,
    metadata: { code, role, expirationDays, recipientEmail: invite.recipientEmail, autoActivate: invite.autoActivate }
  });

  return invite;
}

export async function verifyInviteCode(rawCode: string): Promise<{
  valid: boolean;
  error?: string;
  invite?: UserInvite;
}> {
  await ensureInitialized();
  if (!rawCode || !rawCode.trim()) {
    return { valid: false, error: 'Código de convite obrigatório.' };
  }

  const cleanCode = rawCode.trim().toUpperCase();
  let foundInvite: UserInvite | null = null;

  for (const inv of cachedInvites.values()) {
    if (inv.code.toUpperCase() === cleanCode) {
      foundInvite = inv;
      break;
    }
  }

  if (!foundInvite) {
    return { valid: false, error: 'Código de convite inválido ou expirado.' };
  }

  if (foundInvite.used || foundInvite.status === 'UTILIZADO') {
    return { valid: false, error: 'Este código de convite já foi utilizado.' };
  }

  if (foundInvite.status === 'REVOGADO') {
    return { valid: false, error: 'Código de convite revogado pela administração.' };
  }

  if (new Date(foundInvite.expiresAt) < new Date()) {
    foundInvite.status = 'EXPIRADO';
    return { valid: false, error: 'Código de convite expirado.' };
  }

  return { valid: true, invite: foundInvite };
}

export async function consumeInviteAndCreateProfile(data: {
  userId: string;
  name: string;
  email: string;
  inviteCode: string;
}): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  await ensureInitialized();
  const { valid, error, invite } = await verifyInviteCode(data.inviteCode);
  if (!valid || !invite) {
    return { success: false, error: error || 'Código de convite inválido ou expirado.' };
  }

  const now = new Date().toISOString();

  // 1. Atualizar convite para UTILIZADO
  invite.used = true;
  invite.usedBy = data.email.toLowerCase();
  invite.usedAt = now;
  invite.status = 'UTILIZADO';
  cachedInvites.set(invite.id, invite);

  // 2. Criar perfil: se autoActivate for true, usuário entra ATIVO; se false, entra PENDENTE
  const initialStatus: UserStatus = (invite.autoActivate === false) ? 'PENDENTE' : 'ATIVO';

  const newProfile: UserProfile = {
    id: data.userId,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    role: invite.role || 'CONSULTA',
    status: initialStatus,
    createdAt: now,
    lastSignInAt: now,
    inviteCode: invite.code,
    invitedBy: invite.createdBy
  };

  cachedProfiles.set(newProfile.id, newProfile);

  // Persistir no SQLite local
  try {
    saveUserInviteSqlite(invite);
    saveUserProfileSqlite(newProfile);
  } catch (err) {
    console.error('[SQLite] Erro ao persistir cadastro e convite no SQLite:', err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await Promise.all([
        supabase.from('user_invites').upsert([{
          id: invite.id,
          data: invite,
          updated_at: now
        }]),
        supabase.from('user_profiles').upsert([{
          id: newProfile.id,
          data: newProfile,
          updated_at: now
        }])
      ]);
    } catch (err) {
      console.error('[UserManagement] Erro ao persistir cadastro no Supabase:', err);
    }
  }

  await addAuditLog({
    user: newProfile.email,
    userName: newProfile.name,
    action: 'NOVO_CADASTRO',
    description: `Novo usuário ${newProfile.name} (${newProfile.email}) realizou cadastro com o convite ${invite.code}. Status inicial: ${newProfile.status} (Perfil: ${newProfile.role}).`,
    entityType: 'USER',
    entityId: newProfile.id,
    metadata: { inviteCode: invite.code, role: newProfile.role, status: newProfile.status }
  });

  return { success: true, profile: newProfile };
}

export async function revokeInvite(
  inviteId: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  await ensureInitialized();
  const invite = cachedInvites.get(inviteId);
  if (!invite) {
    return { success: false, error: 'Convite não encontrado.' };
  }

  if (invite.used || invite.status === 'UTILIZADO') {
    return { success: false, error: 'Convites já utilizados não podem ser revogados.' };
  }

  invite.status = 'REVOGADO';
  cachedInvites.set(invite.id, invite);

  // Persistir no SQLite local
  try {
    saveUserInviteSqlite(invite);
  } catch (err) {
    console.error('[SQLite] Erro ao revogar convite no SQLite:', err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('user_invites').upsert([{
        id: invite.id,
        data: invite,
        updated_at: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('[UserManagement] Erro ao revogar convite no Supabase:', err);
    }
  }

  await addAuditLog({
    user: adminEmail,
    action: 'CONVITE_REVOGADO',
    description: `Administrador ${adminEmail} revogou o convite ${invite.code}.`,
    entityType: 'INVITE',
    entityId: invite.id,
    metadata: { code: invite.code }
  });

  return { success: true };
}
