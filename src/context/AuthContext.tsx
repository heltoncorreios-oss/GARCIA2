import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabase, configureSupabase } from '../services/supabaseClient';
import { setApiAuthToken, apiService } from '../services/api';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signUpWithInvite: (data: {
    name: string;
    email: string;
    password: string;
    inviteCode: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REMEMBERED_EMAIL_KEY = 'supermarket_remembered_email';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Mapeamento amigável de erros do Supabase para o usuário final
  const mapAuthError = (err: any): string => {
    if (!err) return 'Ocorreu um erro na autenticação.';
    const msg = (err.message || '').toLowerCase();
    const status = err.status;

    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid credential') ||
      msg.includes('invalid_grant') ||
      status === 400
    ) {
      return 'E-mail ou senha incorretos.';
    }

    if (msg.includes('user already registered') || msg.includes('unique constraint') || msg.includes('already exists')) {
      return 'Este e-mail já está cadastrado no sistema.';
    }

    if (msg.includes('password should be at least')) {
      return 'A senha deve conter no mínimo 6 caracteres.';
    }

    if (msg.includes('email not confirmed')) {
      return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
    }

    if (
      msg.includes('invalid api key') ||
      msg.includes('invalid_api_key') ||
      msg.includes('invalid apikey')
    ) {
      return 'Chave de API do Supabase inválida. Verifique se a variável VITE_SUPABASE_ANON_KEY no Vercel contém a chave "anon / public" correta do seu projeto no Supabase (copiada em Project Settings > API).';
    }

    if (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('gateway')
    ) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
    }

    if (msg.includes('too many requests') || msg.includes('rate limit')) {
      return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.';
    }

    return err.message || 'Não foi possível autenticar. Verifique seus dados e tente novamente.';
  };

  const loadUserProfile = useCallback(async () => {
    try {
      const me = await apiService.getAuthMe();
      if (me?.profile) {
        setProfile(me.profile);
      }
    } catch (err) {
      console.warn('[AuthContext] Falha ao carregar perfil de usuário:', err);
    }
  }, []);

  const refreshProfile = async (): Promise<void> => {
    await loadUserProfile();
  };

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabase();

    // 1. Obter sessão inicial persistida oficialmente pelo Supabase
    async function initSession() {
      try {
        // Tenta sincronizar configuração ativa do servidor caso o frontend não tenha as variáveis no build
        try {
          const configRes = await fetch('/api/auth/config');
          if (configRes.ok) {
            const cfg = await configRes.json();
            if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
              configureSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);
            }
          }
        } catch {
          // Servidor offline ou rota indisponível, segue normalmente
        }

        const client = getSupabase();
        const { data, error } = await client.auth.getSession();
        if (error) {
          console.warn('[AuthContext] Erro ao recuperar sessão inicial:', error.message);
        }
        if (isMounted) {
          const activeSession = data?.session || null;
          setSession(activeSession);
          setUser(activeSession?.user || null);
          setApiAuthToken(activeSession?.access_token || null);
          if (activeSession?.access_token) {
            loadUserProfile();
          }
        }
      } catch (err) {
        console.error('[AuthContext] Falha ao verificar sessão:', err);
        if (isMounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setApiAuthToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initSession();

    // 2. Escutar eventos de autenticação oficiais do Supabase (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user || null);
      setApiAuthToken(newSession?.access_token || null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setApiAuthToken(null);
      } else if (newSession?.access_token) {
        loadUserProfile();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signIn = async (
    email: string,
    password: string,
    rememberMe = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim();
      const supabase = getSupabase();

      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      // Se falhar por chave de API ou conexão, tenta obter chaves atualizadas do servidor e tenta mais uma vez
      if (
        error &&
        (error.message?.toLowerCase().includes('invalid api key') ||
          error.message?.toLowerCase().includes('failed to fetch'))
      ) {
        try {
          const configRes = await fetch('/api/auth/config');
          if (configRes.ok) {
            const cfg = await configRes.json();
            if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
              const freshClient = configureSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);
              const retryResult = await freshClient.auth.signInWithPassword({
                email: cleanEmail,
                password
              });
              if (!retryResult.error && retryResult.data?.session) {
                data = retryResult.data;
                error = null;
              } else if (retryResult.error) {
                error = retryResult.error;
              }
            }
          }
        } catch {
          // Segue com o erro original
        }
      }

      if (error) {
        return { success: false, error: mapAuthError(error) };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.user);
        setApiAuthToken(data.session.access_token);

        // Opção "Lembrar acesso": salvar apenas o e-mail no storage local seguro para conveniência
        if (rememberMe) {
          try {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
          } catch {}
        } else {
          try {
            localStorage.removeItem(REMEMBERED_EMAIL_KEY);
          } catch {}
        }

        await loadUserProfile();
        return { success: true };
      }

      return { success: false, error: 'E-mail ou senha incorretos.' };
    } catch (err: any) {
      console.error('[AuthContext] Erro em signIn:', err);
      return { success: false, error: mapAuthError(err) };
    }
  };

  const signUpWithInvite = async (data: {
    name: string;
    email: string;
    password: string;
    inviteCode: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanName = data.name.trim();
      const cleanCode = data.inviteCode.trim().toUpperCase();

      // 1. Validar código de convite com o servidor antes do cadastro
      const inviteCheck = await apiService.verifyInvite(cleanCode);
      if (!inviteCheck.valid) {
        return { success: false, error: inviteCheck.error || 'Código de convite inválido ou expirado.' };
      }

      const supabase = getSupabase();

      // 2. Criar usuário no Supabase Auth via signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            name: cleanName,
            inviteCode: cleanCode
          }
        }
      });

      if (signUpError) {
        return { success: false, error: mapAuthError(signUpError) };
      }

      const createdUser = signUpData.user;
      if (!createdUser) {
        return { success: false, error: 'Não foi possível criar o usuário no sistema.' };
      }

      // 3. Registrar o perfil e associar o convite consumido
      const regRes = await apiService.registerProfile({
        userId: createdUser.id,
        name: cleanName,
        email: cleanEmail,
        inviteCode: cleanCode
      });

      if (!regRes.success) {
        return { success: false, error: regRes.error || 'Erro ao vincular convite.' };
      }

      // 4. Efetuar login imediatamente para carregar a sessão
      const loginRes = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: data.password
      });

      if (loginRes.data?.session) {
        setSession(loginRes.data.session);
        setUser(loginRes.data.user);
        setApiAuthToken(loginRes.data.session.access_token);
        await loadUserProfile();
      }

      return { success: true };
    } catch (err: any) {
      console.error('[AuthContext] Erro em signUpWithInvite:', err);
      return { success: false, error: err.message || 'Falha ao processar cadastro com convite.' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Erro ao deslogar do Supabase:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      setApiAuthToken(null);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        return { success: false, error: 'Por favor, informe seu e-mail cadastrado.' };
      }

      const supabase = getSupabase();
      const redirectUrl = `${window.location.origin}/login`;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl
      });

      if (error) {
        return { success: false, error: mapAuthError(error) };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[AuthContext] Erro ao solicitar recuperação de senha:', err);
      return { success: false, error: mapAuthError(err) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUpWithInvite,
        signOut,
        resetPassword,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
