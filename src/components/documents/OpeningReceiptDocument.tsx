import React from "react";
import { CompanyHeader } from "./CompanyHeader";
import { SignatureBlock } from "./SignatureBlock";
import { PhotoGrid } from "./PhotoGrid";
import { formatDatePtBr, formatDateTimePtBr } from "../../lib/documentUtils";

interface OpeningReceiptDocumentProps {
  data: any;
  selectedPhotoIds?: number[];
}

export function OpeningReceiptDocument({ data, selectedPhotoIds }: OpeningReceiptDocumentProps) {
  const { company, order, client, equipment, accessories = [], attachments = [], meta } = data;

  return (
    <div className="text-gray-900 leading-snug text-xs">
      {/* Company Header */}
      <CompanyHeader
        company={company}
        documentTitle="Comprovante de Abertura e Recepção"
        osCode={order?.code}
        statusName={order?.status_name}
      />

      {/* Dates & Status Summary */}
      <div className="grid grid-cols-3 gap-2 bg-gray-50 border border-gray-200 rounded p-2 mb-3 text-[11px] document-section">
        <div>
          <span className="font-semibold text-gray-700 block text-[9px] uppercase">Data de Entrada</span>
          <span className="font-bold">{formatDateTimePtBr(order?.entry_date)}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-700 block text-[9px] uppercase">Previsão de Entrega</span>
          <span className="font-bold">{order?.promise_date ? formatDatePtBr(order.promise_date) : "Não informada"}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-700 block text-[9px] uppercase">Técnico Responsável</span>
          <span className="font-bold">{order?.technician_name || "A definir"}</span>
        </div>
      </div>

      {/* Client & Equipment Side by Side */}
      <div className="grid grid-cols-2 gap-3 mb-3 document-section">
        {/* Client Box */}
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1.5">
            Dados do Cliente
          </h3>
          <div className="space-y-1 text-[11px]">
            <p><span className="font-bold">Nome:</span> {client?.name}</p>
            <p><span className="font-semibold">CPF/CNPJ:</span> {client?.cpf_cnpj || "Não informado"}</p>
            {client?.responsible && <p><span className="font-semibold">Responsável:</span> {client.responsible}</p>}
            <p><span className="font-semibold">Telefone:</span> {client?.phone || client?.whatsapp || "Não informado"}</p>
            <p><span className="font-semibold">E-mail:</span> {client?.email || "Não informado"}</p>
            <p>
              <span className="font-semibold">Endereço:</span>{" "}
              {[client?.street, client?.number, client?.neighborhood, client?.city, client?.state]
                .filter(Boolean)
                .join(", ") || "Não informado"}
            </p>
          </div>
        </div>

        {/* Equipment Box */}
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1.5">
            Dados do Equipamento
          </h3>
          <div className="space-y-1 text-[11px]">
            <p><span className="font-bold">Marca / Modelo:</span> {equipment?.brand} {equipment?.model}</p>
            <p><span className="font-semibold">Categoria:</span> {equipment?.category_name}</p>
            <p><span className="font-semibold">Nº de Série:</span> {equipment?.serial_number || "Não informado"}</p>
            {equipment?.imei && <p><span className="font-semibold">IMEI:</span> {equipment.imei}</p>}
            {equipment?.asset_tag && <p><span className="font-semibold">Patrimônio:</span> {equipment.asset_tag}</p>}
            {equipment?.color && <p><span className="font-semibold">Cor:</span> {equipment.color}</p>}
          </div>
        </div>
      </div>

      {/* Accessories */}
      <div className="border border-gray-200 rounded p-2.5 mb-3 bg-white document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
          Acessórios Recebidos
        </h3>
        {accessories && accessories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
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

      {/* Problem & Reception Details */}
      <div className="space-y-2 mb-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Defeito / Problema Relatado
          </h3>
          <p className="text-[11px] text-gray-800 whitespace-pre-wrap">{order?.problem_reported || "Nenhum problema relatado."}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded p-2.5 bg-white">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
              Estado Físico na Recepção
            </h3>
            <p className="text-[10px] text-gray-800 whitespace-pre-wrap">
              {order?.reception_equipment_state || "Estado físico normal no momento do recebimento."}
            </p>
          </div>

          <div className="border border-gray-200 rounded p-2.5 bg-white">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
              Observações da Recepção
            </h3>
            <p className="text-[10px] text-gray-800 whitespace-pre-wrap">
              {order?.reception_notes || "Nenhuma observação complementar."}
            </p>
          </div>
        </div>
      </div>

      {/* Reception Photos */}
      <PhotoGrid
        attachments={attachments}
        title="Fotos da Recepção e Entrada"
        emptyMessage="Nenhuma foto de entrada anexada nesta OS."
        selectedIds={selectedPhotoIds}
      />

      {/* Footer Info */}
      <div className="text-[9px] text-gray-500 flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
        <span>Documento gerado em: {formatDateTimePtBr(meta?.generated_at)}</span>
        <span>Emitido por: {meta?.generated_by || "Sistema"}</span>
      </div>

      {/* Signature Block */}
      <SignatureBlock
        client={client}
        technicianName={order?.technician_name}
        declarationText="Declaro que conferi os dados acima, os acessórios entregues e o estado informado do equipamento no momento da abertura desta ordem de serviço."
      />
    </div>
  );
}
