import React, { useState, useEffect } from "react";
import {
  FileText,
  Wrench,
  DollarSign,
  CreditCard,
  Receipt,
  Shield,
  FileCheck,
  History,
  Printer,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock
} from "lucide-react";
import { DocumentPreview } from "./DocumentPreview";
import { formatDatePtBr, formatDateTimePtBr } from "../../lib/documentUtils";

interface ServiceOrderDocumentsProps {
  serviceOrder: any;
  onRefreshOS?: () => void;
}

type DocType = "opening" | "technical" | "budget" | "financial" | "payment" | "warranty" | "full";

interface DocCardDef {
  type: DocType;
  title: string;
  description: string;
  icon: any;
  badgeColor: string;
}

const DOCUMENT_CARDS: DocCardDef[] = [
  {
    type: "opening",
    title: "Comprovante de Abertura e Recepção",
    description: "Comprovante inicial com dados do cliente, equipamento, acessórios e estado físico de entrada.",
    icon: FileText,
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200"
  },
  {
    type: "technical",
    title: "Relatório Técnico de Manutenção",
    description: "Laudo técnico detalhando defeitos constatados, diagnósticos, recomendações e fotos de análise.",
    icon: Wrench,
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200"
  },
  {
    type: "budget",
    title: "Orçamento de Serviços e Peças",
    description: "Detalhamento de itens, valores unitários, mão de obra e subtotais calculados do orçamento.",
    icon: DollarSign,
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200"
  },
  {
    type: "financial",
    title: "Guia Financeira de Cobrança",
    description: "Detalhamento de parcelas, datas de vencimento, formas de pagamento e saldos em aberto.",
    icon: CreditCard,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200"
  },
  {
    type: "payment",
    title: "Comprovante Individual de Pagamento",
    description: "Recibo de quitação de pagamento efetuado vinculado à guia da Ordem de Serviço.",
    icon: Receipt,
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200"
  },
  {
    type: "warranty",
    title: "Termo e Certificado de Garantia",
    description: "Certificado formal estipulando prazos, regras e condições gerais de garantia do serviço.",
    icon: Shield,
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200"
  },
  {
    type: "full",
    title: "Relatório Completo Consolidado da OS",
    description: "Documento unificado com todo o histórico: abertura, recepção, laudo, orçamento, pagamentos e garantia.",
    icon: FileCheck,
    badgeColor: "bg-slate-100 text-slate-800 border-slate-200"
  }
];

export function ServiceOrderDocuments({ serviceOrder, onRefreshOS }: ServiceOrderDocumentsProps) {
  const [activeView, setActiveView] = useState<"cards" | "preview">("cards");
  const [selectedType, setSelectedType] = useState<DocType>("opening");
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [snapshotInfo, setSnapshotInfo] = useState<any>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const osId = serviceOrder?.id;

  // Load snapshot history
  const fetchHistory = async () => {
    if (!osId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/service-orders/${osId}/documents/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.snapshots || []);
      }
    } catch (e) {
      console.error("Error loading document history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [osId]);

  // Open Preview for standard generation
  const handleOpenDoc = (type: DocType) => {
    setSelectedType(type);
    setSnapshotData(null);
    setSnapshotInfo(null);
    setActiveView("preview");
  };

  // Open Preview for a historical snapshot
  const handleOpenSnapshot = async (snapId: number) => {
    try {
      const res = await fetch(`/api/service-orders/${osId}/documents/snapshot/${snapId}`);
      if (!res.ok) throw new Error("Erro ao carregar versão do documento");
      const data = await res.json();
      setSelectedType(data.snapshot_info.document_type as DocType);
      setSnapshotData(data.document_data);
      setSnapshotInfo(data.snapshot_info);
      setActiveView("preview");
    } catch (e: any) {
      alert(`Falha ao carregar versão histórica: ${e.message}`);
    }
  };

  if (activeView === "preview") {
    return (
      <DocumentPreview
        osId={osId}
        documentType={selectedType}
        initialData={snapshotData}
        snapshotInfo={snapshotInfo}
        onBack={() => {
          setActiveView("cards");
          fetchHistory();
        }}
        onEmitSuccess={() => {
          fetchHistory();
          if (onRefreshOS) onRefreshOS();
        }}
      />
    );
  }

  const docTypeLabels: Record<string, string> = {
    opening: "Comprovante de Abertura",
    technical: "Relatório Técnico",
    budget: "Orçamento",
    financial: "Guia Financeira",
    payment: "Comprovante de Pagamento",
    warranty: "Termo de Garantia",
    full: "Relatório Completo"
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Central de Documentos da Ordem de Serviço #{serviceOrder?.code}
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Gere, visualize e imprima documentos oficiais formatados em papel A4 padrão.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-gray-100 text-gray-700 font-semibold px-2.5 py-1 rounded border">
            Técnico: <strong className="text-gray-900">{serviceOrder?.technician_name || "Não informado"}</strong>
          </span>
          <span className="bg-indigo-50 text-indigo-800 font-bold px-2.5 py-1 rounded border border-indigo-200">
            {historyList.length} Emissão(ões) Registrada(s)
          </span>
        </div>
      </div>

      {/* Grid of 7 Document Types */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-gray-500" />
          Documentos Disponíveis para Emissão
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCUMENT_CARDS.map((card) => {
            const IconComp = card.icon;
            // Check if there are emitted snapshots for this doc type
            const emittedForType = historyList.filter((h) => h.document_type === card.type);

            return (
              <div
                key={card.type}
                className="bg-white border border-gray-200 hover:border-indigo-400 rounded-lg p-4 shadow-sm hover:shadow transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-indigo-50 transition text-indigo-600">
                      <IconComp className="w-5 h-5" />
                    </div>
                    {emittedForType.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        v{emittedForType[0].version} Emitido
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition">
                    {card.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-3 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-medium">Formato A4 Padrão</span>
                  <button
                    onClick={() => handleOpenDoc(card.type)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded font-bold text-xs transition"
                  >
                    Visualizar / Imprimir
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Snapshots History Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
            <History className="w-4 h-4 text-indigo-600" />
            Histórico de Documentos Definitivos Emitidos (Auditoria)
          </h3>
          <span className="text-xs text-gray-500 font-medium">{historyList.length} registro(s)</span>
        </div>

        {loadingHistory ? (
          <div className="p-6 text-center text-gray-500 text-xs">Carregando histórico...</div>
        ) : historyList.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-200">
                <th className="py-2.5 px-4">Versão</th>
                <th className="py-2.5 px-4">Tipo de Documento</th>
                <th className="py-2.5 px-4">Situação da OS na Época</th>
                <th className="py-2.5 px-4">Emitido Por</th>
                <th className="py-2.5 px-4">Data e Hora</th>
                <th className="py-2.5 px-4">Hash de Conteúdo</th>
                <th className="py-2.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {historyList.map((snap) => (
                <tr key={snap.id} className="hover:bg-gray-50">
                  <td className="py-2.5 px-4 font-bold text-indigo-900">v{snap.version}</td>
                  <td className="py-2.5 px-4 font-semibold text-gray-900">
                    {docTypeLabels[snap.document_type] || snap.document_type}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[10px] font-medium border">
                      {snap.service_order_status || "Desconhecida"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-700">{snap.generated_by}</td>
                  <td className="py-2.5 px-4 text-gray-600">{formatDateTimePtBr(snap.generated_at)}</td>
                  <td className="py-2.5 px-4 font-mono text-[10px] text-gray-500">
                    {snap.content_hash ? snap.content_hash.substring(0, 12) + "..." : "N/A"}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => handleOpenSnapshot(snap.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-indigo-600 text-gray-800 hover:text-white rounded text-[11px] font-semibold transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Reimprimir v{snap.version}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500 italic text-xs">
            Nenhum documento definitivo foi emitido ainda para esta Ordem de Serviço.
          </div>
        )}
      </div>
    </div>
  );
}
