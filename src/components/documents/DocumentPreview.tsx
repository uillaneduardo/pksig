import React, { useState, useEffect } from "react";
import { ArrowLeft, Printer, CheckCircle, AlertTriangle, Image as ImageIcon, ShieldCheck, History, FileCheck } from "lucide-react";
import { OpeningReceiptDocument } from "./OpeningReceiptDocument";
import { TechnicalReportDocument } from "./TechnicalReportDocument";
import { BudgetDocument } from "./BudgetDocument";
import { FinancialGuideDocument } from "./FinancialGuideDocument";
import { PaymentReceiptDocument } from "./PaymentReceiptDocument";
import { WarrantyDocument } from "./WarrantyDocument";
import { FullServiceOrderDocument } from "./FullServiceOrderDocument";

interface DocumentPreviewProps {
  osId: number;
  documentType: "opening" | "technical" | "budget" | "financial" | "payment" | "warranty" | "full";
  initialData?: any;
  snapshotInfo?: any;
  onBack: () => void;
  onEmitSuccess?: () => void;
}

export function DocumentPreview({ osId, documentType, initialData, snapshotInfo, onBack, onEmitSuccess }: DocumentPreviewProps) {
  const [docData, setDocData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [emitting, setEmitting] = useState<boolean>(false);
  const [emittedSnapshot, setEmittedSnapshot] = useState<any>(snapshotInfo || null);
  const [showPhotoSelector, setShowPhotoSelector] = useState<boolean>(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | undefined>(undefined);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);

  // Load document data if not provided
  useEffect(() => {
    if (initialData) {
      setDocData(initialData);
      // Initialize photo selector with all image attachment IDs by default
      if (initialData.attachments) {
        const imageIds = initialData.attachments
          .filter((att: any) => {
            const mime = (att.mime_type || "").toLowerCase();
            const name = (att.filename || "").toLowerCase();
            return mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(name);
          })
          .map((att: any) => att.id);
        setSelectedPhotoIds(imageIds);
      }
      if (initialData.payments && initialData.payments.length > 0) {
        setSelectedPaymentId(initialData.payments[0].id);
      }
      return;
    }

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        let url = `/api/service-orders/${osId}/documents/${documentType}`;
        const res = await fetch(url);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Erro ao carregar dados do documento");
        }
        const data = await res.json();
        setDocData(data);

        if (data.attachments) {
          const imageIds = data.attachments
            .filter((att: any) => {
              const mime = (att.mime_type || "").toLowerCase();
              const name = (att.filename || "").toLowerCase();
              return mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(name);
            })
            .map((att: any) => att.id);
          setSelectedPhotoIds(imageIds);
        }

        if (data.payments && data.payments.length > 0) {
          setSelectedPaymentId(data.payments[0].id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [osId, documentType, initialData]);

  // Handle emitting document
  const handleEmitDocument = async () => {
    if (!osId) return;
    setEmitting(true);
    try {
      const res = await fetch(`/api/service-orders/${osId}/documents/emit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: documentType,
          payment_id: selectedPaymentId,
          selected_attachment_ids: selectedPhotoIds
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao emitir documento");
      }

      const result = await res.json();
      setEmittedSnapshot({
        version: result.version,
        content_hash: result.content_hash,
        generated_at: new Date().toISOString()
      });
      if (result.snapshot) {
        setDocData(result.snapshot);
      }
      if (onEmitSuccess) onEmitSuccess();
    } catch (err: any) {
      alert(`Falha ao emitir documento: ${err.message}`);
    } finally {
      setEmitting(false);
    }
  };

  const docTypeFileNames: Record<string, string> = {
    opening: "Comprovante_Abertura",
    technical: "Relatorio_Tecnico",
    budget: "Orcamento",
    financial: "Guia_Financeira",
    payment: "Comprovante_Pagamento",
    warranty: "Termo_Garantia",
    full: "Relatorio_Completo"
  };

  // Set document title for PDF print filename matching [TipoDocumento]_OS_[NumeroOS]
  useEffect(() => {
    if (docData?.order) {
      const osCode = docData.order.code || osId;
      const typeLabel = docTypeFileNames[documentType] || documentType;
      const titleName = `${typeLabel}_OS_${osCode}`;
      const previousTitle = document.title;
      document.title = titleName;

      return () => {
        document.title = previousTitle;
      };
    }
  }, [docData, documentType, osId]);

  // Handle trigger print in dedicated tab / page
  const handlePrint = () => {
    setPopupBlockedUrl(null);
    const queryParams: string[] = [];

    if (selectedPhotoIds && selectedPhotoIds.length > 0) {
      queryParams.push(`photos=${selectedPhotoIds.join(",")}`);
    }
    if (selectedPaymentId) {
      queryParams.push(`payment_id=${selectedPaymentId}`);
    }
    if (emittedSnapshot?.id) {
      queryParams.push(`snapshot_id=${emittedSnapshot.id}`);
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
    let printUrl = "";

    if (documentType === "payment" && selectedPaymentId) {
      printUrl = `/print/payments/${selectedPaymentId}${queryString}`;
    } else if (documentType === "warranty" && docData?.target_warranty?.id) {
      printUrl = `/print/warranties/${docData.target_warranty.id}${queryString}`;
    } else {
      printUrl = `/print/service-orders/${osId}/${documentType}${queryString}`;
    }

    const newWin = window.open(printUrl, "_blank", "noopener,noreferrer");
    if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
      setPopupBlockedUrl(printUrl);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-2"></div>
        <p className="text-sm font-medium">Carregando dados do documento...</p>
      </div>
    );
  }

  if (error || !docData) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="font-bold">Não foi possível gerar o documento</p>
        <p className="text-xs mt-1">{error || "Dados indisponíveis."}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-1.5 bg-gray-800 text-white rounded text-xs font-semibold hover:bg-gray-900"
        >
          Voltar
        </button>
      </div>
    );
  }

  const isTechnicianMissing = !docData.order?.technician_name?.trim();
  const availablePhotos = (docData.attachments || []).filter((att: any) => {
    const mime = (att.mime_type || "").toLowerCase();
    const name = (att.filename || "").toLowerCase();
    return mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(name);
  });

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      {/* Top Controls Bar (Hidden on print) */}
      <div className="no-print bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-medium text-xs transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>

            <div className="border-l border-gray-300 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-gray-900">
                  Documento: OS #{docData.order?.code}
                </span>
                {emittedSnapshot ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    Emitido Definitivo (v{emittedSnapshot.version})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Prévia em Tempo Real
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Payment Selector if multiple payments exist */}
            {documentType === "payment" && docData.payments && docData.payments.length > 1 && (
              <select
                value={selectedPaymentId}
                onChange={(e) => setSelectedPaymentId(Number(e.target.value))}
                className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-800 font-medium"
              >
                {docData.payments.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    Recibo #PAG-{p.id} (R$ {p.amount})
                  </option>
                ))}
              </select>
            )}

            {/* Photo Selector Toggle Button */}
            {availablePhotos.length > 0 && (
              <button
                onClick={() => setShowPhotoSelector(!showPhotoSelector)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold"
              >
                <ImageIcon className="w-4 h-4" />
                Fotos ({selectedPhotoIds.length}/{availablePhotos.length})
              </button>
            )}

            {/* Emit Button */}
            {!emittedSnapshot && (
              <button
                onClick={handleEmitDocument}
                disabled={emitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <FileCheck className="w-4 h-4" />
                {emitting ? "Emitindo..." : "Emitir Definitivo"}
              </button>
            )}

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        {/* Warning Banner if technician is missing */}
        {isTechnicianMissing && (
          <div className="max-w-5xl mx-auto mt-2.5 bg-amber-50 border border-amber-300 rounded p-2 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Atenção:</strong> O técnico responsável não foi informado nesta OS. Preencha na OS para garantir a validade das assinaturas.
            </span>
          </div>
        )}

        {/* Fallback Banner if Browser Pop-up was Blocked */}
        {popupBlockedUrl && (
          <div className="max-w-5xl mx-auto mt-2.5 bg-indigo-50 border border-indigo-300 rounded p-3 text-xs text-indigo-900 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>
                O seu navegador impediu a abertura da janela de impressão. Clique no botão ao lado para abrir a página de impressão dedicada.
              </span>
            </div>
            <a
              href={popupBlockedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs transition shadow-xs"
            >
              Abrir página de impressão
            </a>
          </div>
        )}

        {/* Photo Selection Drawer / Popover */}
        {showPhotoSelector && availablePhotos.length > 0 && (
          <div className="max-w-5xl mx-auto mt-2 bg-gray-50 border border-gray-300 rounded p-3 text-xs">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-gray-800">Selecione as fotos que devem aparecer no documento:</span>
              <div className="space-x-2">
                <button
                  onClick={() => setSelectedPhotoIds(availablePhotos.map((a: any) => a.id))}
                  className="text-indigo-600 font-semibold hover:underline text-[11px]"
                >
                  Selecionar todas
                </button>
                <button
                  onClick={() => setSelectedPhotoIds([])}
                  className="text-gray-600 hover:underline text-[11px]"
                >
                  Desmarcar todas
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {availablePhotos.map((att: any) => {
                const isChecked = selectedPhotoIds.includes(att.id);
                return (
                  <label
                    key={att.id}
                    className={`flex items-center gap-2 p-1.5 border rounded cursor-pointer transition ${
                      isChecked ? "bg-indigo-50 border-indigo-400" : "bg-white border-gray-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPhotoIds([...selectedPhotoIds, att.id]);
                        } else {
                          setSelectedPhotoIds(selectedPhotoIds.filter((id) => id !== att.id));
                        }
                      }}
                      className="rounded text-indigo-600"
                    />
                    <img
                      src={att.view_url}
                      alt={att.filename}
                      className="w-8 h-8 object-cover rounded border"
                    />
                    <span className="truncate text-[10px] text-gray-700">{att.filename}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* A4 Paper Canvas Container */}
      <div className="max-w-[210mm] mx-auto my-6 print:m-0 print:max-w-none">
        <div className="print-area bg-white shadow-xl rounded-sm border border-gray-200 p-[14mm] print:shadow-none print:border-none print:p-0">
          {documentType === "opening" && (
            <OpeningReceiptDocument data={docData} selectedPhotoIds={selectedPhotoIds} />
          )}

          {documentType === "technical" && (
            <TechnicalReportDocument data={docData} selectedPhotoIds={selectedPhotoIds} />
          )}

          {documentType === "budget" && <BudgetDocument data={docData} />}

          {documentType === "financial" && <FinancialGuideDocument data={docData} />}

          {documentType === "payment" && (
            <PaymentReceiptDocument data={docData} targetPaymentId={selectedPaymentId} />
          )}

          {documentType === "warranty" && <WarrantyDocument data={docData} />}

          {documentType === "full" && (
            <FullServiceOrderDocument data={docData} selectedPhotoIds={selectedPhotoIds} />
          )}
        </div>
      </div>
    </div>
  );
}
