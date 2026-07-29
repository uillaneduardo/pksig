import React from "react";

interface CompanyHeaderProps {
  company: any;
  documentTitle: string;
  osCode: string;
  statusName?: string;
}

export function CompanyHeader({ company, documentTitle, osCode, statusName }: CompanyHeaderProps) {
  return (
    <div className="border-b-2 border-gray-800 pb-3 mb-4 document-section">
      <div className="flex justify-between items-start gap-4">
        {/* Left: Logo & Company Details */}
        <div className="flex items-start gap-3">
          {company?.logo_path && (
            <img
              src={company.logo_path}
              alt="Logo"
              className="h-12 w-auto object-contain max-w-[120px]"
            />
          )}
          <div>
            <h1 className="text-base font-bold text-gray-900 uppercase tracking-tight">
              {company?.trade_name || company?.company_name || "PK SIG Assistência Técnica"}
            </h1>
            {company?.trade_name && company?.company_name && (
              <p className="text-[11px] font-semibold text-gray-700">{company.company_name}</p>
            )}
            <div className="text-[10px] text-gray-600 space-y-0.5 leading-tight mt-0.5">
              {company?.tax_id && <span>CNPJ/CPF: {company.tax_id} &bull; </span>}
              {company?.phone && <span>Tel: {company.phone} </span>}
              {company?.whatsapp && <span>&bull; WhatsApp: {company.whatsapp} </span>}
              {company?.email && <div>E-mail: {company.email}</div>}
              {company?.address_text && <div>{company.address_text}</div>}
            </div>
          </div>
        </div>

        {/* Right: Document Title & OS Number */}
        <div className="text-right">
          <div className="inline-block bg-gray-900 text-white font-bold px-3 py-1 rounded text-xs uppercase tracking-wider mb-1 no-print-bg">
            OS #{osCode}
          </div>
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide">{documentTitle}</h2>
          {statusName && (
            <p className="text-[10px] font-medium text-gray-600 mt-0.5">
              Situação: <span className="font-semibold text-gray-900">{statusName}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
