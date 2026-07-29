import React from "react";
import { CompanyHeader } from "./CompanyHeader";
import { SignatureBlock } from "./SignatureBlock";
import { PhotoGrid } from "./PhotoGrid";
import { formatDatePtBr, formatDateTimePtBr } from "../../lib/documentUtils";

interface TechnicalReportDocumentProps {
  data: any;
  selectedPhotoIds?: number[];
}

export function TechnicalReportDocument({ data, selectedPhotoIds }: TechnicalReportDocumentProps) {
  const { company, order, client, equipment, attachments = [], meta } = data;

  return (
    <div className="text-gray-900 leading-snug text-xs">
      <CompanyHeader
        company={company}
        documentTitle="Relatório Técnico de Manutenção"
        osCode={order?.code}
        statusName={order?.status_name}
      />

      {/* OS Summary Header */}
      <div className="grid grid-cols-3 gap-2 bg-gray-50 border border-gray-200 rounded p-2 mb-3 text-[11px] document-section">
        <div>
          <span className="font-semibold text-gray-700 block text-[9px] uppercase">Data de Entrada</span>
          <span className="font-bold">{formatDateTimePtBr(order?.entry_date)}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-700 block text-[9px] uppercase">Data de Conclusão</span>
          <span className="font-bold">{order?.completion_date ? formatDateTimePtBr(order.completion_date) : "Em andamento / Não concluída"}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-700 block text-[9px] uppercase">Técnico Responsável</span>
          <span className="font-bold">{order?.technician_name || "Não informado"}</span>
        </div>
      </div>

      {/* Client & Equipment Summary */}
      <div className="grid grid-cols-2 gap-3 mb-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">Cliente</h3>
          <p className="font-bold text-[11px]">{client?.name}</p>
          <p className="text-[10px] text-gray-600">CPF/CNPJ: {client?.cpf_cnpj || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">Tel: {client?.phone || client?.whatsapp || "Não informado"}</p>
        </div>

        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">Equipamento</h3>
          <p className="font-bold text-[11px]">{equipment?.brand} {equipment?.model}</p>
          <p className="text-[10px] text-gray-600">Nº Série: {equipment?.serial_number || "Não informado"} &bull; IMEI: {equipment?.imei || "N/A"}</p>
          <p className="text-[10px] text-gray-600">Categoria: {equipment?.category_name}</p>
        </div>
      </div>

      {/* Problem & Diagnosis Details */}
      <div className="space-y-2.5 mb-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Problema Relatado
          </h3>
          <p className="text-[11px] text-gray-800">{order?.problem_reported || "Nenhum problema relatado."}</p>
        </div>

        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Defeito Constatado
          </h3>
          <p className="text-[11px] text-gray-800 whitespace-pre-wrap">{order?.technical_defect || "Defeito ainda não detalhado na análise."}</p>
        </div>

        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Diagnóstico Técnico
          </h3>
          <p className="text-[11px] text-gray-800 whitespace-pre-wrap">{order?.technical_diagnosis || "Diagnóstico pendente de conclusão."}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded p-2.5 bg-white">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
              Serviço Recomendado
            </h3>
            <p className="text-[10px] text-gray-800 whitespace-pre-wrap">{order?.technical_service_recommended || "Ainda não definido."}</p>
          </div>

          <div className="border border-gray-200 rounded p-2.5 bg-white">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
              Peças Necessárias
            </h3>
            <p className="text-[10px] text-gray-800 whitespace-pre-wrap">{order?.technical_parts_needed || "Nenhuma peça informada."}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded p-2.5 bg-white">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
              Tempo Estimado
            </h3>
            <p className="text-[11px] font-bold text-gray-900">{order?.technical_estimated_hours ? `${order.technical_estimated_hours} horas` : "Não estimado"}</p>
          </div>

          <div className="border border-gray-200 rounded p-2.5 bg-white">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
              Observações Técnicas Complementares
            </h3>
            <p className="text-[10px] text-gray-800 whitespace-pre-wrap">{order?.technical_notes || "Sem observações adicionais."}</p>
          </div>
        </div>
      </div>

      {/* Technical Photos */}
      <PhotoGrid
        attachments={attachments}
        title="Evidências Fotográficas Técnicas"
        emptyMessage="Nenhuma foto de laudo laudo técnico registrada."
        selectedIds={selectedPhotoIds}
      />

      {/* Footer metadata */}
      <div className="text-[9px] text-gray-500 flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
        <span>Laudo emitido em: {formatDateTimePtBr(meta?.generated_at)}</span>
        <span>Emitido por: {meta?.generated_by || "Sistema"}</span>
      </div>

      <SignatureBlock
        client={client}
        technicianName={order?.technician_name}
        declarationText="Declaro ter recebido e conferido as informações técnicas do laudo de manutenção constante neste documento."
      />
    </div>
  );
}
