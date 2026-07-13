import React, { useState, useEffect } from "react";
import { EquipmentCategory, PaymentMethod, WarrantyRule } from "../types";
import { 
  Settings as SettingsIcon, Save, Plus, Check, Trash2, 
  RefreshCw, DollarSign, Laptop, ShieldCheck, Tag, Loader, AlertCircle,
  Building, Edit, Database, Server, ArrowLeftRight, Download, Upload
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
  const [activeSection, setActiveSection] = useState<"geral" | "categorias" | "pagamentos" | "garantias" | "acessorios" | "empresa" | "armazenamento">("geral");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // DB States
  const [systemConfig, setSystemConfig] = useState({
    id: 1,
    currency: "R$",
    default_delay_alert_days: 5,
    default_tax_rate: 0
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
          setSystemConfig(data.system);
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
            { id: "armazenamento", label: "Armazenamento", icon: Database }
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

        </div>

      </div>

    </div>
  );
}
