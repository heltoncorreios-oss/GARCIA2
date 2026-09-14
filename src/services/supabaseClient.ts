/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read values injected via Vite build/dev define
const envUrl = (((import.meta as any).env?.VITE_SUPABASE_URL as string) || '').trim();
const envAnonKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '').trim();

let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!clientInstance) {
    const url = envUrl || (window as any).__SUPABASE_URL__ || '';
    const anonKey = envAnonKey || (window as any).__SUPABASE_ANON_KEY__ || '';

    if (!url || !anonKey) {
      console.warn('[Supabase Client] URL ou Anon Key não configuradas no ambiente.');
    }

    clientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return clientInstance;
}

export const supabase = getSupabase();
