import React from "react";
import { CompanyHeader } from "./CompanyHeader";
import { SignatureBlock } from "./SignatureBlock";
import { formatCurrency, formatDatePtBr, formatDateTimePtBr } from "../../lib/documentUtils";

interface FinancialGuideDocumentProps {
  data: any;
}

export function FinancialGuideDocument({ data }: FinancialGuideDocumentProps) {
  const { company, order, client, equipment, guide, installments = [], payments = [], meta } = data;

  if (!guide) {
    return (
      <div className="text-gray-900 leading-snug text-xs p-4 text-center">
        <CompanyHeader company={company} documentTitle="Guia Financeira" osCode={order?.code} />
        <div className="p-8 bg-gray-50 border border-gray-200 rounded my-4 text-gray-500 italic">
          Nenhuma guia financeira vinculada a esta Ordem de Serviço.
        </div>
      </div>
    );
  }

  const guideStatus = guide.status || "em_aberto";
  const guideStatusLabels: Record<string, string> = {
    em_aberto: "Em Aberto",
    parcial: "Parcialmente Paga",
    pago: "Quitada",
    cancelado: "Cancelada"
  };

  return (
    <div className="text-gray-900 leading-snug text-xs">
      <CompanyHeader
        company={company}
        documentTitle={`Guia Financeira Nº ${guide.code || guide.id}`}
        osCode={order?.code}
        statusName={order?.status_name}
      />

      {/* Guide Main Summary Cards */}
      <div className="grid grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded p-2.5 mb-3 text-[11px] document-section">
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Código da Guia</span>
          <span className="font-bold text-gray-900">{guide.code}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Data de Emissão</span>
          <span className="font-bold">{formatDatePtBr(guide.issue_date)}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Vencimento</span>
          <span className="font-bold text-red-700">{formatDatePtBr(guide.due_date)}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Situação</span>
          <span className="font-bold uppercase text-indigo-900">{guideStatusLabels[guideStatus] || guideStatus}</span>
        </div>
      </div>

      {/* Client & Equipment Summary */}
      <div className="grid grid-cols-2 gap-3 mb-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Cliente
          </h3>
          <p className="font-bold text-[11px]">{client?.name}</p>
          <p className="text-[10px] text-gray-600">CPF/CNPJ: {client?.cpf_cnpj || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">Tel: {client?.phone || client?.whatsapp || "Não informado"}</p>
        </div>

        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Equipamento / Serviços
          </h3>
          <p className="font-bold text-[11px]">{equipment?.brand} {equipment?.model}</p>
          <p className="text-[10px] text-gray-600">Forma Prevista: {guide.expected_method_name || "Não definida"}</p>
          <p className="text-[10px] text-gray-600">Parcelas: {guide.installments_count || 1}x</p>
        </div>
      </div>

      {/* Financial Totals Summary Box */}
      <div className="grid grid-cols-3 gap-3 mb-3 document-section">
        <div className="border border-gray-300 rounded bg-white p-2.5 text-center">
          <span className="text-[9px] font-bold text-gray-500 uppercase block">Valor Total</span>
          <span className="text-sm font-extrabold text-gray-900">{formatCurrency(guide.total_amount)}</span>
        </div>
        <div className="border border-emerald-300 rounded bg-emerald-50/50 p-2.5 text-center">
          <span className="text-[9px] font-bold text-emerald-700 uppercase block">Valor Pago</span>
          <span className="text-sm font-extrabold text-emerald-800">{formatCurrency(guide.paid_amount)}</span>
        </div>
        <div className="border border-amber-300 rounded bg-amber-50/50 p-2.5 text-center">
          <span className="text-[9px] font-bold text-amber-700 uppercase block">Saldo Restante</span>
          <span className="text-sm font-extrabold text-amber-900">{formatCurrency(guide.balance_amount)}</span>
        </div>
      </div>

      {/* Installments Table */}
      <div className="border border-gray-200 rounded mb-3 bg-white overflow-hidden document-section">
        <div className="p-2 bg-gray-100 border-b border-gray-200 font-bold text-xs uppercase tracking-wide text-gray-800">
          Detalhamento de Parcelas
        </div>
        {installments.length > 0 ? (
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold uppercase text-[9px] tracking-wider">
                <th className="py-1.5 px-3">Parcela</th>
                <th className="py-1.5 px-3">Vencimento</th>
                <th className="py-1.5 px-3 text-right">Valor Parcela</th>
                <th className="py-1.5 px-3 text-right">Valor Pago</th>
                <th className="py-1.5 px-3 text-center">Status</th>
                <th className="py-1.5 px-3 text-center">Data Pagto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {installments.map((inst: any) => (
                <tr key={inst.id} className="hover:bg-gray-50">
                  <td className="py-1.5 px-3 font-bold text-gray-900">{inst.installment_number}ª Parcela</td>
                  <td className="py-1.5 px-3 text-gray-700">{formatDatePtBr(inst.due_date)}</td>
                  <td className="py-1.5 px-3 text-right font-semibold text-gray-900">{formatCurrency(inst.amount)}</td>
                  <td className="py-1.5 px-3 text-right text-emerald-700 font-semibold">{formatCurrency(inst.paid_amount)}</td>
                  <td className="py-1.5 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      inst.status === "pago" ? "bg-emerald-100 text-emerald-800" : inst.status === "atrasado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {inst.status === "pago" ? "Pago" : inst.status === "atrasado" ? "Atrasado" : "Pendente"}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-center text-gray-600">{inst.paid_date ? formatDatePtBr(inst.paid_date) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-3 text-gray-500 italic text-[10px]">Nenhuma parcela gerada.</p>
        )}
      </div>

      {/* Actual Registered Payments Table */}
      {payments.length > 0 && (
        <div className="border border-gray-200 rounded mb-3 bg-white overflow-hidden document-section">
          <div className="p-2 bg-gray-100 border-b border-gray-200 font-bold text-xs uppercase tracking-wide text-gray-800">
            Histórico de Pagamentos Efetuados
          </div>
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold uppercase text-[9px]">
                <th className="py-1.5 px-3">ID / Recibo</th>
                <th className="py-1.5 px-3">Data do Pagamento</th>
                <th className="py-1.5 px-3">Forma de Pagamento</th>
                <th className="py-1.5 px-3 text-right">Valor Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="py-1.5 px-3 font-semibold text-gray-900">#PAG-{p.id}</td>
                  <td className="py-1.5 px-3 text-gray-700">{formatDatePtBr(p.payment_date)}</td>
                  <td className="py-1.5 px-3 text-gray-700">{p.method_name || "Geral"}</td>
                  <td className="py-1.5 px-3 text-right font-bold text-emerald-800">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {guide.notes && (
        <div className="border border-gray-200 rounded p-2.5 mb-3 bg-white document-section">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Observações Financeiras
          </h3>
          <p className="text-[10px] text-gray-700 whitespace-pre-wrap">{guide.notes}</p>
        </div>
      )}

      <div className="text-[9px] text-gray-500 flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
        <span>Guia gerada em: {formatDateTimePtBr(meta?.generated_at)}</span>
        <span>Emitido por: {meta?.generated_by || "Sistema"}</span>
      </div>

      <SignatureBlock
        client={client}
        technicianName={order?.technician_name}
        declarationText="Declaro estar ciente dos valores, prazos e condições financeiras descritos nesta guia."
      />
    </div>
  );
}
