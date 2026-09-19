import React from "react";
import { X, ExternalLink, Copy, Check, FileText } from "lucide-react";
import { BookRecord } from "../types";

interface PdfModalProps {
  record: BookRecord | null;
  onClose: () => void;
}

export const PdfModal: React.FC<PdfModalProps> = ({ record, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!record) return null;

  const directUrl = record.pdfUrl || record.readerUrl;
  if (!directUrl) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-slate-900 truncate">{record.title}</h3>
              <p className="text-xs text-slate-500 truncate">
                {record.author} • Cota: {record.itemcallnumber || "S/N"} • {record.sourceName || "Texto Integral"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : "Copiar Link"}
            </button>

            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir em Nova Aba
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content iframe */}
        <div className="flex-1 bg-slate-100 relative">
          <iframe
            src={directUrl}
            title={record.title}
            className="w-full h-full border-0"
          />
          {/* Helper notice at the bottom in case embedding is restricted */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white text-xs px-4 py-1.5 rounded-full backdrop-blur-sm pointer-events-none shadow-md">
            Nota: Se o documento não carregar no visor, utilize o botão "Abrir em Nova Aba".
          </div>
        </div>
      </div>
    </div>
  );
};
