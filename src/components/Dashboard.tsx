import { useState, useEffect } from "react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell 
} from "recharts";
import { 
  Users, Laptop, AlertTriangle, DollarSign, ArrowRight, 
  Clock, CheckCircle, RefreshCw, AlertCircle, Settings 
} from "lucide-react";

interface DashboardProps {
  onNavigate: (tab: string, arg?: any) => void;
  currency: string;
}

export default function Dashboard({ onNavigate, currency }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState("6m");
  const [groupBy, setGroupBy] = useState("month");
  const [chartLoading, setChartLoading] = useState(false);

  const fetchDashboardData = async (currentPeriod = period, currentGroupBy = groupBy, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setChartLoading(true);
    }
    try {
      const res = await fetch(`/api/dashboard?period=${currentPeriod}&groupBy=${currentGroupBy}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setChartLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchDashboardData(period, groupBy, true);
  }, []);

  const handlePeriodChange = (newPeriod: string) => {
    let newGroupBy = groupBy;
    if (newPeriod === "15d" || newPeriod === "30d") {
      newGroupBy = "day";
    } else if (newPeriod === "90d") {
      newGroupBy = "week";
    } else if (newPeriod === "6m" || newPeriod === "1y") {
      newGroupBy = "month";
    }
    setPeriod(newPeriod);
    setGroupBy(newGroupBy);
    fetchDashboardData(newPeriod, newGroupBy, false);
  };

  const handleGroupByChange = (newGroupBy: string) => {
    setGroupBy(newGroupBy);
    fetchDashboardData(period, newGroupBy, false);
  };

  if (loading) {
    return (
      <div className="bg-white p-16 border border-gray-200 rounded-md flex justify-center items-center shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const stats = data?.stats || { clients_total: 0, equipments_maintenance: 0, os_delayed: 0, monthly_earnings: 0 };
  const recentOrders = data?.recent_orders || [];
  const chartEarnings = data?.chart_earnings || [];
  const chartCategories = data?.chart_categories || [];

  // Theme colors for Pie Chart Cells
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#374151"];

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white p-6 border border-gray-200 rounded-md shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Painel de Controle</h2>
          <p className="text-gray-500 text-xs mt-1">Bem-vindo de volta! Aqui está uma visão abrangente dos seus clientes, manutenções em laboratório e faturamentos da oficina.</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition text-gray-500 cursor-pointer"
          title="Atualizar Dados"
        >
          <RefreshCw className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Bento-style KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        
        {/* Card 1: Active Clients */}
        <div className="bg-white p-5 border border-gray-200 rounded-md shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Clientes Ativos</span>
            <div className="text-2xl font-black text-gray-950 font-mono">{stats.clients_total}</div>
            <p className="text-[10px] text-gray-500">Cadastros válidos em uso</p>
          </div>
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Equipments under repair */}
        <div className="bg-white p-5 border border-gray-200 rounded-md shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Em Manutenção</span>
            <div className="text-2xl font-black text-gray-950 font-mono">{stats.equipments_maintenance}</div>
            <p className="text-[10px] text-gray-500">Aparelhos ativos na bancada</p>
          </div>
          <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <Laptop className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Delayed OS (SLA alerts) */}
        <div className={`p-5 border rounded-md shadow-sm flex items-center justify-between transition ${stats.os_delayed > 0 ? "bg-red-50/50 border-red-200" : "bg-white border-gray-200"}`}>
          <div className="space-y-1">
            <span className={`text-[10px] uppercase font-bold tracking-wider ${stats.os_delayed > 0 ? "text-red-700" : "text-gray-400"}`}>OS em Atraso</span>
            <div className={`text-2xl font-black font-mono ${stats.os_delayed > 0 ? "text-red-600" : "text-gray-950"}`}>{stats.os_delayed}</div>
            <p className="text-[10px] text-gray-500">Prazos de SLA ultrapassados</p>
          </div>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.os_delayed > 0 ? "bg-red-100 text-red-600 animate-pulse" : "bg-gray-100 text-gray-500"}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Monthly Earnings */}
        <div className="bg-white p-5 border border-gray-200 rounded-md shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Caixa Mensal</span>
            <div className="text-2xl font-black text-green-600 font-mono">{currency} {stats.monthly_earnings.toFixed(2)}</div>
            <p className="text-[10px] text-gray-500">Recebidos no mês atual</p>
          </div>
          <div className="h-10 w-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* Double Charts block using Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs text-gray-700">
        
        {/* Chart 1: Revenue Evolution (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-4 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Faturamento Recebido</h3>
              <p className="text-gray-400 text-[10px]">Evolução dos recebimentos e amortizações da oficina no período.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Period Selector */}
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-md shrink-0">
                {[
                  { label: "15d", value: "15d" },
                  { label: "30d", value: "30d" },
                  { label: "3m", value: "90d" },
                  { label: "6m", value: "6m" },
                  { label: "1a", value: "1y" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => handlePeriodChange(item.value)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      period === item.value
                        ? "bg-white text-gray-950 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                    title={`Visualizar últimos ${item.label}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Group By Selector */}
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-md shrink-0">
                {[
                  { label: "Dia", value: "day" },
                  { label: "Sem.", value: "week" },
                  { label: "Mês", value: "month" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => handleGroupByChange(item.value)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      groupBy === item.value
                        ? "bg-white text-[#0e131f] shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`h-64 font-mono transition-opacity duration-200 ${chartLoading ? "opacity-40" : "opacity-100"}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartEarnings}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "11px" }}
                  formatter={(value) => [`${currency} ${parseFloat(value as any).toFixed(2)}`, "Recebimentos"]}
                />
                <Bar dataKey="revenue" fill="#0e131f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {chartLoading && (
            <div className="absolute inset-0 bg-white/20 flex items-center justify-center pointer-events-none">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0e131f]" />
            </div>
          )}
        </div>

        {/* Chart 2: OS Categories (1/3 width) */}
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">OS por Categoria</h3>
            <p className="text-gray-400 text-[10px]">Distribuição volumétrica das manutenções por categoria.</p>
          </div>

          <div className="h-64 flex flex-col justify-between">
            {chartCategories.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-gray-400">
                <Laptop className="h-8 w-8 text-gray-300 mb-1" />
                <span>Nenhum dado cadastrado</span>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie
                        data={chartCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="category"
                      >
                        {chartCategories.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list */}
                <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-[10px]">
                  {chartCategories.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center space-x-1.5 font-semibold text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate">{item.category} ({item.count})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Row: Recent OS list vs Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs text-gray-700">
        
        {/* Recent Service Orders list (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Entradas Recentes (Ordens de Serviço)</h3>
            <button
              onClick={() => onNavigate("os-list")}
              className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center space-x-1"
            >
              <span>Ver Todas as OS</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Nenhuma Ordem de Serviço cadastrada recentemente.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOrders.map((ord: any) => (
                <div
                  key={ord.id}
                  onClick={() => onNavigate("os-detail", ord.id)}
                  className="p-4 hover:bg-gray-50/50 cursor-pointer transition flex justify-between items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-gray-900">{ord.code}</span>
                      <span className="text-gray-400 text-[10px] font-mono">{new Date(ord.entry_date).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <p className="text-gray-600 font-medium">Cliente: <span className="font-bold text-gray-800">{ord.client_name} ({ord.client_code})</span></p>
                    <p className="text-gray-400 text-[11px]">Aparelho: <span className="font-semibold text-gray-600">{ord.brand} {ord.model}</span></p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      ord.status_name === "Recebida" ? "bg-gray-100 text-gray-700" :
                      ord.status_name === "Em análise" ? "bg-blue-50 text-blue-700" :
                      ord.status_name === "Em manutenção" ? "bg-amber-50 text-amber-700" :
                      ord.status_name === "Pronta" ? "bg-green-50 text-green-700" :
                      ord.status_name === "Entregue" ? "bg-emerald-100 text-emerald-800" :
                      "bg-red-50 text-red-700"
                    }`}>{ord.status_name}</span>
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Operations Widget (1/3 width) */}
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Operações Rápidas</h3>
            <p className="text-gray-400 text-[10px]">Ações diretas de atalho rápido.</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onNavigate("clients")}
              className="w-full py-2.5 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Users className="h-4 w-4" />
              <span>Consultar Fichas de Clientes</span>
            </button>
            <button
              onClick={() => onNavigate("settings")}
              className="w-full py-2.5 border border-gray-300 text-gray-700 rounded font-bold hover:bg-gray-50 transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Settings className="h-4 w-4 text-gray-500" />
              <span>Configurações do Estabelecimento</span>
            </button>
          </div>

          {/* Quick Informational Warning */}
          <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-md flex items-start space-x-2 text-indigo-950 font-medium">
            <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px]">Segurança e Backup:</p>
              <p className="text-gray-500 text-[10px] mt-0.5">As credenciais do banco MySQL local ou remoto estão criptografadas e salvas em segurança no servidor local.</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
