/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeStorage } from '../utils/safeStorage';

function cleanEnvVar(val: any): string {
  if (!val || typeof val !== 'string') return '';
  let cleaned = val.trim();
  // Remove surrounding quotes if user accidentally pasted with quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

// Read values injected via Vite build/dev define
const envUrl = cleanEnvVar((import.meta as any).env?.VITE_SUPABASE_URL);
const envAnonKey = cleanEnvVar((import.meta as any).env?.VITE_SUPABASE_ANON_KEY);

let clientInstance: SupabaseClient | null = null;

export function configureSupabase(rawUrl: string, rawKey: string): SupabaseClient {
  const url = cleanEnvVar(rawUrl);
  const anonKey = cleanEnvVar(rawKey);

  if (url && anonKey && !anonKey.includes('placeholder')) {
    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          storage: safeStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return clientInstance;
    } catch (e) {
      console.warn('[Supabase Client] Falha ao reconfigurar cliente:', e);
    }
  }
  return getSupabase();
}

export function getSupabase(): SupabaseClient {
  if (!clientInstance) {
    const url = envUrl || (window as any).__SUPABASE_URL__ || 'https://placeholder.supabase.co';
    const anonKey = envAnonKey || (window as any).__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

    if (!envUrl || !envAnonKey) {
      console.warn('[Supabase Client] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas no build.');
    }

    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          storage: safeStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (e) {
      console.error('[Supabase Client] Erro ao inicializar cliente Supabase:', e);
      clientInstance = createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder', {
        auth: {
          storage: safeStorage,
          persistSession: false
        }
      });
    }
  }
  return clientInstance;
}

export const supabase = getSupabase();


