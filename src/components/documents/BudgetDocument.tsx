import React from "react";
import { CompanyHeader } from "./CompanyHeader";
import { SignatureBlock } from "./SignatureBlock";
import { formatCurrency, formatDateTimePtBr } from "../../lib/documentUtils";

interface BudgetDocumentProps {
  data: any;
}

export function BudgetDocument({ data }: BudgetDocumentProps) {
  const { company, order, client, equipment, budget, meta } = data;
  const items = budget?.items || [];

  return (
    <div className="text-gray-900 leading-snug text-xs">
      <CompanyHeader
        company={company}
        documentTitle="Orçamento de Serviço"
        osCode={order?.code}
        statusName={order?.status_name}
      />

      {/* Client & Equipment Summary */}
      <div className="grid grid-cols-2 gap-3 mb-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Cliente
          </h3>
          <p className="font-bold text-[11px]">{client?.name}</p>
          <p className="text-[10px] text-gray-600">CPF/CNPJ: {client?.cpf_cnpj || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">Tel/WhatsApp: {client?.whatsapp || client?.phone || "Não informado"}</p>
        </div>

        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Equipamento
          </h3>
          <p className="font-bold text-[11px]">{equipment?.brand} {equipment?.model}</p>
          <p className="text-[10px] text-gray-600">Nº Série: {equipment?.serial_number || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">Defeito: {order?.problem_reported || "Não detalhado"}</p>
        </div>
      </div>

      {/* Budget Items Table */}
      <div className="border border-gray-200 rounded mb-3 bg-white overflow-hidden document-section">
        <div className="p-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Itens do Orçamento</h3>
          <span className="text-[10px] text-gray-600 font-medium">{items.length} item(ns)</span>
        </div>

        {items.length > 0 ? (
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold uppercase text-[9px] tracking-wider">
                <th className="py-1.5 px-3">Item / Descrição</th>
                <th className="py-1.5 px-2 text-center">Tipo</th>
                <th className="py-1.5 px-2 text-right">Qtd</th>
                <th className="py-1.5 px-2 text-right">Valor Unit.</th>
                <th className="py-1.5 px-3 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item: any, idx: number) => {
                const qty = parseFloat(item.quantity) || 1;
                const unit = parseFloat(item.unit_value) || 0;
                const total = parseFloat(item.total_value) || (qty * unit);
                return (
                  <tr key={item.id || idx} className="hover:bg-gray-50">
                    <td className="py-1.5 px-3 font-medium text-gray-900">{item.description}</td>
                    <td className="py-1.5 px-2 text-center text-[10px] text-gray-600 capitalize">
                      {item.type === "servico" ? "Serviço" : item.type === "peca" ? "Peça" : item.type === "mao_de_obra" ? "Mão de obra" : item.type}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700">{qty}</td>
                    <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrency(unit)}</td>
                    <td className="py-1.5 px-3 text-right font-bold text-gray-900">{formatCurrency(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-center text-[11px] text-gray-500 italic">
            Nenhum item de orçamento cadastrado para esta OS.
          </p>
        )}
      </div>

      {/* Subtotals & Totals Card */}
      <div className="flex justify-end mb-4 document-section break-inside-avoid">
        <div className="w-64 border border-gray-300 rounded bg-gray-50 p-3 space-y-1.5 text-[11px]">
          <div className="flex justify-between text-gray-700">
            <span>Subtotal de Serviços:</span>
            <span className="font-semibold">{formatCurrency(budget?.subtotal_services || 0)}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Subtotal de Peças:</span>
            <span className="font-semibold">{formatCurrency(budget?.subtotal_parts || 0)}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Subtotal Mão de Obra:</span>
            <span className="font-semibold">{formatCurrency(budget?.subtotal_labor || 0)}</span>
          </div>
          <div className="border-t border-gray-300 pt-1.5 flex justify-between text-xs font-bold text-gray-900">
            <span>TOTAL GERAL:</span>
            <span className="text-sm text-indigo-900">{formatCurrency(budget?.total_amount || 0)}</span>
          </div>
        </div>
      </div>

      <div className="text-[9px] text-gray-500 flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
        <span>Orçamento gerado em: {formatDateTimePtBr(meta?.generated_at)}</span>
        <span>Emitido por: {meta?.generated_by || "Sistema"}</span>
      </div>

      <SignatureBlock
        client={client}
        technicianName={order?.technician_name}
        declarationText="Declaro estar ciente dos serviços, peças, valores e condições apresentados neste orçamento."
      />
    </div>
  );
}
