import React, { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseExcelFile } from "../utils/excel";
import { SAMPLE_BOOKS } from "../utils/sampleData";
import { BookRecord } from "../types";

interface FileUploaderProps {
  onDataLoaded: (records: BookRecord[], filename: string) => void;
  isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);
    try {
      const { records } = await parseExcelFile(file);
      onDataLoaded(records, file.name);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "Erro ao processar o ficheiro XLSX/CSV. Verifique o formato.");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileProcess(file);
    }
  };

  const handleLoadSample = () => {
    onDataLoaded(SAMPLE_BOOKS, "catalogo_exemplo.xlsx");
  };

  return (
    <div id="file-uploader-section" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Carregar Ficheiro XLSX / Folha de Cálculo
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Suporta ficheiros Excel (.xlsx, .xls) ou CSV com as colunas do seu catálogo bibliográfico.
          </p>
        </div>

        <button
          id="btn-load-sample"
          type="button"
          onClick={handleLoadSample}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Carregar Exemplo de Teste
        </button>
      </div>

      {/* Drag and Drop Zone */}
      <div
        id="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]"
            : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80 bg-slate-50/30"
        }`}
      >
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isLoading}
        />

        <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-3">
          <Upload className="w-7 h-7" />
        </div>

        <p className="text-base font-semibold text-slate-800 mb-1">
          Arraste e solte aqui o seu ficheiro XLSX ou clique para procurar
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
          Formatos suportados: .xlsx, .xls, .csv. O ficheiro original será preservado e a nova coluna com os links dos PDFs será adicionada.
        </p>

        {/* Expected columns pill list */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 pt-2 border-t border-slate-200/80 max-w-2xl mx-auto">
          <span className="text-xs font-semibold text-slate-600 mr-1">Colunas identificadas:</span>
          {["biblionumber", "title", "author", "isbn", "publicationyear", "itemcallnumber"].map(col => (
            <span
              key={col}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {col}
            </span>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-sm text-rose-700">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
