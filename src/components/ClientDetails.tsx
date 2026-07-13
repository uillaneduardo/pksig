import React, { useState, useEffect } from "react";
import { Client, Equipment, ServiceOrder, PaymentGuide, Warranty, EquipmentCategory, PaymentMethod, WarrantyRule } from "../types";
import { 
  ArrowLeft, Save, Eye, Check, PenTool, Plus, Laptop, FileText, 
  DollarSign, ShieldCheck, Trash2, Calendar, Phone, Mail, MapPin, 
  HelpCircle, ChevronRight, AlertCircle, RefreshCw 
} from "lucide-react";

interface ClientDetailsProps {
  clientId: number;
  onBack: () => void;
  onOpenOS: (osId: number) => void;
  currency: string;
}

export default function ClientDetails({ clientId, onBack, onOpenOS, currency }: ClientDetailsProps) {
  const [activeTab, setActiveTab] = useState<"dados" | "equipamentos" | "os" | "garantias" | "financeiro">("dados");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Data loaded from backend
  const [client, setClient] = useState<Client | null>(null);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [guides, setGuides] = useState<PaymentGuide[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);

  // Master lists from settings
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [warrantyRules, setWarrantyRules] = useState<WarrantyRule[]>([]);

  // Modals / Modifiers
  const [showAddEquip, setShowAddEquip] = useState(false);
  const [showAddOS, setShowAddOS] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<any | null>(null); // For payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // New Equipment Form state
  const [eqCategory, setEqCategory] = useState("");
  const [eqBrand, setEqBrand] = useState("");
  const [eqModel, setEqModel] = useState("");
  const [eqSerial, setEqSerial] = useState("");
  const [eqImei, setEqImei] = useState("");
  const [eqAsset, setEqAsset] = useState("");
  const [eqResponsible, setEqResponsible] = useState("");
  const [eqColor, setEqColor] = useState("");
  const [eqNotes, setEqNotes] = useState("");

  // New OS Form state
  const [osEquipId, setOsEquipId] = useState("");
  const [osTechnician, setOsTechnician] = useState("Suporte TI (Administrador)");
  const [osProblem, setOsProblem] = useState("");
  const [osEquipState, setOsEquipState] = useState("");
  const [osNotes, setOsNotes] = useState("");
  const [osAccessories, setOsAccessories] = useState<string[]>([]);
  const [accessoriesMaster, setAccessoriesMaster] = useState<any[]>([]);

  // Payment Form state
  const [payAmount, setPayAmount] = useState("");
  const [payMethodId, setPayMethodId] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Load Client details
  const loadClientDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setEquipments(data.equipments);
        setOrders(data.orders);
        setGuides(data.guides);
        setWarranties(data.warranties);
      } else {
        setErrorMsg("Falha ao carregar os dados do cliente.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação.");
    } finally {
      setLoading(false);
    }
  };

  // Load master lists for dropdowns
  const loadMasterData = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories.filter((c: any) => c.active));
        setPaymentMethods(data.paymentMethods.filter((p: any) => p.active));
        setWarrantyRules(data.warrantyRules.filter((w: any) => w.active));
        setAccessoriesMaster(data.accessories.filter((a: any) => a.active));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadClientDetails();
    loadMasterData();
  }, [clientId]);

  // Client update logic
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client)
      });
      if (res.ok) {
        setSuccessMsg("Dados salvos com sucesso.");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg("Erro ao salvar os dados.");
      }
    } catch (err) {
      setErrorMsg("Falha de conexão com o servidor.");
    }
  };

  // Add Equipment logic
  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqCategory || !eqBrand || !eqModel) {
      alert("Por favor, selecione a categoria, marca e modelo.");
      return;
    }

    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          category_id: parseInt(eqCategory),
          brand: eqBrand,
          model: eqModel,
          serial_number: eqSerial,
          imei: eqImei,
          asset_tag: eqAsset,
          responsible: eqResponsible,
          color: eqColor,
          notes: eqNotes,
          status: "Disponível"
        })
      });
      if (res.ok) {
        setShowAddEquip(false);
        setEqBrand(""); setEqModel(""); setEqSerial(""); setEqImei(""); setEqAsset(""); setEqResponsible(""); setEqColor(""); setEqNotes("");
        loadClientDetails();
      }
    } catch (err) {
      alert("Erro ao adicionar equipamento");
    }
  };

  // Add OS logic
  const handleAddOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!osEquipId || !osProblem) {
      alert("Selecione um equipamento e descreva o problema informado.");
      return;
    }

    try {
      const res = await fetch("/api/service-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          equipment_id: parseInt(osEquipId),
          technician_name: osTechnician,
          problem_reported: osProblem,
          reception_equipment_state: osEquipState,
          reception_notes: osNotes,
          accessories: osAccessories
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShowAddOS(false);
        setOsEquipId(""); setOsProblem(""); setOsEquipState(""); setOsNotes(""); setOsAccessories([]);
        onOpenOS(data.osId);
      }
    } catch (err) {
      alert("Erro ao abrir ordem de serviço.");
    }
  };

  // Open financial guide details
  const handleOpenGuideDetails = async (guideId: number) => {
    try {
      const res = await fetch(`/api/payment-guides/${guideId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedGuide(data);
        setPayAmount(data.guide.balance_amount.toString());
        if (paymentMethods.length > 0) {
          setPayMethodId(paymentMethods[0].id.toString());
        }
        setShowPaymentModal(true);
      }
    } catch (err) {
      alert("Erro ao carregar detalhes do faturamento.");
    }
  };

  // Record payment
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || !payMethodId || !selectedGuide) return;

    try {
      const res = await fetch(`/api/payment-guides/${selectedGuide.guide.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          method_id: parseInt(payMethodId),
          notes: payNotes
        })
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPayNotes("");
        loadClientDetails();
      } else {
        const d = await res.json();
        alert(d.error || "Erro ao registrar o pagamento.");
      }
    } catch (err) {
      alert("Erro ao conectar ao servidor.");
    }
  };

  // Helper mask for client fields
  const formatPhone = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
      if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      } else {
        v = v.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
      }
    }
    return v;
  };

  const handleOpenNewOSWithEquip = (equipId: number) => {
    setOsEquipId(equipId.toString());
    setShowAddOS(true);
    setActiveTab("os");
  };

  if (loading) {
    return (
      <div className="bg-white p-16 border border-gray-200 rounded-md flex justify-center items-center shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="bg-white p-8 border border-gray-200 rounded-md text-center text-gray-500 shadow-sm">
        Cliente não encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Upper header */}
      <div className="bg-white p-6 border border-gray-200 rounded-md shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition text-gray-500 cursor-pointer"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">{client.name}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${client.type === "PF" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                {client.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
              </span>
            </div>
            <p className="text-gray-400 text-xs font-mono mt-0.5">{client.code} • Status: <span className="font-bold text-green-600">{client.status.toUpperCase()}</span></p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === "dados" && (
            <button
              onClick={handleUpdateClient}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0e131f] hover:bg-[#1f2937] text-white rounded-md text-xs font-bold transition cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Salvar Alterações</span>
            </button>
          )}

          {activeTab === "equipamentos" && (
            <button
              onClick={() => setShowAddEquip(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Equipamento</span>
            </button>
          )}

          {activeTab === "os" && (
            <button
              onClick={() => setShowAddOS(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nova Ordem de Serviço</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-xs flex items-center space-x-2 animate-pulse">
          <Check className="h-4 w-4 text-green-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* HORIZONTAL SYSTEM TABS - MOBILE HAS SIDE SCROLL */}
      <div className="border-b border-gray-200 bg-white px-4 rounded-md border shadow-sm">
        <nav className="-mb-px flex space-x-8 overflow-x-auto whitespace-nowrap">
          {[
            { id: "dados", label: "Dados Cadastrais" },
            { id: "equipamentos", label: `Equipamentos (${equipments.length})` },
            { id: "os", label: `Ordens de Serviço (${orders.length})` },
            { id: "financeiro", label: `Financeiro (${guides.length})` },
            { id: "garantias", label: `Garantias (${warranties.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-semibold text-xs tracking-tight transition cursor-pointer ${activeTab === tab.id ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: DADOS CADASTRAIS */}
      {activeTab === "dados" && (
        <form onSubmit={handleUpdateClient} className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-6 text-xs text-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Col: Personal info */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-950 border-b border-gray-100 pb-1.5 uppercase tracking-wider text-[10px]">Informações do Perfil</h3>
              
              <div>
                <label className="block text-gray-600 mb-1 font-semibold">{client.type === "PF" ? "Nome Completo" : "Razão Social"} *</label>
                <input
                  type="text"
                  required
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none font-medium"
                />
              </div>

              {client.type === "PJ" && (
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Nome Fantasia</label>
                  <input
                    type="text"
                    value={client.responsible || ""}
                    onChange={(e) => setClient({ ...client, responsible: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">{client.type === "PF" ? "CPF" : "CNPJ"} *</label>
                  <input
                    type="text"
                    required
                    value={client.cpf_cnpj}
                    onChange={(e) => setClient({ ...client, cpf_cnpj: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">{client.type === "PF" ? "RG" : "Inscrição Estadual"}</label>
                  <input
                    type="text"
                    value={client.rg_ie || ""}
                    onChange={(e) => setClient({ ...client, rg_ie: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {client.type === "PF" && (
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Data de Nascimento</label>
                    <input
                      type="date"
                      value={client.birth_date ? client.birth_date.slice(0, 10) : ""}
                      onChange={(e) => setClient({ ...client, birth_date: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">E-mail</label>
                  <input
                    type="email"
                    value={client.email || ""}
                    onChange={(e) => setClient({ ...client, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Telefone Principal</label>
                  <input
                    type="text"
                    value={client.phone || ""}
                    onChange={(e) => setClient({ ...client, phone: formatPhone(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">WhatsApp</label>
                  <input
                    type="text"
                    value={client.whatsapp || ""}
                    onChange={(e) => setClient({ ...client, whatsapp: formatPhone(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Right Col: Address info */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-950 border-b border-gray-100 pb-1.5 uppercase tracking-wider text-[10px]">Endereço de Correspondência</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">CEP</label>
                  <input
                    type="text"
                    value={client.zip_code || ""}
                    onChange={(e) => setClient({ ...client, zip_code: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-gray-600 mb-1 font-semibold">Rua / Logradouro</label>
                  <input
                    type="text"
                    value={client.street || ""}
                    onChange={(e) => setClient({ ...client, street: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Número</label>
                  <input
                    type="text"
                    value={client.number || ""}
                    onChange={(e) => setClient({ ...client, number: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-gray-600 mb-1 font-semibold">Complemento</label>
                  <input
                    type="text"
                    value={client.complement || ""}
                    onChange={(e) => setClient({ ...client, complement: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Bairro</label>
                  <input
                    type="text"
                    value={client.neighborhood || ""}
                    onChange={(e) => setClient({ ...client, neighborhood: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Cidade</label>
                  <input
                    type="text"
                    value={client.city || ""}
                    onChange={(e) => setClient({ ...client, city: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Estado (UF)</label>
                  <input
                    type="text"
                    value={client.state || ""}
                    onChange={(e) => setClient({ ...client, state: e.target.value })}
                    maxLength={2}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none uppercase font-bold text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Observações Internas</label>
                <textarea
                  value={client.notes || ""}
                  onChange={(e) => setClient({ ...client, notes: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-16"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: EQUIPAMENTOS */}
      {activeTab === "equipamentos" && (
        <div className="space-y-4">
          {equipments.length === 0 ? (
            <div className="bg-white p-12 text-center text-gray-500 border border-gray-200 rounded-md shadow-sm space-y-2">
              <Laptop className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-sm font-medium">Nenhum equipamento cadastrado para este cliente.</p>
              <button
                onClick={() => setShowAddEquip(true)}
                className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
              >
                + Cadastrar Primeiro Equipamento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipments.map((equip) => (
                <div key={equip.id} className="bg-white p-5 border border-gray-200 rounded-md shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-mono font-bold">{equip.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        equip.status === "Disponível" ? "bg-green-50 text-green-700" :
                        equip.status === "Em manutenção" ? "bg-amber-50 text-amber-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{equip.status}</span>
                    </div>

                    <h4 className="font-bold text-gray-900 text-sm mt-1">{equip.brand} - {equip.model}</h4>
                    <p className="text-gray-500 text-xs font-medium">Categoria: {equip.category_name}</p>

                    <div className="pt-2 text-[11px] text-gray-600 space-y-1 font-mono">
                      {equip.serial_number && <div>N/S: <span className="font-bold">{equip.serial_number}</span></div>}
                      {equip.asset_tag && <div>Patrimônio: <span className="font-bold">{equip.asset_tag}</span></div>}
                      {equip.imei && <div>IMEI: <span className="font-bold">{equip.imei}</span></div>}
                      {equip.color && <div>Cor: <span>{equip.color}</span></div>}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <button
                      onClick={() => handleOpenNewOSWithEquip(equip.id)}
                      className="text-xs text-indigo-600 font-bold hover:underline flex items-center space-x-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Abrir Ordem de Serviço</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ORDENS DE SERVIÇO */}
      {activeTab === "os" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-16 text-center text-gray-500 space-y-2">
              <FileText className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-sm font-medium">Nenhuma Ordem de Serviço cadastrada.</p>
              <button
                onClick={() => setShowAddOS(true)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                + Abrir Primeira Ordem de Serviço
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Código / Entrada</th>
                    <th className="py-3 px-4">Equipamento</th>
                    <th className="py-3 px-4">Defeito Informado</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Previsão</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((ord) => (
                    <tr 
                      key={ord.id}
                      onClick={() => onOpenOS(ord.id)}
                      className="hover:bg-gray-50/50 transition cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-gray-900">{ord.code}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(ord.entry_date).toLocaleDateString("pt-BR")}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{ord.brand} - {ord.model}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">S/N: {ord.serial_number || "Sem serial"}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                        {ord.problem_reported}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ord.status_name === "Recebida" ? "bg-gray-100 text-gray-700" :
                          ord.status_name === "Em análise" ? "bg-blue-50 text-blue-700" :
                          ord.status_name === "Em manutenção" ? "bg-amber-50 text-amber-700" :
                          ord.status_name === "Pronta" ? "bg-green-50 text-green-700" :
                          ord.status_name === "Entregue" ? "bg-emerald-100 text-emerald-800" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {ord.status_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono">
                        {ord.promise_date ? new Date(ord.promise_date).toLocaleDateString("pt-BR") : "Não definida"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                        {ord.total_value ? `${currency} ${parseFloat(ord.total_value as any).toFixed(2)}` : `${currency} 0.00`}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onOpenOS(ord.id)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-bold transition"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FINANCEIRO */}
      {activeTab === "financeiro" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          {guides.length === 0 ? (
            <div className="p-16 text-center text-gray-500 space-y-2">
              <DollarSign className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-sm font-medium">Nenhum faturamento registrado.</p>
              <p className="text-xs">As guias de cobrança são geradas diretamente a partir do orçamento das ordens de serviço.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Código Guia</th>
                    <th className="py-3 px-4">OS de Origem</th>
                    <th className="py-3 px-4">Emissão / Vencimento</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Pago</th>
                    <th className="py-3 px-4 text-right">Saldo Devedor</th>
                    <th className="py-3 px-4 text-center">Situação</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {guides.map((g) => (
                    <tr 
                      key={g.id}
                      onClick={() => handleOpenGuideDetails(g.id)}
                      className="hover:bg-gray-50/50 transition cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{g.code}</td>
                      <td className="py-3 px-4 font-mono text-gray-600">{g.os_code}</td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        <div>{new Date(g.issue_date).toLocaleDateString("pt-BR")}</div>
                        {g.due_date && <div className="text-[10px] text-red-500 font-bold">Venc: {new Date(g.due_date).toLocaleDateString("pt-BR")}</div>}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{currency} {parseFloat(g.total_amount as any).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-semibold">{currency} {parseFloat(g.paid_amount as any).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold">{currency} {parseFloat(g.balance_amount as any).toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.status === "Quitada" ? "bg-green-50 text-green-700" :
                          g.status === "Parcial" ? "bg-amber-50 text-amber-700" :
                          g.status === "Vencida" ? "bg-red-50 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenGuideDetails(g.id)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-bold transition"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: GARANTIAS */}
      {activeTab === "garantias" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          {warranties.length === 0 ? (
            <div className="p-16 text-center text-gray-500 space-y-2">
              <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-sm font-medium">Nenhum termo de garantia emitido.</p>
              <p className="text-xs">Os certificados de garantia são emitidos no fechamento da ordem de serviço após a quitação financeira.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Código Certificado</th>
                    <th className="py-3 px-4">OS de Origem</th>
                    <th className="py-3 px-4">Equipamento</th>
                    <th className="py-3 px-4">Período de Vigência</th>
                    <th className="py-3 px-4 text-center">Situação</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {warranties.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{w.code}</td>
                      <td className="py-3 px-4 font-mono text-gray-600">{w.os_code}</td>
                      <td className="py-3 px-4 text-gray-700 font-semibold">{w.brand} - {w.model}</td>
                      <td className="py-3 px-4 text-gray-600 font-mono">
                        {new Date(w.start_date).toLocaleDateString("pt-BR")} até {new Date(w.end_date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          w.status === "Vigente" ? "bg-green-50 text-green-700 animate-pulse" : "bg-red-50 text-red-700"
                        }`}>{w.status}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => alert(`Consultando termo de garantia ${w.code}... (Modelo PDF em desenvolvimento para próxima versão)`)}
                            className="px-2 py-1 border border-gray-300 rounded text-[10px] font-bold text-gray-600 hover:bg-gray-50"
                          >
                            Consultar Termo
                          </button>
                          <button
                            onClick={() => alert(`Baixando PDF ${w.pdf_reference}... (Módulo de impressão será integrado na próxima etapa)`)}
                            className="px-2 py-1 bg-[#0e131f] text-white rounded text-[10px] font-bold hover:bg-[#1a2336]"
                          >
                            Baixar Termo
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CADASTRO DE EQUIPAMENTO */}
      {showAddEquip && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="w-full max-w-lg bg-white border border-gray-200 shadow-2xl rounded-lg overflow-hidden animate-zoom-in text-xs">
            <div className="bg-[#0e131f] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Cadastrar Novo Equipamento</h3>
              <button onClick={() => setShowAddEquip(false)} className="text-gray-400 hover:text-white font-bold cursor-pointer">[X]</button>
            </div>

            <form onSubmit={handleAddEquipment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Categoria *</label>
                  <select
                    required
                    value={eqCategory}
                    onChange={(e) => setEqCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Marca *</label>
                  <input
                    type="text"
                    required
                    value={eqBrand}
                    onChange={(e) => setEqBrand(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                    placeholder="Ex: Dell, Apple, Samsung"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Modelo *</label>
                  <input
                    type="text"
                    required
                    value={eqModel}
                    onChange={(e) => setEqModel(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                    placeholder="Ex: Vostro 14-3468, iPhone 13"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Número de Série (S/N)</label>
                  <input
                    type="text"
                    value={eqSerial}
                    onChange={(e) => setEqSerial(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Patrimônio</label>
                  <input
                    type="text"
                    value={eqAsset}
                    onChange={(e) => setEqAsset(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Cor</label>
                  <input
                    type="text"
                    value={eqColor}
                    onChange={(e) => setEqColor(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">IMEI (Celulares)</label>
                  <input
                    type="text"
                    value={eqImei}
                    onChange={(e) => setEqImei(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Responsável / Usuário</label>
                <input
                  type="text"
                  value={eqResponsible}
                  onChange={(e) => setEqResponsible(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                  placeholder="Se diferente do cliente cadastrado"
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Observações Físicas do Equipamento</label>
                <textarea
                  value={eqNotes}
                  onChange={(e) => setEqNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none h-14"
                  placeholder="Ex: Riscado na tampa traseira, teclado com desgastes..."
                />
              </div>

              <div className="flex space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddEquip(false)}
                  className="w-1/3 py-2 border border-gray-300 text-gray-700 rounded-md font-bold hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2 bg-[#0e131f] text-white rounded-md font-bold hover:bg-[#1a2336] transition cursor-pointer"
                >
                  Cadastrar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ABERTURA DE ORDEM DE SERVIÇO */}
      {showAddOS && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="w-full max-w-xl bg-white border border-gray-200 shadow-2xl rounded-lg overflow-hidden animate-zoom-in text-xs">
            <div className="bg-[#0e131f] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Abertura de Ordem de Serviço</h3>
              <button onClick={() => setShowAddOS(false)} className="text-gray-400 hover:text-white font-bold cursor-pointer">[X]</button>
            </div>

            <form onSubmit={handleAddOS} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Equipamento Vinculado *</label>
                  <select
                    required
                    value={osEquipId}
                    onChange={(e) => setOsEquipId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white focus:outline-none font-bold"
                  >
                    <option value="">Selecione...</option>
                    {equipments.map((eq) => <option key={eq.id} value={eq.id}>{eq.brand} {eq.model} ({eq.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Técnico Responsável</label>
                  <input
                    type="text"
                    required
                    value={osTechnician}
                    onChange={(e) => setOsTechnician(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Defeito Relatado pelo Cliente *</label>
                <textarea
                  required
                  value={osProblem}
                  onChange={(e) => setOsProblem(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none h-16 font-semibold"
                  placeholder="Descreva minuciosamente o que o cliente diz que o aparelho apresenta..."
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Acessórios Entregues no Recebimento</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-50 p-3 border border-gray-200 rounded-md max-h-24 overflow-y-auto">
                  {accessoriesMaster.map((acc) => (
                    <label key={acc.id} className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={osAccessories.includes(acc.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setOsAccessories([...osAccessories, acc.name]);
                          } else {
                            setOsAccessories(osAccessories.filter((name) => name !== acc.name));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                      <span>{acc.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Estado Físico do Equipamento</label>
                  <input
                    type="text"
                    value={osEquipState}
                    onChange={(e) => setOsEquipState(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                    placeholder="Ex: Teclado com poeira, tela arranhada"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Observações Adicionais</label>
                  <input
                    type="text"
                    value={osNotes}
                    onChange={(e) => setOsNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none"
                    placeholder="Observações complementares"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddOS(false)}
                  className="w-1/3 py-2 border border-gray-300 text-gray-700 rounded-md font-bold hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-bold transition cursor-pointer"
                >
                  Abrir Ordem de Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DE GUIA E REGISTRO DE PAGAMENTO */}
      {showPaymentModal && selectedGuide && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-center items-center z-50 p-4">
          <div className="w-full max-w-xl bg-white border border-gray-200 shadow-2xl rounded-lg overflow-hidden animate-zoom-in text-xs">
            
            <div className="bg-[#0e131f] p-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold">Guia de Faturamento: {selectedGuide.guide.code}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Controle de parcelas e liquidação financeira.</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white font-bold cursor-pointer">[X]</button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              
              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 border border-gray-200 rounded-md text-center">
                <div>
                  <div className="text-gray-400 text-[10px] uppercase font-bold">Total da Guia</div>
                  <div className="text-sm font-bold text-gray-900">{currency} {parseFloat(selectedGuide.guide.total_amount as any).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-[10px] uppercase font-bold text-green-700">Total Pago</div>
                  <div className="text-sm font-bold text-green-600">{currency} {parseFloat(selectedGuide.guide.paid_amount as any).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-[10px] uppercase font-bold text-red-700">Saldo Restante</div>
                  <div className="text-sm font-bold text-red-600">{currency} {parseFloat(selectedGuide.guide.balance_amount as any).toFixed(2)}</div>
                </div>
              </div>

              {/* Installments List */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-1 uppercase tracking-wider text-[10px]">Parcelas Previstas</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedGuide.installments.map((inst: any) => (
                    <div key={inst.id} className="flex justify-between items-center p-2 border border-gray-100 rounded bg-gray-50/50 font-mono text-[11px]">
                      <div>
                        <span className="font-bold text-gray-800">Parcela #{inst.installment_number}</span> • Venc: {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-gray-700">{currency} {parseFloat(inst.amount as any).toFixed(2)}</span>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          inst.status === "Pago" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}>{inst.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Register Payment Form (Only if balance > 0) */}
              {selectedGuide.guide.balance_amount > 0 ? (
                <form onSubmit={handleRegisterPayment} className="space-y-3 bg-indigo-50/30 p-4 border border-indigo-100 rounded-md">
                  <h4 className="font-bold text-indigo-950 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                    <DollarSign className="h-4 w-4 text-indigo-600" />
                    <span>Registrar Novo Pagamento</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Valor do Recebimento *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        max={selectedGuide.guide.balance_amount}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none bg-white text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Forma Utilizada *</label>
                      <select
                        required
                        value={payMethodId}
                        onChange={(e) => setPayMethodId(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white focus:outline-none text-xs"
                      >
                        {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Observações de Recebimento</label>
                    <input
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none bg-white text-xs"
                      placeholder="Ex: Recebido em mãos, transferência bancária..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-xs transition cursor-pointer"
                  >
                    Confirmar e Liquidar Valor
                  </button>
                </form>
              ) : (
                <div className="bg-green-50 p-3 border border-green-200 text-green-800 text-xs text-center font-bold rounded">
                  Esta guia está inteiramente quitada. Não há saldos pendentes!
                </div>
              )}

              {/* Payments History List */}
              {selectedGuide.payments.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-1 uppercase tracking-wider text-[10px]">Histórico de Pagamentos</h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[10px]">
                    {selectedGuide.payments.map((p: any) => (
                      <div key={p.id} className="p-2 border border-gray-100 bg-white rounded flex justify-between">
                        <div>
                          <span className="text-gray-400">{new Date(p.payment_date).toLocaleDateString("pt-BR")}</span> • <span>{p.method_name}</span>
                          {p.notes && <div className="text-[9px] text-gray-400 font-sans mt-0.5">Obs: {p.notes}</div>}
                        </div>
                        <span className="font-bold text-green-600">+{currency} {parseFloat(p.amount as any).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-600 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
