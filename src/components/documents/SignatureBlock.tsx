import React from "react";
import { getClientSignatureInfo } from "../../lib/documentUtils";

interface SignatureBlockProps {
  client: any;
  technicianName?: string;
  declarationText?: string;
}

export function SignatureBlock({ client, technicianName, declarationText }: SignatureBlockProps) {
  const clientInfo = getClientSignatureInfo(client);
  const techName = technicianName?.trim() || "";

  return (
    <div className="signature-block mt-6 pt-4 break-inside-avoid page-break-inside-avoid">
      {declarationText && (
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 mb-6 text-[10px] text-gray-700 leading-snug">
          <p className="font-semibold text-gray-900 mb-0.5">Declaração:</p>
          <p className="italic">“{declarationText}”</p>
        </div>
      )}

      <div className="signature-grid grid grid-cols-2 gap-8 text-center pt-2">
        {/* Client Signature */}
        <div className="flex flex-col items-center justify-end min-h-[70px]">
          <div className="w-full border-b border-gray-800 mb-1.5"></div>
          <p className="font-bold text-[11px] text-gray-900 uppercase tracking-tight">
            {clientInfo.name}
          </p>
          <p className="text-[10px] text-gray-600">{clientInfo.role}</p>
          <p className="text-[9px] text-gray-500 mt-1">Data: ____/____/________</p>
        </div>

        {/* Technician Signature */}
        <div className="flex flex-col items-center justify-end min-h-[70px]">
          <div className="w-full border-b border-gray-800 mb-1.5"></div>
          <p className="font-bold text-[11px] text-gray-900 uppercase tracking-tight">
            {techName || "TÉCNICO NÃO INFORMADO"}
          </p>
          <p className="text-[10px] text-gray-600">Técnico Responsável</p>
          <p className="text-[9px] text-gray-500 mt-1">Data: ____/____/________</p>
        </div>
      </div>
    </div>
  );
}
