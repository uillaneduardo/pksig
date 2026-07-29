import React, { useState } from "react";
import { Shield, Eye, EyeOff, Loader, AlertCircle, CheckCircle2, ArrowLeft, KeyRound, Lock } from "lucide-react";

interface LoginProps {
  onSuccess: (user: any) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [mode, setMode] = useState<"login" | "recover_step1" | "recover_step2">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Recovery States
  const [verificationInfo, setVerificationInfo] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [adminName, setAdminName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const switchMode = (newMode: "login" | "recover_step1" | "recover_step2") => {
    setMode(newMode);
    setErrorMsg("");
    setSuccessMsg("");
    if (newMode === "recover_step1") {
      setVerificationInfo("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Por favor, preencha o usuário e a senha.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.user);
      } else {
        setErrorMsg(data.error || "Erro de login desconhecido.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !verificationInfo) {
      setErrorMsg("Por favor, informe seu usuário e o dado de verificação da empresa.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/recover-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          verification_info: verificationInfo
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResetToken(data.resetToken);
        setAdminName(data.adminName || data.username);
        setMode("recover_step2");
        setSuccessMsg("Identidade confirmada com sucesso! Crie sua nova senha abaixo.");
      } else {
        setErrorMsg(data.error || "Informações divergentes. Verifique e tente novamente.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação ao verificar permissão.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMsg("Por favor, preencha e confirme sua nova senha.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("A confirmação da senha não coincide com a nova senha.");
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg("A nova senha deve possuir no mínimo 4 caracteres.");
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
          resetToken,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || "Senha redefinida com sucesso!");
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setResetToken("");
        setMode("login");
      } else {
        setErrorMsg(data.error || "Não foi possível redefinir a senha.");
      }
    } catch (err) {
      setErrorMsg("Erro ao processar a redefinição de senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full mx-auto bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        
        {/* Visual brand header mimicking the dark sidebar style */}
        <div className="bg-[#0e131f] px-6 py-6 text-center space-y-2">
          <Shield className="h-10 w-10 text-white mx-auto" />
          <h1 className="text-white text-xl font-bold tracking-tight">PK SIG</h1>
          <p className="text-gray-400 text-xs">Gestão Integrada para Assistência Técnica</p>
        </div>

        <div className="p-8 space-y-6">
          {mode === "login" && (
            <>
              <div className="text-center">
                <h2 className="text-base font-bold text-gray-900">Acesso Administrativo</h2>
                <p className="text-xs text-gray-500 mt-1">Insira suas credenciais para gerenciar a assistência</p>
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome de Usuário</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="Ex: uillan.silva"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">Senha de Acesso</label>
                    <button
                      type="button"
                      onClick={() => switchMode("recover_step1")}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition hover:underline"
                    >
                      Esqueceu a senha?
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

          {mode === "recover_step1" && (
            <>
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center p-2.5 bg-indigo-50 rounded-full text-indigo-600 mb-1">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Recuperação de Senha</h2>
                <p className="text-xs text-gray-500">
                  Informe seu usuário e um dado de segurança da empresa para validar o acesso.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs font-medium">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleVerifyRecover} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome de Usuário</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="Ex: admin ou uillan.silva"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Dado de Segurança da Empresa
                  </label>
                  <input
                    type="text"
                    required
                    value={verificationInfo}
                    onChange={(e) => setVerificationInfo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="CNPJ/CPF, E-mail ou Telefone da empresa"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Insira o CNPJ, E-mail ou Telefone cadastrado nas Configurações da Assistência.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2 cursor-pointer mt-2"
                >
                  {loading && <Loader className="animate-spin h-4 w-4" />}
                  <span>Verificar Dados</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition flex items-center justify-center space-x-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Voltar para o Login</span>
                </button>
              </form>
            </>
          )}

          {mode === "recover_step2" && (
            <>
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center p-2.5 bg-emerald-50 rounded-full text-emerald-600 mb-1">
                  <Lock className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Definir Nova Senha</h2>
                <p className="text-xs text-gray-500">
                  Usuário validado: <strong className="text-gray-800">{username}</strong> ({adminName})
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

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium pr-10"
                      placeholder="Mínimo 4 caracteres"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2 cursor-pointer mt-2"
                >
                  {loading && <Loader className="animate-spin h-4 w-4" />}
                  <span>Salvar Nova Senha</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition flex items-center justify-center space-x-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Cancelar e Voltar</span>
                </button>
              </form>
            </>
          )}

          <div className="pt-2 border-t border-gray-100 text-center">
            <span className="text-[10px] text-gray-400">PK SIG v1.0.0 • Versão de Uso Pessoal</span>
          </div>
        </div>

      </div>
    </div>
  );
}
