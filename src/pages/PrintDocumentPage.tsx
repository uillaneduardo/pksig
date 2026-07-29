import React, { useState, useEffect } from "react";
import { Printer, X, AlertTriangle, ArrowLeft, RefreshCw, CheckCircle } from "lucide-react";
import { OpeningReceiptDocument } from "../components/documents/OpeningReceiptDocument";
import { TechnicalReportDocument } from "../components/documents/TechnicalReportDocument";
import { BudgetDocument } from "../components/documents/BudgetDocument";
import { FinancialGuideDocument } from "../components/documents/FinancialGuideDocument";
import { PaymentReceiptDocument } from "../components/documents/PaymentReceiptDocument";
import { WarrantyDocument } from "../components/documents/WarrantyDocument";
import { FullServiceOrderDocument } from "../components/documents/FullServiceOrderDocument";

type MarginOption = "5mm" | "7mm" | "10mm";

interface RouteInfo {
  docType: "opening" | "technical" | "budget" | "financial" | "payment" | "warranty" | "full";
  osId?: number;
  paymentId?: number;
  warrantyId?: number;
  snapshotId?: number;
}

export default function PrintDocumentPage() {
  const [docData, setDocData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [targetPaymentId, setTargetPaymentId] = useState<number | undefined>(undefined);
  const [margin, setMargin] = useState<MarginOption>("7mm");
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Parse current URL path and query string
  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    // Margin setting from query param
    const marginParam = searchParams.get("margin");
    if (marginParam === "5mm" || marginParam === "7mm" || marginParam === "10mm") {
      setMargin(marginParam);
    }

    // Selected photo IDs param
    const photosParam = searchParams.get("photos");
    let photoIds: number[] = [];
    if (photosParam) {
      photoIds = photosParam
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    }

    // Target payment ID param
    const paymentIdParam = searchParams.get("payment_id");
    if (paymentIdParam) {
      const pid = parseInt(paymentIdParam, 10);
      if (!isNaN(pid)) setTargetPaymentId(pid);
    }

    // Snapshot ID param
    const snapshotIdParam = searchParams.get("snapshot_id");
    const snapshotId = snapshotIdParam ? parseInt(snapshotIdParam, 10) : undefined;

    // Match routes:
    // /print/service-orders/:id/opening
    // /print/service-orders/:id/technical
    // /print/service-orders/:id/budget
    // /print/service-orders/:id/financial
    // /print/service-orders/:id/full
    // /print/payments/:paymentId
    // /print/warranties/:warrantyId

    const soMatch = path.match(/^\/print\/service-orders\/(\d+)\/(opening|technical|budget|financial|full|payment|warranty)$/i);
    const payMatch = path.match(/^\/print\/payments\/(\d+)$/i);
    const warMatch = path.match(/^\/print\/warranties\/(\d+)$/i);

    if (soMatch) {
      const osId = parseInt(soMatch[1], 10);
      const docType = soMatch[2].toLowerCase() as RouteInfo["docType"];
      setRouteInfo({ docType, osId, snapshotId });
    } else if (payMatch) {
      const paymentId = parseInt(payMatch[1], 10);
      setRouteInfo({ docType: "payment", paymentId, snapshotId });
      if (!targetPaymentId) setTargetPaymentId(paymentId);
    } else if (warMatch) {
      const warrantyId = parseInt(warMatch[1], 10);
      setRouteInfo({ docType: "warranty", warrantyId, snapshotId });
    } else {
      setError("Rota de impressão inválida.");
      setLoading(false);
      return;
    }

    if (photosParam) {
      setSelectedPhotoIds(photoIds);
    }
  }, []);

  // Fetch document data from backend once routeInfo is resolved
  useEffect(() => {
    if (!routeInfo) return;

    async function loadDocumentData() {
      setLoading(true);
      setError(null);

      try {
        let endpoint = "";

        if (routeInfo.snapshotId && routeInfo.osId) {
          endpoint = `/api/service-orders/${routeInfo.osId}/documents/snapshot/${routeInfo.snapshotId}`;
        } else if (routeInfo.paymentId) {
          endpoint = `/api/payments/${routeInfo.paymentId}/document`;
        } else if (routeInfo.warrantyId) {
          endpoint = `/api/warranties/${routeInfo.warrantyId}/document`;
        } else if (routeInfo.osId) {
          endpoint = `/api/service-orders/${routeInfo.osId}/documents/${routeInfo.docType}`;
        } else {
          throw new Error("Parâmetros de documento insuficientes.");
        }

        const res = await fetch(endpoint, {
          headers: { "Content-Type": "application/json" }
        });

        if (res.status === 401) {
          throw new Error("Não autenticado. Por favor, faça login para visualizar e imprimir este documento.");
        }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Erro ao carregar dados do documento no servidor.");
        }

        const data = await res.json();
        const actualDocData = data.document_data || data;
        setDocData(actualDocData);

        // If photos param wasn't set, default to all image attachment IDs from fetched data
        const searchParams = new URLSearchParams(window.location.search);
        if (!searchParams.has("photos") && actualDocData.attachments) {
          const imageIds = actualDocData.attachments
            .filter((att: any) => {
              const mime = (att.mime_type || "").toLowerCase();
              const name = (att.filename || "").toLowerCase();
              return mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(name);
            })
            .map((att: any) => att.id);
          setSelectedPhotoIds(imageIds);
        }

        if (routeInfo.docType === "payment" && actualDocData.target_payment?.id) {
          setTargetPaymentId(actualDocData.target_payment.id);
        }
      } catch (err: any) {
        setError(err.message || "Falha ao carregar o documento.");
      } finally {
        setLoading(false);
      }
    }

    loadDocumentData();
  }, [routeInfo]);

  // Set page title for clean PDF filename
  useEffect(() => {
    if (!docData) return;

    const docTypeFileNames: Record<string, string> = {
      opening: "Comprovante_Abertura",
      technical: "Relatorio_Tecnico",
      budget: "Orcamento",
      financial: "Guia_Financeira",
      payment: "Comprovante_Pagamento",
      warranty: "Termo_Garantia",
      full: "Relatorio_Completo"
    };

    const osCode = docData.order?.code || routeInfo?.osId || "DOC";
    const typeLabel = docTypeFileNames[routeInfo?.docType || ""] || "Documento";
    document.title = `${typeLabel}_OS_${osCode}`;
  }, [docData, routeInfo]);

  // Automatically trigger print once images and fonts are fully loaded
  useEffect(() => {
    if (loading || error || !docData) return;

    let isCancelled = false;

    async function triggerPrint() {
      // 1. Wait for web fonts to load
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (e) {
          // Ignore font ready errors
        }
      }

      // 2. Wait for all document images to complete loading
      const images = Array.from(document.images);
      const imagePromises = images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      });

      await Promise.all(imagePromises);

      if (isCancelled) return;

      // Short timeout to allow browser layout engine to stabilize layout before print dialog
      setTimeout(() => {
        if (!isCancelled) {
          window.print();
        }
      }, 400);
    }

    triggerPrint();

    return () => {
      isCancelled = true;
    };
  }, [loading, error, docData]);

  const handlePrintClick = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
    // Fallback if window.close is prevented by browser policies
    setTimeout(() => {
      window.location.href = "/";
    }, 200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-gray-700 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="font-bold text-sm">Carregando documento para impressão...</p>
        <p className="text-xs text-gray-500 mt-1">Aguarde a preparação dos dados e imagens.</p>
      </div>
    );
  }

  if (error || !docData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-gray-800 font-sans">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-red-900 mb-1">Não foi possível carregar o documento</h2>
          <p className="text-xs text-red-700 mb-4">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs transition"
            >
              Tentar Novamente
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded text-xs transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isTechnicianMissing = !docData.order?.technician_name?.trim();

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-xs antialiased">
      {/* Dynamic @page CSS rule for selected margin */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: ${margin};
        }
      `}</style>

      {/* Dedicated Top Toolbar (Only visible outside print mode) */}
      <div className="no-print bg-slate-900 text-white sticky top-0 z-50 px-4 py-2.5 shadow-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded font-medium text-xs transition"
              title="Fechar janela de impressão"
            >
              <ArrowLeft className="w-4 h-4" />
              Fechar
            </button>
            <div>
              <span className="font-bold text-sm text-white block leading-tight">
                Impressão: OS #{docData.order?.code || routeInfo?.osId}
              </span>
              <span className="text-[10px] text-slate-400">
                Página dedicada em formato A4
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Margins Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margem A4:</span>
              <select
                value={margin}
                onChange={(e) => setMargin(e.target.value as MarginOption)}
                className="bg-slate-900 text-white text-xs font-semibold rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="5mm">Compacta (5 mm)</option>
                <option value="7mm">Padrão (7 mm)</option>
                <option value="10mm">Confortável (10 mm)</option>
              </select>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrintClick}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-sm text-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        {/* Warning if Technician is missing */}
        {isTechnicianMissing && (
          <div className="max-w-5xl mx-auto mt-2 bg-amber-500/20 border border-amber-500/50 rounded p-2 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Atenção:</strong> O técnico responsável não foi informado nesta Ordem de Serviço.
            </span>
          </div>
        )}
      </div>

      {/* Document Sheet Canvas Container */}
      <div className="py-6 px-2 print:p-0">
        <main className={`print-page margin-${margin} bg-white max-w-[210mm] mx-auto p-[10mm] print:p-0 print:max-w-none print:shadow-none shadow-xl border border-gray-200 print:border-none`}>
          <div className="print-area">
            {routeInfo?.docType === "opening" && (
              <OpeningReceiptDocument data={docData} selectedPhotoIds={selectedPhotoIds} />
            )}

            {routeInfo?.docType === "technical" && (
              <TechnicalReportDocument data={docData} selectedPhotoIds={selectedPhotoIds} />
            )}

            {routeInfo?.docType === "budget" && <BudgetDocument data={docData} />}

            {routeInfo?.docType === "financial" && <FinancialGuideDocument data={docData} />}

            {routeInfo?.docType === "payment" && (
              <PaymentReceiptDocument data={docData} targetPaymentId={targetPaymentId} />
            )}

            {routeInfo?.docType === "warranty" && <WarrantyDocument data={docData} />}

            {routeInfo?.docType === "full" && (
              <FullServiceOrderDocument data={docData} selectedPhotoIds={selectedPhotoIds} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
