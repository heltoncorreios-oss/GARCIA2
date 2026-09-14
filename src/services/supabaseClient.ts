/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read values injected via Vite build/dev define
const envUrl = (((import.meta as any).env?.VITE_SUPABASE_URL as string) || '').trim();
const envAnonKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '').trim();

let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!clientInstance) {
    const url = envUrl || (window as any).__SUPABASE_URL__ || 'https://placeholder.supabase.co';
    const anonKey = envAnonKey || (window as any).__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

    if (!envUrl || !envAnonKey) {
      console.warn('[Supabase Client] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas. Usando cliente em modo de espera.');
    }

    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (e) {
      console.error('[Supabase Client] Erro ao inicializar cliente Supabase:', e);
      // Fallback seguro para evitar tela branca
      clientInstance = createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder');
    }
  }
  return clientInstance;
}

export const supabase = getSupabase();

