import React, { useState, useEffect } from "react";
import { ServiceOrder, BudgetItem, PaymentGuide, PaymentMethod, WarrantyRule, Warranty } from "../types";
import { 
  ArrowLeft, Save, FileText, Check, Plus, Trash2, DollarSign, 
  ShieldCheck, Upload, Download, Loader, CheckCircle, AlertCircle 
} from "lucide-react";

interface ServiceOrderDetailsProps {
  osId: number;
  onBack: () => void;
  currency: string;
}

export default function ServiceOrderDetails({ osId, onBack, currency }: ServiceOrderDetailsProps) {
  const [activeTab, setActiveTab] = useState<"recepcao" | "analise" | "orcamento" | "cobrancas" | "garantia" | "anexos">("recepcao");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Data loaded from backend
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [accessories, setAccessories] = useState<string[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [guide, setGuide] = useState<PaymentGuide | null>(null);
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);

  // Master lists from settings
  const [statuses, setStatuses] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [warrantyRules, setWarrantyRules] = useState<WarrantyRule[]>([]);
  const [accessoriesMaster, setAccessoriesMaster] = useState<any[]>([]);

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"Serviço" | "Peça" | "Mão de obra">("Serviço");
  const [newQty, setNewQty] = useState("1");
  const [newVal, setNewVal] = useState("0");

  // Payment Guide Generation Form State
  const [expectedMethod, setExpectedMethod] = useState("");
  const [installments, setInstallments] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [guideNotes, setGuideNotes] = useState("");

  // Warranty Issuance Form State
  const [warrantyRuleId, setWarrantyRuleId] = useState("");
  const [warrantyStartDate, setWarrantyStartDate] = useState("");

  // Attachment states
  const [isUploading, setIsUploading] = useState(false);

  // Payment States
  const [guideInstallments, setGuideInstallments] = useState<any[]>([]);
  const [guidePayments, setGuidePayments] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethodId, setPayMethodId] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);

  useEffect(() => {
    if (paymentMethods.length > 0 && !payMethodId) {
      setPayMethodId(paymentMethods[0].id.toString());
    }
  }, [paymentMethods, payMethodId]);

  const loadGuideDetails = async (guideId: number) => {
    try {
      const res = await fetch(`/api/payment-guides/${guideId}`);
      if (res.ok) {
        const data = await res.json();
        setGuide(data.guide);
        setGuideInstallments(data.installments || []);
        setGuidePayments(data.payments || []);
        setPayAmount(data.guide.balance_amount.toString());
      }
    } catch (err) {
      console.error("Error loading guide details:", err);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || !payMethodId || !guide) return;

    setIsRegisteringPayment(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/payment-guides/${guide.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          method_id: parseInt(payMethodId),
          notes: payNotes
        })
      });
      if (res.ok) {
        setPayNotes("");
        setSuccessMsg("Pagamento registrado com sucesso!");
        setTimeout(() => setSuccessMsg(""), 3000);
        await loadGuideDetails(guide.id);
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Erro ao registrar o pagamento.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação ao registrar pagamento.");
    } finally {
      setIsRegisteringPayment(false);
    }
  };

  const loadOSDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-orders/${osId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setAccessories(data.accessories || []);
        setBudgetItems(data.budgetItems || []);
        setGuide(data.guide);
        setWarranty(data.warranty);
        setAttachments(data.attachments || []);

        if (data.guide) {
          try {
            const guideRes = await fetch(`/api/payment-guides/${data.guide.id}`);
            if (guideRes.ok) {
              const guideData = await guideRes.json();
              setGuideInstallments(guideData.installments || []);
              setGuidePayments(guideData.payments || []);
              setPayAmount(guideData.guide.balance_amount.toString());
            }
          } catch (gErr) {
            console.error("Error loading guide details:", gErr);
          }
        } else {
          setGuideInstallments([]);
          setGuidePayments([]);
        }
      } else {
        setErrorMsg("Falha ao carregar ordem de serviço.");
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação.");
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses && data.statuses.length > 0 ? data.statuses : [
          { id: 1, name: "Recebida" },
          { id: 2, name: "Em análise" },
          { id: 3, name: "Aguardando aprovação" },
          { id: 4, name: "Aguardando peça" },
          { id: 5, name: "Em manutenção" },
          { id: 6, name: "Pronta" },
          { id: 7, name: "Entregue" },
          { id: 8, name: "Cancelada" }
        ]);
        setPaymentMethods(data.paymentMethods.filter((p: any) => p.active));
        setWarrantyRules(data.warrantyRules.filter((w: any) => w.active));
        setAccessoriesMaster(data.accessories.filter((a: any) => a.active));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadOSDetails();
    loadMasterData();
    // Default warranty date to today
    setWarrantyStartDate(new Date().toISOString().slice(0, 10));
  }, [osId]);

  // Handle saving of active OS modifications
  const handleSaveOS = async () => {
    if (!order) return;
    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/service-orders/${osId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order)
      });
      if (res.ok) {
        setSuccessMsg("Ordem de Serviço salva com sucesso.");
        setTimeout(() => setSuccessMsg(""), 3000);
        loadOSDetails();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrorMsg(errorData.error || "Erro ao salvar ordem de serviço.");
      }
    } catch (err) {
      setErrorMsg("Falha ao conectar com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  // Add Budget Item
  const handleAddBudgetItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc || parseFloat(newQty) <= 0 || parseFloat(newVal) < 0) {
      alert("Preencha todos os campos do item.");
      return;
    }

    try {
      const res = await fetch(`/api/service-orders/${osId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newDesc,
          type: newType,
          quantity: parseFloat(newQty),
          unit_value: parseFloat(newVal)
        })
      });
      if (res.ok) {
        setNewDesc("");
        setNewQty("1");
        setNewVal("0");
        loadOSDetails();
      } else {
        const d = await res.json();
        alert(d.error || "Erro ao adicionar item.");
      }
    } catch (err) {
      alert("Erro ao conectar.");
    }
  };

  // Remove Budget Item
  const handleRemoveBudgetItem = async (itemId: number) => {
    if (!window.confirm("Deseja realmente remover este item do orçamento?")) return;

    try {
      const res = await fetch(`/api/service-orders/${osId}/budget/${itemId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        loadOSDetails();
      } else {
        const d = await res.json();
        alert(d.error || "Erro ao remover item.");
      }
    } catch (err) {
      alert("Falha de conexão.");
    }
  };

  // Calculate Subtotals
  const subtotal = budgetItems.reduce((acc, item) => acc + parseFloat(item.total_value as any), 0);

  // Generate Payment Guide
  const handleGenerateGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subtotal <= 0) {
      alert("O orçamento deve ser superior a zero para faturar.");
      return;
    }

    try {
      const res = await fetch(`/api/service-orders/${osId}/guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_method_id: expectedMethod ? parseInt(expectedMethod) : null,
          installments_count: parseInt(installments) || 1,
          due_date: dueDate || null,
          notes: guideNotes
        })
      });
      if (res.ok) {
        setExpectedMethod(""); setInstallments("1"); setDueDate(""); setGuideNotes("");
        loadOSDetails();
        setActiveTab("cobrancas");
      } else {
        const d = await res.json();
        alert(d.error || "Erro ao gerar cobrança.");
      }
    } catch (err) {
      alert("Erro ao conectar ao servidor.");
    }
  };

  // Issue Warranty Certificate
  const handleIssueWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warrantyRuleId) {
      alert("Por favor, selecione uma regra de garantia padrão.");
      return;
    }

    try {
      const res = await fetch(`/api/service-orders/${osId}/warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: parseInt(warrantyRuleId),
          start_date: warrantyStartDate,
        })
      });
      if (res.ok) {
        loadOSDetails();
      } else {
        const d = await res.json();
        alert(d.error || "Falha ao emitir certificado.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    }
  };

  // Handle Attachment File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch(`/api/service-orders/${osId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            fileBase64: base64,
            mimeType: file.type
          })
        });
        if (res.ok) {
          loadOSDetails();
        } else {
          alert("Erro ao enviar arquivo.");
        }
      } catch (err) {
        alert("Erro de comunicação ao enviar arquivo.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="bg-white p-16 border border-gray-200 rounded-md flex justify-center items-center shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white p-8 border border-gray-200 rounded-md text-center text-gray-500 shadow-sm">
        Ordem de serviço não encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* OS Header */}
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
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">OS: {order.code}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                order.status_name === "Recebida" ? "bg-gray-100 text-gray-700" :
                order.status_name === "Em análise" ? "bg-blue-50 text-blue-700" :
                order.status_name === "Em manutenção" ? "bg-amber-50 text-amber-700" :
                order.status_name === "Pronta" ? "bg-green-50 text-green-700" :
                order.status_name === "Entregue" ? "bg-emerald-100 text-emerald-800" :
                "bg-red-50 text-red-700"
              }`}>{order.status_name}</span>
            </div>
            <p className="text-gray-400 text-xs font-mono mt-0.5">Cliente: <span className="font-bold text-gray-700">{order.client_name} ({order.client_code})</span> • Equipamento: <span className="font-bold text-gray-700">{order.equip_brand} {order.equip_model}</span></p>
          </div>
        </div>

        {/* Dynamic Status Dropdown and Save bar */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={order.status_id}
            onChange={(e) => setOrder({ ...order, status_id: parseInt(e.target.value) })}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
          >
            {statuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>

          <button
            onClick={handleSaveOS}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0e131f] hover:bg-[#1f2937] text-white rounded-md text-xs font-bold transition cursor-pointer shrink-0"
          >
            {isSaving ? <Loader className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            <span>Salvar OS</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs flex items-center space-x-2">
          <Check className="h-4 w-4 text-green-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Horizontal Tabs */}
      <div className="border-b border-gray-200 bg-white px-4 rounded-md border shadow-sm">
        <nav className="-mb-px flex space-x-8 overflow-x-auto whitespace-nowrap">
          {[
            { id: "recepcao", label: "Recepção / Checklist" },
            { id: "analise", label: "Análise Técnica" },
            { id: "orcamento", label: `Orçamento (${budgetItems.length})` },
            { id: "cobrancas", label: "Faturamento / Cobranças" },
            { id: "garantia", label: "Termo de Garantia" },
            { id: "anexos", label: `Anexos / Fotos (${attachments.length})` }
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

      {/* TAB CONTENT: RECEPÇÃO */}
      {activeTab === "recepcao" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-4 text-xs text-gray-700">
          <h3 className="font-bold text-gray-950 border-b border-gray-100 pb-1.5 uppercase tracking-wider text-[10px]">Dados de Entrada / Recepção</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-gray-600 font-bold mb-1">Defeito Informado pelo Cliente *</label>
              <textarea
                value={order.problem_reported}
                onChange={(e) => setOrder({ ...order, problem_reported: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold focus:ring-1 focus:outline-none h-20"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Estado Físico do Equipamento</label>
                <textarea
                  value={order.reception_equipment_state || ""}
                  onChange={(e) => setOrder({ ...order, reception_equipment_state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-16"
                  placeholder="Ex: Riscos na carcaça superior, cantos amassados..."
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Observações Gerais de Entrada</label>
                <textarea
                  value={order.reception_notes || ""}
                  onChange={(e) => setOrder({ ...order, reception_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-16"
                  placeholder="Observações complementares..."
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-600 mb-1 font-bold">Acessórios Entregues no Recebimento</label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md flex flex-wrap gap-4 font-mono">
                {accessories.length === 0 ? (
                  <span className="text-gray-400">Nenhum acessório entregue.</span>
                ) : (
                  accessories.map((acc, i) => (
                    <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-700 flex items-center">
                      <Check className="h-3.5 w-3.5 text-green-600 mr-1" />
                      {acc}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ANÁLISE TÉCNICA */}
      {activeTab === "analise" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-4 text-xs text-gray-700">
          <h3 className="font-bold text-gray-950 border-b border-gray-100 pb-1.5 uppercase tracking-wider text-[10px]">Diagnóstico e Execução Técnica</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-600 mb-1 font-semibold">Defeito Constatado pelo Técnico</label>
              <textarea
                value={order.technical_defect || ""}
                onChange={(e) => setOrder({ ...order, technical_defect: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-20"
                placeholder="Qual o problema real encontrado pelo laboratório?"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 font-semibold">Laudo de Diagnóstico Técnico</label>
              <textarea
                value={order.technical_diagnosis || ""}
                onChange={(e) => setOrder({ ...order, technical_diagnosis: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-20"
                placeholder="Qual a causa do defeito?"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-600 mb-1 font-semibold">Serviço Recomendado</label>
              <textarea
                value={order.technical_service_recommended || ""}
                onChange={(e) => setOrder({ ...order, technical_service_recommended: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-16"
                placeholder="Ex: Formatação de sistema e substituição de HD para SSD"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 font-semibold">Peças Necessárias para Reparo</label>
              <textarea
                value={order.technical_parts_needed || ""}
                onChange={(e) => setOrder({ ...order, technical_parts_needed: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-16"
                placeholder="Ex: SSD 240GB Sata III Kingston"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-600 mb-1 font-semibold">Técnico Responsável</label>
              <input
                type="text"
                value={order.technician_name || ""}
                onChange={(e) => setOrder({ ...order, technician_name: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 font-semibold">Tempo Estimado (Horas)</label>
              <input
                type="number"
                step="0.1"
                value={order.technical_estimated_hours || ""}
                onChange={(e) => setOrder({ ...order, technical_estimated_hours: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
                placeholder="Ex: 2.5"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1 font-semibold">Data de Previsão de Entrega</label>
              <input
                type="date"
                value={order.promise_date ? order.promise_date.slice(0, 10) : ""}
                onChange={(e) => setOrder({ ...order, promise_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-600 mb-1 font-semibold">Observações Técnicas do Laboratório</label>
            <textarea
              value={order.technical_notes || ""}
              onChange={(e) => setOrder({ ...order, technical_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:outline-none h-16"
              placeholder="Anotações internas do laboratório..."
            />
          </div>
        </div>
      )}

      {/* TAB CONTENT: ORÇAMENTO */}
      {activeTab === "orcamento" && (
        <div className="space-y-6 text-xs text-gray-700">
          
          {/* Add budget item form */}
          {(!guide || guide.paid_amount === 0) ? (
            <form onSubmit={handleAddBudgetItem} className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-3">
              <h4 className="font-bold text-gray-950 border-b border-gray-100 pb-1.5 uppercase tracking-wider text-[10px]">Adicionar Item ao Orçamento</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-gray-600 mb-1 font-semibold">Descrição do Item *</label>
                  <input
                    type="text"
                    required
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none font-bold"
                    placeholder="Ex: Formatação de sistema Windows 11"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Tipo de Item *</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none font-bold"
                  >
                    <option value="Serviço">Serviço</option>
                    <option value="Peça">Peça</option>
                    <option value="Mão de obra">Mão de obra</option>
                  </select>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Qtd *</label>
                      <input
                        type="number"
                        required
                        value={newQty}
                        onChange={(e) => setNewQty(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Valor Unit. *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={newVal}
                        onChange={(e) => setNewVal(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md transition cursor-pointer"
                >
                  + Inserir Item
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-md font-semibold text-xs flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span>O orçamento deste faturamento está bloqueado porque já existem pagamentos registrados.</span>
            </div>
          )}

          {/* Budget items table list */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-bold text-gray-900">Itens Orcamentados</h4>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">Total: {budgetItems.length} itens</span>
            </div>

            {budgetItems.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Nenhum item inserido no orçamento de serviço.</div>
            ) : (
              <div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/20 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Item / Descrição</th>
                      <th className="py-3 px-4 text-center">Tipo</th>
                      <th className="py-3 px-4 text-center">Qtd</th>
                      <th className="py-3 px-4 text-right">Valor Unitário</th>
                      <th className="py-3 px-4 text-right">Valor Total</th>
                      {(!guide || guide.paid_amount === 0) && <th className="py-3 px-4 text-right">Excluir</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {budgetItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/30 transition">
                        <td className="py-3.5 px-4 font-semibold text-gray-900">{item.description}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.type === "Serviço" ? "bg-blue-50 text-blue-700" :
                            item.type === "Peça" ? "bg-purple-50 text-purple-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>{item.type}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">{parseFloat(item.quantity as any)}</td>
                        <td className="py-3.5 px-4 text-right font-mono">{currency} {parseFloat(item.unit_value as any).toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">{currency} {parseFloat(item.total_value as any).toFixed(2)}</td>
                        {(!guide || guide.paid_amount === 0) && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleRemoveBudgetItem(item.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Subtotal calculator */}
                <div className="bg-gray-50/50 p-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h5 className="font-bold text-gray-900 text-sm">Resumo Orcamentário</h5>
                    <p className="text-gray-400 text-[10px] mt-0.5">O total faturado será baseado na soma integral destes itens.</p>
                  </div>
                  
                  <div className="text-right space-y-1.5 w-full md:w-auto">
                    <div className="text-gray-500 font-semibold flex justify-between md:justify-end md:space-x-8">
                      <span>Valor Subtotal:</span>
                      <span className="font-mono font-bold text-gray-800">{currency} {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="text-gray-500 font-semibold flex justify-between md:justify-end md:space-x-8">
                      <span>Acréscimos / Descontos:</span>
                      <span className="font-mono font-bold text-gray-400">{currency} 0.00</span>
                    </div>
                    <div className="text-lg font-bold text-gray-950 flex justify-between md:justify-end md:space-x-8 border-t border-gray-200 pt-2">
                      <span>Valor Total Líquido:</span>
                      <span className="font-mono font-extrabold text-indigo-700">{currency} {subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Billing Form Generation */}
          {subtotal > 0 && (
            <form onSubmit={handleGenerateGuide} className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-4">
              <div className="border-b border-gray-100 pb-2">
                <h4 className="font-bold text-gray-950 uppercase tracking-wider text-[10px] flex items-center space-x-1.5 text-indigo-700">
                  <DollarSign className="h-4 w-4" />
                  <span>Emissão de Guia de Pagamento (Faturamento)</span>
                </h4>
                <p className="text-gray-400 text-[10px] mt-0.5">Defina os termos financeiros de recebimento das parcelas.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Forma de Pagamento Planejada</label>
                  <select
                    value={expectedMethod}
                    onChange={(e) => setExpectedMethod(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none font-bold"
                  >
                    <option value="">Selecione...</option>
                    {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Número de Parcelas *</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Data do Primeiro Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Observações do Faturamento</label>
                <input
                  type="text"
                  value={guideNotes}
                  onChange={(e) => setGuideNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                  placeholder="Ex: Pagamento parcelado no balcão"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition text-xs cursor-pointer flex items-center justify-center space-x-2"
              >
                <CheckCircle className="h-4.5 w-4.5" />
                <span>Confirmar e Gerar Guia de Cobrança</span>
              </button>
            </form>
          )}

        </div>
      )}

      {/* TAB CONTENT: COBRANÇAS */}
      {activeTab === "cobrancas" && (
        <div className="space-y-4 text-xs text-gray-700">
          {!guide ? (
            <div className="bg-white p-12 text-center text-gray-500 border border-gray-200 rounded-md shadow-sm space-y-1">
              <DollarSign className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-sm font-medium">Nenhuma guia faturada para esta OS.</p>
              <p className="text-xs">Por favor, acesse a aba Orçamento para gerar a guia de pagamento correspondente.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Faturamento {guide.code}</h4>
                  <p className="text-gray-400 text-[10px] font-mono mt-0.5">Situação: <span className="font-bold text-indigo-600">{guide.status.toUpperCase()}</span></p>
                </div>

                <div className="flex items-center space-x-6 text-right font-mono">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Total Faturado</span>
                    <div className="text-base font-bold text-gray-900">{currency} {parseFloat(guide.total_amount as any).toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-green-700 uppercase font-bold">Total Recebido</span>
                    <div className="text-base font-bold text-green-600">+{currency} {parseFloat(guide.paid_amount as any).toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-red-700 uppercase font-bold">Saldo devedor</span>
                    <div className="text-base font-bold text-red-600">{currency} {parseFloat(guide.balance_amount as any).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Installments Table, Payments History and Payment Recording */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Side: Installments & Payments History */}
                <div className="space-y-6">
                  {/* Installments List */}
                  <div className="space-y-2.5">
                    <h5 className="font-bold text-gray-950 uppercase tracking-wider text-[10px] border-b border-gray-100 pb-1">Parcelas Previstas</h5>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {guideInstallments.length === 0 ? (
                        <p className="text-gray-400 py-2">Nenhuma parcela gerada.</p>
                      ) : (
                        guideInstallments.map((inst: any) => (
                          <div key={inst.id} className="flex justify-between items-center p-2.5 border border-gray-100 rounded bg-gray-50/50 font-mono text-[11px] hover:bg-gray-50 transition">
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
                        ))
                      )}
                    </div>
                  </div>

                  {/* Payments History List */}
                  {guidePayments.length > 0 && (
                    <div className="space-y-2.5">
                      <h5 className="font-bold text-gray-950 uppercase tracking-wider text-[10px] border-b border-gray-100 pb-1">Histórico de Recebimentos</h5>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[10px]">
                        {guidePayments.map((p: any) => (
                          <div key={p.id} className="p-2.5 border border-gray-100 bg-white rounded flex justify-between hover:bg-gray-50 transition">
                            <div>
                              <span className="text-gray-400">{new Date(p.payment_date).toLocaleDateString("pt-BR")}</span> • <span className="font-semibold text-gray-800">{p.method_name}</span>
                              {p.notes && <div className="text-[9px] text-gray-400 font-sans mt-0.5">Obs: {p.notes}</div>}
                            </div>
                            <span className="font-bold text-green-600">+{currency} {parseFloat(p.amount as any).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Register Payment Form */}
                <div>
                  {parseFloat(guide.balance_amount as any) > 0 ? (
                    <form onSubmit={handleRegisterPayment} className="space-y-3 bg-indigo-50/30 p-5 border border-indigo-100 rounded-md">
                      <h5 className="font-bold text-indigo-950 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                        <DollarSign className="h-4 w-4 text-indigo-600" />
                        <span>Registrar Novo Pagamento</span>
                      </h5>
                      <p className="text-gray-400 text-[10px] mt-0.5">Informe os detalhes para liquidar ou amortizar o saldo devedor.</p>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-gray-600 mb-1 font-semibold">Valor do Recebimento *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            max={parseFloat(guide.balance_amount as any)}
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
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white focus:outline-none text-xs font-semibold"
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
                          placeholder="Ex: Recebido em mãos, pix, transferência..."
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isRegisteringPayment}
                        className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-bold text-xs transition cursor-pointer flex items-center justify-center space-x-2"
                      >
                        {isRegisteringPayment ? <Loader className="animate-spin h-3.5 w-3.5" /> : <CheckCircle className="h-4 w-4" />}
                        <span>Confirmar e Liquidar Valor</span>
                      </button>
                    </form>
                  ) : (
                    <div className="bg-green-50 p-4 border border-green-200 text-green-800 text-xs text-center font-bold rounded-md flex flex-col items-center justify-center space-y-2">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="text-sm">Faturamento Totalmente Quitado!</p>
                        <p className="text-gray-500 font-medium text-[10px] mt-0.5">Não há saldos pendentes nesta guia de cobrança.</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: GARANTIA */}
      {activeTab === "garantia" && (
        <div className="space-y-4 text-xs text-gray-700">
          
          {warranty ? (
            <div className="bg-white border border-gray-200 rounded-md p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-green-600 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Garantia Ativa: {warranty.code}</h4>
                    <p className="text-gray-400 text-[10px] font-mono mt-0.5">Situação: <span className="font-bold text-green-600">{warranty.status.toUpperCase()}</span></p>
                  </div>
                </div>

                <div className="text-right font-mono text-[11px] text-gray-600">
                  <div>Vigência: <span className="font-bold">{new Date(warranty.start_date).toLocaleDateString("pt-BR")}</span> até <span className="font-bold text-red-600">{new Date(warranty.end_date).toLocaleDateString("pt-BR")}</span></div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Referência: {warranty.pdf_reference}</div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 border border-gray-200 rounded-md">
                <p className="font-semibold text-gray-800">O que você deseja fazer?</p>
                <div className="flex space-x-3 mt-3">
                  <button
                    onClick={() => alert(`Consultando termo de garantia ${warranty.code}... (Modelo PDF em desenvolvimento para próxima versão)`)}
                    className="px-3 py-1.5 border border-gray-300 rounded font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                  >
                    Consultar Termo
                  </button>
                  <button
                    onClick={() => alert(`Baixando PDF ${warranty.pdf_reference}... (Módulo de impressão será integrado na próxima etapa)`)}
                    className="px-3 py-1.5 bg-[#0e131f] hover:bg-[#1f2937] text-white rounded font-bold transition cursor-pointer"
                  >
                    Baixar Termo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md p-6 shadow-sm">
              <div className="border-b border-gray-100 pb-3 mb-4">
                <h4 className="font-bold text-gray-900 flex items-center space-x-1.5">
                  <ShieldCheck className="h-5 w-5 text-gray-600" />
                  <span>Emissão de Termo de Garantia</span>
                </h4>
                <p className="text-gray-400 text-[10px] mt-1">A garantia legal ou contratual é emitida no fechamento da OS após a quitação total faturada.</p>
              </div>

              {/* Guard checks for finalized and paid OS */}
              {(order.status_name !== "Pronta" && order.status_name !== "Entregue") || !guide || guide.status !== "Quitada" ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-start space-x-3 font-semibold text-xs">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="font-bold">Regras de Emissão Não Atendidas:</p>
                    <ul className="list-disc list-inside space-y-1 font-medium text-gray-600 mt-1">
                      <li>A ordem de serviço deve estar nos status: <span className="font-bold text-gray-800">Pronta</span> ou <span className="font-bold text-gray-800">Entregue</span>. (Status atual: {order.status_name})</li>
                      <li>A guia de faturamento faturada deve estar com status: <span className="font-bold text-gray-800">Quitada</span>. (Status atual: {guide ? guide.status : "Sem guia gerada"})</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleIssueWarranty} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Selecione a Regra de Garantia Padrão *</label>
                      <select
                        required
                        value={warrantyRuleId}
                        onChange={(e) => setWarrantyRuleId(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none font-bold"
                      >
                        <option value="">Selecione...</option>
                        {warrantyRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} ({rule.duration_days} dias)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Data de Início da Garantia *</label>
                      <input
                        type="date"
                        required
                        value={warrantyStartDate}
                        onChange={(e) => setWarrantyStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md transition text-xs cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <ShieldCheck className="h-4.5 w-4.5" />
                    <span>Gerar Certificado de Garantia Ativa</span>
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      )}

      {/* TAB CONTENT: ANEXOS */}
      {activeTab === "anexos" && (
        <div className="bg-white border border-gray-200 rounded-md p-6 shadow-sm space-y-6 text-xs text-gray-700">
          
          <div className="border-b border-gray-100 pb-2">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
              <Upload className="h-4 w-4 text-gray-600" />
              <span>Anexos, Laudos e Fotos Físicas</span>
            </h4>
            <p className="text-gray-400 text-[10px] mt-0.5">Armazene fotos físicas do aparelho ou laudos técnicos anexados a esta ordem de serviço.</p>
          </div>

          {/* Simple Upload input */}
          <div className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition rounded-md p-8 text-center bg-gray-50/50 space-y-3">
            <Upload className="h-8 w-8 text-gray-400 mx-auto" />
            <div className="space-y-1">
              <span className="font-bold text-gray-800">Clique para selecionar e enviar arquivo físico</span>
              <p className="text-gray-400 text-[10px]">Arquivos JPG, PNG, PDF ou DOC até 50MB</p>
            </div>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
              id="file_upload_input"
            />
            <label
              htmlFor="file_upload_input"
              className="inline-block px-4 py-1.5 bg-[#0e131f] hover:bg-[#1f2937] text-white rounded font-bold text-[11px] transition cursor-pointer"
            >
              {isUploading ? "Enviando arquivo..." : "Selecionar Arquivo"}
            </label>
          </div>

          {/* List attachments */}
          <div className="space-y-2">
            <h5 className="font-bold text-gray-900 uppercase text-[10px] tracking-wider">Arquivos Salvos ({attachments.length})</h5>
            
            {attachments.length === 0 ? (
              <p className="text-gray-400 py-4 text-center">Nenhum anexo salvo para esta ordem de serviço.</p>
            ) : (
              <div className="divide-y divide-gray-100 font-mono text-[11px] text-gray-600">
                {attachments.map((file) => (
                  <div key={file.id} className="py-2 flex justify-between items-center bg-gray-50/30 px-3 rounded hover:bg-gray-50 transition border border-gray-100/50 mb-1.5">
                    <div>
                      <div className="font-semibold text-gray-900">{file.filename}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Tamanho: {(file.file_size / 1024).toFixed(1)} KB • Enviado: {new Date(file.uploaded_at).toLocaleString("pt-BR")}</div>
                    </div>
                    
                    <a
                      href={`/api/attachments/${file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 border border-gray-200 rounded hover:bg-gray-100 transition text-gray-600 flex items-center space-x-1 font-sans text-[10px]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
