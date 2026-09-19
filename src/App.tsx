import React, { useState, useRef, useEffect } from "react";
import { Header } from "./components/Header";
import { FileUploader } from "./components/FileUploader";
import { BatchControls } from "./components/BatchControls";
import { BookTable } from "./components/BookTable";
import { PdfModal } from "./components/PdfModal";
import { BookRecord, BatchStats } from "./types";
import { SAMPLE_BOOKS } from "./utils/sampleData";

export default function App() {
  const [records, setRecords] = useState<BookRecord[]>(SAMPLE_BOOKS);
  const [filename, setFilename] = useState<string>("catalogo_exemplo.xlsx");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [previewRecord, setPreviewRecord] = useState<BookRecord | null>(null);
  const [quotaNoticeVisible, setQuotaNoticeVisible] = useState<boolean>(false);

  // Cancellation and pause ref for batch loop
  const stopBatchRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);

  // Calculate live stats
  const stats: BatchStats = {
    total: records.length,
    completed: records.filter(r => r.status === "found" || r.status === "not_found" || r.status === "error").length,
    found: records.filter(r => r.status === "found" || Boolean(r.pdfUrl || r.readerUrl)).length,
    notFound: records.filter(r => r.status === "not_found").length,
    errors: records.filter(r => r.status === "error").length,
    inProgress: isProcessing,
  };

  const handleDataLoaded = (newRecords: BookRecord[], name: string) => {
    // If currently processing, stop
    stopBatchRef.current = true;
    setIsProcessing(false);
    isProcessingRef.current = false;
    setRecords(newRecords);
    setFilename(name);
  };

  // Perform single book search API call
  const executeSearch = async (record: BookRecord): Promise<Partial<BookRecord>> => {
    try {
      const res = await fetch("/api/search-book-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biblionumber: record.biblionumber,
          title: record.title,
          author: record.author,
          isbn: record.isbn,
          publicationyear: record.publicationyear,
          itemcallnumber: record.itemcallnumber,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.quotaExceeded) {
        setQuotaNoticeVisible(true);
      }

      return {
        pdfUrl: data.pdfUrl || null,
        readerUrl: data.readerUrl || null,
        sourceName: data.sourceName || "",
        databaseSource: data.databaseSource || "other",
        confidence: data.confidence || "none",
        notes: data.notes || "",
        verified: data.verified,
        verifiedMetadata: data.verifiedMetadata,
        quotaExceeded: data.quotaExceeded,
        isDirectPdf: data.isDirectPdf,
        webSources: data.webSources || [],
        status: data.found ? "found" : "not_found",
      };
    } catch (err: any) {
      console.error("Search failed for record:", record.title, err);
      return {
        status: "error",
        errorMessage: err?.message || "Erro de conexão",
        notes: `Erro: ${err?.message || "Não foi possível pesquisar"}`,
      };
    }
  };

  // Search a single record from table
  const handleSearchSingle = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (!record) return;

    // Set row state to searching
    setRecords(prev =>
      prev.map(r => (r.id === id ? { ...r, status: "searching" as const } : r))
    );

    const result = await executeSearch(record);

    setRecords(prev =>
      prev.map(r => (r.id === id ? { ...r, ...result } : r))
    );
  };

  // Update a record's URL manually
  const handleUpdateRecordUrl = (id: string, newUrl: string) => {
    setRecords(prev =>
      prev.map(r => {
        if (r.id === id) {
          const trimmed = newUrl.trim();
          const hasUrl = trimmed.length > 0;
          return {
            ...r,
            pdfUrl: hasUrl ? trimmed : null,
            status: hasUrl ? "found" : "not_found",
            isDirectPdf: trimmed.toLowerCase().split("?")[0].endsWith(".pdf"),
            verified: hasUrl,
          };
        }
        return r;
      })
    );
  };

  // Batch search loop with concurrency
  const handleStartBatch = async () => {
    if (isProcessingRef.current) return;

    stopBatchRef.current = false;
    setIsProcessing(true);
    isProcessingRef.current = true;

    // Get all pending records
    const pendingIds = records.filter(r => r.status === "pending").map(r => r.id);
    if (pendingIds.length === 0) {
      setIsProcessing(false);
      isProcessingRef.current = false;
      return;
    }

    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < pendingIds.length && !stopBatchRef.current) {
        const id = pendingIds[currentIndex++];
        if (!id) break;

        // Current snapshot of record
        const record = records.find(r => r.id === id);
        if (!record) continue;

        // Update state to searching
        setRecords(prev =>
          prev.map(r => (r.id === id ? { ...r, status: "searching" as const } : r))
        );

        const result = await executeSearch(record);

        setRecords(prev =>
          prev.map(r => (r.id === id ? { ...r, ...result } : r))
        );

        // Small breather between calls to be gentle with rate limits
        await new Promise(res => setTimeout(res, 400));
      }
    };

    // Run parallel workers based on concurrency setting
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    setIsProcessing(false);
    isProcessingRef.current = false;
  };

  const handlePauseBatch = () => {
    stopBatchRef.current = true;
    setIsProcessing(false);
    isProcessingRef.current = false;
  };

  const handleReset = () => {
    stopBatchRef.current = true;
    setIsProcessing(false);
    isProcessingRef.current = false;
    setRecords([]);
    setFilename("catalogo.xlsx");
  };

  // Sync ref when unmounting
  useEffect(() => {
    return () => {
      stopBatchRef.current = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header stats={stats} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Upload Zone */}
        <FileUploader onDataLoaded={handleDataLoaded} isLoading={isProcessing} />

        {/* Informative Gemini API Quota Banner */}
        {quotaNoticeVisible && (
          <div
            id="quota-notice-banner"
            className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                <strong>Aviso de Quota da API Gemini (429):</strong> O limite temporário da quota web foi atingido. A aplicação continua a pesquisar com sucesso os textos integrais diretamente através do <strong>Internet Archive</strong>, <strong>ERIC</strong>, <strong>RCAAP / b-on</strong>, <strong>SciELO / OpenAlex</strong> e <strong>Google Books</strong>.
              </span>
            </div>
            <button
              id="btn-close-quota-banner"
              type="button"
              onClick={() => setQuotaNoticeVisible(false)}
              className="text-amber-800 hover:text-amber-950 text-xs font-semibold px-2 py-1 rounded hover:bg-amber-100 transition-colors ml-4 shrink-0"
            >
              Dispensar
            </button>
          </div>
        )}

        {/* Batch Operations and Export Toolbar */}
        {records.length > 0 && (
          <BatchControls
            records={records}
            stats={stats}
            isProcessing={isProcessing}
            filename={filename}
            onStartBatch={handleStartBatch}
            onPauseBatch={handlePauseBatch}
            onReset={handleReset}
            concurrency={concurrency}
            setConcurrency={setConcurrency}
          />
        )}

        {/* Interactive Book Table with PDF links */}
        {records.length > 0 ? (
          <BookTable
            records={records}
            onSearchSingle={handleSearchSingle}
            onUpdateRecordUrl={handleUpdateRecordUrl}
            onPreviewPdf={(rec) => setPreviewRecord(rec)}
            isProcessing={isProcessing}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
            Carregue um ficheiro XLSX ou clique em "Carregar Exemplo de Teste" para começar a pesquisar textos integrais em PDF.
          </div>
        )}
      </main>

      {/* In-app PDF Viewer Modal */}
      <PdfModal record={previewRecord} onClose={() => setPreviewRecord(null)} />
    </div>
  );
}
