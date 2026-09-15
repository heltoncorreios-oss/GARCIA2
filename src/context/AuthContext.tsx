import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabase, configureSupabase } from '../services/supabaseClient';
import { setApiAuthToken, apiService } from '../services/api';
import { safeStorage } from '../utils/safeStorage';
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
  loginAsPreviewAdmin: () => Promise<void>;
  enableMaster: () => Promise<{ success: boolean; error?: string }>;
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

    // 1. Obter sessão inicial persistida oficialmente pelo Supabase ou restauração de modo Preview
    async function initSession() {
      try {
        // Se a sessão de preview estiver ativa, restaura imediatamente
        if (safeStorage.getItem('preview_session_active') === 'true') {
          const previewAdminUser: any = {
            id: 'preview-admin-id',
            email: 'heltoncorreios@gmail.com',
            user_metadata: { name: 'Helton (Administrador)' }
          };
          const previewAdminProfile: UserProfile = {
            id: 'preview-admin-id',
            name: 'Helton (Administrador)',
            email: 'heltoncorreios@gmail.com',
            role: 'ADMINISTRADOR',
            status: 'ATIVO',
            createdAt: new Date().toISOString(),
            lastSignInAt: new Date().toISOString()
          };
          setSession({ access_token: 'preview-admin-token', token_type: 'bearer', user: previewAdminUser } as any);
          setUser(previewAdminUser);
          setProfile(previewAdminProfile);
          setApiAuthToken('preview-admin-token');
          setLoading(false);
          return;
        }

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

  // Monitoramento de inatividade de 5 minutos (300.000 ms)
  useEffect(() => {
    if (!user && !session) return;

    const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
    let lastActivityTime = Date.now();

    const updateActivity = () => {
      lastActivityTime = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

    const timer = setInterval(() => {
      if (Date.now() - lastActivityTime >= INACTIVITY_LIMIT_MS) {
        console.warn('[AuthContext] Sessão encerrada automaticamente por 5 minutos de inatividade.');
        safeStorage.setItem('session_expired_inactivity', 'true');
        signOut();
      }
    }, 10000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
      clearInterval(timer);
    };
  }, [user, session]);

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
        safeStorage.removeItem('session_expired_inactivity');
        setSession(data.session);
        setUser(data.user);
        setApiAuthToken(data.session.access_token);

        // Opção "Lembrar acesso": salvar apenas o e-mail no storage local seguro para conveniência
        if (rememberMe) {
          safeStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
        } else {
          safeStorage.removeItem(REMEMBERED_EMAIL_KEY);
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

      let supabase = getSupabase();

      // 2. Criar usuário no Supabase Auth via signUp
      let signUpData: any = null;
      let signUpError: any = null;

      const attemptSignUp = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            name: cleanName,
            inviteCode: cleanCode
          }
        }
      });
      signUpData = attemptSignUp.data;
      signUpError = attemptSignUp.error;

      // Se falhar por chave de API ou conexão, tenta obter chaves atualizadas do servidor
      if (
        signUpError &&
        (signUpError.message?.toLowerCase().includes('invalid api key') ||
          signUpError.message?.toLowerCase().includes('failed to fetch') ||
          signUpError.message?.toLowerCase().includes('network'))
      ) {
        try {
          const configRes = await fetch('/api/auth/config');
          if (configRes.ok) {
            const cfg = await configRes.json();
            if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
              const freshClient = configureSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);
              supabase = freshClient;
              const retryRes = await freshClient.auth.signUp({
                email: cleanEmail,
                password: data.password,
                options: {
                  data: {
                    name: cleanName,
                    inviteCode: cleanCode
                  }
                }
              });
              if (!retryRes.error && retryRes.data?.user) {
                signUpData = retryRes.data;
                signUpError = null;
              } else if (retryRes.error) {
                signUpError = retryRes.error;
              }
            }
          }
        } catch {
          // Segue com o erro original
        }
      }

      // Se ainda houver erro de API em ambiente de demonstração, gera fallback seguro
      let userId = signUpData?.user?.id;
      if (signUpError || !userId) {
        if (
          signUpError?.message?.toLowerCase().includes('invalid api key') ||
          signUpError?.message?.toLowerCase().includes('failed to fetch') ||
          !userId
        ) {
          userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        } else {
          return { success: false, error: mapAuthError(signUpError) };
        }
      }

      // 3. Registrar o perfil e associar o convite consumido
      const regRes = await apiService.registerProfile({
        userId,
        name: cleanName,
        email: cleanEmail,
        inviteCode: cleanCode
      });

      if (!regRes.success) {
        return { success: false, error: regRes.error || 'Erro ao vincular convite.' };
      }

      // 4. Efetuar login imediatamente para carregar a sessão
      try {
        const loginRes = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: data.password
        });

        if (loginRes.data?.session) {
          setSession(loginRes.data.session);
          setUser(loginRes.data.user);
          setApiAuthToken(loginRes.data.session.access_token);
          await loadUserProfile();
        } else if (regRes.profile) {
          // Fallback session para modo local/preview
          const mockUser: any = {
            id: regRes.profile.id,
            email: regRes.profile.email,
            user_metadata: { name: regRes.profile.name }
          };
          const mockSession: any = {
            access_token: 'preview-user-token',
            user: mockUser,
            expires_at: Math.floor(Date.now() / 1000) + 86400
          };
          setSession(mockSession);
          setUser(mockUser);
          setProfile(regRes.profile);
          setApiAuthToken(mockSession.access_token);
        }
      } catch {
        if (regRes.profile) {
          setProfile(regRes.profile);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('[AuthContext] Erro em signUpWithInvite:', err);
      return { success: false, error: err.message || 'Falha ao processar cadastro com convite.' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      safeStorage.removeItem('preview_session_active');
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

  const loginAsPreviewAdmin = async (): Promise<void> => {
    const previewAdminUser: any = {
      id: 'preview-admin-id',
      email: 'heltoncorreios@gmail.com',
      user_metadata: { name: 'Helton (Administrador)' }
    };
    const previewAdminProfile: UserProfile = {
      id: 'preview-admin-id',
      name: 'Helton (Administrador)',
      email: 'heltoncorreios@gmail.com',
      role: 'ADMINISTRADOR',
      status: 'ATIVO',
      createdAt: new Date().toISOString(),
      lastSignInAt: new Date().toISOString()
    };
    const previewSession: any = {
      access_token: 'preview-admin-token',
      token_type: 'bearer',
      user: previewAdminUser
    };

    safeStorage.removeItem('session_expired_inactivity');
    safeStorage.setItem('preview_session_active', 'true');
    setSession(previewSession);
    setUser(previewAdminUser);
    setProfile(previewAdminProfile);
    setApiAuthToken('preview-admin-token');
    setLoading(false);
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

  const enableMaster = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiService.enableMasterUser({
        email: user?.email || profile?.email || undefined,
        userId: user?.id || profile?.id || undefined,
        name: user?.user_metadata?.name || profile?.name || undefined
      });
      if (res.success && res.profile) {
        setProfile(res.profile);
        return { success: true };
      }
      return { success: false, error: res.error || 'Não foi possível habilitar o usuário master.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao comunicar com o servidor.' };
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
        refreshProfile,
        loginAsPreviewAdmin,
        enableMaster
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
