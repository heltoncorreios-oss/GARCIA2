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
      safeStorage.setItem('supermercado_supabase_url', url);
      safeStorage.setItem('supermercado_supabase_anon_key', anonKey);
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
    const storedUrl = safeStorage.getItem('supermercado_supabase_url') || '';
    const storedAnonKey = safeStorage.getItem('supermercado_supabase_anon_key') || '';
    const fallbackUrl = 'https://zvwgukqvtmmtjiqrvhtd.supabase.co';
    const fallbackAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2d2d1a3F2dG1tdGppcXJ2aHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTkxMDQsImV4cCI6MjEwNDk3NTEwNH0.Hw4KmRxZ8ypl_pvIUQ0N80ii1FuNcjs-uM3sdwhU6-M';
    
    const url = envUrl || storedUrl || (window as any).__SUPABASE_URL__ || fallbackUrl;
    const anonKey = envAnonKey || storedAnonKey || (window as any).__SUPABASE_ANON_KEY__ || fallbackAnon;

    if (!envUrl && !storedUrl) {
      console.warn('[Supabase Client] Usando fallback de conexão do Supabase.');
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
      clientInstance = createClient(fallbackUrl, fallbackAnon, {
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


