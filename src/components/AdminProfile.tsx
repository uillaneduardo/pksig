import React, { useState, useEffect } from "react";
import { 
  User, Lock, History, Shield, CheckCircle2, AlertCircle, Loader, 
  KeyRound, Smartphone, LogOut, RefreshCw, Calendar, Mail, Phone,
  Filter, ChevronLeft, ChevronRight, ShieldCheck, Clock
} from "lucide-react";

interface AdminProfileProps {
  currentUser: any;
  onUserUpdated: (user: any) => void;
}

export default function AdminProfile({ currentUser, onUserUpdated }: AdminProfileProps) {
  const [activeTab, setActiveTab] = useState<"personal" | "security" | "history">("personal");

  // Personal info state
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSuccess, setPersonalSuccess] = useState("");
  const [personalError, setPersonalError] = useState("");

  // Detailed profile fetched from API
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [endingSessions, setEndingSessions] = useState(false);
  const [sessionMsg, setSessionMsg] = useState("");

  // History / Audit log state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all"); // all, 7d, 30d, 90d

  // Fetch full admin profile details on load
  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/admin/profile");
      if (res.ok) {
        const data = await res.json();
        setProfileData(data.admin);
        setName(data.admin.name || "");
        setUsername(data.admin.username || "");
        setEmail(data.admin.email || "");
        setPhone(data.admin.phone || "");
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch active sessions
  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/admin/profile/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Error loading sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch audit history
  const loadHistory = async (page = 1) => {
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "15",
        action: actionFilter,
        period: periodFilter,
      });

      const res = await fetch(`/api/admin/profile/history?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setHistoryPage(data.pagination?.page || 1);
        setHistoryTotalPages(data.pagination?.totalPages || 1);
        setHistoryTotal(data.pagination?.total || 0);
      } else {
        setHistoryError("Falha ao carregar histórico de ações.");
      }
    } catch (err) {
      setHistoryError("Erro de conexão ao carregar histórico.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (activeTab === "security") {
      loadSessions();
    } else if (activeTab === "history") {
      loadHistory(1);
    }
  }, [activeTab, actionFilter, periodFilter]);

  // Handle personal info save
  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalSuccess("");
    setPersonalError("");

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, phone })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPersonalSuccess("Dados cadastrais atualizados com sucesso!");
        onUserUpdated(data.user);
        setProfileData((prev: any) => ({ ...prev, ...data.user }));
        setTimeout(() => setPersonalSuccess(""), 4000);
      } else {
        setPersonalError(data.error || "Não foi possível salvar os dados.");
      }
    } catch (err) {
      setPersonalError("Erro de comunicação com o servidor.");
    } finally {
      setSavingPersonal(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess("");
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Por favor, preencha todos os campos do formulário de senha.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da senha não coincide com a nova senha.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("A nova senha deve possuir no mínimo 8 caracteres.");
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch("/api/admin/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordSuccess("Sua senha foi alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        loadProfile();
        loadSessions();
        setTimeout(() => setPasswordSuccess(""), 4000);
      } else {
        setPasswordError(data.error || "Não foi possível alterar a senha.");
      }
    } catch (err) {
      setPasswordError("Erro ao alterar senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Handle end other sessions
  const handleEndOtherSessions = async () => {
    if (!window.confirm("Deseja realmente encerrar todas as outras sessões ativas?")) return;

    setEndingSessions(true);
    setSessionMsg("");
    try {
      const res = await fetch("/api/admin/profile/sessions/others", {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionMsg("Outras sessões encerradas com sucesso!");
        loadSessions();
        setTimeout(() => setSessionMsg(""), 4000);
      } else {
        setSessionMsg(data.error || "Erro ao encerrar sessões.");
      }
    } catch (err) {
      setSessionMsg("Erro de comunicação com o servidor.");
    } finally {
      setEndingSessions(false);
    }
  };

  // Parse User-Agent string into human-friendly device text
  const parseUserAgent = (ua: string | null) => {
    if (!ua) return "Dispositivo Desconhecido";
    let browser = "Navegador Web";
    let os = "Sistema";

    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";

    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";

    return `${browser} em ${os}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      
      {/* Top Page Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="h-14 w-14 bg-[#0e131f] text-white rounded-full flex items-center justify-center font-bold font-mono text-xl shadow-inner shrink-0">
            {currentUser?.name?.slice(0, 2).toUpperCase() || "AD"}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{currentUser?.name || "Administrador"}</h1>
            <p className="text-xs text-gray-500 flex items-center space-x-2 mt-1">
              <span>@{currentUser?.username}</span>
              <span>•</span>
              <span className="text-indigo-600 font-medium">{currentUser?.email || "E-mail não cadastrado"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 text-xs px-3 py-1.5 rounded-md border border-emerald-200 font-medium self-start md:self-auto">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Conta Ativa & Protegida</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 flex space-x-6">
        <button
          onClick={() => setActiveTab("personal")}
          className={`pb-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === "personal"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Dados Pessoais</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`pb-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === "security"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>Segurança & Sessões</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === "history"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Histórico de Ações</span>
        </button>
      </div>

      {/* TAB 1: DADOS PESSOAIS */}
      {activeTab === "personal" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-lg p-6 space-y-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Editar Informações Cadastrais</h2>
              <p className="text-xs text-gray-500 mt-0.5">Mantenha seu e-mail e dados pessoais sempre atualizados para recuperação de conta</p>
            </div>

            {personalSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start space-x-2 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{personalSuccess}</span>
              </div>
            )}

            {personalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs font-medium">
                <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                <span>{personalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePersonal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome de Usuário (Login) *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="Seu usuário de login"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail Cadastral *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="exemplo@empresa.com"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Utilizado exclusivamente para recuperação de senha</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPersonal}
                  className="px-5 py-2 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-xs font-bold transition flex items-center space-x-2 cursor-pointer"
                >
                  {savingPersonal && <Loader className="animate-spin h-3.5 w-3.5" />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>

          {/* Account Metadata Readonly Box */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 shadow-2xs h-fit">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider text-gray-500">Detalhes da Conta</h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">ID de Usuário</span>
                <span className="font-mono font-bold text-gray-800">#{profileData?.id || currentUser?.id}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Data de Cadastro</span>
                <span className="font-medium text-gray-800">{formatDate(profileData?.created_at)}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Último Acesso</span>
                <span className="font-medium text-gray-800">{formatDate(profileData?.last_login_at)}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Última Troca de Senha</span>
                <span className="font-medium text-gray-800">{profileData?.password_changed_at ? formatDate(profileData.password_changed_at) : "Nunca alterada"}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-gray-500">Situação da Conta</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">Ativa</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SEGURANÇA E SESSÕES */}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-lg p-6 space-y-5 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Alterar Senha do Administrador</h2>
              <p className="text-xs text-gray-500 mt-0.5">Sua nova senha deve conter pelo menos 8 caracteres e ser diferente da atual</p>
            </div>

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start space-x-2 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs font-medium">
                <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Senha Atual *</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  placeholder="Informe sua senha atual para confirmar"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nova Senha *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="No mínimo 8 dígitos"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar Nova Senha *</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition flex items-center space-x-2 cursor-pointer"
                >
                  {savingPassword && <Loader className="animate-spin h-3.5 w-3.5" />}
                  <span>Atualizar Senha</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Sessions Panel */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 shadow-2xs h-fit">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider text-gray-500">Sessões Ativas ({sessions.length})</h3>
              <button
                type="button"
                onClick={loadSessions}
                className="text-gray-400 hover:text-gray-600"
                title="Atualizar sessões"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
              </button>
            </div>

            {sessionMsg && (
              <div className="p-2.5 bg-indigo-50 text-indigo-800 text-[11px] rounded border border-indigo-200 font-medium">
                {sessionMsg}
              </div>
            )}

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {sessions.map((sess: any) => (
                <div key={sess.id} className={`p-3 rounded-md border text-xs space-y-1 ${sess.isCurrent ? "bg-indigo-50/50 border-indigo-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between font-bold text-gray-800">
                    <span className="flex items-center space-x-1">
                      <Smartphone className="h-3.5 w-3.5 text-gray-500" />
                      <span>{parseUserAgent(sess.user_agent)}</span>
                    </span>
                    {sess.isCurrent && (
                      <span className="px-1.5 py-0.5 bg-indigo-600 text-white font-bold rounded text-[9px]">Sessão Atual</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 flex justify-between">
                    <span>IP: {sess.ip_address || "Não registrado"}</span>
                    <span>Atividade: {formatDate(sess.last_activity_at)}</span>
                  </div>
                </div>
              ))}
            </div>

            {sessions.length > 1 && (
              <button
                type="button"
                onClick={handleEndOtherSessions}
                disabled={endingSessions}
                className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer mt-2"
              >
                {endingSessions ? <Loader className="animate-spin h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
                <span>Encerrar Outras Sessões</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HISTÓRICO DE AÇÕES */}
      {activeTab === "history" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Histórico de Ações do Administrador</h2>
              <p className="text-xs text-gray-500 mt-0.5">Registro completo de auditoria para ações importantes no sistema</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
                <Filter className="h-3.5 w-3.5 text-gray-400" />
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="bg-transparent text-xs text-gray-700 focus:outline-none font-medium"
                >
                  <option value="all">Todo o período</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                </select>
              </div>

              <div className="flex items-center space-x-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="bg-transparent text-xs text-gray-700 focus:outline-none font-medium"
                >
                  <option value="">Todas as Ações</option>
                  <option value="LOGIN">Logins</option>
                  <option value="PASSWORD_RESET">Redefinições de Senha</option>
                  <option value="PROFILE_UPDATE">Alterações de Perfil</option>
                  <option value="SYSTEM_SETTINGS">Configurações do Sistema</option>
                  <option value="OS_CREATE">Criação de OS</option>
                  <option value="OS_UPDATE">Atualização de OS</option>
                  <option value="PAYMENT">Pagamentos</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => loadHistory(historyPage)}
                className="p-1.5 border border-gray-200 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                title="Atualizar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {historyError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
              <span>{historyError}</span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold">
                  <th className="py-2.5 px-3">Data e Hora</th>
                  <th className="py-2.5 px-3">Ação</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Entidade</th>
                  <th className="py-2.5 px-3">Endereço IP</th>
                  <th className="py-2.5 px-3">Dispositivo / Navegador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      <Loader className="animate-spin h-5 w-5 mx-auto text-indigo-600 mb-2" />
                      <span>Carregando histórico de auditoria...</span>
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                      Nenhum registro de auditoria encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-2.5 px-3 whitespace-nowrap text-gray-600 font-medium">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-800 font-medium max-w-xs truncate" title={log.description}>
                        {log.description}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {log.entity_type ? `${log.entity_type} #${log.entity_id || ""}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {log.ip_address || "Não informado"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-gray-600" title={log.user_agent}>
                        {parseUserAgent(log.user_agent)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
              <span className="text-gray-500">
                Exibindo página <strong className="text-gray-800">{historyPage}</strong> de <strong className="text-gray-800">{historyTotalPages}</strong> ({historyTotal} registros)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={historyPage <= 1}
                  onClick={() => loadHistory(historyPage - 1)}
                  className="px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => loadHistory(historyPage + 1)}
                  className="px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
