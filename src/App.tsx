import { useState, useEffect } from "react";
import { 
  Shield, LayoutDashboard, Users, FileText, Settings as SettingsIcon, 
  LogOut, AlertCircle, RefreshCw, ChevronRight, Menu, DollarSign
} from "lucide-react";

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
        onSuccess={(user) => {
          setIsAuthenticated(true);
          setCurrentUser(user);
          checkSystemStatus();
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#f3f4f6] flex flex-col md:flex-row font-sans text-xs antialiased overflow-x-hidden">
      
      {/* 1. SIDEBAR NAVIGATION - DEEP SLATE/NAVY VISUAL BRAND */}
      <aside className={`w-64 bg-[#0e131f] text-gray-300 flex flex-col justify-between shrink-0 transition-transform md:translate-x-0 z-40 fixed inset-y-0 left-0 md:relative md:h-screen md:overflow-y-auto ${showMobileSidebar ? "translate-x-0" : "-translate-x-full"}`}>
        
        <div className="flex flex-col">
          {/* Logo brand */}
          <div className="px-6 py-5 border-b border-gray-800/60 flex items-center space-x-3 bg-[#0a0e17]">
            <Shield className="h-6 w-6 text-indigo-500 shrink-0" />
            <div>
              <h1 className="text-white text-sm font-black tracking-tight leading-none">PK SIG</h1>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Assistência Técnica</span>
            </div>
          </div>

          {/* Menus list */}
          <nav className="p-4 space-y-1.5 flex-1">
            <span className="block px-3 text-[9px] text-gray-600 uppercase font-black tracking-widest mb-2.5">Menu Principal</span>
            
            <button
              onClick={() => navigateTo("dashboard")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md font-semibold transition cursor-pointer ${activeTab === "dashboard" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
            >
              <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
              <span>Painel de Controle</span>
            </button>

            <button
              onClick={() => navigateTo("clients")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md font-semibold transition cursor-pointer ${activeTab === "clients" || activeTab === "client-detail" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
            >
              <Users className="h-4.5 w-4.5 shrink-0" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => navigateTo("os-list")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md font-semibold transition cursor-pointer ${activeTab === "os-list" || activeTab === "os-detail" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
            >
              <FileText className="h-4.5 w-4.5 shrink-0" />
              <span>Ordens de Serviço</span>
            </button>

            <button
              onClick={() => navigateTo("financeiro")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md font-semibold transition cursor-pointer ${activeTab === "financeiro" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
            >
              <DollarSign className="h-4.5 w-4.5 shrink-0" />
              <span>Financeiro</span>
            </button>

            <button
              onClick={() => navigateTo("settings")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md font-semibold transition cursor-pointer ${activeTab === "settings" ? "bg-indigo-600 text-white font-bold" : "hover:bg-gray-800/50 hover:text-white"}`}
            >
              <SettingsIcon className="h-4.5 w-4.5 shrink-0" />
              <span>Preferências</span>
            </button>
          </nav>
        </div>

        {/* User profile details and Signout bottom row */}
        <div className="p-4 border-t border-gray-800/60 bg-[#0a0e17] space-y-3">
          <div className="flex items-center space-x-3 px-1">
            <div className="h-8 w-8 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center font-bold font-mono">
              {currentUser?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-xs font-bold truncate leading-tight">{currentUser?.name}</div>
              <div className="text-[10px] text-gray-500 truncate mt-0.5">@{currentUser?.username}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 border border-gray-800 hover:border-red-900/60 hover:bg-red-950/20 hover:text-red-400 text-gray-400 rounded font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair do Sistema</span>
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

          {/* User information display */}
          <div className="flex items-center space-x-4">
            <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full flex items-center">
              <span className="h-1.5 w-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
              SISTEMA ONLINE
            </span>
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
