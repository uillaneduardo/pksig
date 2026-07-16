import React, { useState, useEffect } from "react";
import { EquipmentCategory, PaymentMethod, WarrantyRule } from "../types";
import { useOperationProgress } from "../hooks/useOperationProgress";
import { ProgressModal } from "./OperationProgress";
import { 
  Settings as SettingsIcon, Save, Plus, Check, Trash2, 
  RefreshCw, DollarSign, Laptop, ShieldCheck, Tag, Loader, AlertCircle,
  Building, Edit, Database, Server, ArrowLeftRight, Download, Upload,
  Smartphone, Shield
} from "lucide-react";
import ImportAssistant from "./ImportAssistant";

interface SettingsProps {
  onUpdateCurrency: (currency: string) => void;
  currency: string;
  onCompanyUpdated?: () => void;
  onDatabaseUpdated?: () => void;
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

export default function Settings({ onUpdateCurrency, currency, onCompanyUpdated, onDatabaseUpdated }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<"geral" | "categorias" | "pagamentos" | "garantias" | "acessorios" | "empresa" | "armazenamento" | "pwa" | "financeiro">("geral");
  const [armazenamentoTab, setArmazenamentoTab] = useState<"diagnostico" | "importacao">("diagnostico");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Financial States
  const [finCategories, setFinCategories] = useState<any[]>([]);
  const [newFinCatName, setNewFinCatName] = useState("");
  const [newFinCatType, setNewFinCatType] = useState<"entrada" | "saida">("entrada");
  const [editingFinCategory, setEditingFinCategory] = useState<any | null>(null);

  const fetchFinCategories = async () => {
    try {
      const res = await fetch("/api/finance/categories");
      if (res.ok) {
        const data = await res.json();
        setFinCategories(data);
      }
    } catch (err) {
      console.error("Error fetching financial categories:", err);
    }
  };

  const handleAddFinCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinCatName.trim()) return;

    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFinCatName, type: newFinCatType })
      });
      if (res.ok) {
        setSuccessMsg("Categoria financeira adicionada com sucesso!");
        setNewFinCatName("");
        fetchFinCategories();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Erro ao adicionar categoria.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação.");
    }
  };

  const handleUpdateFinCategory = async (cat: any, updatedFields: Partial<any>) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/finance/categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updatedFields.name !== undefined ? updatedFields.name : cat.name,
          type: updatedFields.type !== undefined ? updatedFields.type : cat.type,
          active: updatedFields.active !== undefined ? updatedFields.active : cat.active
        })
      });
      if (res.ok) {
        setSuccessMsg("Categoria financeira atualizada.");
        setEditingFinCategory(null);
        fetchFinCategories();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Erro ao atualizar categoria.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação.");
    }
  };

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
    type: "mysql",
    host: "",
    port: "3306",
    database: "pksig",
    user: "root",
    password: "",
    ssl: false,
    certificate: ""
  });
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");
  const [importError, setImportError] = useState("");

  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlSuccess, setSqlSuccess] = useState("");
  const [sqlError, setSqlError] = useState("");

  const handleImportSql = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSqlLoading(true);
    setSqlSuccess("");
    setSqlError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const sqlText = event.target?.result as string;
        const res = await fetch("/api/database/import-sql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ sql: sqlText })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSqlSuccess(data.message || "Backup .SQL importado com sucesso!");
          if (data.errors && data.errors.length > 0) {
            setSqlError("Alguns comandos falharam:\n" + data.errors.join("\n"));
          }
          loadSettingsData();
          if (onDatabaseUpdated) {
            onDatabaseUpdated();
          }
        } else {
          setSqlError(data.error || "Erro ao importar dados SQL.");
        }
      } catch (err: any) {
        setSqlError("Erro de conexão ou leitura do arquivo: " + err.message);
      } finally {
        setSqlLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const [testSuccess, setTestSuccess] = useState("");
  const [testError, setTestError] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  const [dbIntegrity, setDbIntegrity] = useState<any>(null);
  const [verifyingDb, setVerifyingDb] = useState(false);
  const [integrityError, setIntegrityError] = useState("");

  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmResetWord, setConfirmResetWord] = useState("");

  // Operation Progress State & Hook Integrations
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);

  const {
    progress: resetProgress,
    error: resetProgressError,
    startPolling: startResetProgressPolling,
    reset: resetResetProgress
  } = useOperationProgress(null, {
    onSuccess: async () => {
      setResetSuccess("Banco de dados recriado do zero com sucesso! As migrações foram aplicadas.");
      await handleVerifyDbIntegrity();
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    },
    onFailure: (prog) => {
      setResetError(prog.error || "Falha crítica durante a recriação do banco de dados.");
    }
  });

  const {
    progress: simProgress,
    error: simProgressError,
    startPolling: startSimProgressPolling,
    reset: resetSimProgress
  } = useOperationProgress(null);

  const handleStartSimulation = async (scenario: "success" | "fail" | "indeterminate") => {
    setIsSimulateModalOpen(true);
    try {
      const res = await fetch("/api/operations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json();
      if (res.ok && data.operationId) {
        startSimProgressPolling(data.operationId);
      } else {
        alert(data.error || "Erro ao iniciar simulação.");
      }
    } catch (err) {
      alert("Falha ao comunicar com o servidor.");
    }
  };

  const handleResetDatabase = async () => {
    if (confirmResetWord.trim().toUpperCase() !== "REDEFINIR") {
      setResetError("Digite a palavra REDEFINIR para confirmar que deseja apagar os dados.");
      return;
    }

    setResetLoading(true);
    setResetSuccess("");
    setResetError("");
    try {
      const res = await fetch("/api/setup/database/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmResetWord })
      });
      const data = await res.json();
      if (res.ok && data.operationId) {
        setIsResetModalOpen(true);
        setShowResetConfirm(false);
        setConfirmResetWord("");
        startResetProgressPolling(data.operationId);
      } else {
        setResetError(data.error || "Erro ao redefinir o banco de dados.");
      }
    } catch (err) {
      setResetError("Erro de comunicação ao redefinir o banco de dados.");
    } finally {
      setResetLoading(false);
    }
  };

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


  const fetchDbConfig = async () => {
    try {
      const res = await fetch("/api/database/config");
      if (res.ok) {
        const data = await res.json();
        setDbConfig(data);
        if (data.mode === "remoto") {
          setRemoteForm({
            type: data.type || "mysql",
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

  const handleExportSettings = async () => {
    try {
      const res = await fetch("/api/settings/export");
      if (!res.ok) {
        throw new Error("Falha ao exportar configurações do servidor");
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pksig_configuracoes_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao exportar configurações: " + err.message);
    }
  };

  const handleImportSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportSuccess("");
    setImportError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await fetch("/api/settings/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(json)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setImportSuccess(data.message || "Configurações importadas com sucesso!");
          loadSettingsData();
          if (onDatabaseUpdated) {
            onDatabaseUpdated();
          }
        } else {
          setImportError(data.error || "Erro ao importar dados no servidor.");
        }
      } catch (err: any) {
        setImportError("Arquivo JSON inválido ou erro de conexão: " + err.message);
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsText(file);
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
        fetchFinCategories();
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
    if (activeSection === "financeiro") {
      fetchFinCategories();
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
            { id: "financeiro", label: "Categorias Financeiras", icon: ArrowLeftRight },
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
                  Gerenciamento de Armazenamento
                </h3>
                <p className="text-gray-400 text-[10px]">
                  Gerencie a base de dados MySQL ativa e importe ou exporte as configurações fundamentais do sistema.
                </p>
              </div>

              {/* TAB ROW */}
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setArmazenamentoTab("diagnostico")}
                  className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    armazenamentoTab === "diagnostico"
                      ? "border-[#0e131f] text-[#0e131f] font-black"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200"
                  }`}
                >
                  Visão Geral & Diagnóstico
                </button>
                <button
                  type="button"
                  onClick={() => setArmazenamentoTab("importacao")}
                  className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    armazenamentoTab === "importacao"
                      ? "border-[#0e131f] text-[#0e131f] font-black"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200"
                  }`}
                >
                  Assistente de Importação & Backup
                </button>
              </div>

              {armazenamentoTab === "diagnostico" && (
                <div className="space-y-6">

              {/* ARQUITETURA DE ARMAZENAMENTO COMPLETA E SEGURA - ETAPA 9 */}
              <div className="bg-indigo-50/40 border border-indigo-150 rounded-lg p-4 space-y-3 text-xs leading-relaxed">
                <h4 className="font-bold text-indigo-950 text-xs flex items-center">
                  <Shield className="h-4 w-4 mr-1.5 text-indigo-700" />
                  Arquitetura de Armazenamento PK SIG (PWA + InnoDB)
                </h4>
                <p className="text-gray-600 text-[11px]">
                  O PK SIG utiliza uma topologia moderna projetada para alta disponibilidade offline e sincronização garantida:
                </p>
                <div className="space-y-2.5 text-[10.5px]">
                  <div className="flex items-start space-x-2">
                    <span className="bg-indigo-200 text-indigo-800 h-4.5 w-4.5 text-[9px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <span className="font-bold text-gray-800">MySQL Remoto (Servidor Nuvem / Produção):</span>
                      <p className="text-gray-500 text-[10px]">
                        Banco definitivo hospedado na nuvem utilizando o motor transacional seguro InnoDB. O backend do PK SIG conecta-se utilizando credenciais isoladas de forma privada e segura.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-indigo-200 text-indigo-800 h-4.5 w-4.5 text-[9px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      <span className="font-bold text-gray-800">IndexedDB do Dispositivo (PWA Offline Cache):</span>
                      <p className="text-gray-500 text-[10px]">
                        O cache inteligente gerenciado pelo navegador no dispositivo do usuário. Se a conexão de internet oscilar ou cair temporariamente, o sistema salva as alterações imediatamente no IndexedDB local e as sincroniza de forma transparente com o servidor remoto assim que restabelecer a rede.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 flex items-start space-x-3 text-xs">
                <Server className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-gray-900 text-xs">Banco de Dados Ativo Atualmente</p>
                  <p className="text-gray-500 text-[11px]">
                    O PK SIG está executando no modo:{" "}
                    <span className="font-bold text-indigo-600 uppercase bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">
                      Remoto (MySQL / MariaDB)
                    </span>
                  </p>
                  <p className="text-gray-400 text-[10px]">
                    Conectado ao servidor MySQL: <span className="font-mono bg-gray-100 px-1 rounded">{dbConfig?.host || "Servidor Remoto"}</span> | Banco: <span className="font-mono bg-gray-100 px-1 rounded">{dbConfig?.database || "pksig"}</span>
                  </p>
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
                    <p className="text-[10px] text-red-600 mt-1">Verifique suas credenciais de acesso ou tente novamente.</p>
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

              {/* LISTA DE MOTORES DE BANCO DE DADOS DISPONÍVEIS */}
              <div className="bg-white border border-gray-200 rounded-md p-4 space-y-4 shadow-sm">
                <div className="border-b border-gray-100 pb-2">
                  <h4 className="font-bold text-gray-800 text-xs flex items-center">
                    <Database className="h-4 w-4 mr-2 text-indigo-600" />
                    Lista de Motores de Banco de Dados Compatíveis
                  </h4>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    O PK SIG permite selecionar qual motor relacional utilizar para hospedar seu sistema:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* MySQL / MariaDB (Ativo) */}
                  <div className="p-3 rounded-md border-2 border-indigo-600 bg-indigo-50/20 text-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 mb-1">
                        <input type="radio" checked={true} readOnly className="h-3 w-3 text-indigo-600" />
                        <span className="font-bold text-gray-950">MySQL / MariaDB</span>
                        <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 rounded">Ativo</span>
                      </div>
                      <p className="text-gray-500 text-[10px]">Motor InnoDB transacional nativo para total segurança e consistência dos dados operacionais.</p>
                    </div>
                  </div>

                  {/* PostgreSQL (Planejado) */}
                  <div className="p-3 rounded-md border border-gray-200 opacity-55 bg-gray-50 text-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 mb-1">
                        <input type="radio" checked={false} disabled className="h-3 w-3 text-gray-400" />
                        <span className="font-bold text-gray-400">PostgreSQL</span>
                        <span className="text-[9px] bg-gray-200 text-gray-600 font-bold px-1.5 rounded">Em breve</span>
                      </div>
                      <p className="text-gray-400 text-[10px]">Suporte planejado para futuras atualizações da plataforma corporativa.</p>
                    </div>
                  </div>

                  {/* SQL Server (Planejado) */}
                  <div className="p-3 rounded-md border border-gray-200 opacity-55 bg-gray-50 text-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 mb-1">
                        <input type="radio" checked={false} disabled className="h-3 w-3 text-gray-400" />
                        <span className="font-bold text-gray-400">SQL Server</span>
                        <span className="text-[9px] bg-gray-200 text-gray-600 font-bold px-1.5 rounded">Em breve</span>
                      </div>
                      <p className="text-gray-400 text-[10px]">Compatibilidade futura para grandes infraestruturas corporativas.</p>
                    </div>
                  </div>
                </div>
              </div>



              {/* REDEFINIÇÃO E RESTAURAÇÃO DE FÁBRICA */}
              <div className="bg-white border border-red-200 rounded-md p-4 space-y-4 shadow-sm">
                <div className="border-b border-red-50 pb-2">
                  <h4 className="font-bold text-red-700 text-xs flex items-center">
                    <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                    Redefinição e Restauração de Fábrica (Reset Geral)
                  </h4>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Esta ação apaga todas as tabelas, clientes, ordens de serviço e históricos do banco de dados ativo atualmente (seja Local ou Remoto), recriando as tabelas limpas e inserindo as configurações padrão do sistema.
                  </p>
                </div>

                {resetSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md flex items-start space-x-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Sucesso!</p>
                      <p className="text-[10px] mt-0.5">{resetSuccess}</p>
                    </div>
                  </div>
                )}

                {resetError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Falha no Reset</p>
                      <p className="text-[10px] mt-0.5">{resetError}</p>
                    </div>
                  </div>
                )}

                {showResetConfirm ? (
                  <div className="bg-red-50 border border-red-100 rounded p-3.5 space-y-3 text-[11px]">
                    <p className="font-bold text-red-800 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1 text-red-600 animate-pulse" />
                      CONFIRMAÇÃO CRÍTICA EXIGIDA:
                    </p>
                    <p className="text-red-700">
                      Você está prestes a <strong>APAGAR TODOS OS DADOS</strong> e redefinir o sistema. Seu usuário administrador atual e perfil de empresa serão preservados com as mesmas senhas por segurança, mas todo o restante será limpo.
                    </p>
                    <div>
                      <label className="block text-red-800 font-bold mb-1 text-[10px]">
                        Para confirmar, digite a palavra <span className="bg-red-100 px-1 py-0.2 rounded font-mono select-all text-red-950 uppercase border border-red-200">REDEFINIR</span> no campo abaixo:
                      </label>
                      <input
                        type="text"
                        value={confirmResetWord}
                        onChange={(e) => setConfirmResetWord(e.target.value)}
                        placeholder="Digite REDEFINIR aqui"
                        className="w-full max-w-xs px-2.5 py-1.5 border border-red-300 rounded text-xs bg-white text-red-900 font-bold placeholder-red-300 focus:outline-none focus:ring-1 focus:ring-red-500 uppercase"
                      />
                    </div>
                    <div className="flex space-x-2 pt-1">
                      <button
                        onClick={() => {
                          setShowResetConfirm(false);
                          setConfirmResetWord("");
                          setResetError("");
                        }}
                        className="px-3.5 py-1.5 bg-white border border-gray-300 text-gray-700 rounded font-semibold hover:bg-gray-50 transition text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleResetDatabase}
                        disabled={resetLoading || confirmResetWord.trim().toUpperCase() !== "REDEFINIR"}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition text-xs cursor-pointer flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {resetLoading && <Loader className="animate-spin h-3.5 w-3.5" />}
                        <span>Sim, Apagar e Redefinir Banco</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3 rounded border border-gray-150 gap-3">
                    <div className="text-[10px] text-gray-500 max-w-md">
                      <strong>Nota:</strong> Suas credenciais de login e dados de perfil corporativo são salvos temporariamente em memória durante o reset e restaurados automaticamente na nova tabela, evitando que você seja deslogado ou perca o acesso administrativo.
                    </div>
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Redefinir Base de Dados</span>
                    </button>
                  </div>
                )}
              </div>

              {/* DEMO & TESTING REUSABLE PROGRESS TRACKING PANELS */}
              <div className="bg-white border border-gray-150 rounded-lg p-5 space-y-4 shadow-xs">
                <div>
                  <h4 className="font-bold text-gray-800 text-xs flex items-center">
                    <RefreshCw className="h-4 w-4 mr-2 text-blue-600 animate-spin-slow" />
                    Simulador do Motor de Feedback Reutilizável (Polimento Visual)
                  </h4>
                  <p className="text-gray-400 text-[10px] mt-0.5 leading-relaxed">
                    Testes práticos de interface e polling em tempo real (intervalo de 800ms) sem necessidade de redefinir o banco físico. Conectado ao endpoint centralizado de monitoramento de tarefas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <button
                    onClick={() => handleStartSimulation("success")}
                    className="p-3 bg-blue-50/50 hover:bg-blue-50 border border-blue-150 hover:border-blue-300 text-blue-700 rounded-lg text-left transition cursor-pointer flex flex-col justify-between h-24"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Fluxo Nominal</div>
                    <div>
                      <span className="font-bold text-xs block text-blue-900">Backup Completo</span>
                      <span className="text-[9.5px] text-blue-600/80">4 etapas consecutivas com sucesso.</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleStartSimulation("fail")}
                    className="p-3 bg-red-50/50 hover:bg-red-50 border border-red-150 hover:border-red-300 text-red-700 rounded-lg text-left transition cursor-pointer flex flex-col justify-between h-24"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">Fluxo com Falha</div>
                    <div>
                      <span className="font-bold text-xs block text-red-900">Relatório de Vendas</span>
                      <span className="text-[9.5px] text-red-600/80">Etapa 2 falha com sugestão de recuperação.</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleStartSimulation("indeterminate")}
                    className="p-3 bg-amber-50/50 hover:bg-amber-50 border border-amber-150 hover:border-amber-300 text-amber-700 rounded-lg text-left transition cursor-pointer flex flex-col justify-between h-24"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 font-mono">Sem total conhecido</div>
                    <div>
                      <span className="font-bold text-xs block text-amber-900">Sincronização PWA</span>
                      <span className="text-[9.5px] text-amber-600/80">Barra indeterminada e mensagens fluídas.</span>
                    </div>
                  </button>
                </div>

                <div className="bg-gray-50 rounded border border-gray-150 p-3 text-[10px] text-gray-500 space-y-1">
                  <p className="font-bold text-gray-700">Guia rápido de integração para novas rotas de background:</p>
                  <p className="leading-relaxed">
                    1. No backend, use <code className="bg-gray-200 px-1 py-0.2 rounded font-mono">createOperation(type, title, totalSteps?, stepNames?)</code> para criar e iniciar sua tarefa.<br />
                    2. Retorne o <code className="bg-gray-200 px-1 py-0.2 rounded font-mono">operationId</code> imediatamente. Execute as etapas de forma assíncrona em segundo plano.<br />
                    3. No frontend, invoque <code className="bg-gray-200 px-1 py-0.2 rounded font-mono">useOperationProgress()</code> passando o ID e renderize o componente reutilizável <code className="bg-gray-200 px-1 py-0.2 rounded font-mono">&lt;ProgressModal /&gt;</code>.
                  </p>
                </div>
              )}

              {/* IMPORT TAB CONTENT */}
              {armazenamentoTab === "importacao" && (
                <div className="space-y-6">
                  <ImportAssistant onDatabaseUpdated={onDatabaseUpdated} loadSettingsData={loadSettingsData} />

                  {/* Export Box */}
                  <div className="bg-white border border-gray-200 rounded-md p-5 space-y-4 shadow-sm">
                    <div className="border-b border-gray-100 pb-2">
                      <h4 className="font-bold text-gray-800 text-xs flex items-center space-x-1.5">
                        <Download className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
                        <span>Exportador Geral de Configurações (Backup)</span>
                      </h4>
                      <p className="text-gray-400 text-[10px] mt-0.5">
                        Gere cópias de segurança offline das definições do sistema para reimportar em outros ambientes ou como ponto de restauração seguro.
                      </p>
                    </div>

                    <div className="border border-gray-200 rounded p-4 flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 bg-gray-50/30">
                      <div className="space-y-1 max-w-xl">
                        <h5 className="font-bold text-xs text-gray-900 flex items-center">
                          <Download className="h-4 w-4 text-indigo-600 mr-1.5" />
                          Exportar Dados Atuais
                        </h5>
                        <p className="text-gray-500 text-[10.5px] leading-relaxed">
                          Gera um arquivo de formato JSON contendo todas as tabelas de parametrização da oficina (Empresa, Checklist de Entrada, Garantias, Categorias, Métodos de Pagamento e Definições Gerais).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportSettings}
                        className="py-2.5 px-5 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="h-4 w-4" />
                        <span>Exportar Configurações (.JSON)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODALS RENDERING */}
              <ProgressModal
                isOpen={isResetModalOpen}
                progress={resetProgress}
                error={resetProgressError}
                onClose={() => {
                  setIsResetModalOpen(false);
                  resetResetProgress();
                }}
              />

              <ProgressModal
                isOpen={isSimulateModalOpen}
                progress={simProgress}
                error={simProgressError}
                onClose={() => {
                  setIsSimulateModalOpen(false);
                  resetSimProgress();
                }}
              />
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

          {/* SECTION: CATEGORIAS FINANCEIRAS */}
          {activeSection === "financeiro" && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="font-bold text-gray-900 text-sm flex items-center">
                  <ArrowLeftRight className="h-4 w-4 mr-2 text-indigo-600" />
                  Categorias Financeiras
                </h3>
                <p className="text-gray-400 text-[10px] mt-0.5">
                  Configure as categorias e tags utilizadas para classificar as entradas e saídas de dinheiro na sua oficina.
                </p>
              </div>

              {/* Informational Guidance */}
              <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-md text-[11px] text-indigo-900 leading-relaxed space-y-1">
                <p className="font-bold flex items-center">
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-indigo-700 shrink-0" />
                  Como funcionam as Categorias Financeiras?
                </p>
                <p className="text-indigo-800">
                  Estas categorias são utilizadas no menu <strong>Financeiro</strong> para organizar o fluxo de caixa. Elas permitem classificar cada movimentação (como custos de peças, salários, ou receitas de serviços) para que você tenha relatórios precisos de lucratividade e faturamento por categoria.
                </p>
              </div>

              {/* Formulário de Adicionar Categoria */}
              <form onSubmit={handleAddFinCategory} className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-4">
                <h4 className="font-bold text-gray-800 text-xs">Nova Categoria</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Nome da Categoria</label>
                    <input
                      type="text"
                      value={newFinCatName}
                      onChange={(e) => setNewFinCatName(e.target.value)}
                      placeholder="Ex: Aluguel, Compra de Telas, etc."
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Tipo de Movimentação</label>
                    <select
                      value={newFinCatType}
                      onChange={(e) => setNewFinCatType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    >
                      <option value="entrada" className="text-green-600 font-semibold">Entrada (Receita)</option>
                      <option value="saida" className="text-red-600 font-semibold">Saída (Despesa / Custo)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={!newFinCatName.trim()}
                      className="w-full px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-bold transition text-xs flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Cadastrar Categoria</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Listagem de Categorias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Entradas */}
                <div className="space-y-3">
                  <h4 className="font-bold text-green-700 text-xs flex items-center border-b border-green-100 pb-1.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Categorias de Entrada (Receitas)
                  </h4>
                  <div className="border border-gray-150 rounded-md divide-y divide-gray-150 bg-white shadow-sm overflow-hidden text-xs">
                    {finCategories.filter(c => c.type === "entrada").length === 0 ? (
                      <p className="p-4 text-center text-gray-400 text-[11px]">Nenhuma categoria cadastrada.</p>
                    ) : (
                      finCategories.filter(c => c.type === "entrada").map(cat => (
                        <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition">
                          {editingFinCategory?.id === cat.id ? (
                            <div className="flex items-center space-x-2 w-full">
                              <input
                                type="text"
                                value={editingFinCategory.name}
                                onChange={(e) => setEditingFinCategory({ ...editingFinCategory, name: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900 w-full"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateFinCategory(cat, { name: editingFinCategory.name })}
                                className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold hover:bg-green-700"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingFinCategory(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300"
                              >
                                Sair
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center space-x-2">
                                <span className={`font-semibold ${cat.active ? "text-gray-800" : "text-gray-400 line-through"}`}>
                                  {cat.name}
                                </span>
                                {!cat.active && (
                                  <span className="bg-gray-100 text-gray-400 text-[9px] px-1.5 py-0.2 rounded font-bold border border-gray-250">
                                    Inativa
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingFinCategory({ id: cat.id, name: cat.name })}
                                  className="text-gray-500 hover:text-indigo-600 transition"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateFinCategory(cat, { active: !cat.active })}
                                  className={`text-[10px] font-bold px-2 py-1 rounded border transition ${
                                    cat.active 
                                      ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200" 
                                      : "bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                                  }`}
                                >
                                  {cat.active ? "Desativar" : "Ativar"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Saídas */}
                <div className="space-y-3">
                  <h4 className="font-bold text-red-700 text-xs flex items-center border-b border-red-100 pb-1.5">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    Categorias de Saída (Despesas)
                  </h4>
                  <div className="border border-gray-150 rounded-md divide-y divide-gray-150 bg-white shadow-sm overflow-hidden text-xs">
                    {finCategories.filter(c => c.type === "saida").length === 0 ? (
                      <p className="p-4 text-center text-gray-400 text-[11px]">Nenhuma categoria cadastrada.</p>
                    ) : (
                      finCategories.filter(c => c.type === "saida").map(cat => (
                        <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition">
                          {editingFinCategory?.id === cat.id ? (
                            <div className="flex items-center space-x-2 w-full">
                              <input
                                type="text"
                                value={editingFinCategory.name}
                                onChange={(e) => setEditingFinCategory({ ...editingFinCategory, name: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900 w-full"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateFinCategory(cat, { name: editingFinCategory.name })}
                                className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold hover:bg-green-700"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingFinCategory(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300"
                              >
                                Sair
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center space-x-2">
                                <span className={`font-semibold ${cat.active ? "text-gray-800" : "text-gray-400 line-through"}`}>
                                  {cat.name}
                                </span>
                                {!cat.active && (
                                  <span className="bg-gray-100 text-gray-400 text-[9px] px-1.5 py-0.2 rounded font-bold border border-gray-250">
                                    Inativa
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingFinCategory({ id: cat.id, name: cat.name })}
                                  className="text-gray-500 hover:text-indigo-600 transition"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateFinCategory(cat, { active: !cat.active })}
                                  className={`text-[10px] font-bold px-2 py-1 rounded border transition ${
                                    cat.active 
                                      ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200" 
                                      : "bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                                  }`}
                                >
                                  {cat.active ? "Desativar" : "Ativar"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
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
