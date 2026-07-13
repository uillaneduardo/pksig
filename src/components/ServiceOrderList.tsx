import { useState, useEffect } from "react";
import { ServiceOrder } from "../types";
import { Search, FileText, ChevronLeft, ChevronRight, RefreshCw, Eye, AlertCircle, Clock, CheckCircle } from "lucide-react";

interface ServiceOrderListProps {
  onSelectOS: (id: number) => void;
  currency: string;
}

export default function ServiceOrderList({ onSelectOS, currency }: ServiceOrderListProps) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [totalRecords, setTotalRecords] = useState(0);

  // Status counters for KPI row
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    ready: 0,
    delivered: 0
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 12;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        q: search,
        status: filterStatus
      });
      const res = await fetch(`/api/service-orders?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        setTotalRecords(data.length);

        // Compute local stats for KPIs
        const total = data.length;
        const open = data.filter((o: any) => o.status_name !== "Pronta" && o.status_name !== "Entregue" && o.status_name !== "Cancelada").length;
        const ready = data.filter((o: any) => o.status_name === "Pronta").length;
        const delivered = data.filter((o: any) => o.status_name === "Entregue").length;
        setStats({ total, open, ready, delivered });
      }
    } catch (err) {
      console.error("Failed to load service orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    setCurrentPage(1);
  }, [search, filterStatus]);

  // Pagination helper slices
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = orders.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Não definida";
    const d = new Date(isoString);
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white p-6 border border-gray-200 rounded-md shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Ordens de Serviço</h2>
        <p className="text-gray-500 text-xs mt-1">
          Acompanhe o laboratório técnico, a esteira de triagem, controle de orçamentos e prazos de entrega das ordens de serviço.
        </p>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 border border-gray-200 rounded-md shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-gray-100 rounded text-gray-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold">Listadas</span>
            <div className="text-lg font-bold text-gray-950">{stats.total} OS</div>
          </div>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-md shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-amber-50 rounded text-amber-700">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-amber-600 uppercase font-bold">Em Aberto / Oficina</span>
            <div className="text-lg font-bold text-amber-950">{stats.open} OS</div>
          </div>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-md shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-green-50 rounded text-green-700">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-green-600 uppercase font-bold">Aparelhos Prontos</span>
            <div className="text-lg font-bold text-green-950">{stats.ready} OS</div>
          </div>
        </div>

        <div className="bg-white p-4 border border-gray-200 rounded-md shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-emerald-50 rounded text-emerald-700">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-600 uppercase font-bold">Entregues</span>
            <div className="text-lg font-bold text-emerald-950">{stats.delivered} OS</div>
          </div>
        </div>
      </div>

      {/* OS Search and Table Card */}
      <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        
        {/* Filters */}
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
              placeholder="Buscar por OS, cliente, serial, marca, modelo..."
            />
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
            >
              <option value="">Todos os status</option>
              <option value="Recebida">Recebidas</option>
              <option value="Em análise">Em análise</option>
              <option value="Aguardando aprovação">Aprovando orçamento</option>
              <option value="Aguardando peça">Aguardando peça</option>
              <option value="Em manutenção">Em manutenção</option>
              <option value="Pronta">Prontas</option>
              <option value="Entregue">Entregues</option>
              <option value="Cancelada">Canceladas</option>
            </select>

            <button 
              onClick={fetchOrders}
              className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition text-gray-500"
              title="Recarregar"
            >
              <RefreshCw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="p-16 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : currentRecords.length === 0 ? (
          <div className="p-16 text-center text-gray-500 space-y-2">
            <AlertCircle className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="text-sm font-medium">Nenhuma Ordem de Serviço encontrada.</p>
            <p className="text-xs">Para iniciar uma OS, acesse a ficha do respectivo Cliente e clique em Nova OS.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Código / Entrada</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Equipamento</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Prazo / Previsão</th>
                  <th className="py-3 px-4 text-right">Orçamento Total</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentRecords.map((ord) => (
                  <tr 
                    key={ord.id}
                    onClick={() => onSelectOS(ord.id)}
                    className="hover:bg-gray-50/50 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition">{ord.code}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{new Date(ord.entry_date).toLocaleDateString("pt-BR")}</div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      <div className="font-semibold">{ord.client_name}</div>
                      <div className="text-gray-400 text-[10px] mt-0.5">Cód: {ord.client_code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">{ord.brand} - {ord.model}</div>
                      <span className="text-[10px] text-gray-400 font-mono mt-0.5">S/N: {ord.serial_number || "Sem serial"}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
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
                    <td className="py-3.5 px-4 text-gray-500 font-mono">
                      {formatDate(ord.promise_date)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-gray-950">
                      {ord.total_value ? `${currency} ${parseFloat(ord.total_value as any).toFixed(2)}` : `${currency} 0.00`}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectOS(ord.id)}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                          title="Gerenciar OS"
                        >
                          <Eye className="h-4 w-4" />
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

    </div>
  );
}
