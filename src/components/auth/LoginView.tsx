import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { safeStorage } from '../../utils/safeStorage';
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  ArrowLeft,
  Ticket,
  User,
  UserPlus,
  ShieldCheck
} from 'lucide-react';

const REMEMBERED_EMAIL_KEY = 'supermarket_remembered_email';

export const LoginView: React.FC = () => {
  const {
    user,
    session,
    loading: authLoading,
    signIn,
    signUpWithInvite,
    resetPassword,
    loginAsPreviewAdmin
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState<string>(() => {
    return safeStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  });
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return Boolean(safeStorage.getItem(REMEMBERED_EMAIL_KEY));
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState<boolean>(() => {
    return safeStorage.getItem('session_expired_inactivity') === 'true';
  });

  // Password Recovery Mode State
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState<boolean>(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState<boolean>(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);
  const [recoveryErrorMessage, setRecoveryErrorMessage] = useState<string | null>(null);

  // Controlled Registration Mode State (Req 1, 2, 3, 4)
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [registerName, setRegisterName] = useState<string>('');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState<string>('');
  const [registerInviteCode, setRegisterInviteCode] = useState<string>('');
  const [showRegisterPassword, setShowRegisterPassword] = useState<boolean>(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // Live Invite Code Validation
  const [isCheckingInvite, setIsCheckingInvite] = useState<boolean>(false);
  const [inviteStatusInfo, setInviteStatusInfo] = useState<{
    valid: boolean;
    role?: string;
    error?: string;
  } | null>(null);

  // Read invite query param from URL (e.g. /login?invite=FIN-XXXX-XXXX)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const inviteParam = params.get('invite') || params.get('convite') || params.get('code');
    if (inviteParam) {
      setIsRegisterMode(true);
      setRegisterInviteCode(inviteParam.toUpperCase().trim());
    }
  }, [location.search]);

  // Live check invite code with debounce
  useEffect(() => {
    const cleanCode = registerInviteCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 5 || !isRegisterMode) {
      setInviteStatusInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingInvite(true);
        const res = await apiService.verifyInvite(cleanCode);
        if (res.valid && res.invite) {
          setInviteStatusInfo({
            valid: true,
            role: res.invite.role
          });
        } else {
          setInviteStatusInfo({
            valid: false,
            error: res.error || 'Código inválido ou expirado'
          });
        }
      } catch (err: any) {
        setInviteStatusInfo({
          valid: false,
          error: err.message || 'Erro ao validar código'
        });
      } finally {
        setIsCheckingInvite(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [registerInviteCode, isRegisterMode]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && session && user) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [authLoading, session, user, navigate, location]);

  const handlePreviewAccess = async () => {
    setIsSubmitting(true);
    try {
      await loginAsPreviewAdmin();
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao entrar no modo preview.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Por favor, informe seu e-mail cadastrado.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor, digite sua senha.');
    }

    try {
      setIsSubmitting(true);
      const res = await signIn(trimmedEmail, password, rememberMe);
      if (!res.success) {
        setErrorMessage(res.error || 'E-mail ou senha incorretos.');
      } else {
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSuccess(null);

    const trimmedName = registerName.trim();
    const trimmedEmail = registerEmail.trim();
    const trimmedCode = registerInviteCode.trim().toUpperCase();

    // 1. Validar nome
    if (!trimmedName) {
      setRegisterError('Por favor, informe seu nome completo.');
      return;
    }

    // 2. Validar e-mail
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setRegisterError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    // 3. Validar senha >= 6 caracteres
    if (registerPassword.length < 6) {
      setRegisterError('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    // 4. Confirmação de senha
    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('A confirmação da senha não confere com a senha informada.');
      return;
    }

    // 5. Código de convite obrigatório
    if (!trimmedCode) {
      setRegisterError('O código de convite fornecido pelo administrador é obrigatório.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await signUpWithInvite({
        name: trimmedName,
        email: trimmedEmail,
        password: registerPassword,
        inviteCode: trimmedCode
      });

      if (!res.success) {
        setRegisterError(res.error || 'Não foi possível concluir o cadastro com o convite.');
      } else {
        setRegisterSuccess('Cadastro realizado com sucesso! Redirecionando...');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);
      }
    } catch (err: any) {
      setRegisterError('Erro de conexão ao registrar usuário. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryErrorMessage(null);
    setRecoverySuccessMessage(null);

    const trimmedEmail = (recoveryEmail || email).trim();
    if (!trimmedEmail) {
      setRecoveryErrorMessage('Informe o e-mail de acesso para receber as instruções.');
      return;
    }

    try {
      setIsSubmittingRecovery(true);
      const res = await resetPassword(trimmedEmail);
      if (!res.success) {
        setRecoveryErrorMessage(res.error || 'Não foi possível enviar o e-mail de recuperação.');
      } else {
        setRecoverySuccessMessage(
          `Instruções para redefinição de senha foram enviadas para ${trimmedEmail}. Verifique sua caixa de entrada e pasta de spam.`
        );
      }
    } catch (err) {
      setRecoveryErrorMessage('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Central Login Card */}
      <div className="w-full max-w-md bg-white border border-black rounded-3xl p-6 sm:p-8 shadow-2xl shadow-zinc-200/50 space-y-6">
        {/* Brand & System Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/30 border border-orange-700/30">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              Supermercado Central
            </h1>
            <p className="text-xs sm:text-sm font-bold text-zinc-700 mt-1">
              Gestão Financeira & Conciliação Bancária
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-300 text-[11px] font-bold text-orange-800 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            {isRegisterMode ? 'Cadastro Controlado' : isForgotPasswordMode ? 'Recuperação de Acesso' : 'Acesso Restrito'}
          </div>
        </div>

        {/* 1. Normal Login Form */}
        {!isForgotPasswordMode && !isRegisterMode && (
          <form onSubmit={handleLogin} className="space-y-4 pt-1">
            {/* Inactivity Warning Banner */}
            {inactivityNotice && (
              <div
                id="inactivity-notice-message"
                className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900 font-bold animate-in fade-in duration-200"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Sua sessão foi encerrada automaticamente por 5 minutos de inatividade por motivos de segurança financeira. Faça login novamente para prosseguir.
                </span>
              </div>
            )}

            {/* Error banner */}
            {errorMessage && (
              <div
                id="login-error-message"
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 flex items-start gap-2.5 text-xs text-rose-800 font-bold animate-in fade-in duration-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                E-mail de Acesso
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="usuario@supermercado.com"
                  autoComplete="username"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-3 text-sm font-semibold text-zinc-950 bg-white border border-black rounded-xl placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600 transition-all disabled:bg-zinc-100"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                  Senha
                </label>
                <button
                  type="button"
                  id="btn-forgot-password"
                  onClick={() => {
                    setIsForgotPasswordMode(true);
                    setRecoveryEmail(email);
                    setRecoveryErrorMessage(null);
                    setRecoverySuccessMessage(null);
                  }}
                  className="text-xs font-bold text-orange-700 hover:text-orange-900 transition-colors hover:underline cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-3 text-sm font-semibold text-zinc-950 bg-white border border-black rounded-xl placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600 transition-all disabled:bg-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="checkbox-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded-md border-black text-orange-600 focus:ring-orange-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-zinc-800">Lembrar acesso</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-login-submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-sm rounded-xl shadow-md shadow-orange-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Autenticando acesso...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>

            {/* Divisor Modo Preview */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-zinc-600 font-bold tracking-wider">Acesso Rápido no Preview</span>
              </div>
            </div>

            {/* Botão de Acesso Imediato no Preview */}
            <button
              type="button"
              id="btn-login-preview"
              onClick={handlePreviewAccess}
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-700"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Entrar como Administrador (Modo Preview)</span>
            </button>

            {/* Link para Criar Conta com Convite */}
            <div className="pt-3 border-t border-zinc-200 text-center">
              <p className="text-xs text-zinc-600 font-medium">
                Possui um código de convite da administração?{' '}
                <button
                  type="button"
                  id="btn-switch-to-register"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setRegisterError(null);
                    setRegisterSuccess(null);
                  }}
                  className="font-bold text-orange-700 hover:text-orange-950 underline cursor-pointer"
                >
                  Criar conta
                </button>
              </p>
            </div>
          </form>
        )}

        {/* 2. Controlled Registration Form (Req 1, 2, 3, 4) */}
        {isRegisterMode && (
          <form onSubmit={handleRegister} className="space-y-3.5 pt-1">
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-2.5">
              <button
                type="button"
                id="btn-register-back-to-login"
                onClick={() => setIsRegisterMode(false)}
                className="p-1.5 -ml-1 text-zinc-600 hover:text-zinc-950 rounded-lg hover:bg-zinc-100 transition-colors"
                title="Voltar ao login"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wide">
                  Criar Conta com Convite
                </h3>
              </div>
            </div>

            {/* Error and Success banners */}
            {registerError && (
              <div
                id="register-error-message"
                className="p-3 rounded-xl bg-rose-50 border border-rose-300 flex items-start gap-2 text-xs text-rose-800 font-bold animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{registerError}</span>
              </div>
            )}

            {registerSuccess && (
              <div
                id="register-success-message"
                className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex items-start gap-2 text-xs text-emerald-800 font-bold animate-in fade-in"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span className="leading-snug">{registerSuccess}</span>
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-1">
              <label htmlFor="reg-name" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                Nome Completo *
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="reg-name"
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silveira"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold text-zinc-950 bg-white border border-black rounded-xl placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="reg-email" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                E-mail Corporativo *
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="reg-email"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="carlos@supermercado.com"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold text-zinc-950 bg-white border border-black rounded-xl placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="reg-password" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                Senha (mínimo 6 caracteres) *
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg-password"
                  type={showRegisterPassword ? 'text' : 'password'}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold text-zinc-950 bg-white border border-black rounded-xl placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600"
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute right-3.5 text-zinc-500 hover:text-zinc-950"
                  tabIndex={-1}
                >
                  {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                Confirmar Senha *
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg-confirm-password"
                  type={showRegisterPassword ? 'text' : 'password'}
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold text-zinc-950 bg-white border border-black rounded-xl placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600"
                />
              </div>
            </div>

            {/* Invitation Code */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="reg-invite-code" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                  Código de Convite da Administração *
                </label>
                {isCheckingInvite && (
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin text-orange-600" />
                    Verificando...
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <Ticket className="w-4 h-4 text-orange-600" />
                </div>
                <input
                  id="reg-invite-code"
                  type="text"
                  value={registerInviteCode}
                  onChange={(e) => setRegisterInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ex: FIN-8K4P-X92M"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold tracking-wider text-orange-950 bg-orange-50/50 border border-black rounded-xl placeholder:text-zinc-400 placeholder:font-sans focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600"
                />
              </div>

              {/* Status do Convite em Tempo Real */}
              {inviteStatusInfo && (
                <div className={`mt-1.5 p-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border ${
                  inviteStatusInfo.valid
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}>
                  {inviteStatusInfo.valid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Convite Válido! Perfil autorizado: <strong className="underline">{inviteStatusInfo.role}</strong></span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{inviteStatusInfo.error || 'Código inválido ou expirado.'}</span>
                    </>
                  )}
                </div>
              )}

              <p className="text-[10px] text-zinc-500 font-medium">
                O convite é intransferível e define seu nível de acesso inicial.
              </p>
            </div>

            {/* Register Submit Button */}
            <button
              type="submit"
              id="btn-register-submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Validando convite e criando perfil...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-white" />
                  <span>Concluir Cadastro</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsRegisterMode(false)}
              className="w-full py-2 text-xs font-bold text-zinc-600 hover:text-zinc-950 text-center transition-colors cursor-pointer"
            >
              Já possui conta? Fazer Login
            </button>
          </form>
        )}

        {/* 3. Password Recovery Flow (Req 10) */}
        {isForgotPasswordMode && (
          <form onSubmit={handlePasswordReset} className="space-y-4 pt-1">
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
              <button
                type="button"
                id="btn-back-to-login"
                onClick={() => setIsForgotPasswordMode(false)}
                className="p-1.5 -ml-1 text-zinc-600 hover:text-zinc-950 rounded-lg hover:bg-zinc-100 transition-colors"
                title="Voltar ao login"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wide">
                  Recuperação de Senha
                </h3>
              </div>
            </div>

            <p className="text-xs text-zinc-700 font-medium leading-relaxed">
              Informe seu e-mail cadastrado. Enviaremos um link oficial do Supabase para redefinir sua senha com segurança.
            </p>

            {/* Feedback messages */}
            {recoverySuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-start gap-2.5 text-xs text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span className="leading-snug">{recoverySuccessMessage}</span>
              </div>
            )}

            {recoveryErrorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 flex items-start gap-2.5 text-xs text-rose-800 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{recoveryErrorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="recovery-email" className="block text-xs font-bold text-zinc-950 uppercase tracking-wider">
                E-mail para Redefinição
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => {
                    setRecoveryEmail(e.target.value);
                    if (recoveryErrorMessage) setRecoveryErrorMessage(null);
                  }}
                  placeholder="usuario@supermercado.com"
                  required
                  disabled={isSubmittingRecovery}
                  className="w-full pl-10 pr-3.5 py-3 text-sm font-semibold text-zinc-950 bg-white border border-black rounded-xl placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-orange-600 focus:border-orange-600 transition-all disabled:bg-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                id="btn-submit-recovery"
                disabled={isSubmittingRecovery}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmittingRecovery ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Enviando link oficial...</span>
                  </>
                ) : (
                  <span>Enviar Link de Redefinição</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsForgotPasswordMode(false)}
                className="w-full py-2.5 text-xs font-bold text-zinc-600 hover:text-zinc-950 text-center transition-colors cursor-pointer"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {/* Security & System Info Footer */}
        <div className="pt-2 border-t border-zinc-200 text-center space-y-1">
          <p className="text-[11px] font-bold text-zinc-600">
            Autenticação Segura via Supabase Auth & Criptografia TLS
          </p>
          <p className="text-[10px] text-zinc-500 font-medium">
            Supermercado Central &bull; Painel Financeiro Protegido
          </p>
        </div>
      </div>
    </div>
  );
};
