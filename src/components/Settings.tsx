import React, { useState, useEffect } from "react";
import { EquipmentCategory, PaymentMethod, WarrantyRule } from "../types";
import { 
  Settings as SettingsIcon, Save, Plus, Check, Trash2, 
  RefreshCw, DollarSign, Laptop, ShieldCheck, Tag, Loader, AlertCircle,
  Building, Edit, Database, Server, ArrowLeftRight, Download, Upload,
  Smartphone
} from "lucide-react";

interface SettingsProps {
  onUpdateCurrency: (currency: string) => void;
  currency: string;
  onCompanyUpdated?: () => void;
}

// Helpers for input masks
const formatCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return digits
      .substring(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
      .replace(/\/(\d{4})(\d)/, "/$1-$2");
  }
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits
      .substring(0, 10)
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    return digits
      .substring(0, 11)
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }
};

export default function Settings({ onUpdateCurrency, currency, onCompanyUpdated }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<"geral" | "categorias" | "pagamentos" | "garantias" | "acessorios" | "empresa" | "armazenamento" | "pwa">("geral");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // DB States
  const [systemConfig, setSystemConfig] = useState({
    id: 1,
    currency: "R$",
    default_delay_alert_days: 5,
    default_tax_rate: 0,
    pwa_name: "",
    pwa_short_name: "",
    pwa_description: "",
    pwa_theme_color: "#0e131f",
    pwa_background_color: "#ffffff",
    pwa_display: "standalone",
    pwa_icon_url: ""
  });

  const [companyConfig, setCompanyConfig] = useState({
    company_name: "PK SIG Assistência",
    trade_name: "",
    tax_id: "",
    phone: "",
    whatsapp: "",
    email: "",
    address_text: ""
  });

  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<EquipmentCategory | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [warrantyRules, setWarrantyRules] = useState<WarrantyRule[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);

  // Inline additions
  const [newCatName, setNewCatName] = useState("");
  const [newCatNotes, setNewCatNotes] = useState("");

  const [newPayName, setNewPayName] = useState("");
  const [newPayMaxInstall, setNewPayMaxInstall] = useState("1");

  const [newWarrName, setNewWarrName] = useState("");
  const [newWarrDays, setNewWarrDays] = useState("90");
  const [newWarrDesc, setNewWarrDesc] = useState("");

  const [newAccName, setNewAccName] = useState("");

  // Database configuration & cloning states
  const [dbConfig, setDbConfig] = useState<any>(null);
  const [remoteForm, setRemoteForm] = useState({
    host: "",
    port: "3306",
    database: "pksig",
    user: "root",
    password: "",
    ssl: false,
    certificate: ""
  });
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState("");
  const [cloneError, setCloneError] = useState("");
  const [testSuccess, setTestSuccess] = useState("");
  const [testError, setTestError] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<"remote-to-local" | "local-to-remote" | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);

  const [dbIntegrity, setDbIntegrity] = useState<any>(null);
  const [verifyingDb, setVerifyingDb] = useState(false);
  const [integrityError, setIntegrityError] = useState("");

  const handleVerifyDbIntegrity = async () => {
    setVerifyingDb(true);
    setIntegrityError("");
    setDbIntegrity(null);
    try {
      const res = await fetch("/api/database/verify");
      const data = await res.json();
      if (res.ok && !data.error) {
        setDbIntegrity(data);
      } else {
        setIntegrityError(data.error || "Erro ao verificar integridade do banco de dados.");
      }
    } catch (err) {
      setIntegrityError("Erro de comunicação ao verificar integridade do banco de dados.");
    } finally {
      setVerifyingDb(false);
    }
  };

  const handleToggleDbMode = async (targetMode: "local" | "remoto") => {
    if (dbConfig?.mode === targetMode) return;

    if (targetMode === "remoto" && !remoteForm.host) {
      setCloneError("Para ativar o modo Remoto, preencha as credenciais do MySQL abaixo e teste a conexão primeiro.");
      return;
    }

    setSwitchingMode(true);
    setCloneSuccess("");
    setCloneError("");
    try {
      const payload: any = { mode: targetMode };
      if (targetMode === "remoto") {
        payload.host = remoteForm.host;
        payload.port = parseInt(remoteForm.port || "3306");
        payload.database = remoteForm.database;
        payload.user = remoteForm.user;
        if (remoteForm.password) {
          payload.password = remoteForm.password;
        }
        payload.ssl = remoteForm.ssl;
        payload.certificate = remoteForm.certificate;
      }

      const res = await fetch("/api/database/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setCloneSuccess(data.message || `Banco de dados alterado para ${targetMode === "local" ? "Local" : "Remoto"}!`);
        await fetchDbConfig();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setCloneError(data.error || data.message || "Falha ao alterar o banco de dados.");
      }
    } catch (err) {
      setCloneError("Falha de rede ao alterar o modo do banco de dados.");
    } finally {
      setSwitchingMode(false);
    }
  };

  const fetchDbConfig = async () => {
    try {
      const res = await fetch("/api/database/config");
      if (res.ok) {
        const data = await res.json();
        setDbConfig(data);
        if (data.mode === "remoto") {
          setRemoteForm({
            host: data.host || "",
            port: String(data.port || "3306"),
            database: data.database || "pksig",
            user: data.user || "root",
            password: "",
            ssl: !!data.ssl,
            certificate: data.certificate || ""
          });
        }
      }
    } catch (err) {
      console.error("Failed to load database config:", err);
    }
  };

  const handleTestRemoteConnection = async () => {
    setTestingConnection(true);
    setTestSuccess("");
    setTestError("");
    try {
      const res = await fetch("/api/setup/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "remoto",
          ...remoteForm
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestSuccess("Conexão com o banco de dados remoto testada com sucesso!");
      } else {
        setTestError(data.error || data.message || "Erro de conexão com o MySQL remoto.");
      }
    } catch (err: any) {
      setTestError("Falha de rede ao testar conexão.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClone = async (direction: "remote-to-local" | "local-to-remote") => {
    setCloneLoading(true);
    setCloneSuccess("");
    setCloneError("");
    setShowConfirmModal(null);
    try {
      const res = await fetch("/api/database/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          customRemoteConfig: dbConfig?.mode === "local" ? {
            mode: "remoto",
            ...remoteForm
          } : undefined
        })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setCloneSuccess(data.message || "Clonagem realizada com sucesso!");
        if (direction === "remote-to-local") {
          loadSettingsData();
        }
      } else {
        setCloneError(data.error || data.message || "Falha ao executar clonagem.");
      }
    } catch (err: any) {
      setCloneError("Erro ao enviar comando de clonagem para o servidor.");
    } finally {
      setCloneLoading(false);
    }
  };

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.system) {
          setSystemConfig({
            ...data.system,
            pwa_name: data.system.pwa_name || "",
            pwa_short_name: data.system.pwa_short_name || "",
            pwa_description: data.system.pwa_description || "",
            pwa_theme_color: data.system.pwa_theme_color || "#0e131f",
            pwa_background_color: data.system.pwa_background_color || "#ffffff",
            pwa_display: data.system.pwa_display || "standalone",
            pwa_icon_url: data.system.pwa_icon_url || ""
          });
          onUpdateCurrency(data.system.currency);
        }
        if (data.company) {
          setCompanyConfig({
            company_name: data.company.company_name || "PK SIG Assistência",
            trade_name: data.company.trade_name || "",
            tax_id: formatCpfCnpj(data.company.tax_id || ""),
            phone: formatPhone(data.company.phone || ""),
            whatsapp: formatPhone(data.company.whatsapp || ""),
            email: data.company.email || "",
            address_text: data.company.address_text || ""
          });
        }
        setCategories(data.categories || []);
        setPaymentMethods(data.paymentMethods || []);
        setWarrantyRules(data.warrantyRules || []);
        setAccessories(data.accessories || []);
      }
    } catch (err) {
      setErrorMsg("Falha ao sincronizar as configurações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  useEffect(() => {
    if (activeSection === "armazenamento") {
      fetchDbConfig();
      handleVerifyDbIntegrity();
    }
  }, [activeSection]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(systemConfig)
      });
      if (res.ok) {
        setSuccessMsg("Configurações gerais atualizadas.");
        onUpdateCurrency(systemConfig.currency);
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg("Erro ao salvar as configurações gerais.");
      }
    } catch (err) {
      setErrorMsg("Falha de conexão com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/settings/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyConfig)
      });
      if (res.ok) {
        setSuccessMsg("Informações da empresa salvas com sucesso!");
        if (onCompanyUpdated) {
          onCompanyUpdated();
        }
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Erro ao salvar as informações da empresa.");
      }
    } catch (err) {
      setErrorMsg("Falha de conexão com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePwa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/settings/pwa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pwa_name: systemConfig.pwa_name,
          pwa_short_name: systemConfig.pwa_short_name,
          pwa_description: systemConfig.pwa_description,
          pwa_theme_color: systemConfig.pwa_theme_color,
          pwa_background_color: systemConfig.pwa_background_color,
          pwa_display: systemConfig.pwa_display,
          pwa_icon_url: systemConfig.pwa_icon_url
        })
      });
      if (res.ok) {
        setSuccessMsg("Configurações do aplicativo (PWA) salvas com sucesso!");
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Erro ao salvar as configurações do aplicativo.");
      }
    } catch (err) {
      setErrorMsg("Falha de conexão com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert("O tamanho da imagem do ícone não deve ultrapassar 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSystemConfig({ ...systemConfig, pwa_icon_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleResetIcon = () => {
    setSystemConfig({ ...systemConfig, pwa_icon_url: "" });
  };

  // Save (Add or Update) category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    try {
      const isEditing = !!editingCategory;
      const url = isEditing 
        ? `/api/settings/categories/${editingCategory.id}` 
        : "/api/settings/categories";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName, notes: newCatNotes })
      });
      if (res.ok) {
        setNewCatName("");
        setNewCatNotes("");
        setEditingCategory(null);
        loadSettingsData();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || `Erro ao ${isEditing ? "atualizar" : "adicionar"} categoria.`);
      }
    } catch (err) {
      alert("Erro ao salvar categoria.");
    }
  };

  const handleEditCategoryClick = (cat: EquipmentCategory) => {
    setEditingCategory(cat);
    setNewCatName(cat.name);
    setNewCatNotes(cat.notes || "");
  };

  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setNewCatName("");
    setNewCatNotes("");
  };

  // Toggle active item status
  const handleToggleActive = async (table: string, id: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/settings/toggle-active`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id, active: !currentActive })
      });
      if (res.ok) {
        loadSettingsData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Payment Method
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayName) return;

    try {
      const res = await fetch("/api/settings/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPayName, max_installments: parseInt(newPayMaxInstall) || 1 })
      });
      if (res.ok) {
        setNewPayName("");
        setNewPayMaxInstall("1");
        loadSettingsData();
      }
    } catch (err) {
      alert("Erro ao adicionar forma de pagamento.");
    }
  };

  // Add Warranty Rule
  const handleAddWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarrName) return;

    try {
      const res = await fetch("/api/settings/warranty-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWarrName,
          duration_days: parseInt(newWarrDays) || 90,
          terms_description: newWarrDesc
        })
      });
      if (res.ok) {
        setNewWarrName("");
        setNewWarrDays("90");
        setNewWarrDesc("");
        loadSettingsData();
      }
    } catch (err) {
      alert("Erro ao adicionar termo de garantia.");
    }
  };

  // Add Accessory Checklist Item
  const handleAddAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;

    try {
      const res = await fetch("/api/settings/accessories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAccName })
      });
      if (res.ok) {
        setNewAccName("");
        loadSettingsData();
      }
    } catch (err) {
      alert("Erro ao adicionar acessório.");
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-16 border border-gray-200 rounded-md flex justify-center items-center shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Upper header */}
      <div className="bg-white p-6 border border-gray-200 rounded-md shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Configurações do Sistema</h2>
        <p className="text-gray-500 text-xs mt-1">
          Ajuste as preferências globais do PK SIG, formas de pagamento aceitas, regras de garantias contratuais e checklists do balcão.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 rounded-md">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs flex items-center space-x-2 rounded-md">
          <Check className="h-4 w-4 text-green-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: Vertical section links & Content Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-gray-700">
        
        {/* Left Links */}
        <div className="md:col-span-1 space-y-1">
          {[
            { id: "geral", label: "Parâmetros Gerais", icon: SettingsIcon },
            { id: "empresa", label: "Informações da Empresa", icon: Building },
            { id: "categorias", label: "Categorias de Equip.", icon: Laptop },
            { id: "pagamentos", label: "Formas de Pagamento", icon: DollarSign },
            { id: "garantias", label: "Termos de Garantia", icon: ShieldCheck },
            { id: "acessorios", label: "Acessórios Checklist", icon: Tag },
            { id: "armazenamento", label: "Armazenamento", icon: Database },
            { id: "pwa", label: "Configurar Aplicativo (PWA)", icon: Smartphone }
          ].map((sec) => {
            const IconComp = sec.icon;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`w-full text-left px-4 py-2.5 rounded-md font-semibold flex items-center space-x-2.5 transition cursor-pointer ${activeSection === sec.id ? "bg-[#0e131f] text-white font-bold" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-950"}`}
              >
                <IconComp className="h-4 w-4 shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-3 bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-6">
          
          {/* SECTION: PARÂMETROS GERAIS */}
          {activeSection === "geral" && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-900 text-sm">Parâmetros Globais</h3>
                <p className="text-gray-400 text-[10px]">Ajustes de identidade e limites de faturamento da oficina.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Moeda do Sistema</label>
                  <select
                    value={systemConfig.currency}
                    onChange={(e) => setSystemConfig({ ...systemConfig, currency: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none font-bold"
                  >
                    <option value="R$">Real Brasileiro (R$)</option>
                    <option value="$">Dólar Americano ($)</option>
                    <option value="€">Euro (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Alerta de Atraso de OS (Dias de Tolerância)</label>
                  <input
                    type="number"
                    value={systemConfig.default_delay_alert_days}
                    onChange={(e) => setSystemConfig({ ...systemConfig, default_delay_alert_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-bold text-center"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md font-bold transition cursor-pointer"
                >
                  {isSaving ? <Loader className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Salvar Preferências</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION: INFORMAÇÕES DA EMPRESA */}
          {activeSection === "empresa" && (
            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-900 text-sm">Informações da Empresa</h3>
                <p className="text-gray-400 text-[10px]">Dados da sua assistência técnica utilizados para personalização de documentos e relatórios gerados.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Razão Social / Nome da Assistência *</label>
                  <input
                    type="text"
                    required
                    value={companyConfig.company_name}
                    onChange={(e) => setCompanyConfig({ ...companyConfig, company_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-semibold bg-white"
                    placeholder="Ex: PK SIG Assistência Técnica Ltda"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Nome Fantasia</label>
                  <input
                    type="text"
                    value={companyConfig.trade_name}
                    onChange={(e) => setCompanyConfig({ ...companyConfig, trade_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-semibold bg-white"
                    placeholder="Ex: PK SIG Celulares"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">CNPJ / CPF</label>
                  <input
                    type="text"
                    value={companyConfig.tax_id}
                    onChange={(e) => setCompanyConfig({ ...companyConfig, tax_id: formatCpfCnpj(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-semibold bg-white"
                    placeholder="00.000.000/0001-00"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">E-mail de Contato</label>
                  <input
                    type="email"
                    value={companyConfig.email}
                    onChange={(e) => setCompanyConfig({ ...companyConfig, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-semibold bg-white"
                    placeholder="contato@empresa.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Telefone Fixo / Comercial</label>
                  <input
                    type="text"
                    value={companyConfig.phone}
                    onChange={(e) => setCompanyConfig({ ...companyConfig, phone: formatPhone(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-semibold bg-white"
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Whatsapp</label>
                  <input
                    type="text"
                    value={companyConfig.whatsapp}
                    onChange={(e) => setCompanyConfig({ ...companyConfig, whatsapp: formatPhone(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-semibold bg-white"
                    placeholder="(00) 90000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Endereço Completo</label>
                <textarea
                  value={companyConfig.address_text}
                  onChange={(e) => setCompanyConfig({ ...companyConfig, address_text: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none h-20 bg-white"
                  placeholder="Ex: Rua das Flores, 123, Centro, São Paulo - SP, CEP 00000-000"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md font-bold transition cursor-pointer"
                >
                  {isSaving ? <Loader className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Salvar Informações</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION: CATEGORIAS DE EQUIPAMENTO */}
          {activeSection === "categorias" && (
            <div className="space-y-6">
              <form onSubmit={handleSaveCategory} className="space-y-3 bg-gray-50/50 p-4 border border-gray-200 rounded-md">
                <h4 className="font-bold text-gray-950 uppercase tracking-wider text-[10px]">
                  {editingCategory ? "Editar Categoria de Equipamento" : "+ Adicionar Nova Categoria"}
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Nome da Categoria *</label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none font-semibold"
                      placeholder="Ex: Notebook, Smartphone, Console"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Observações (Opcional)</label>
                    <input
                      type="text"
                      value={newCatNotes}
                      onChange={(e) => setNewCatNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none"
                      placeholder="Breve descrição"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={handleCancelEditCategory}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded cursor-pointer transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded cursor-pointer transition"
                  >
                    {editingCategory ? "Salvar Alterações" : "Salvar Categoria"}
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 text-[10px] uppercase tracking-wider">Categorias Cadastradas ({categories.length})</h4>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase py-2 px-3">
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Observações</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {categories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-gray-50/20">
                          <td className="p-3 font-bold text-gray-900">{cat.name}</td>
                          <td className="p-3 text-gray-500">{cat.notes || "-"}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                              {cat.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleEditCategoryClick(cat)}
                              className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-600 hover:text-indigo-600 font-bold border border-gray-200 rounded text-[10px] transition cursor-pointer"
                              title="Editar Categoria"
                            >
                              <Edit className="h-3 w-3 inline mr-1" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleActive("equipment_categories", cat.id, cat.active)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${cat.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                            >
                              {cat.active ? "Inativar" : "Ativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: FORMAS DE PAGAMENTO */}
          {activeSection === "pagamentos" && (
            <div className="space-y-6">
              <form onSubmit={handleAddPayment} className="space-y-3 bg-gray-50/50 p-4 border border-gray-200 rounded-md">
                <h4 className="font-bold text-gray-950 uppercase tracking-wider text-[10px]">+ Adicionar Forma de Pagamento</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Nome da Forma *</label>
                    <input
                      type="text"
                      required
                      value={newPayName}
                      onChange={(e) => setNewPayName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none font-semibold"
                      placeholder="Ex: Cartão de Crédito, Pix, Dinheiro"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Máximo de Parcelas Permitidas</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={newPayMaxInstall}
                      onChange={(e) => setNewPayMaxInstall(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none text-center font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded"
                  >
                    Salvar Forma de Pagamento
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 text-[10px] uppercase tracking-wider">Formas Cadastradas ({paymentMethods.length})</h4>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase py-2 px-3">
                        <th className="p-3">Forma de Pagamento</th>
                        <th className="p-3 text-center">Parcelamento Máx.</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paymentMethods.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50/20">
                          <td className="p-3 font-bold text-gray-900">{m.name}</td>
                          <td className="p-3 text-center font-mono font-bold">{m.max_installments}x</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${m.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                              {m.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleToggleActive("payment_methods", m.id, m.active)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${m.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                            >
                              {m.active ? "Inativar" : "Ativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: TERMO DE GARANTIA PADRÃO */}
          {activeSection === "garantias" && (
            <div className="space-y-6">
              <form onSubmit={handleAddWarranty} className="space-y-3 bg-gray-50/50 p-4 border border-gray-200 rounded-md">
                <h4 className="font-bold text-gray-950 uppercase tracking-wider text-[10px]">+ Adicionar Nova Regra de Garantia</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-gray-600 mb-1 font-semibold">Nome Curto *</label>
                    <input
                      type="text"
                      required
                      value={newWarrName}
                      onChange={(e) => setNewWarrName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none font-semibold"
                      placeholder="Ex: Garantia Balcão Standard, Garantia Placa Mãe"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Prazo de Vigência (Dias) *</label>
                    <input
                      type="number"
                      required
                      value={newWarrDays}
                      onChange={(e) => setNewWarrDays(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none text-center font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Descrição Detalhada do Termo (Para Impressão)</label>
                  <textarea
                    value={newWarrDesc}
                    onChange={(e) => setNewWarrDesc(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none h-14"
                    placeholder="Ex: A garantia cobre defeitos decorrentes da peça substituída. Ficam excluídos danos por quedas, líquidos..."
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded"
                  >
                    Salvar Regra de Garantia
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 text-[10px] uppercase tracking-wider">Regras de Garantia Cadastradas ({warrantyRules.length})</h4>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase py-2 px-3">
                        <th className="p-3">Garantia</th>
                        <th className="p-3 text-center">Vigência (Dias)</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {warrantyRules.map((w) => (
                        <tr key={w.id} className="hover:bg-gray-50/20">
                          <td className="p-3">
                            <div className="font-bold text-gray-900">{w.name}</div>
                            {w.terms_description && <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-sm">{w.terms_description}</div>}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-indigo-600">{w.duration_days} dias</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${w.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                              {w.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleToggleActive("warranty_rules", w.id, w.active)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${w.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                            >
                              {w.active ? "Inativar" : "Ativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: ACESSÓRIOS CHECKLIST */}
          {activeSection === "acessorios" && (
            <div className="space-y-6">
              <form onSubmit={handleAddAccessory} className="space-y-3 bg-gray-50/50 p-4 border border-gray-200 rounded-md">
                <h4 className="font-bold text-gray-950 uppercase tracking-wider text-[10px]">+ Adicionar Novo Acessório ao Checklist</h4>
                
                <div className="flex space-x-3 items-end">
                  <div className="flex-1">
                    <label className="block text-gray-600 mb-1 font-semibold">Nome do Acessório *</label>
                    <input
                      type="text"
                      required
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded-md focus:outline-none font-semibold"
                      placeholder="Ex: Cabo de Alimentação, Capa Protetora, Cartão SD"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded"
                  >
                    Salvar
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 text-[10px] uppercase tracking-wider">Acessórios de Checklist Cadastrados ({accessories.length})</h4>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase py-2 px-3">
                        <th className="p-3">Acessório</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {accessories.map((acc) => (
                        <tr key={acc.id} className="hover:bg-gray-50/20">
                          <td className="p-3 font-bold text-gray-900">{acc.name}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${acc.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                              {acc.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleToggleActive("reception_accessories", acc.id, acc.active)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${acc.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                            >
                              {acc.active ? "Inativar" : "Ativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSection === "armazenamento" && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-900 text-sm flex items-center">
                  <Database className="h-5 w-5 mr-1.5 text-gray-700" />
                  Gerenciamento de Armazenamento e Clonagem
                </h3>
                <p className="text-gray-400 text-[10px]">
                  Gerencie a sincronização e clonagem completa dos dados entre o servidor online (MySQL) e o armazenamento local (SQLite).
                </p>
              </div>

              {/* Status Banner */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 flex items-start space-x-3 text-xs">
                <Server className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-gray-900 text-xs">Banco de Dados Ativo Atualmente</p>
                  <p className="text-gray-500 text-[11px]">
                    O PK SIG está executando no modo:{" "}
                    <span className="font-bold text-indigo-600 uppercase bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">
                      {dbConfig?.mode === "local" ? "Local (SQLite)" : "Remoto (MySQL)"}
                    </span>
                  </p>
                  {dbConfig?.mode === "local" ? (
                    <p className="text-gray-400 text-[10px]">
                      Arquivo local: <span className="font-mono bg-gray-100 px-1 rounded">storage/pksig.db</span>
                    </p>
                  ) : (
                    <p className="text-gray-400 text-[10px]">
                      Conectado ao servidor MySQL: <span className="font-mono bg-gray-100 px-1 rounded">{dbConfig?.host}</span> | Banco: <span className="font-mono bg-gray-100 px-1 rounded">{dbConfig?.database}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Diagnóstico de Integridade e Compatibilidade */}
              <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="font-bold text-gray-800 text-xs flex items-center">
                    <ShieldCheck className="h-4.5 w-4.5 mr-1.5 text-emerald-600" />
                    Diagnóstico em Tempo Real de Integridade e Estrutura
                  </h4>
                  <button
                    onClick={handleVerifyDbIntegrity}
                    disabled={verifyingDb}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${verifyingDb ? "animate-spin" : ""}`} />
                    <span>Reavaliar Estrutura</span>
                  </button>
                </div>

                {verifyingDb ? (
                  <div className="flex items-center space-x-2 py-2 text-gray-500 text-[11px]">
                    <Loader className="animate-spin h-3.5 w-3.5 text-indigo-600" />
                    <span>Analisando tabelas, registros, administradores e integridade estrutural do banco...</span>
                  </div>
                ) : integrityError ? (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-[11px] space-y-1">
                    <p className="font-bold flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1 text-red-600 shrink-0" />
                      Falha na Conexão / Estrutura
                    </p>
                    <p>{integrityError}</p>
                    <p className="text-[10px] text-red-600 mt-1">Verifique suas credenciais de acesso ou realize uma clonagem de dados para restaurar as tabelas corretamente.</p>
                  </div>
                ) : dbIntegrity ? (
                  <div className="space-y-3 text-[11px]">
                    {/* Status Alert */}
                    {dbIntegrity.hasCompatibleTables ? (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-2.5 flex items-start space-x-2">
                        <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold text-xs">Banco de Dados Ativo com Estrutura Íntegra e Compatível!</p>
                          <p className="text-[10px] text-emerald-700/90 mt-0.5">{dbIntegrity.message}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-2.5 flex items-start space-x-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold text-xs">Estrutura Parcial ou Incompatível Detectada</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">{dbIntegrity.message}</p>
                          <p className="text-[9px] text-amber-600 mt-1">Dica: Use as opções de clonagem abaixo para restaurar e sincronizar todas as tabelas e dados.</p>
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                      <div className="bg-gray-50 border border-gray-150 rounded p-2 flex flex-col justify-between">
                        <span className="text-gray-400 font-semibold">Tabelas Criadas</span>
                        <div className="mt-1 flex items-baseline space-x-1">
                          <span className="text-sm font-bold text-gray-800">{dbIntegrity.existingTables?.length || 0}</span>
                          <span className="text-gray-400 text-[9px]">/ 22 tabelas necessárias</span>
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-150 rounded p-2 flex flex-col justify-between">
                        <span className="text-gray-400 font-semibold">Usuários Administradores</span>
                        <div className="mt-1 flex items-baseline space-x-1">
                          <span className="text-sm font-bold text-gray-800">{dbIntegrity.existingAdmins?.length || 0}</span>
                          <span className="text-gray-400 text-[9px]">usuário(s) na base</span>
                        </div>
                      </div>
                    </div>

                    {dbIntegrity.existingAdmins && dbIntegrity.existingAdmins.length > 0 && (
                      <div className="text-[9px] text-gray-400 bg-gray-50 rounded p-2 font-mono">
                        <span className="font-bold block text-[10px] text-gray-500 mb-1 font-sans">Administradores encontrados na base ativa:</span>
                        {dbIntegrity.existingAdmins.join(", ")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-[11px] italic">Clique em "Reavaliar Estrutura" para gerar o relatório de integridade.</div>
                )}
              </div>

              {/* SELEÇÃO DO MODO DE BANCO DE DADOS ATIVO */}
              <div className="bg-white border border-gray-200 rounded-md p-4 space-y-4 shadow-sm">
                <div className="border-b border-gray-50 pb-2">
                  <h4 className="font-bold text-gray-800 text-xs flex items-center">
                    <Server className="h-4 w-4 mr-2 text-indigo-600" />
                    Selecione qual Base de Dados Deseja Ativar
                  </h4>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Selecione se o sistema deve ler e salvar dados localmente ou diretamente no servidor MySQL remoto na nuvem.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card Local */}
                  <div 
                    onClick={() => !switchingMode && handleToggleDbMode("local")}
                    className={`p-4 rounded-md border-2 text-xs cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-sm ${
                      dbConfig?.mode === "local" 
                        ? "border-indigo-600 bg-indigo-50/25 ring-2 ring-indigo-600/10" 
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          name="db_mode" 
                          checked={dbConfig?.mode === "local"} 
                          onChange={() => {}}
                          disabled={switchingMode}
                          className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-bold text-gray-900 text-xs">Local (SQLite)</span>
                        {dbConfig?.mode === "local" && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">Ativo</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-[10px] leading-relaxed">
                        Extremamente veloz e independente de internet. Ideal se você roda o sistema de forma local offline ou quer velocidade instantânea.
                      </p>
                    </div>
                  </div>

                  {/* Card Remoto */}
                  <div 
                    onClick={() => !switchingMode && handleToggleDbMode("remoto")}
                    className={`p-4 rounded-md border-2 text-xs cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-sm ${
                      dbConfig?.mode === "remoto" 
                        ? "border-indigo-600 bg-indigo-50/25 ring-2 ring-indigo-600/10" 
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          name="db_mode" 
                          checked={dbConfig?.mode === "remoto"} 
                          onChange={() => {}}
                          disabled={switchingMode}
                          className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-bold text-gray-900 text-xs">Online / Remoto (MySQL)</span>
                        {dbConfig?.mode === "remoto" && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">Ativo</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-[10px] leading-relaxed">
                        Conecta com o servidor MySQL remoto na nuvem. Perfeito para uso multiusuário, equipes externas ou acesso centralizado de qualquer lugar.
                      </p>
                    </div>
                  </div>
                </div>

                {switchingMode && (
                  <div className="flex items-center space-x-2 text-indigo-600 text-[10px] font-bold">
                    <Loader className="animate-spin h-3.5 w-3.5" />
                    <span>Alterando modo do banco de dados e reiniciando conexões...</span>
                  </div>
                )}
              </div>

              {/* Success / Error Alerts */}
              {cloneSuccess && (
                <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md flex items-start space-x-2.5">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Sucesso!</p>
                    <p className="text-[11px] mt-0.5">{cloneSuccess}</p>
                  </div>
                </div>
              )}

              {cloneError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md flex items-start space-x-2.5">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Falha na Clonagem</p>
                    <p className="text-[11px] mt-0.5">{cloneError}</p>
                  </div>
                </div>
              )}

              {/* CLONE PANEL */}
              {cloneLoading ? (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-md p-10 flex flex-col items-center justify-center space-y-4 text-center">
                  <Loader className="animate-spin h-8 w-8 text-indigo-600" />
                  <div className="space-y-1">
                    <p className="font-bold text-indigo-900 text-xs">Clonando base de dados...</p>
                    <p className="text-indigo-700 text-[10px] max-w-md">
                      Isso pode levar alguns segundos dependendo do volume de dados. Por favor, mantenha esta janela aberta e não interrompa a operação.
                    </p>
                  </div>
                </div>
              ) : showConfirmModal ? (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-5 space-y-4 text-xs">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-950 text-xs">
                        ⚠️ Atenção: Ação Altamente Destrutiva
                      </p>
                      <p className="text-amber-800 text-[11px]">
                        Você selecionou clonar a base de dados na direção:{" "}
                        <span className="font-bold underline uppercase text-amber-950">
                          {showConfirmModal === "remote-to-local"
                            ? "Nuvem (MySQL) para Local (SQLite)"
                            : "Local (SQLite) para Nuvem (MySQL)"}
                        </span>.
                      </p>
                      <p className="text-amber-800 text-[11px] mt-2">
                        {showConfirmModal === "remote-to-local"
                          ? "Isso irá SUBSTITUIR COMPLETAMENTE todas as informações atuais do seu banco de dados local pelos dados vindos do MySQL online. Os dados locais existentes serão permanentemente apagados."
                          : "Isso irá SUBSTITUIR COMPLETAMENTE todas as informações atuais da sua base de dados MySQL na nuvem pelos registros locais do SQLite. Os dados remotos existentes serão permanentemente apagados."}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2.5 pt-1 text-[11px]">
                    <button
                      onClick={() => setShowConfirmModal(null)}
                      className="px-3.5 py-1.5 bg-white border border-amber-200 text-amber-900 rounded font-semibold hover:bg-amber-100 transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleClone(showConfirmModal)}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold transition cursor-pointer flex items-center space-x-1"
                    >
                      <span>Sim, Clonar e Substituir Tudo</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {dbConfig?.mode === "local" ? (
                    <div className="space-y-5 text-xs">
                      <div className="bg-amber-50/50 border border-amber-200/60 rounded-md p-4 text-[11px] text-amber-900 leading-relaxed">
                        <p className="font-semibold flex items-center mb-1">
                          <AlertCircle className="h-4 w-4 text-amber-600 mr-1 shrink-0" />
                          Ambiente de Sincronização Local (SQLite)
                        </p>
                        <p>
                          Como o sistema está rodando em modo SQLite Local, você precisa preencher abaixo as credenciais de acesso do seu servidor **MySQL Remoto** para onde ou de onde deseja clonar os dados.
                        </p>
                      </div>

                      {/* Remote Form Inputs */}
                      <div className="bg-white border border-gray-100 rounded-md p-4 space-y-4 text-xs">
                        <h4 className="font-bold text-gray-900 text-xs border-b border-gray-100 pb-1.5">Conectar ao MySQL Remoto para Clonagem</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-gray-600 mb-0.5 font-semibold text-[10px]">Host / Servidor MySQL</label>
                            <input
                              type="text"
                              value={remoteForm.host}
                              onChange={(e) => setRemoteForm({ ...remoteForm, host: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none"
                              placeholder="Ex: sql.provedor.com ou IP"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 mb-0.5 font-semibold text-[10px]">Porta</label>
                            <input
                              type="number"
                              value={remoteForm.port}
                              onChange={(e) => setRemoteForm({ ...remoteForm, port: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-600 mb-0.5 font-semibold text-[10px]">Nome do Banco (Database)</label>
                            <input
                              type="text"
                              value={remoteForm.database}
                              onChange={(e) => setRemoteForm({ ...remoteForm, database: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 mb-0.5 font-semibold text-[10px]">Usuário</label>
                            <input
                              type="text"
                              value={remoteForm.user}
                              onChange={(e) => setRemoteForm({ ...remoteForm, user: e.target.value })}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-600 mb-0.5 font-semibold text-[10px]">Senha do Servidor Remoto</label>
                          <input
                            type="password"
                            value={remoteForm.password}
                            onChange={(e) => setRemoteForm({ ...remoteForm, password: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none"
                            placeholder="Insira a senha do banco"
                          />
                        </div>

                        <div className="space-y-2 pt-1 text-xs">
                          <label className="flex items-center space-x-2 text-[10px] font-semibold text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={remoteForm.ssl}
                              onChange={(e) => setRemoteForm({ ...remoteForm, ssl: e.target.checked })}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>Usar Conexão Segura (SSL)</span>
                          </label>

                          {remoteForm.ssl && (
                            <div>
                              <label className="block text-gray-600 mb-0.5 font-semibold text-[10px]">Certificado CA (Opcional)</label>
                              <textarea
                                value={remoteForm.certificate}
                                onChange={(e) => setRemoteForm({ ...remoteForm, certificate: e.target.value })}
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-[10px] font-mono bg-white focus:outline-none h-16"
                                placeholder="Cole o conteúdo do certificado PEM se necessário"
                              />
                            </div>
                          )}
                        </div>

                        {/* Connection Test Response */}
                        {testSuccess && (
                          <p className="text-[11px] text-green-700 bg-green-50 px-2.5 py-1.5 rounded border border-green-200 flex items-center font-semibold">
                            <Check className="h-3.5 w-3.5 mr-1 shrink-0" /> {testSuccess}
                          </p>
                        )}
                        {testError && (
                          <p className="text-[11px] text-red-700 bg-red-50 px-2.5 py-1.5 rounded border border-red-200 flex items-center font-semibold">
                            <AlertCircle className="h-3.5 w-3.5 mr-1 shrink-0" /> {testError}
                          </p>
                        )}

                        <div className="pt-2 border-t border-gray-100 flex justify-end">
                          <button
                            type="button"
                            onClick={handleTestRemoteConnection}
                            disabled={testingConnection}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                          >
                            {testingConnection && <Loader className="animate-spin h-3 w-3" />}
                            <span>Testar Conexão Remota</span>
                          </button>
                        </div>
                      </div>

                      {/* Direction Selection Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nuvem -> Local */}
                        <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3 flex flex-col justify-between hover:border-indigo-200 transition text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs">
                              <Download className="h-4 w-4" />
                              <span>Clonar Online para Local</span>
                            </div>
                            <p className="text-gray-500 text-[11px] leading-relaxed">
                              Baixa todas as tabelas e registros do servidor MySQL informado acima e **apaga/substitui** a base local SQLite por esses dados.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowConfirmModal("remote-to-local")}
                            className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Baixar Sincronismo Online</span>
                          </button>
                        </div>

                        {/* Local -> Nuvem */}
                        <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3 flex flex-col justify-between hover:border-green-200 transition text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2 text-green-600 font-bold text-xs">
                              <Upload className="h-4 w-4" />
                              <span>Clonar Local para Online</span>
                            </div>
                            <p className="text-gray-500 text-[11px] leading-relaxed">
                              Envia todos os registros salvos nesta instância local SQLite e **sobrescreve completamente** o banco de dados MySQL remoto acima.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowConfirmModal("local-to-remote")}
                            className="w-full mt-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Enviar Sincronismo Local</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5 text-xs">
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-md p-4 text-[11px] text-indigo-900 leading-relaxed">
                        <p className="font-semibold flex items-center mb-1">
                          <Check className="h-4 w-4 text-indigo-600 mr-1 shrink-0" />
                          Ambiente de Sincronização Remota Ativo (MySQL)
                        </p>
                        <p>
                          Excelente! O sistema já está conectado à sua base de dados MySQL. Como a base de dados SQLite local está sempre disponível em arquivo seguro, você pode alternar ou clonar dados entre ambas as bases diretamente.
                        </p>
                      </div>

                      {/* Cloning Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nuvem -> Local */}
                        <div className="bg-white border border-gray-200 rounded-md p-5 space-y-3 flex flex-col justify-between hover:border-indigo-200 transition text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs">
                              <Download className="h-4 w-4" />
                              <span>Clonar Nuvem para Local (SQLite)</span>
                            </div>
                            <p className="text-gray-500 text-[11px] leading-relaxed">
                              Realiza uma cópia idêntica de todas as tabelas e registros do seu MySQL ativo na nuvem e substitui o arquivo local SQLite. Útil para criar cópias de backup locais de sua nuvem.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowConfirmModal("remote-to-local")}
                            className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Clonar para SQLite Local</span>
                          </button>
                        </div>

                        {/* Local -> Nuvem */}
                        <div className="bg-white border border-gray-200 rounded-md p-5 space-y-3 flex flex-col justify-between hover:border-green-200 transition text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2 text-green-600 font-bold text-xs">
                              <Upload className="h-4 w-4" />
                              <span>Clonar Local (SQLite) para Nuvem</span>
                            </div>
                            <p className="text-gray-500 text-[11px] leading-relaxed">
                              Substitui por completo todas as informações do seu servidor MySQL na nuvem pelos dados contidos atualmente no arquivo SQLite local. Ideal para subir dados de uma instalação offline anterior.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowConfirmModal("local-to-remote")}
                            className="w-full mt-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Clonar para MySQL Nuvem</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SECTION: CONFIGURAÇÃO DO APLICATIVO PWA */}
          {activeSection === "pwa" && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm flex items-center">
                    <Smartphone className="h-4 w-4 mr-2 text-indigo-600" />
                    Aplicativo Android / PWA (Progressive Web App)
                  </h3>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Habilite a instalação direta do PK SIG no celular em tela cheia com sua própria marca, cores e ícone.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Formulário de Configuração */}
                <form onSubmit={handleSavePwa} className="lg:col-span-3 space-y-4">
                  
                  {/* Nome e Descrição do App */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-gray-800 text-xs border-b border-gray-50 pb-1">Identidade do Aplicativo</h4>
                    
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold flex items-center">
                        Nome do Aplicativo
                        <span className="ml-1 text-[10px] text-gray-400 font-normal">(Exibido na tela de carregamento)</span>
                      </label>
                      <input
                        type="text"
                        value={systemConfig.pwa_name}
                        onChange={(e) => setSystemConfig({ ...systemConfig, pwa_name: e.target.value })}
                        placeholder="Ex: PK SIG - Sistema de Gestão de OS"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        Este é o título completo do seu aplicativo que aparece na barra de carregamento e nas propriedades do sistema.
                      </p>
                    </div>

                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold flex items-center">
                        Nome Curto na Tela Inicial
                        <span className="ml-1 text-[10px] text-gray-400 font-normal">(Crucial para Android)</span>
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={systemConfig.pwa_short_name}
                        onChange={(e) => setSystemConfig({ ...systemConfig, pwa_short_name: e.target.value })}
                        placeholder="Ex: PK SIG"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        O nome que ficará impresso logo abaixo do ícone do aplicativo na tela inicial do celular Android. Use no máximo 12-15 caracteres para evitar cortes.
                      </p>
                    </div>

                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Descrição do Aplicativo</label>
                      <textarea
                        value={systemConfig.pwa_description}
                        onChange={(e) => setSystemConfig({ ...systemConfig, pwa_description: e.target.value })}
                        placeholder="Ex: Sistema completo para gerenciamento de ordens de serviço, clientes e estoque."
                        rows={2}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        Uma breve descrição do propósito do aplicativo, utilizada por lojas e pelo instalador do navegador.
                      </p>
                    </div>
                  </div>

                  {/* Cores e Aparência */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-gray-800 text-xs border-b border-gray-50 pb-1">Cores e Aparência</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-600 mb-1 font-semibold flex items-center">
                          Cor de Tema (Status Bar)
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="color"
                            value={systemConfig.pwa_theme_color}
                            onChange={(e) => setSystemConfig({ ...systemConfig, pwa_theme_color: e.target.value })}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={systemConfig.pwa_theme_color}
                            onChange={(e) => setSystemConfig({ ...systemConfig, pwa_theme_color: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs font-mono font-bold"
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                          Colore a barra de notificações do celular quando o app estiver aberto.
                        </p>
                      </div>

                      <div>
                        <label className="block text-gray-600 mb-1 font-semibold flex items-center">
                          Cor de Fundo (Splash)
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="color"
                            value={systemConfig.pwa_background_color}
                            onChange={(e) => setSystemConfig({ ...systemConfig, pwa_background_color: e.target.value })}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={systemConfig.pwa_background_color}
                            onChange={(e) => setSystemConfig({ ...systemConfig, pwa_background_color: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs font-mono font-bold"
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                          Cor da tela de abertura (Splash Screen) enquanto o aplicativo inicializa.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Modo de Exibição (Tela Cheia)</label>
                      <select
                        value={systemConfig.pwa_display}
                        onChange={(e) => setSystemConfig({ ...systemConfig, pwa_display: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      >
                        <option value="standalone">Standalone (Como aplicativo nativo - recomendado)</option>
                        <option value="fullscreen">Fullscreen (Imersão total - oculta barra de status do celular)</option>
                        <option value="minimal-ui">Minimal UI (Exibe barra simples de navegação superior)</option>
                      </select>
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        Controla as bordas do navegador. O modo **Standalone** remove toda e qualquer barra de navegador, simulando perfeitamente um aplicativo nativo baixado pela Google Play Store!
                      </p>
                    </div>
                  </div>

                  {/* Upload do Ícone Personalizado */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-gray-800 text-xs border-b border-gray-50 pb-1">Ícone de Lançamento</h4>
                    
                    <div className="flex items-start space-x-4">
                      <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0 shadow-inner">
                        {systemConfig.pwa_icon_url ? (
                          <img src={systemConfig.pwa_icon_url} alt="Ícone PWA" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="text-[10px] text-indigo-400 font-mono font-bold">PADRÃO</div>
                        )}
                      </div>
                      <div className="space-y-1.5 w-full">
                        <label className="block text-gray-600 font-semibold">Alterar Ícone do Aplicativo</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/svg+xml"
                            onChange={handleIconChange}
                            className="hidden"
                            id="pwa-icon-file"
                          />
                          <label
                            htmlFor="pwa-icon-file"
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1 border border-slate-300"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>Enviar Nova Imagem</span>
                          </label>
                          {systemConfig.pwa_icon_url && (
                            <button
                              type="button"
                              onClick={handleResetIcon}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-bold transition cursor-pointer border border-red-200"
                            >
                              Redefinir Padrão
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 leading-normal">
                          Envie um ícone quadrado (PNG ou SVG de preferência). Recomendado tamanho mínimo de 192x192px. A imagem é comprimida e sincronizada na nuvem automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Ação de salvar */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <Loader className="h-3.5 w-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Salvar Configurações do App</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Painel Lateral Interativo (Android Mockup & Instruções) */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Celular Mockup Interativo */}
                  <div className="bg-slate-950 rounded-[32px] p-4 shadow-xl border-4 border-slate-800 max-w-[260px] mx-auto relative overflow-hidden flex flex-col items-center">
                    {/* Speaker notch */}
                    <div className="w-20 h-4 bg-slate-800 rounded-b-xl absolute top-0 z-20 flex items-center justify-center">
                      <div className="w-10 h-1 bg-slate-900 rounded-full"></div>
                    </div>

                    {/* Phone Status Bar */}
                    <div 
                      className="w-full h-6 pt-1 px-4 flex items-center justify-between text-[8px] text-white/90 font-mono font-bold select-none z-10 transition-colors duration-300"
                      style={{ backgroundColor: systemConfig.pwa_theme_color || "#0e131f" }}
                    >
                      <span>12:00</span>
                      <div className="flex items-center space-x-1">
                        <span>📶</span>
                        <span>🔋 100%</span>
                      </div>
                    </div>

                    {/* Phone Screen Area */}
                    <div 
                      className="w-full aspect-[9/16] rounded-[20px] p-4 flex flex-col items-center justify-between text-center select-none relative transition-colors duration-500 overflow-hidden"
                      style={{ backgroundColor: systemConfig.pwa_background_color || "#ffffff" }}
                    >
                      <div className="w-full flex flex-col items-center justify-center flex-grow mt-8 space-y-3 z-10">
                        {/* App Launcher Icon inside Screen */}
                        <div className="w-14 h-14 rounded-xl shadow-lg border border-gray-100 overflow-hidden bg-[#0e131f] flex items-center justify-center">
                          {systemConfig.pwa_icon_url ? (
                            <img src={systemConfig.pwa_icon_url} alt="Phone Mock Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <svg className="w-10 h-10 text-indigo-500" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6">
                              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="4" />
                              <path d="M35,50 L45,60 L65,40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Title of application */}
                        <div className="space-y-1">
                          <h5 className="font-bold text-[11px] truncate max-w-[140px]" style={{ color: (systemConfig.pwa_background_color || "#ffffff").toLowerCase() === "#ffffff" ? "#0f172a" : "#ffffff" }}>
                            {systemConfig.pwa_short_name || systemConfig.pwa_name || "PK SIG"}
                          </h5>
                          <p className="text-[7px] text-gray-400 font-mono">Carregando recursos...</p>
                        </div>
                      </div>

                      {/* Micro Footer Indicator */}
                      <div className="w-full z-10">
                        <div className="h-1 bg-gray-300 rounded-full w-24 mx-auto mb-1"></div>
                        <p className="text-[6px] text-gray-400">{systemConfig.pwa_short_name || "PK SIG"}</p>
                      </div>
                    </div>

                    {/* Bottom home button bar */}
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-3"></div>
                  </div>

                  {/* Informações sobre o PWA para o Usuário */}
                  <div className="bg-amber-50/50 border border-amber-200 rounded-md p-4 space-y-2.5 text-xs text-amber-900 leading-relaxed">
                    <p className="font-bold flex items-center mb-1 text-amber-800 text-xs">
                      <AlertCircle className="h-4 w-4 mr-1 text-amber-600 shrink-0" />
                      Como instalar no seu Android?
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-amber-800">
                      <li>
                        Acesse este sistema no seu celular usando o navegador <strong>Google Chrome</strong>.
                      </li>
                      <li>
                        Toque no botão de <strong>Menu (três pontinhos)</strong> no canto superior direito.
                      </li>
                      <li>
                        Clique na opção <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.
                      </li>
                      <li>
                        O aplicativo será baixado e aparecerá na sua tela de aplicativos como se fosse baixado da Play Store!
                      </li>
                    </ol>
                    <div className="border-t border-amber-200/50 pt-2 text-[10px] text-amber-700/85">
                      <strong>Nota de Consistência:</strong> Esta tecnologia PWA roda em tela cheia. Caso faça alterações no ícone ou cores acima, reinstale o aplicativo ou limpe o cache do Chrome no celular para ver os novos ícones aplicados.
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
