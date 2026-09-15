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
let initPromise: Promise<void> | null = null;

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
    withTimeout(
      supabase.from('audit_logs').insert([{
        id: log.id,
        data: log,
        updated_at: log.timestamp
      }]),
      2000
    ).catch(err => {
      console.warn('[Auditoria] Falha ao persistir no Supabase:', err.message);
    });
  }

  return log;
}

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Supabase request timeout')), ms);
      if (timer && typeof (timer as any).unref === 'function') {
        (timer as any).unref();
      }
    })
  ]);
}

export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  await ensureInitialized();
  return cachedAuditLogs.slice(0, limit);
}

export async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Carregar primeiro dados do SQLite local de forma instantânea
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

    // 2. Garantir administradores conhecidos em cache e SQLite
    ensureLocalAdmins();

    // 3. Garantir convites iniciais em cache e SQLite
    ensureLocalInvites();

    // 4. Marcar inicialização local como concluída imediatamente
    isInitialized = true;

    // 5. Em background (sem bloquear requisições da aplicação), sincronizar com Supabase se configurado
    syncWithSupabaseBackground().catch(err => {
      console.warn('[UserManagement] Sincronização background com Supabase falhou:', err?.message || err);
    });
  })();

  return initPromise;
}

function ensureLocalAdmins(): void {
  const adminEmails = ['admin@supermercado.com', 'heltoncorreios@gmail.com'];
  for (const email of adminEmails) {
    let existing = Array.from(cachedProfiles.values()).find(p => p.email.toLowerCase() === email);
    if (!existing) {
      const defaultAdmin: UserProfile = {
        id: email === 'admin@supermercado.com' ? 'user_admin_local' : 'user_helton_admin',
        name: email === 'admin@supermercado.com' ? 'Administrador Financeiro' : 'Helton (Administrador Master)',
        email: email,
        role: 'ADMINISTRADOR',
        status: 'ATIVO',
        createdAt: new Date().toISOString(),
        lastSignInAt: new Date().toISOString()
      };
      cachedProfiles.set(defaultAdmin.id, defaultAdmin);
      try {
        saveUserProfileSqlite(defaultAdmin);
      } catch {}
    } else {
      existing.role = 'ADMINISTRADOR';
      existing.status = 'ATIVO';
      if (email === 'heltoncorreios@gmail.com' && !existing.name.includes('Master')) {
        existing.name = 'Helton (Administrador Master)';
      }
      cachedProfiles.set(existing.id, existing);
      try {
        saveUserProfileSqlite(existing);
      } catch {}
    }
  }
}

function ensureLocalInvites(): void {
  if (cachedInvites.size > 0) return;
  const initialInvites = [
    { code: 'FIN-8K4P-X92M', role: 'FINANCEIRO' as UserRole, expirationDays: 30 },
    { code: 'FIN-OPER-7B3Q', role: 'OPERADOR' as UserRole, expirationDays: 30 },
    { code: 'FIN-CONS-9L1W', role: 'CONSULTA' as UserRole, expirationDays: 30 }
  ];
  for (const inv of initialInvites) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + inv.expirationDays * 24 * 60 * 60 * 1000).toISOString();
    const id = 'inv_init_' + inv.code.replace(/-/g, '_');
    const invite: UserInvite = {
      id,
      code: inv.code,
      role: inv.role,
      createdBy: 'admin@supermercado.com',
      createdAt: now.toISOString(),
      expiresAt,
      used: false,
      usedBy: null,
      usedAt: null,
      status: 'DISPONIVEL',
      recipientEmail: null,
      autoActivate: true,
      notes: 'Convite inicial gerado pelo sistema'
    };
    cachedInvites.set(id, invite);
    try {
      saveUserInviteSqlite(invite);
    } catch {}
  }
}

async function syncWithSupabaseBackground(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // Sincronizar perfis
    const profPromise = supabase.from('user_profiles').select('*');
    const { data: profRows, error: profErr }: any = await withTimeout(profPromise, 3000).catch(() => ({ data: null, error: null }));
    if (!profErr && profRows) {
      for (const row of profRows) {
        if (row.data) {
          const current = cachedProfiles.get(row.data.id);
          // Se já for administrador no SQLite local, não fazer downgrade
          if (current && current.role === 'ADMINISTRADOR' && row.data.role !== 'ADMINISTRADOR') {
            row.data.role = 'ADMINISTRADOR';
          }
          cachedProfiles.set(row.data.id, row.data);
          saveUserProfileSqlite(row.data);
        }
      }
    }

    // Fazer upload de perfis locais de administrador para o Supabase
    for (const p of cachedProfiles.values()) {
      if (p.role === 'ADMINISTRADOR') {
        withTimeout(
          supabase.from('user_profiles').upsert([{ id: p.id, data: p, updated_at: new Date().toISOString() }]),
          2000
        ).catch(() => {});
      }
    }

    // Sincronizar convites
    const invPromise = supabase.from('user_invites').select('*');
    const { data: invRows, error: invErr }: any = await withTimeout(invPromise, 3000).catch(() => ({ data: null, error: null }));
    if (!invErr && invRows) {
      for (const row of invRows) {
        if (row.data) {
          cachedInvites.set(row.data.id, row.data);
          saveUserInviteSqlite(row.data);
        }
      }
    }

    // Fazer upload de convites locais para o Supabase
    for (const inv of cachedInvites.values()) {
      withTimeout(
        supabase.from('user_invites').upsert([{ id: inv.id, data: inv, updated_at: new Date().toISOString() }]),
        2000
      ).catch(() => {});
    }

    // Carregar logs de auditoria
    const auditPromise = supabase.from('audit_logs').select('*').order('updated_at', { ascending: false }).limit(200);
    const { data: auditRows, error: auditErr }: any = await withTimeout(auditPromise, 3000).catch(() => ({ data: null, error: null }));
    if (!auditErr && auditRows) {
      const remoteLogs = auditRows.map((r: any) => r.data).filter(Boolean);
      if (remoteLogs.length > 0) {
        cachedAuditLogs = remoteLogs;
      }
    }

    // Se tiver service role key, verificar Auth Users
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const listPromise = supabase.auth.admin.listUsers();
        const { data: authData }: any = await withTimeout(listPromise, 3000).catch(() => ({ data: null }));
        if (authData?.users) {
          for (const authUser of authData.users) {
            const email = (authUser.email || '').toLowerCase();
            if (email === 'heltoncorreios@gmail.com' || email === 'admin@supermercado.com') {
              let existing = Array.from(cachedProfiles.values()).find(
                p => p.id === authUser.id || p.email.toLowerCase() === email
              );
              const adminProfile: UserProfile = {
                id: existing ? existing.id : authUser.id,
                name: existing?.name || (email.includes('helton') ? 'Helton (Administrador Master)' : 'Administrador Financeiro'),
                email: authUser.email!,
                role: 'ADMINISTRADOR',
                status: 'ATIVO',
                createdAt: existing?.createdAt || authUser.created_at || new Date().toISOString(),
                lastSignInAt: authUser.last_sign_in_at || existing?.lastSignInAt || null
              };
              cachedProfiles.set(adminProfile.id, adminProfile);
              cachedProfiles.set(authUser.id, adminProfile);
              saveUserProfileSqlite(adminProfile);
              withTimeout(
                supabase.from('user_profiles').upsert([{ id: authUser.id, data: adminProfile, updated_at: new Date().toISOString() }]),
                2000
              ).catch(() => {});
            }
          }
        }
      } catch {}
    }
  } catch (err: any) {
    console.warn('[UserManagement] Erro na sincronização com Supabase:', err.message);
  }
}

export async function getUserProfiles(): Promise<UserProfile[]> {
  await ensureInitialized();

  // Atualizar last_sign_in_at dinamicamente a partir do Supabase Auth
  const supabase = getSupabaseClient();
  if (supabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const listPromise = supabase.auth.admin.listUsers();
      const timeoutPromise = new Promise<{ data: null }>(res =>
        setTimeout(() => res({ data: null }), 3000)
      );
      const { data: authData }: any = await Promise.race([listPromise, timeoutPromise]);
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

export async function ensureUserIsAdmin(email: string, userId: string, name?: string): Promise<UserProfile> {
  await ensureInitialized();
  const cleanEmail = (email || '').toLowerCase().trim();
  let profile = await getUserProfileById(userId);
  if (!profile && cleanEmail) {
    profile = await getUserProfileByEmail(cleanEmail);
  }

  if (!profile) {
    profile = {
      id: userId,
      name: name || (cleanEmail.includes('helton') ? 'Helton (Administrador Master)' : cleanEmail.split('@')[0]),
      email: cleanEmail,
      role: 'ADMINISTRADOR',
      status: 'ATIVO',
      createdAt: new Date().toISOString(),
      lastSignInAt: new Date().toISOString()
    };
  } else {
    profile.role = 'ADMINISTRADOR';
    profile.status = 'ATIVO';
    if (name && (!profile.name || profile.name.includes('@') || profile.name === 'Consulta')) {
      profile.name = name;
    }
  }

  // Sincronizar ID de autenticação
  cachedProfiles.set(profile.id, profile);
  if (userId && userId !== profile.id) {
    cachedProfiles.set(userId, profile);
  }

  try {
    saveUserProfileSqlite(profile);
    const supabase = getSupabaseClient();
    if (supabase) {
      withTimeout(
        supabase.from('user_profiles').upsert([{ id: profile.id, data: profile, updated_at: new Date().toISOString() }]),
        2000
      ).catch(() => {});
      if (userId && userId !== profile.id) {
        withTimeout(
          supabase.from('user_profiles').upsert([{ id: userId, data: profile, updated_at: new Date().toISOString() }]),
          2000
        ).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn('[UserManagement] Erro ao sincronizar perfil de administrador:', err.message);
  }
  return profile;
}

export async function enableMasterUser(email?: string, userId?: string, name?: string): Promise<UserProfile> {
  await ensureInitialized();
  const targetEmail = (email || 'heltoncorreios@gmail.com').toLowerCase().trim();
  let profile: UserProfile | null = null;
  if (userId) {
    profile = await getUserProfileById(userId);
  }
  if (!profile && targetEmail) {
    profile = await getUserProfileByEmail(targetEmail);
  }

  const defaultName = name || (targetEmail.includes('helton') ? 'Helton (Administrador Master)' : 'Administrador Master');

  if (!profile) {
    profile = {
      id: userId || 'user_master_' + Date.now(),
      name: defaultName,
      email: targetEmail,
      role: 'ADMINISTRADOR',
      status: 'ATIVO',
      createdAt: new Date().toISOString(),
      lastSignInAt: new Date().toISOString()
    };
  } else {
    profile.role = 'ADMINISTRADOR';
    profile.status = 'ATIVO';
    profile.name = defaultName;
  }

  cachedProfiles.set(profile.id, profile);
  if (userId && userId !== profile.id) {
    cachedProfiles.set(userId, profile);
  }

  try {
    saveUserProfileSqlite(profile);
    const supabase = getSupabaseClient();
    if (supabase) {
      withTimeout(
        supabase.from('user_profiles').upsert([{ id: profile.id, data: profile, updated_at: new Date().toISOString() }]),
        2500
      ).catch(err => {
        console.warn('[UserManagement] Erro ao sincronizar master profile com Supabase:', err.message);
      });
      if (userId && userId !== profile.id) {
        withTimeout(
          supabase.from('user_profiles').upsert([{ id: userId, data: profile, updated_at: new Date().toISOString() }]),
          2500
        ).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn('[UserManagement] Erro ao salvar master profile no Supabase:', err.message);
  }

  try {
    await addAuditLog({
      user: profile.email,
      userName: profile.name,
      action: 'USUARIO_PROMOVIDO_MASTER',
      description: `Perfil ${profile.email} ativado como ADMINISTRADOR MASTER com privilégios irrestritos`,
      entityType: 'USER',
      entityId: profile.id
    });
  } catch {}

  return profile;
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
    withTimeout(
      supabase.from('user_profiles').upsert([{
        id: target.id,
        data: target,
        updated_at: new Date().toISOString()
      }]),
      2000
    ).catch(() => {});
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
    withTimeout(
      supabase.from('user_profiles').upsert([{
        id: target.id,
        data: target,
        updated_at: new Date().toISOString()
      }]),
      2000
    ).catch(() => {});
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
    withTimeout(
      supabase.from('user_invites').upsert([{
        id,
        data: invite,
        updated_at: now.toISOString()
      }]),
      2000
    ).catch(err => {
      console.warn('[UserManagement] Erro ao salvar convite no Supabase:', err.message);
    });
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
    withTimeout(
      Promise.all([
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
      ]),
      2500
    ).catch(err => {
      console.warn('[UserManagement] Erro ao persistir cadastro no Supabase:', err.message);
    });
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
    withTimeout(
      supabase.from('user_invites').upsert([{
        id: invite.id,
        data: invite,
        updated_at: new Date().toISOString()
      }]),
      2000
    ).catch(err => {
      console.warn('[UserManagement] Erro ao revogar convite no Supabase:', err.message);
    });
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
