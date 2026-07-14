import React, { useState, useEffect } from "react";
import { 
  ArrowDownRight, ArrowUpRight, TrendingUp, Plus, Search, Filter, 
  Calendar, Edit, Trash2, AlertCircle, Check, Loader, FileText, X, 
  DollarSign, ArrowLeftRight, HelpCircle
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, BarChart, Bar, Legend, Cell, PieChart, Pie
} from "recharts";

interface FinanceProps {
  currency: string;
}

export default function Finance({ currency }: FinanceProps) {
  const [activeTab, setActiveTab] = useState<"movimentacoes" | "fluxo-caixa">("movimentacoes");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    inflows: 0,
    outflows: 0,
    balance: 0,
    byCategory: [],
    dailyFlow: []
  });

  // Filters State
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Form Fields
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr);
  const [catId, setCatId] = useState("");
  const [linkedOsId, setLinkedOsId] = useState("");
  const [selectedOS, setSelectedOS] = useState<any | null>(null);

  // OS Lookup in Modal
  const [osSearch, setOsSearch] = useState("");
  const [osResults, setOsResults] = useState<any[]>([]);
  const [isSearchingOS, setIsSearchingOS] = useState(false);

  // Search/Filter Actions
  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [startDate, endDate, filterCategory, filterType, searchQuery]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/finance/categories");
      if (res.ok) {
        const data = await res.json();
        // Only active or if they are editing/viewing we want active ones
        setCategories(data);
      }
    } catch (err) {
      console.error("Error loading financial categories:", err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/finance/transactions", window.location.origin);
      if (startDate) url.searchParams.append("startDate", startDate);
      if (endDate) url.searchParams.append("endDate", endDate);
      if (filterCategory) url.searchParams.append("categoryId", filterCategory);
      if (filterType) url.searchParams.append("type", filterType);
      if (searchQuery) url.searchParams.append("searchQuery", searchQuery);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error("Error loading transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const url = new URL("/api/finance/stats", window.location.origin);
      if (startDate) url.searchParams.append("startDate", startDate);
      if (endDate) url.searchParams.append("endDate", endDate);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // OS Lookup Helper
  useEffect(() => {
    if (osSearch.trim().length < 2) {
      setOsResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearchingOS(true);
      try {
        const res = await fetch(`/api/service-orders?q=${encodeURIComponent(osSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setOsResults(data.slice(0, 5)); // Limit to top 5 results
        }
      } catch (err) {
        console.error("Error lookup OS:", err);
      } finally {
        setIsSearchingOS(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [osSearch]);

  const handleOpenCreateModal = () => {
    setEditingTransaction(null);
    setDesc("");
    setType("entrada");
    setAmount("");
    setDate(todayStr);
    setCatId("");
    setLinkedOsId("");
    setSelectedOS(null);
    setOsSearch("");
    setOsResults([]);
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: any) => {
    setEditingTransaction(t);
    setDesc(t.description);
    setType(t.type);
    setAmount(String(t.amount));
    // Formatting date YYYY-MM-DD
    const tDate = t.transaction_date ? t.transaction_date.split("T")[0] : todayStr;
    setDate(tDate);
    setCatId(t.category_id ? String(t.category_id) : "");
    setLinkedOsId(t.os_id ? String(t.os_id) : "");
    setOsSearch("");
    setOsResults([]);
    setFormError("");
    setFormSuccess("");

    if (t.os_id) {
      setSelectedOS({
        id: t.os_id,
        code: t.os_code,
        client_name: t.client_name,
        brand: t.equipment_brand,
        model: t.equipment_model
      });
    } else {
      setSelectedOS(null);
    }

    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm("Deseja realmente apagar esta movimentação? Essa ação é definitiva.")) {
      return;
    }
    try {
      const res = await fetch(`/api/finance/transactions/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTransactions();
        fetchStats();
      } else {
        alert("Erro ao excluir movimentação.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) {
      setFormError("A descrição é obrigatória.");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    if (!date) {
      setFormError("A data é obrigatória.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    setFormSuccess("");

    const payload = {
      description: desc,
      type,
      amount: parseFloat(amount),
      transaction_date: date,
      category_id: catId ? parseInt(catId) : null,
      os_id: selectedOS ? selectedOS.id : null
    };

    try {
      const url = editingTransaction 
        ? `/api/finance/transactions/${editingTransaction.id}`
        : "/api/finance/transactions";
      const method = editingTransaction ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFormSuccess(editingTransaction ? "Lançamento editado com sucesso!" : "Lançamento registrado com sucesso!");
        setTimeout(() => {
          setIsModalOpen(false);
          fetchTransactions();
          fetchStats();
        }, 1200);
      } else {
        const d = await res.json();
        setFormError(d.error || "Erro ao salvar movimentação.");
      }
    } catch (err) {
      setFormError("Erro de comunicação com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  // Format Helper
  const formatVal = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val).replace("R$", currency);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const cleanDate = dateStr.split("T")[0];
    const [year, month, day] = cleanDate.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="bg-white p-6 border border-gray-200 rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center">
            <DollarSign className="h-5 w-5 mr-1.5 text-indigo-600" />
            Movimentação Financeira e Caixa
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Controle o fluxo de caixa, registre receitas e despesas operacionais da oficina e vincule custos às Ordens de Serviço.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Entradas */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-50 rounded-full text-green-600">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Entradas / Receitas</p>
            <h3 className="text-lg font-extrabold text-green-600 mt-0.5">
              {statsLoading ? "..." : formatVal(stats.inflows)}
            </h3>
            <p className="text-[9px] text-gray-400 mt-0.5">Somatório no período selecionado</p>
          </div>
        </div>

        {/* Saídas */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 rounded-full text-red-600">
            <ArrowDownRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Saídas / Despesas</p>
            <h3 className="text-lg font-extrabold text-red-600 mt-0.5">
              {statsLoading ? "..." : formatVal(stats.outflows)}
            </h3>
            <p className="text-[9px] text-gray-400 mt-0.5">Custos e despesas operacionais</p>
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex items-center space-x-4">
          <div className={`p-3 rounded-full ${stats.balance >= 0 ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}>
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Resultado (Saldo Líquido)</p>
            <h3 className={`text-lg font-extrabold mt-0.5 ${stats.balance >= 0 ? "text-indigo-600" : "text-amber-600"}`}>
              {statsLoading ? "..." : formatVal(stats.balance)}
            </h3>
            <p className="text-[9px] text-gray-400 mt-0.5">Entradas menos Saídas do período</p>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab("movimentacoes")}
          className={`pb-2.5 font-bold text-xs transition relative cursor-pointer ${activeTab === "movimentacoes" ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`}
        >
          Lançamentos Diários
          {activeTab === "movimentacoes" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full"></span>}
        </button>
        <button
          onClick={() => setActiveTab("fluxo-caixa")}
          className={`pb-2.5 font-bold text-xs transition relative cursor-pointer ${activeTab === "fluxo-caixa" ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`}
        >
          Relatório e Fluxo de Caixa
          {activeTab === "fluxo-caixa" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full"></span>}
        </button>
      </div>

      {/* Filter Toolbar (Common to both tabs in general date range, or individual) */}
      <div className="bg-white p-4 border border-gray-200 rounded-md shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Start */}
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">De</span>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-250 rounded text-[11px] text-gray-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Date End */}
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-250 rounded text-[11px] text-gray-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Category Filter */}
            {activeTab === "movimentacoes" && (
              <>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Categoria</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-250 rounded text-[11px] text-gray-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Todas as Categorias</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type === "entrada" ? "Entrada" : "Saída"})</option>
                    ))}
                  </select>
                </div>

                {/* Type Filter */}
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Tipo</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-250 rounded text-[11px] text-gray-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Entradas e Saídas</option>
                    <option value="entrada">Apenas Entradas</option>
                    <option value="saida">Apenas Saídas</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Quick Search */}
          {activeTab === "movimentacoes" && (
            <div className="w-full md:max-w-xs flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Buscar</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Descrição ou Cód. OS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-250 rounded text-[11px] text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-450"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* CONTENT TAB: MOVIMENTACOES (LANÇAMENTOS DIÁRIOS) */}
      {activeTab === "movimentacoes" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          
          <div className="px-5 py-4 border-b border-gray-150 flex justify-between items-center bg-gray-50/50">
            <h4 className="font-bold text-gray-800 text-xs flex items-center">
              <Calendar className="h-4 w-4 mr-1.5 text-indigo-600" />
              Lançamentos no Período ({formatDate(startDate)} a {formatDate(endDate)})
            </h4>
            <span className="text-[10px] text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-mono font-bold">
              {transactions.length} registros
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center flex flex-col items-center space-y-2">
              <Loader className="animate-spin h-6 w-6 text-indigo-600" />
              <p className="text-gray-400 text-xs">Carregando movimentações do caixa...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center space-y-2">
              <AlertCircle className="h-6 w-6 text-gray-300" />
              <p className="text-gray-400 font-bold text-xs">Nenhuma movimentação encontrada.</p>
              <p className="text-gray-400 text-[10px] max-w-sm">Use o botão "Novo Lançamento" acima para registrar as entradas e saídas financeiras do dia.</p>
            </div>
          ) : (
            <div className="overflow-x-auto text-xs text-gray-700">
              <table className="w-full min-w-[700px] border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-150 text-gray-400 font-bold text-[10px] uppercase tracking-wider">
                    <th className="p-3">Data</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Vínculo OS</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition duration-150">
                      
                      {/* Data */}
                      <td className="p-3 font-semibold text-gray-600">
                        {formatDate(t.transaction_date)}
                      </td>

                      {/* Descrição */}
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <span className={`p-1 rounded-full ${t.type === "entrada" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                            {t.type === "entrada" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          </span>
                          <span className="font-bold text-gray-800">{t.description}</span>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="p-3">
                        {t.category_name ? (
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {t.category_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Sem categoria</span>
                        )}
                      </td>

                      {/* Vínculo OS */}
                      <td className="p-3">
                        {t.os_code ? (
                          <div className="flex flex-col space-y-0.2">
                            <span className="text-[10px] font-bold text-gray-800 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.2 w-max flex items-center">
                              <FileText className="h-3 w-3 mr-1 text-gray-500" />
                              {t.os_code}
                            </span>
                            <span className="text-[9px] text-gray-400 truncate max-w-[150px]">
                              {t.client_name} - {t.equipment_brand} {t.equipment_model}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="p-3 text-right">
                        <span className={`font-extrabold text-[12px] ${t.type === "entrada" ? "text-green-600" : "text-red-600"}`}>
                          {t.type === "entrada" ? "+ " : "- "}
                          {formatVal(t.amount)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="p-3">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(t)}
                            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Editar lançamento"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* CONTENT TAB: RELATORIO & FLUXO DE CAIXA (GRÁFICOS) */}
      {activeTab === "fluxo-caixa" && (
        <div className="space-y-6">
          
          {/* Main Flow Chart */}
          <div className="bg-white p-6 border border-gray-200 rounded-md shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-xs">Gráfico Comparativo de Entradas vs Saídas Diárias</h3>
              <p className="text-gray-400 text-[10px] mt-0.5">Evolução do fluxo financeiro no período filtrado.</p>
            </div>

            <div className="h-72 w-full text-xs">
              {stats.dailyFlow.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>Sem dados suficientes no período para renderizar o gráfico.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.dailyFlow}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorInflows" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOutflows" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(d) => d.split("-").reverse().slice(0,2).join("/")}
                      stroke="#9ca3af"
                      tick={{ fontSize: 9 }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      tickFormatter={(val) => `R$ ${val}`}
                      tick={{ fontSize: 9 }}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatVal(Number(value)), ""]}
                      labelFormatter={(label) => `Data: ${label.split("-").reverse().join("/")}`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Area 
                      type="monotone" 
                      dataKey="inflows" 
                      name="Receitas (Entradas)" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorInflows)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="outflows" 
                      name="Despesas (Saídas)" 
                      stroke="#EF4444" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorOutflows)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Grouping List & Category Share */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Table grouping */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-gray-150 bg-gray-50/50">
                <h4 className="font-bold text-gray-800 text-xs">Totalização por Categoria</h4>
                <p className="text-gray-400 text-[10px] mt-0.5">Somatórios acumulados das categorias ativas no período.</p>
              </div>

              <div className="flex-grow">
                {stats.byCategory.length === 0 ? (
                  <div className="p-8 text-center text-gray-450 text-[11px] h-full flex items-center justify-center">
                    Nenhum lançamento categorizado no período selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto text-xs text-gray-700">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-gray-150 text-gray-400 font-bold text-[9px] uppercase tracking-wider">
                          <th className="p-3">Categoria</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3 text-right">Total Acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stats.byCategory.map((cat: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition">
                            <td className="p-3 font-semibold text-gray-800">{cat.category_name}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                cat.category_type === "entrada" 
                                  ? "bg-green-50 text-green-700 border border-green-100" 
                                  : "bg-red-50 text-red-700 border border-red-100"
                              }`}>
                                {cat.category_type === "entrada" ? "Entrada" : "Saída"}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900">{formatVal(cat.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Health Box with useful guide */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 text-xs flex items-center">
                  <HelpCircle className="h-4.5 w-4.5 mr-1.5 text-indigo-600" />
                  Dicas de Gestão de Caixa e Custos de OS
                </h4>
                
                <div className="space-y-3.5 text-[11px] text-gray-600 leading-relaxed">
                  <div className="border-l-2 border-indigo-500 pl-3">
                    <p className="font-bold text-indigo-950">Acompanhamento de Lucratividade por OS</p>
                    <p className="text-[10.5px] mt-0.5">Ao lançar despesas de peças ou serviços terceirizados, vincule sempre o lançamento à respectiva Ordem de Serviço. Isso garante um histórico financeiro completo e permite no futuro saber a margem real de cada reparo.</p>
                  </div>

                  <div className="border-l-2 border-green-500 pl-3">
                    <p className="font-bold text-green-950">Categorização Correta</p>
                    <p className="text-[10.5px] mt-0.5">Evite o uso excessivo de "Outras Receitas" ou "Outras Despesas". Use a guia <strong>Preferências &gt; Categorias Financeiras</strong> para cadastrar contas adequadas (como Compra de Telas, Terceirização, etc.) para extrair relatórios precisos.</p>
                  </div>

                  <div className="border-l-2 border-amber-500 pl-3">
                    <p className="font-bold text-amber-950">Conciliação Diária</p>
                    <p className="text-[10.5px] mt-0.5">Lançar as movimentações no mesmo dia do ocorrido evita esquecimentos e furos de caixa. Certifique-se de fechar o fluxo diário conferindo se o saldo bate com o dinheiro na gaveta ou conta bancária.</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded text-[11px] text-indigo-900 leading-tight">
                <strong>Orientações:</strong> O gráfico de fluxo de caixa mostra o comportamento operacional diário. Picos de despesas ou receitas refletem as compras de insumos e quitações de guias de serviço.
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SLIDE-OVER MODAL: REGISTRAR / EDITAR MOVIMENTAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-md border border-gray-200 shadow-xl w-full max-w-lg overflow-hidden flex flex-col my-8">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-sm flex items-center">
                <DollarSign className="h-4.5 w-4.5 mr-1.5 text-indigo-600" />
                {editingTransaction ? "Editar Lançamento Financeiro" : "Novo Lançamento Financeiro"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTransaction} className="p-5 space-y-4 text-xs">
              
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded flex items-start space-x-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Guidance indicator */}
              <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 text-indigo-950 rounded text-[11px] leading-relaxed">
                <strong>Orientações de Lançamento:</strong> 
                {type === "entrada" 
                  ? " O lançamento de entrada acrescenta saldo ao caixa operacional. Útil para venda de acessórios avulsos ou receitas diretas."
                  : " O lançamento de saída debita saldo. Ideal para registrar custos de insumos, peças de reparo de uma OS ou contas fixas."
                }
              </div>

              {/* Type selector (Entrada / Saída) */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("entrada")}
                  className={`py-2 px-4 rounded-md font-bold text-center border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    type === "entrada" 
                      ? "bg-green-600 text-white border-green-700 hover:bg-green-700" 
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span>Receita (Entrada)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("saida")}
                  className={`py-2 px-4 rounded-md font-bold text-center border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    type === "saida" 
                      ? "bg-red-600 text-white border-red-700 hover:bg-red-700" 
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <ArrowDownRight className="h-4 w-4" />
                  <span>Despesa (Saída)</span>
                </button>
              </div>

              {/* Description */}
              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Descrição do Lançamento <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ex: Compra de peça de reposição, Aluguel comercial, etc."
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Amount and Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Valor ({currency}) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-extrabold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-semibold">Data do Lançamento <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-gray-600 mb-1 font-semibold">Categoria de Lançamento</label>
                <select
                  value={catId}
                  onChange={(e) => setCatId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Sem categoria (Não classificado)</option>
                  {categories.filter(c => c.active && c.type === type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Configure estas categorias em <strong>Preferências &gt; Categorias Financeiras</strong>.</p>
              </div>

              {/* Optional Link to Service Order (OS) */}
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <div>
                  <h4 className="font-bold text-gray-800 text-xs flex items-center">
                    <FileText className="h-4 w-4 mr-1 text-indigo-600" />
                    Vincular a uma Ordem de Serviço (Opcional)
                  </h4>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Se este lançamento for referente a um custo específico de conserto (ex: compra de tela de um celular específico) ou uma receita direta de OS, vincule-o abaixo.
                  </p>
                </div>

                {selectedOS ? (
                  <div className="p-2.5 bg-gray-50 border border-gray-250 rounded-md flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-xs flex items-center">
                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded text-[10px] font-mono mr-1.5">
                          {selectedOS.code}
                        </span>
                        {selectedOS.client_name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Equipamento: {selectedOS.brand} {selectedOS.model}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOS(null);
                        setLinkedOsId("");
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition"
                      title="Remover vínculo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 relative">
                    <label className="block text-gray-600 mb-0.5 font-semibold">Pesquise e selecione a OS por código, cliente ou modelo:</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Pesquisar OS..."
                        value={osSearch}
                        onChange={(e) => setOsSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {isSearchingOS && (
                      <p className="text-[10px] text-indigo-600 flex items-center">
                        <Loader className="animate-spin h-3 w-3 mr-1" /> Buscando ordens de serviço correspondentes...
                      </p>
                    )}

                    {osResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-250 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto z-10 divide-y divide-gray-100">
                        {osResults.map((os) => (
                          <button
                            key={os.id}
                            type="button"
                            onClick={() => {
                              setSelectedOS(os);
                              setLinkedOsId(String(os.id));
                              setOsSearch("");
                              setOsResults([]);
                            }}
                            className="w-full text-left p-2.5 hover:bg-indigo-50 transition flex flex-col cursor-pointer"
                          >
                            <span className="font-bold text-gray-800 text-xs">
                              {os.code} — {os.client_name}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              Equipamento: {os.brand} {os.model}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isSaving && <Loader className="animate-spin h-3.5 w-3.5" />}
                  <span>{editingTransaction ? "Salvar Alterações" : "Confirmar Lançamento"}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
