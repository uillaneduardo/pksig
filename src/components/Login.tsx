import React, { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, Loader, AlertCircle, CheckCircle2, ArrowLeft, KeyRound, Lock, Mail } from "lucide-react";

interface LoginProps {
  onSuccess: (user: any) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [mode, setMode] = useState<"login" | "forgot_password" | "reset_password">("login");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState("");

  // Reset Password state
  const [resetToken, setResetToken] = useState("");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenValidationMsg, setTokenValidationMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Check URL token on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token) {
      setResetToken(token);
      setMode("reset_password");
      validateToken(token);
    }
  }, []);

  const validateToken = async (token: string) => {
    setLoading(true);
    setTokenValid(null);
    setTokenValidationMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        setTokenValid(true);
        setTokenValidationMsg(`Token válido para o usuário: @${data.username}`);
      } else {
        setTokenValid(false);
        setTokenValidationMsg(data.message || "Link de redefinição inválido, expirado ou já utilizado.");
      }
    } catch (err) {
      setTokenValid(false);
      setTokenValidationMsg("Não foi possível validar o link de redefinição de senha.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "forgot_password" | "reset_password") => {
    setMode(newMode);
    setErrorMsg("");
    setSuccessMsg("");
    if (newMode === "login") {
      // Clear token from URL bar if present
      if (window.location.search.includes("token=")) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !password) {
      setErrorMsg("Por favor, preencha o usuário/e-mail e a senha.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginIdentifier, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.user);
      } else {
        setErrorMsg(data.error || "Credenciais inválidas ou conta desativada.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setErrorMsg("Por favor, informe seu endereço de e-mail.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.");
        setForgotEmail("");
      } else {
        setErrorMsg(data.error || "Não foi possível processar a solicitação.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação ao solicitar recuperação de senha.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMsg("Por favor, preencha e confirme sua nova senha.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("As senhas informadas não conferem.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("A nova senha deve possuir no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Senha redefinida com sucesso! Você já pode fazer login com a nova senha.");
        setNewPassword("");
        setConfirmPassword("");
        setResetToken("");
        // Clear token query param
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => switchMode("login"), 2500);
      } else {
        setErrorMsg(data.error || "Não foi possível redefinir a senha com este token.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full mx-auto bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0e131f] px-6 py-6 text-center space-y-2">
          <Shield className="h-10 w-10 text-white mx-auto" />
          <h1 className="text-white text-xl font-bold tracking-tight">PK SIG</h1>
          <p className="text-gray-400 text-xs">Gestão Integrada para Assistência Técnica</p>
        </div>

        <div className="p-8 space-y-6">
          {/* MODE: LOGIN */}
          {mode === "login" && (
            <>
              <div className="text-center">
                <h2 className="text-base font-bold text-gray-900">Acesso Administrativo</h2>
                <p className="text-xs text-gray-500 mt-1">Insira seu usuário ou e-mail cadastrado e senha</p>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start space-x-2 text-emerald-800 text-xs font-medium">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs font-medium">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Usuário ou E-mail</label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="Ex: uillan.silva ou admin@empresa.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">Senha de Acesso</label>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot_password")}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition hover:underline cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium pr-10"
                      placeholder="Insira sua senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Permanecer conectado</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2 mt-4 cursor-pointer"
                >
                  {loading && <Loader className="animate-spin h-4 w-4" />}
                  <span>Entrar no Sistema</span>
                </button>
              </form>
            </>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === "forgot_password" && (
            <>
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center p-2.5 bg-indigo-50 rounded-full text-indigo-600 mb-1">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Recuperação de Senha</h2>
                <p className="text-xs text-gray-500">
                  Informe o e-mail cadastrado na sua conta para receber o link de redefinição
                </p>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start space-x-2 text-emerald-800 text-xs font-medium">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs font-medium">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail Cadastrado</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      placeholder="admin@empresa.com"
                    />
                    <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {loading && <Loader className="animate-spin h-4 w-4" />}
                  <span>Enviar Instruções de Recuperação</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Voltar para o Login</span>
                </button>
              </form>
            </>
          )}

          {/* MODE: RESET PASSWORD */}
          {mode === "reset_password" && (
            <>
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center p-2.5 bg-emerald-50 rounded-full text-emerald-600 mb-1">
                  <Lock className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Cadastrar Nova Senha</h2>
                <p className="text-xs text-gray-500">
                  Crie uma senha forte e segura para sua conta
                </p>
              </div>

              {loading && tokenValid === null && (
                <div className="py-6 text-center space-y-2">
                  <Loader className="animate-spin h-6 w-6 text-indigo-600 mx-auto" />
                  <p className="text-xs text-gray-500">Validando token de segurança...</p>
                </div>
              )}

              {tokenValid === false && (
                <div className="space-y-4">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs font-medium">
                    <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{tokenValidationMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot_password")}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 transition"
                  >
                    Solicitar Novo Link de Recuperação
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition flex items-center justify-center space-x-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Voltar ao Login</span>
                  </button>
                </div>
              )}

              {tokenValid === true && (
                <>
                  {tokenValidationMsg && (
                    <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-md text-xs text-indigo-700 font-medium">
                      {tokenValidationMsg}
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start space-x-2 text-emerald-800 text-xs font-medium">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs font-medium">
                      <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleResetSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nova Senha</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium pr-10"
                          placeholder="Mínimo 8 caracteres"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar Nova Senha</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        placeholder="Repita a nova senha"
                      />
                    </div>

                    <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-600 space-y-1">
                      <p className="font-semibold text-gray-700">Requisitos da senha:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                        <li className={newPassword.length >= 8 ? "text-emerald-600 font-medium" : ""}>No mínimo 8 caracteres</li>
                        <li className={/\d/.test(newPassword) && /[a-zA-Z]/.test(newPassword) ? "text-emerald-600 font-medium" : ""}>Combinação de letras e números recomendada</li>
                      </ul>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2 cursor-pointer mt-2"
                    >
                      {loading && <Loader className="animate-spin h-4 w-4" />}
                      <span>Redefinir e Salvar Senha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Voltar ao Login</span>
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          <div className="pt-2 border-t border-gray-100 text-center">
            <span className="text-[10px] text-gray-400">PK SIG v1.0.0 • Sistema de Gestão</span>
          </div>
        </div>

      </div>
    </div>
  );
}
