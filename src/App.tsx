import { useState, useEffect } from "react";
import { 
  Shield, LayoutDashboard, Users, FileText, Settings as SettingsIcon, 
  LogOut, AlertCircle, RefreshCw, ChevronRight, Menu, DollarSign,
  ChevronLeft, Database, Cloud, Upload, Download, Check, AlertTriangle
} from "lucide-react";
import { fetchCsrfToken } from "./lib/api";

// Components
import SetupWizard from "./components/SetupWizard";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ClientList from "./components/ClientList";
import ClientDetails from "./components/ClientDetails";
import ServiceOrderList from "./components/ServiceOrderList";
import ServiceOrderDetails from "./components/ServiceOrderDetails";
import Settings from "./components/Settings";
import Finance from "./components/Finance";

export default function App() {
  // Config state
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string>("");
  const [hasAdmin, setHasAdmin] = useState<boolean>(false);

  // Database mode & sync states
  const [dbMode, setDbMode] = useState<"local" | "remoto">("local");
  const [dbType, setDbType] = useState<string>("sqlite");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncDirection, setLastSyncDirection] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSyncDropdown, setShowSyncDropdown] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>("");
  const [syncSuccess, setSyncSuccess] = useState<string>("");

  const formatSyncDate = (dateStr: string | null) => {
    if (!dateStr) return "Nunca sincronizado";
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch (e) {
      return "Formato inválido";
    }
  };

  const handleQuickSync = async (direction: "remote-to-local" | "local-to-remote") => {
    setIsSyncing(true);
    setSyncError("");
    setSyncSuccess("");
    try {
      const res = await fetch("/api/database/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setSyncSuccess(direction === "local-to-remote" ? "Sincronizado com sucesso (Envio)!" : "Sincronizado com sucesso (Baixar)!");
        await checkSystemStatus();
        setTimeout(() => setSyncSuccess(""), 4000);
      } else {
        setSyncError(data.error || data.message || "Erro na sincronização");
      }
    } catch (err: any) {
      setSyncError("Erro de rede ao sincronizar");
    } finally {
      setIsSyncing(false);
    }
  };

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Navigation / Routing state
  const [activeTab, setActiveTab] = useState<string>("dashboard"); // dashboard, clients, client-detail, os-list, os-detail, settings
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedOSId, setSelectedOSId] = useState<number | null>(null);

  // Global settings synced from backend Settings
  const [currency, setCurrency] = useState<string>("R$");
  const [tradeName, setTradeName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("PK SIG Assistência");

  // Mobile menu sidebar toggle state
  const [showMobileSidebar, setShowMobileSidebar] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Load configuration and session states
  const checkSystemStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setConfigured(data.configured);
        setDbConnected(data.connected || false);
        setDbError(data.error || "");
        setHasAdmin(data.hasAdmin || false);

        if (data.mode !== undefined) {
          setDbMode(data.mode);
        }
        if (data.type !== undefined) {
          setDbType(data.type);
        }
        if (data.last_sync_at !== undefined) {
          setLastSyncAt(data.last_sync_at);
        }
        if (data.last_sync_direction !== undefined) {
          setLastSyncDirection(data.last_sync_direction);
        }

        if (data.tradeName !== undefined) {
          setTradeName(data.tradeName);
        }
        if (data.companyName !== undefined) {
          setCompanyName(data.companyName);
        }

        if (data.configured && data.connected && data.hasAdmin) {
          // Verify current login session
          const meRes = await fetch("/api/auth/me");
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.authenticated) {
              setIsAuthenticated(true);
              setCurrentUser(meData.user);
              await fetchCsrfToken();
            } else {
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error reading system status", err);
    }
  };

  useEffect(() => {
    checkSystemStatus();
    // Periodically update status to keep sync and mode information refreshed and accurate (every 30s)
    const interval = setInterval(checkSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const titleName = tradeName || companyName;
    if (titleName) {
      document.title = titleName;
    } else {
      document.title = "PK SIG";
    }
  }, [tradeName, companyName]);

  const handleLogout = async () => {
    if (!window.confirm("Deseja realmente sair do PK SIG?")) return;

    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setActiveTab("dashboard");
      }
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // State switcher helper
  const navigateTo = (tab: string, arg?: any) => {
    setActiveTab(tab);
    if (tab === "client-detail" && typeof arg === "number") {
      setSelectedClientId(arg);
    } else if (tab === "os-detail" && typeof arg === "number") {
      setSelectedOSId(arg);
    }
    setShowMobileSidebar(false);
  };

  // Render setup wizard if not configured or has database issues
  if (configured === null) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex justify-center items-center font-sans text-xs">
        <div className="text-center space-y-3">
          <RefreshCw className="animate-spin h-8 w-8 text-indigo-600 mx-auto" />
          <p className="font-bold text-gray-700">Iniciando ambiente PK SIG...</p>
        </div>
      </div>
    );
  }

  if (!configured || !dbConnected || !hasAdmin) {
    return (
      <SetupWizard 
        onCompleted={() => {
          checkSystemStatus();
        }} 
      />
    );
  }

  // Render login screen if configured but session expired
  if (!isAuthenticated) {
    return (
      <Login 
        onSuccess={async (user) => {
          setIsAuthenticated(true);
          setCurrentUser(user);
          await fetchCsrfToken();
          checkSystemStatus();
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#f3f4f6] flex flex-col md:flex-row font-sans text-xs antialiased overflow-x-hidden">
      
      {/* 1. SIDEBAR NAVIGATION - DEEP SLATE/NAVY VISUAL BRAND */}
      <aside className={`bg-[#0e131f] text-gray-300 flex flex-col justify-between shrink-0 transition-all duration-300 md:translate-x-0 z-40 fixed inset-y-0 left-0 md:relative md:h-screen md:overflow-y-auto ${isSidebarCollapsed ? "md:w-16" : "md:w-64"} w-64 ${showMobileSidebar ? "translate-x-0" : "-translate-x-full"}`}>
        
        <div className="flex flex-col">
          {/* Logo brand */}
          <div className={`py-5 border-b border-gray-800/60 flex items-center justify-between bg-[#0a0e17] transition-all duration-300 ${isSidebarCollapsed ? "md:px-3 md:justify-center" : "px-6"}`}>
            <div className={`flex items-center space-x-3 min-w-0 ${isSidebarCollapsed ? "md:hidden" : ""}`}>
              <Shield className="h-6 w-6 text-indigo-500 shrink-0" />
              <div className="whitespace-nowrap">
                <h1 className="text-white text-sm font-black tracking-tight leading-none">PK SIG</h1>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Assistência Técnica</span>
              </div>
            </div>

            {/* Desktop collapsed expand button */}
            {isSidebarCollapsed && (
              <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden md:flex p-1.5 hover:bg-gray-800 rounded text-indigo-400 hover:text-white cursor-pointer"
                title="Expandir menu"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            {/* Desktop expanded collapse button */}
            {!isSidebarCollapsed && (
              <button 
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden md:flex p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white cursor-pointer shrink-0"
                title="Recolher menu"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
            )}
          </div>

          {/* Menus list */}
          <nav className={`space-y-1.5 flex-1 transition-all duration-300 ${isSidebarCollapsed ? "md:p-2" : "p-4"}`}>
            <span className={`block px-3 text-[9px] text-gray-600 uppercase font-black tracking-widest mb-2.5 transition-opacity ${isSidebarCollapsed ? "md:hidden" : ""}`}>Menu Principal</span>
            
            <button
              onClick={() => navigateTo("dashboard")}
              className={`w-full flex items-center rounded-md font-semibold transition cursor-pointer ${
                isSidebarCollapsed 
                  ? "md:justify-center md:px-0 md:py-3 space-x-3 md:space-x-0" 
                  : "space-x-3 px-3 py-2.5"
              } ${activeTab === "dashboard" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
              title={isSidebarCollapsed ? "Painel de Controle" : ""}
            >
              <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
              <span className={isSidebarCollapsed ? "md:hidden" : ""}>Painel de Controle</span>
            </button>

            <button
              onClick={() => navigateTo("clients")}
              className={`w-full flex items-center rounded-md font-semibold transition cursor-pointer ${
                isSidebarCollapsed 
                  ? "md:justify-center md:px-0 md:py-3 space-x-3 md:space-x-0" 
                  : "space-x-3 px-3 py-2.5"
              } ${activeTab === "clients" || activeTab === "client-detail" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
              title={isSidebarCollapsed ? "Clientes" : ""}
            >
              <Users className="h-4.5 w-4.5 shrink-0" />
              <span className={isSidebarCollapsed ? "md:hidden" : ""}>Clientes</span>
            </button>

            <button
              onClick={() => navigateTo("os-list")}
              className={`w-full flex items-center rounded-md font-semibold transition cursor-pointer ${
                isSidebarCollapsed 
                  ? "md:justify-center md:px-0 md:py-3 space-x-3 md:space-x-0" 
                  : "space-x-3 px-3 py-2.5"
              } ${activeTab === "os-list" || activeTab === "os-detail" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
              title={isSidebarCollapsed ? "Ordens de Serviço" : ""}
            >
              <FileText className="h-4.5 w-4.5 shrink-0" />
              <span className={isSidebarCollapsed ? "md:hidden" : ""}>Ordens de Serviço</span>
            </button>

            <button
              onClick={() => navigateTo("financeiro")}
              className={`w-full flex items-center rounded-md font-semibold transition cursor-pointer ${
                isSidebarCollapsed 
                  ? "md:justify-center md:px-0 md:py-3 space-x-3 md:space-x-0" 
                  : "space-x-3 px-3 py-2.5"
              } ${activeTab === "financeiro" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
              title={isSidebarCollapsed ? "Financeiro" : ""}
            >
              <DollarSign className="h-4.5 w-4.5 shrink-0" />
              <span className={isSidebarCollapsed ? "md:hidden" : ""}>Financeiro</span>
            </button>

            <button
              onClick={() => navigateTo("settings")}
              className={`w-full flex items-center rounded-md font-semibold transition cursor-pointer ${
                isSidebarCollapsed 
                  ? "md:justify-center md:px-0 md:py-3 space-x-3 md:space-x-0" 
                  : "space-x-3 px-3 py-2.5"
              } ${activeTab === "settings" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
              title={isSidebarCollapsed ? "Preferências" : ""}
            >
              <SettingsIcon className="h-4.5 w-4.5 shrink-0" />
              <span className={isSidebarCollapsed ? "md:hidden" : ""}>Preferências</span>
            </button>
          </nav>
        </div>

        {/* User profile details and Signout bottom row */}
        <div className={`border-t border-gray-800/60 bg-[#0a0e17] space-y-3 transition-all duration-300 ${isSidebarCollapsed ? "md:p-2" : "p-4"}`}>
          <div className={`flex items-center px-1 ${isSidebarCollapsed ? "md:justify-center md:px-0" : "space-x-3"}`}>
            <div className="h-8 w-8 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center font-bold font-mono shrink-0" title={currentUser?.name}>
              {currentUser?.name?.slice(0, 2).toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-white text-xs font-bold truncate leading-tight">{currentUser?.name}</div>
                <div className="text-[10px] text-gray-500 truncate mt-0.5">@{currentUser?.username}</div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`w-full border border-gray-800 hover:border-red-900/60 hover:bg-red-950/20 hover:text-red-400 text-gray-400 rounded font-bold transition flex items-center justify-center cursor-pointer ${
              isSidebarCollapsed ? "md:py-2.5" : "py-2 space-x-2"
            }`}
            title="Sair do Sistema"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!isSidebarCollapsed && <span>Sair do Sistema</span>}
          </button>
        </div>

      </aside>

      {/* 2. MAIN ACTIVE WORKSPACE - LIGHT THEME CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-hidden">
        
        {/* Top Header bar with search indicator / mobile drawer toggles */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-30">
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="p-1 border border-gray-300 rounded md:hidden text-gray-500"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-gray-500 font-bold uppercase tracking-wider text-[11px] hidden md:inline">{tradeName || companyName || "Ambiente Administrativo"}</span>
          </div>

          {/* User information display & Cohesive intelligent sync status widget */}
          <div className="relative flex items-center">
            {/* Click-outside listener for dropdown closing */}
            {showSyncDropdown && (
              <div 
                className="fixed inset-0 z-40 cursor-default" 
                onClick={() => setShowSyncDropdown(false)} 
              />
            )}

            <button
              onClick={() => {
                setShowSyncDropdown(!showSyncDropdown);
                setSyncError("");
                setSyncSuccess("");
              }}
              className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center transition cursor-pointer select-none border shadow-xs hover:shadow-sm ${
                !dbConnected 
                  ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/50" 
                  : dbMode === "remoto" 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/50" 
                    : "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100/50"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                !dbConnected 
                  ? "bg-amber-500 animate-pulse" 
                  : dbMode === "remoto" 
                    ? "bg-emerald-500 animate-pulse" 
                    : "bg-sky-500"
              }`} />
              
              {!dbConnected 
                ? "ERRO DE CONEXÃO" 
                : dbMode === "remoto" 
                  ? "SISTEMA ONLINE (NUVEM)" 
                  : "SISTEMA LOCAL (OFFLINE)"
              }
            </button>

            {/* Dropdown panel */}
            {showSyncDropdown && (
              <div className="absolute right-0 top-full mt-2 w-76 bg-white rounded-lg shadow-lg border border-gray-100 p-4 space-y-3 z-50 text-xs text-gray-700 font-sans animate-in fade-in slide-in-from-top-1 duration-150">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center space-x-1.5">
                    <Database className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="font-bold text-gray-900 text-xs uppercase tracking-tight">Status de Conexão</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    dbConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {dbConnected ? "Ativo" : "Offline"}
                  </span>
                </div>

                {/* Database info list */}
                <div className="space-y-1.5 bg-gray-50 rounded-md p-2.5 border border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Modo Ativo:</span>
                    <span className="font-bold text-gray-900 capitalize">
                      {dbMode === "local" ? "Local (SQLite)" : "Nuvem (MySQL/MariaDB)"}
                    </span>
                  </div>
                  
                  {dbMode === "remoto" && dbConnected && (
                    <div className="text-[10px] text-gray-500 flex flex-col space-y-0.5 border-t border-gray-200/60 pt-1.5 mt-1">
                      <span className="truncate"><strong>Servidor:</strong> {dbType?.toUpperCase()}</span>
                      <span className="truncate"><strong>Diretório:</strong> Remoto</span>
                    </div>
                  )}

                  {dbMode === "local" && (
                    <div className="border-t border-gray-200/60 pt-1.5 mt-1 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Última Sincronização:</span>
                        <span className="font-semibold text-gray-700 truncate max-w-[130px] text-right" title={formatSyncDate(lastSyncAt)}>
                          {lastSyncAt ? new Date(lastSyncAt).toLocaleDateString("pt-BR") + " " + new Date(lastSyncAt).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}) : "Nunca"}
                        </span>
                      </div>
                      {lastSyncDirection && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500">Fluxo:</span>
                          <span className="font-semibold text-gray-700 font-mono">
                            {lastSyncDirection === "local-to-remote" ? "Local → Nuvem" : "Nuvem → Local"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Operations Section */}
                <div className="space-y-2 pt-1">
                  <h5 className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">Ações de Sincronização</h5>
                  
                  {dbMode === "local" ? (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => handleQuickSync("local-to-remote")}
                        disabled={isSyncing || !dbConnected}
                        className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                      >
                        {isSyncing ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>Enviar Dados para Nuvem</span>
                      </button>

                      <button
                        onClick={() => handleQuickSync("remote-to-local")}
                        disabled={isSyncing || !dbConnected}
                        className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                      >
                        {isSyncing ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>Baixar Dados da Nuvem</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-emerald-600 font-medium leading-relaxed bg-emerald-50/50 p-2 border border-emerald-100 rounded">
                        Você está conectado em tempo real à nuvem. Todas as alterações são salvas instantaneamente.
                      </p>
                      
                      <button
                        onClick={() => handleQuickSync("remote-to-local")}
                        disabled={isSyncing || !dbConnected}
                        className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                        title="Baixa cópia da nuvem para o banco SQLite local por segurança"
                      >
                        {isSyncing ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                        )}
                        <span>Fazer Cópia Local (Backup)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Notifications & Messages */}
                {syncError && (
                  <div className="bg-red-50 text-red-700 p-2 rounded text-[10px] font-semibold border border-red-200 flex items-start space-x-1 max-h-24 overflow-y-auto">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{syncError}</span>
                  </div>
                )}

                {syncSuccess && (
                  <div className="bg-emerald-50 text-emerald-700 p-2 rounded text-[10px] font-bold border border-emerald-200 flex items-center space-x-1.5">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>{syncSuccess}</span>
                  </div>
                )}

              </div>
            )}
          </div>

        </header>

        {/* Main scrollable body panel */}
        <main className="p-6 md:p-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
          
          {/* Active Tab rendering */}
          {activeTab === "dashboard" && (
            <Dashboard 
              onNavigate={navigateTo} 
              currency={currency} 
            />
          )}

          {activeTab === "clients" && (
            <ClientList 
              onSelectClient={(id) => navigateTo("client-detail", id)} 
              currency={currency} 
            />
          )}

          {activeTab === "client-detail" && selectedClientId && (
            <ClientDetails 
              clientId={selectedClientId} 
              onBack={() => navigateTo("clients")} 
              onOpenOS={(osId) => navigateTo("os-detail", osId)}
              currency={currency}
            />
          )}

          {activeTab === "os-list" && (
            <ServiceOrderList 
              onSelectOS={(id) => navigateTo("os-detail", id)} 
              currency={currency} 
            />
          )}

          {activeTab === "os-detail" && selectedOSId && (
            <ServiceOrderDetails 
              osId={selectedOSId} 
              onBack={() => navigateTo("os-list")} 
              currency={currency}
            />
          )}

          {activeTab === "settings" && (
            <Settings 
              onUpdateCurrency={setCurrency} 
              currency={currency} 
              onCompanyUpdated={checkSystemStatus}
              onDatabaseUpdated={checkSystemStatus}
            />
          )}

          {activeTab === "financeiro" && (
            <Finance 
              currency={currency}
            />
          )}

        </main>

      </div>

      {/* Backdrop for mobile sidebar drawer overlay */}
      {showMobileSidebar && (
        <div 
          onClick={() => setShowMobileSidebar(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

    </div>
  );
}
