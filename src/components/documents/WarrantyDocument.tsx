import React from "react";
import { CompanyHeader } from "./CompanyHeader";
import { SignatureBlock } from "./SignatureBlock";
import { formatDatePtBr, formatDateTimePtBr } from "../../lib/documentUtils";

interface WarrantyDocumentProps {
  data: any;
  targetWarrantyId?: number;
}

export function WarrantyDocument({ data, targetWarrantyId }: WarrantyDocumentProps) {
  const { company, order, client, equipment, warranty, target_warranty, meta } = data;

  const activeWarranty = target_warranty || warranty;

  if (!activeWarranty) {
    return (
      <div className="text-gray-900 leading-snug text-xs p-4 text-center">
        <CompanyHeader company={company} documentTitle="Termo de Garantia" osCode={order?.code} />
        <div className="p-8 bg-gray-50 border border-gray-200 rounded my-4 text-gray-500 italic">
          Nenhuma garantia emitida para esta Ordem de Serviço.
        </div>
      </div>
    );
  }

  const isExpired = activeWarranty.end_date && new Date(activeWarranty.end_date) < new Date();

  return (
    <div className="text-gray-900 leading-snug text-xs">
      <CompanyHeader
        company={company}
        documentTitle={`Termo de Garantia Nº ${activeWarranty.code}`}
        osCode={order?.code}
        statusName={order?.status_name}
      />

      {/* Warranty Validity Highlight Card */}
      <div className={`border rounded p-3 mb-3 document-section ${
        isExpired ? "bg-red-50 border-red-300" : "bg-emerald-50 border-emerald-300"
      }`}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-xs uppercase tracking-wide">
            Garantia de Assistência Técnica
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
            isExpired ? "bg-red-200 text-red-900" : "bg-emerald-200 text-emerald-900"
          }`}>
            {isExpired ? "Garantia Expirada" : "Garantia Vigente"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
          <div>
            <span className="text-[9px] font-semibold text-gray-600 block uppercase">Início da Garantia</span>
            <span className="font-bold">{formatDatePtBr(activeWarranty.start_date)}</span>
          </div>
          <div>
            <span className="text-[9px] font-semibold text-gray-600 block uppercase">Término da Garantia</span>
            <span className="font-bold">{formatDatePtBr(activeWarranty.end_date)}</span>
          </div>
          <div>
            <span className="text-[9px] font-semibold text-gray-600 block uppercase">Código de Validação</span>
            <span className="font-mono font-bold text-gray-900">{activeWarranty.code}</span>
          </div>
        </div>
      </div>

      {/* Client & Equipment Summary */}
      <div className="grid grid-cols-2 gap-3 mb-3 document-section">
        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Beneficiário / Cliente
          </h3>
          <p className="font-bold text-[11px]">{client?.name}</p>
          <p className="text-[10px] text-gray-600">CPF/CNPJ: {client?.cpf_cnpj || "Não informado"}</p>
          <p className="text-[10px] text-gray-600">Tel: {client?.phone || client?.whatsapp || "Não informado"}</p>
        </div>

        <div className="border border-gray-200 rounded p-2.5 bg-white">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-1">
            Objeto da Garantia (Equipamento)
          </h3>
          <p className="font-bold text-[11px]">{equipment?.brand} {equipment?.model}</p>
          <p className="text-[10px] text-gray-600">Nº Série: {equipment?.serial_number || "Não informado"} &bull; IMEI: {equipment?.imei || "N/A"}</p>
          <p className="text-[10px] text-gray-600">OS Origem: #{order?.code}</p>
        </div>
      </div>

      {/* Warranty Terms & Conditions */}
      <div className="border border-gray-200 rounded p-3 mb-3 bg-white space-y-2 document-section">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1">
          Termos e Condições Gerais de Garantia
        </h3>

        {activeWarranty.rule_name && (
          <p className="text-[11px] font-semibold text-gray-900">
            Regra Aplicada: <span className="text-indigo-900 font-bold">{activeWarranty.rule_name}</span> ({activeWarranty.duration_days || 90} dias)
          </p>
        )}

        <div className="text-[10px] text-gray-700 space-y-1.5 leading-relaxed">
          <p>
            1. Esta garantia cobre exclusivamente os serviços executados e peças substituídas descritos na Ordem de Serviço de origem durante o prazo de vigência acima especificado.
          </p>
          <p>
            2. A garantia perderá automaticamente a sua validade caso ocorra:
          </p>
          <ul className="list-disc list-inside pl-2 space-y-0.5 text-gray-600">
            <li>Rompimento ou violação do selo de garantia/lacre da assistência técnica;</li>
            <li>Danos causados por quedas, impactos, pressão mecânica, umidade ou derramamento de líquidos;</li>
            <li>Uso indevido, sobrecarga elétrica, picos de energia ou uso de carregadores incompatíveis;</li>
            <li>Intervenção ou tentativa de reparo por terceiros ou técnicos não autorizados.</li>
          </ul>
          {activeWarranty.terms_description && (
            <div className="bg-gray-50 border border-gray-200 p-2 rounded mt-2 text-gray-800">
              <span className="font-bold block text-[9px] uppercase text-gray-700">Observações Específicas do Termo:</span>
              <p className="whitespace-pre-wrap">{activeWarranty.terms_description}</p>
            </div>
          )}
        </div>
      </div>

      <div className="text-[9px] text-gray-500 flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
        <span>Termo de garantia emitido em: {formatDateTimePtBr(meta?.generated_at)}</span>
        <span>Emitido por: {meta?.generated_by || "Sistema"}</span>
      </div>

      <SignatureBlock
        client={client}
        technicianName={order?.technician_name}
        declarationText="Declaro ter recebido o equipamento reparado e testado em perfeitas condições de uso, estando de acordo com os termos da garantia aqui estipulados."
      />
    </div>
  );
}
