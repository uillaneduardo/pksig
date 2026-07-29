import React from "react";

interface PhotoGridProps {
  attachments: any[];
  title?: string;
  emptyMessage?: string;
  selectedIds?: number[];
}

export function PhotoGrid({ attachments = [], title = "Fotos do Atendimento", emptyMessage = "Nenhuma foto anexada.", selectedIds }: PhotoGridProps) {
  // Filter image attachments only
  let images = attachments.filter((att) => {
    const mime = (att.mime_type || "").toLowerCase();
    const name = (att.filename || "").toLowerCase();
    return mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(name);
  });

  if (selectedIds && selectedIds.length > 0) {
    images = images.filter(img => selectedIds.includes(img.id));
  }

  if (images.length === 0) {
    return (
      <div className="photo-section document-section mb-4">
        {title && <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-1 border-b border-gray-200 pb-1">{title}</h3>}
        <p className="text-[10px] text-gray-500 italic">{emptyMessage}</p>
      </div>
    );
  }

  // Group images into rows of max 2 photos
  const rows: any[][] = [];
  for (let i = 0; i < images.length; i += 2) {
    rows.push(images.slice(i, i + 2));
  }

  return (
    <div className="photo-section document-section mb-4">
      {title && <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2 border-b border-gray-200 pb-1">{title}</h3>}
      
      <div className="photo-list flex flex-col gap-3 print:gap-[7mm]">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="photo-row grid grid-cols-2 gap-3 print:gap-[7mm]">
            {row.map((img) => (
              <div key={img.id} className="photo-card border border-gray-300 rounded p-1.5 bg-white flex flex-col justify-between">
                <div className="flex items-center justify-center bg-gray-50 rounded overflow-hidden photo-img-container">
                  <img
                    src={img.view_url || `/api/attachments/${img.id}/view`}
                    alt={img.description || img.filename}
                    className="photo-img max-h-[140px] w-auto max-w-full object-contain"
                  />
                </div>
                {(img.description || img.category) && (
                  <div className="mt-1 text-[9px] text-gray-700 leading-tight">
                    {img.category && <span className="font-semibold text-gray-900 uppercase tracking-wider block text-[8px]">{img.category}</span>}
                    {img.description && <span className="text-gray-600">{img.description}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
