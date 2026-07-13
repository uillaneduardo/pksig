import React, { useState } from "react";
import { Shield, Eye, EyeOff, Loader, AlertCircle } from "lucide-react";

interface LoginProps {
  onSuccess: (user: any) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Por favor, preencha o usuário e a senha.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

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
          <div className="text-center">
            <h2 className="text-base font-bold text-gray-900">Acesso Administrativo</h2>
            <p className="text-xs text-gray-500 mt-1">Insira suas credenciais para gerenciar a assistência</p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs">
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Senha de Acesso</label>
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
              className="w-full py-2.5 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2 mt-4"
            >
              {loading && <Loader className="animate-spin h-4 w-4" />}
              <span>Entrar no Sistema</span>
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 text-center">
            <span className="text-[10px] text-gray-400">PK SIG v1.0.0 • Versão de Uso Pessoal</span>
          </div>
        </div>

      </div>
    </div>
  );
}
