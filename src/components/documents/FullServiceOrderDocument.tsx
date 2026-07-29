import React from "react";
import { CompanyHeader } from "./CompanyHeader";
import { SignatureBlock } from "./SignatureBlock";
import { PhotoGrid } from "./PhotoGrid";
import { formatCurrency, formatDatePtBr, formatDateTimePtBr } from "../../lib/documentUtils";

interface FullServiceOrderDocumentProps {
  data: any;
  selectedPhotoIds?: number[];
}

export function FullServiceOrderDocument({ data, selectedPhotoIds }: FullServiceOrderDocumentProps) {
  const {
    company,
    order,
    client,
    equipment,
    accessories = [],
    attachments = [],
    budget,
    guide,
    installments = [],
    payments = [],
    warranty,
    meta
  } = data;

  const budgetItems = budget?.items || [];

  return (
    <div className="text-gray-900 leading-snug text-xs space-y-3">
      {/* 1. Cabeçalho da Empresa */}
      <CompanyHeader
        company={company}
        documentTitle="Relatório Completo de Ordem de Serviço"
        osCode={order?.code}
        statusName={order?.status_name}
      />

      {/* 2. Identificação da OS */}
      <div className="grid grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded p-2 text-[11px] document-section">
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Código OS</span>
          <span className="font-bold text-gray-900">#{order?.code}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Data de Entrada</span>
          <span className="font-bold">{formatDateTimePtBr(order?.entry_date)}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Previsão Entrega</span>
          <span className="font-bold">{order?.promise_date ? formatDatePtBr(order.promise_date) : "Não informada"}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600 block text-[9px] uppercase">Conclusão</span>
          <span className="font-bold">{order?.completion_date ? formatDateTimePtBr(order.completion_date) : "Em andamento"}</span>
        </div>
      </div>

      {/* 3 & 4. Cliente & Equipamento */}
      <div className="grid grid-cols-2 gap-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Cliente
          </h3>
          <p className="font-bold text-[11px]">{client?.name}</p>
          <p className="text-[10px] text-gray-600">CPF/CNPJ: {client?.cpf_cnpj || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">Tel: {client?.phone || client?.whatsapp || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">
            {[client?.street, client?.number, client?.neighborhood, client?.city, client?.state].filter(Boolean).join(", ") || "Sem endereço"}
          </p>
        </div>

        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Equipamento
          </h3>
          <p className="font-bold text-[11px]">{equipment?.brand} {equipment?.model}</p>
          <p className="text-[10px] text-gray-600">Categoria: {equipment?.category_name}</p>
          <p className="text-[10px] text-gray-600">Nº Série: {equipment?.serial_number || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">IMEI: {equipment?.imei || "N/A"}</p>
        </div>
      </div>

      {/* 5. Abertura */}
      <div className="border border-gray-200 rounded p-2.5 bg-white document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
          Abertura / Problema Relatado
        </h3>
        <p className="text-[11px] text-gray-800">{order?.problem_reported || "Nenhum problema relatado."}</p>
      </div>

      {/* 6. Recepção */}
      <div className="grid grid-cols-2 gap-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Estado na Recepção
          </h3>
          <p className="text-[10px] text-gray-800">{order?.reception_equipment_state || "Estado físico normal."}</p>
        </div>
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Observações de Recepção
          </h3>
          <p className="text-[10px] text-gray-800">{order?.reception_notes || "Nenhuma observação."}</p>
        </div>
      </div>

      {/* 7. Acessórios */}
      <div className="border border-gray-200 rounded p-2.5 bg-white document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
          Acessórios
        </h3>
        {accessories && accessories.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {accessories.map((acc: string, idx: number) => (
              <span key={idx} className="bg-gray-100 text-gray-800 border border-gray-300 font-semibold px-2 py-0.5 rounded text-[10px]">
                {acc}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 italic">Nenhum acessório registrado.</p>
        )}
      </div>

      {/* 8. Fotos e Anexos */}
      <PhotoGrid
        attachments={attachments}
        title="8. Fotos de Entrada e Anexos"
        emptyMessage="Nenhum anexo registrado."
        selectedIds={selectedPhotoIds}
      />

      {/* 9. Análise Técnica */}
      <div className="border border-gray-200 rounded p-2.5 bg-white document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
          Análise Técnica
        </h3>
        {order?.technical_defect || order?.technical_diagnosis || order?.technical_service_recommended ? (
          <div className="space-y-1.5 text-[11px]">
            <p><span className="font-bold text-gray-900">Defeito Constatado:</span> {order.technical_defect || "Não informado"}</p>
            <p><span className="font-bold text-gray-900">Diagnóstico:</span> {order.technical_diagnosis || "Não informado"}</p>
            <p><span className="font-bold text-gray-900">Serviço Recomendado:</span> {order.technical_service_recommended || "Não informado"}</p>
            <p><span className="font-bold text-gray-900">Peças Necessárias:</span> {order.technical_parts_needed || "Nenhuma"}</p>
            <p><span className="font-bold text-gray-900">Técnico Responsável:</span> {order.technician_name || "Não informado"}</p>
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 italic">Análise técnica ainda não preenchida.</p>
        )}
      </div>

      {/* 11. Orçamento */}
      <div className="border border-gray-200 rounded bg-white overflow-hidden document-section">
        <div className="p-2 bg-gray-100 border-b border-gray-200 font-bold text-xs uppercase text-gray-800">
          Orçamento
        </div>
        {budgetItems.length > 0 ? (
          <div className="p-2 space-y-2">
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-gray-200 font-semibold uppercase text-gray-600">
                  <th className="py-1">Descrição</th>
                  <th className="py-1">Tipo</th>
                  <th className="py-1 text-right">Qtd</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgetItems.map((bi: any) => (
                  <tr key={bi.id}>
                    <td className="py-1 font-medium">{bi.description}</td>
                    <td className="py-1 text-gray-600 capitalize">{bi.type}</td>
                    <td className="py-1 text-right">{bi.quantity}</td>
                    <td className="py-1 text-right font-bold">{formatCurrency(bi.total_value || bi.unit_value * bi.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-bold text-xs border-t border-gray-200 pt-1 text-indigo-900">
              Total Orçamento: {formatCurrency(budget?.total_amount || 0)}
            </div>
          </div>
        ) : (
          <p className="p-2.5 text-[10px] text-gray-500 italic">Nenhum item de orçamento cadastrado.</p>
        )}
      </div>

      {/* 12, 13, 14. Guia Financeira, Parcelas e Pagamentos */}
      <div className="border border-gray-200 rounded bg-white p-2.5 document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
          Situação Financeira e Pagamentos
        </h3>
        {guide ? (
          <div className="space-y-2 text-[10px]">
            <div className="flex justify-between bg-gray-50 p-1.5 rounded font-semibold">
              <span>Guia #{guide.code}</span>
              <span>Total: {formatCurrency(guide.total_amount)}</span>
              <span className="text-emerald-700">Pago: {formatCurrency(guide.paid_amount)}</span>
              <span className="text-amber-900">Saldo: {formatCurrency(guide.balance_amount)}</span>
            </div>

            {installments.length > 0 && (
              <div>
                <span className="font-bold text-gray-700 block mb-0.5">Parcelas ({installments.length}):</span>
                <div className="grid grid-cols-3 gap-1">
                  {installments.map((inst: any) => (
                    <div key={inst.id} className="border border-gray-200 p-1 rounded bg-gray-50 flex justify-between">
                      <span>{inst.installment_number}ª {formatDatePtBr(inst.due_date)}</span>
                      <span className="font-bold">{formatCurrency(inst.amount)} ({inst.status})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {payments.length > 0 ? (
              <div>
                <span className="font-bold text-gray-700 block mb-0.5">Pagamentos Efetuados:</span>
                <div className="space-y-0.5">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-emerald-800 font-medium">
                      <span>#PAG-{p.id} ({formatDatePtBr(p.payment_date)}) - {p.method_name || "Geral"}</span>
                      <span className="font-bold">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 italic">Nenhum pagamento registrado.</p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 italic">Nenhuma guia financeira vinculada.</p>
        )}
      </div>

      {/* 15. Garantia */}
      <div className="border border-gray-200 rounded p-2.5 bg-white document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
          Garantia
        </h3>
        {warranty ? (
          <div className="text-[10px] space-y-0.5">
            <p><span className="font-bold">Termo Código:</span> {warranty.code}</p>
            <p><span className="font-bold">Período:</span> {formatDatePtBr(warranty.start_date)} até {formatDatePtBr(warranty.end_date)}</p>
            {warranty.rule_name && <p><span className="font-bold">Regra:</span> {warranty.rule_name}</p>}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 italic">Nenhuma garantia emitida.</p>
        )}
      </div>

      {/* 16. Conclusão */}
      <div className="border border-gray-200 rounded p-2.5 bg-white document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
          Conclusão da Ordem de Serviço
        </h3>
        <p className="text-[10px] text-gray-800">
          Status Atual: <span className="font-bold uppercase text-gray-900">{order?.status_name}</span> &bull; Data de Conclusão: {order?.completion_date ? formatDateTimePtBr(order.completion_date) : "Ainda em aberto"}
        </p>
      </div>

      {/* 19. Rodapé info */}
      <div className="text-[9px] text-gray-500 flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
        <span>Relatório completo emitido em: {formatDateTimePtBr(meta?.generated_at)}</span>
        <span>Emitido por: {meta?.generated_by || "Sistema"}</span>
      </div>

      {/* 17 & 18. Declaração e Assinaturas */}
      <SignatureBlock
        client={client}
        technicianName={order?.technician_name}
        declarationText="Declaro ter recebido as informações deste documento e estar ciente dos dados registrados nesta ordem de serviço."
      />
    </div>
  );
}
