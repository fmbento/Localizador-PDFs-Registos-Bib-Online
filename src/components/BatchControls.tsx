import React, { useState } from "react";
import { Play, Pause, Download, Copy, Check, RefreshCw, Trash2, FileDown } from "lucide-react";
import { BatchStats, BookRecord } from "../types";
import { exportToExcel, exportToCsv, copyTableForGoogleSheets } from "../utils/excel";

interface BatchControlsProps {
  records: BookRecord[];
  stats: BatchStats;
  isProcessing: boolean;
  filename: string;
  onStartBatch: () => void;
  onPauseBatch: () => void;
  onReset: () => void;
  concurrency: number;
  setConcurrency: (c: number) => void;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  records,
  stats,
  isProcessing,
  filename,
  onStartBatch,
  onPauseBatch,
  onReset,
  concurrency,
  setConcurrency,
}) => {
  const [copied, setCopied] = useState(false);

  const handleExportExcel = () => {
    const outputName = filename.replace(/\.(xlsx|xls|csv)$/i, "") + "_com_links_pdf.xlsx";
    exportToExcel(records, undefined, outputName);
  };

  const handleExportCsv = () => {
    const outputName = filename.replace(/\.(xlsx|xls|csv)$/i, "") + "_com_links_pdf.csv";
    exportToCsv(records, outputName);
  };

  const handleCopyGoogleSheets = async () => {
    const tsv = copyTableForGoogleSheets(records);
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Falha ao copiar:", err);
    }
  };

  const pendingCount = stats.total - stats.completed;
  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div id="batch-controls" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Processing triggers */}
        <div className="flex flex-wrap items-center gap-3">
          {!isProcessing ? (
            <button
              id="btn-start-batch"
              type="button"
              onClick={onStartBatch}
              disabled={pendingCount === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-sm transition-all cursor-pointer ${
                pendingCount === 0
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:scale-98 shadow-indigo-200"
              }`}
            >
              <Play className="w-4 h-4 fill-white" />
              {stats.completed > 0 ? "Continuar Pesquisa" : "Iniciar Pesquisa Automática de PDFs"}
            </button>
          ) : (
            <button
              id="btn-pause-batch"
              type="button"
              onClick={onPauseBatch}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-amber-600 hover:bg-amber-700 transition-all cursor-pointer shadow-sm shadow-amber-200"
            >
              <Pause className="w-4 h-4" />
              Pausar Pesquisa
            </button>
          )}

          {/* Concurrency Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            <span>Velocidade:</span>
            <select
              id="select-concurrency"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isProcessing}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value={1}>1 livro por vez (Mais estável)</option>
              <option value={2}>2 em paralelo (Rápido)</option>
              <option value={3}>3 em paralelo (Ultra rápido)</option>
            </select>
          </div>

          <button
            id="btn-reset-batch"
            type="button"
            onClick={onReset}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Limpar catálogo carregado"
          >
            <Trash2 className="w-4 h-4 text-slate-400" />
            Limpar
          </button>
        </div>

        {/* Right: Export options */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-export-excel"
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
            title="Descarregar ficheiro XLSX com a nova coluna de links PDF"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Descarregar XLSX Atualizado
          </button>

          <button
            id="btn-copy-sheets"
            type="button"
            onClick={handleCopyGoogleSheets}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            title="Copiar dados tabulares para colar no Google Sheets"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copiar p/ Google Sheets</span>
              </>
            )}
          </button>

          <button
            id="btn-export-csv"
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            title="Descarregar ficheiro CSV"
          >
            <FileDown className="w-4 h-4 text-slate-400" />
            CSV
          </button>
        </div>
      </div>

      {/* Real-time Progress Bar */}
      {(isProcessing || stats.completed > 0) && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span className="flex items-center gap-2 font-medium">
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
              {isProcessing
                ? `A pesquisar textos integrais... (${stats.completed} de ${stats.total} concluídos)`
                : `Pesquisa concluída: ${stats.completed} de ${stats.total} verificados`}
            </span>
            <span className="font-semibold text-slate-700">{progressPercent}%</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                isProcessing ? "bg-gradient-to-r from-indigo-500 to-emerald-500" : "bg-emerald-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
