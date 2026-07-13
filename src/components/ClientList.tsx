import React, { useState, useEffect } from "react";
import { Client } from "../types";
import { Search, UserPlus, FileText, Check, Trash2, ShieldAlert, ChevronLeft, ChevronRight, RefreshCw, Eye, AlertCircle } from "lucide-react";

interface ClientListProps {
  onSelectClient: (id: number) => void;
  currency: string;
}

export default function ClientList({ onSelectClient, currency }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("ativo");
  const [totalRecords, setTotalRecords] = useState(0);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [type, setType] = useState<"PF" | "PJ">("PF");
  const [name, setName] = useState("");
  const [companyTrade, setCompanyTrade] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [rgIe, setRgIe] = useState("");
  const [responsible, setResponsible] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 12;

  const fetchClients = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        q: search,
        type: filterType,
        status: filterStatus
      });
      const res = await fetch(`/api/clients?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
        setTotalRecords(data.length);
      }
    } catch (err) {
      console.error("Failed to load clients", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    setCurrentPage(1);
  }, [search, filterType, filterStatus]);

  // Document formatting masks
  const formatCPF = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return v;
  };

  const formatCNPJ = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 14) {
      v = v.replace(/^(\d{2})(\d)/, "$1.$2");
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
      v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    return v;
  };

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

  const handleDocChange = (val: string) => {
    if (type === "PF") {
      setCpfCnpj(formatCPF(val));
    } else {
      setCpfCnpj(formatCNPJ(val));
    }
  };

  // CEP Auto-Fill helper (ViaCEP)
  const handleCepLookup = async (val: string) => {
    const cleanCep = val.replace(/\D/g, "");
    setZipCode(cleanCep.replace(/^(\d{5})(\d{3})$/, "$1-$2"));
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
        }
      } catch (err) {
        // ignore
      }
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name || !cpfCnpj) {
      setFormError("Nome e CPF/CNPJ são obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type, name, cpf_cnpj: cpfCnpj, rg_ie: rgIe, responsible, birth_date: birthDate || null,
        email, phone, whatsapp: whatsapp || phone, zip_code: zipCode, street, number,
        complement, neighborhood, city, state, notes
      };

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Clean Form & Refresh
        setName(""); setCompanyTrade(""); setCpfCnpj(""); setRgIe(""); setResponsible(""); setBirthDate("");
        setEmail(""); setPhone(""); setWhatsapp(""); setZipCode(""); setStreet("");
        setNumber(""); setComplement(""); setNeighborhood(""); setCity(""); setState("");
        setNotes("");
        setShowAddForm(false);
        fetchClients();
      } else {
        setFormError(data.error || "Erro ao cadastrar cliente.");
      }
    } catch (err) {
      setFormError("Erro de comunicação com o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = currentStatus === "ativo" ? "inativo" : "ativo";
    if (!window.confirm(`Deseja realmente alterar o status deste cliente para ${newStatus}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchClients();
      }
    } catch (err) {
      console.error("Error toggling client status", err);
    }
  };

  // Paginated Slices
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = clients.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Nenhum";
    const d = new Date(isoString);
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-gray-200 rounded-md shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Clientes</h2>
          <p className="text-gray-500 text-xs mt-1">
            Gerencie clientes e consulte seus equipamentos, ordens de serviço, garantias e informações financeiras.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-[#0e131f] hover:bg-[#1f2937] text-white rounded-md text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Novo Cliente</span>
        </button>
      </div>

      {/* Main Grid: Filters & Lists */}
      <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        
        {/* Filters bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-1/3">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Buscar por código, nome, CPF/CNPJ, fone..."
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Todos os tipos</option>
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
              <option value="">Todos os status</option>
            </select>

            <button 
              onClick={fetchClients}
              className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition text-gray-500"
              title="Recarregar"
            >
              <RefreshCw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Clients Table */}
        {loading ? (
          <div className="p-16 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : currentRecords.length === 0 ? (
          <div className="p-16 text-center text-gray-500 space-y-2">
            <AlertCircle className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="text-sm font-medium">Nenhum cliente cadastrado.</p>
            <p className="text-xs">Altere os filtros de pesquisa ou clique em Novo Cliente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Código / Cliente</th>
                  <th className="py-3 px-4">CPF / CNPJ</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4 text-center">Tipo</th>
                  <th className="py-3 px-4 text-center">Equipamentos</th>
                  <th className="py-3 px-4 text-center">OS Abertas</th>
                  <th className="py-3 px-4">Última OS</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {currentRecords.map((client) => (
                  <tr 
                    key={client.id}
                    onClick={() => onSelectClient(client.id)}
                    className="hover:bg-gray-50/70 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition">{client.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{client.code}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-600">
                      {client.cpf_cnpj}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <div>{client.phone || client.whatsapp}</div>
                      <div className="text-gray-400 text-[11px]">{client.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${client.type === "PF" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                        {client.type === "PF" ? "Física" : "Jurídica"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-gray-700">
                      {client.equipment_count || 0}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {client.open_os_count && client.open_os_count > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold">
                          {client.open_os_count} em aberto
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 font-mono">
                      {formatDate(client.last_service_date)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${client.status === "ativo" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {client.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectClient(client.id)}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                          title="Ficha do Cliente"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleToggleStatus(client.id, client.status, e)}
                          className={`p-1 rounded transition ${client.status === "ativo" ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}
                          title={client.status === "ativo" ? "Inativar Cliente" : "Reativar Cliente"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>Exibindo de {indexOfFirstRecord + 1} a {Math.min(indexOfLastRecord, totalRecords)} de {totalRecords} registros</span>
            <div className="flex items-center space-x-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="p-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-2 py-1 rounded border ${currentPage === i + 1 ? "bg-[#0e131f] text-white border-[#0e131f] font-bold" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="p-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* NEW CLIENT SLIDE DRAWER / DIALOG */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl animate-slide-in">
            
            {/* Drawer Header */}
            <div className="bg-[#0e131f] p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider">Novo Cadastro de Cliente</h3>
                <p className="text-gray-400 text-[10px] mt-0.5">Adicione os dados cadastrais e de endereço do novo cliente.</p>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                Fechar [X]
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <form onSubmit={handleAddClient} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-gray-700">
              
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2 text-red-700 text-xs">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Step 1: Type Selection */}
              <div className="bg-gray-50 p-4 border border-gray-200 rounded-md">
                <label className="block font-bold text-gray-800 mb-2">TIPO DE CLIENTE *</label>
                <div className="flex space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="client_type"
                      checked={type === "PF"}
                      onChange={() => { setType("PF"); setCpfCnpj(""); }}
                      className="text-indigo-600 h-4 w-4"
                    />
                    <span>Pessoa Física (PF)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="client_type"
                      checked={type === "PJ"}
                      onChange={() => { setType("PJ"); setCpfCnpj(""); }}
                      className="text-indigo-600 h-4 w-4"
                    />
                    <span>Pessoa Jurídica (PJ)</span>
                  </label>
                </div>
              </div>

              {/* Step 2: Main Personal Info */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-950 border-b border-gray-100 pb-1 uppercase tracking-wider text-[11px]">Dados Pessoais</h4>
                
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">{type === "PF" ? "Nome Completo" : "Razão Social"} *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                    placeholder={type === "PF" ? "Uillan Eduardo Lira da Silva" : "Tech Solutions Ltda"}
                  />
                </div>

                {type === "PJ" && (
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Nome Fantasia</label>
                    <input
                      type="text"
                      value={companyTrade}
                      onChange={(e) => setCompanyTrade(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">{type === "PF" ? "CPF" : "CNPJ"} *</label>
                    <input
                      type="text"
                      required
                      value={cpfCnpj}
                      onChange={(e) => handleDocChange(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md font-mono focus:ring-1 focus:outline-none"
                      placeholder={type === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">{type === "PF" ? "RG" : "Inscrição Estadual"}</label>
                    <input
                      type="text"
                      value={rgIe}
                      onChange={(e) => setRgIe(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md font-mono focus:ring-1 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {type === "PF" ? (
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Data de Nascimento</label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-gray-600 mb-1 font-semibold">Responsável Principal</label>
                      <input
                        type="text"
                        value={responsible}
                        onChange={(e) => setResponsible(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                        placeholder="Ex: Carlos Eduardo"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                      placeholder="email@dominio.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Telefone Principal *</label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md font-mono focus:ring-1 focus:outline-none"
                      placeholder="(11) 98888-7777"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">WhatsApp (Opcional)</label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md font-mono focus:ring-1 focus:outline-none"
                      placeholder="(11) 98888-7777"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Address (Cep Auto Lookup) */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-950 border-b border-gray-100 pb-1 uppercase tracking-wider text-[11px]">Endereço</h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">CEP</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => handleCepLookup(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md font-mono focus:ring-1 focus:outline-none"
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 mb-1 font-semibold">Logradouro / Rua</label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Número</label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 mb-1 font-semibold">Complemento</label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Bairro</label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Cidade</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-semibold">Estado (UF)</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      maxLength={2}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none uppercase font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Notes */}
              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Observações Adicionais</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:outline-none h-16"
                  placeholder="Informações adicionais relevantes sobre o cliente..."
                />
              </div>

              {/* Form Actions footer */}
              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-1/3 py-2 border border-gray-300 text-gray-700 rounded-md font-bold hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-2 bg-[#0e131f] hover:bg-[#1f2937] text-white rounded-md font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isSubmitting && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />}
                  <span>Salvar Cliente</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
