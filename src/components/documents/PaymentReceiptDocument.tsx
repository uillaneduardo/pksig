import React from "react";
import { CompanyHeader } from "./CompanyHeader";
import { SignatureBlock } from "./SignatureBlock";
import { formatCurrency, formatDatePtBr, formatDateTimePtBr } from "../../lib/documentUtils";

interface PaymentReceiptDocumentProps {
  data: any;
  targetPaymentId?: number;
}

export function PaymentReceiptDocument({ data, targetPaymentId }: PaymentReceiptDocumentProps) {
  const { company, order, client, equipment, guide, installments = [], payments = [], target_payment, meta } = data;

  // Find target payment from target_payment property or targetPaymentId or first payment in list
  const activePayment = target_payment ||
    (targetPaymentId ? payments.find((p: any) => p.id === targetPaymentId) : null) ||
    payments[0];

  if (!activePayment) {
    return (
      <div className="text-gray-900 leading-snug text-xs p-4 text-center">
        <CompanyHeader company={company} documentTitle="Comprovante de Pagamento" osCode={order?.code} />
        <div className="p-8 bg-gray-50 border border-gray-200 rounded my-4 text-gray-500 italic">
          Nenhum pagamento registrado para emissão deste recibo.
        </div>
      </div>
    );
  }

  // Find corresponding installment if installment_id is set
  const relatedInstallment = activePayment.installment_id
    ? installments.find((i: any) => i.id === activePayment.installment_id)
    : null;

  return (
    <div className="text-gray-900 leading-snug text-xs">
      <CompanyHeader
        company={company}
        documentTitle={`Recibo de Pagamento #PAG-${activePayment.id}`}
        osCode={order?.code}
        statusName={order?.status_name}
      />

      {/* Payment Highlight Banner */}
      <div className="bg-emerald-50 border border-emerald-300 rounded p-4 mb-4 text-center document-section">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
          Comprovante de Quitação Parcial / Total
        </span>
        <div className="text-2xl font-black text-emerald-900">
          {formatCurrency(activePayment.amount)}
        </div>
        <p className="text-[11px] font-semibold text-emerald-800 mt-1">
          Pago em: {formatDatePtBr(activePayment.payment_date)} via <span className="uppercase">{activePayment.method_name || "Geral"}</span>
        </p>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 document-section">
        {/* Client */}
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Pagador / Cliente
          </h3>
          <p className="font-bold text-[11px]">{client?.name}</p>
          <p className="text-[10px] text-gray-600">CPF/CNPJ: {client?.cpf_cnpj || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">Tel: {client?.phone || client?.whatsapp || "Não informado"}</p>
        </div>

        {/* OS & Guide Reference */}
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Referência da OS & Equipamento
          </h3>
          <p className="font-bold text-[11px]">OS #{order?.code} &bull; Guia #{guide?.code || guide?.id || "N/A"}</p>
          <p className="text-[10px] text-gray-600">Equipamento: {equipment?.brand} {equipment?.model}</p>
          {relatedInstallment && (
            <p className="text-[10px] text-indigo-900 font-semibold mt-0.5">
              Ref. Parcela: {relatedInstallment.installment_number}ª Parcela (Venc: {formatDatePtBr(relatedInstallment.due_date)})
            </p>
          )}
        </div>
      </div>

      {/* Payment Meta Info */}
      <div className="border border-gray-200 rounded p-2.5 mb-3 bg-white space-y-1 text-[11px] document-section">
        <div className="flex justify-between border-b border-gray-100 pb-1">
          <span className="text-gray-600">Identificador Único do Pagamento:</span>
          <span className="font-mono font-bold text-gray-900">#PAG-{activePayment.id}</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 pb-1">
          <span className="text-gray-600">Data e Hora do Registro do Pagamento:</span>
          <span className="font-semibold text-gray-800">{formatDateTimePtBr(activePayment.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Forma de Pagamento Utilizada:</span>
          <span className="font-bold text-gray-900 uppercase">{activePayment.method_name || "Não especificada"}</span>
        </div>
      </div>

      {activePayment.notes && (
        <div className="border border-gray-200 rounded p-2.5 mb-3 bg-white document-section">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Observações do Pagamento
          </h3>
          <p className="text-[10px] text-gray-800 whitespace-pre-wrap">{activePayment.notes}</p>
        </div>
      )}

      {/* Guide Current Balance State */}
      {guide && (
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 mb-3 flex justify-between text-[11px] document-section">
          <div>
            <span className="text-gray-600 block text-[9px] uppercase">Total da Guia</span>
            <span className="font-bold">{formatCurrency(guide.total_amount)}</span>
          </div>
          <div>
            <span className="text-gray-600 block text-[9px] uppercase">Total Acumulado Pago</span>
            <span className="font-bold text-emerald-700">{formatCurrency(guide.paid_amount)}</span>
          </div>
          <div>
            <span className="text-gray-600 block text-[9px] uppercase">Saldo Devedor Atual</span>
            <span className="font-bold text-amber-900">{formatCurrency(guide.balance_amount)}</span>
          </div>
        </div>
      )}

      <div className="text-[9px] text-gray-500 flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
        <span>Documento emitido em: {formatDateTimePtBr(meta?.generated_at)}</span>
        <span>Documento emitido por: {meta?.generated_by || "Sistema"}</span>
      </div>

      <SignatureBlock
        client={client}
        technicianName={order?.technician_name}
        declarationText="Declaro que efetuei o pagamento acima descrito referente aos serviços prestados e/ou produtos fornecidos nesta Ordem de Serviço."
      />
    </div>
  );
}
