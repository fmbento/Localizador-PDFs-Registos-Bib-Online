import React, { useState } from "react";
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Edit2,
  Save,
  X,
  FileCheck,
  AlertCircle,
  Clock,
  Eye,
  RefreshCw,
  Info
} from "lucide-react";
import { BookRecord } from "../types";

interface BookTableProps {
  records: BookRecord[];
  onSearchSingle: (id: string) => Promise<void>;
  onUpdateRecordUrl: (id: string, newUrl: string) => void;
  onPreviewPdf: (record: BookRecord) => void;
  isProcessing: boolean;
}

export const BookTable: React.FC<BookTableProps> = ({
  records,
  onSearchSingle,
  onUpdateRecordUrl,
  onPreviewPdf,
  isProcessing,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "with_pdf" | "eric" | "bon_rcaap" | "scopus_oa" | "archive_org" | "pending" | "without_pdf">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Counts by source
  const ericCount = records.filter(r => (r.pdfUrl || r.readerUrl) && (r.databaseSource === "eric" || r.sourceName?.toLowerCase().includes("eric"))).length;
  const bonCount = records.filter(r => (r.pdfUrl || r.readerUrl) && (r.databaseSource === "bon_rcaap" || r.sourceName?.toLowerCase().includes("rcaap") || r.sourceName?.toLowerCase().includes("b-on"))).length;
  const scopusCount = records.filter(r => (r.pdfUrl || r.readerUrl) && (r.databaseSource === "scopus_oa" || r.sourceName?.toLowerCase().includes("scopus") || r.sourceName?.toLowerCase().includes("doi"))).length;

  // Filter logic
  const filteredRecords = records.filter(record => {
    const matchesSearch =
      record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.isbn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.biblionumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.itemcallnumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.sourceName && record.sourceName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.pdfUrl && record.pdfUrl.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === "with_pdf") return Boolean(record.pdfUrl || record.readerUrl);
    if (filterType === "eric") return (record.pdfUrl || record.readerUrl) && (record.databaseSource === "eric" || record.sourceName?.toLowerCase().includes("eric"));
    if (filterType === "bon_rcaap") return (record.pdfUrl || record.readerUrl) && (record.databaseSource === "bon_rcaap" || record.sourceName?.toLowerCase().includes("rcaap") || record.sourceName?.toLowerCase().includes("b-on"));
    if (filterType === "scopus_oa") return (record.pdfUrl || record.readerUrl) && (record.databaseSource === "scopus_oa" || record.sourceName?.toLowerCase().includes("scopus") || record.sourceName?.toLowerCase().includes("doi"));
    if (filterType === "without_pdf") return record.status === "not_found";
    if (filterType === "pending") return record.status === "pending";
    return true;
  });

  const renderDatabaseBadge = (record: BookRecord) => {
    if (!record.sourceName) return <span className="text-slate-400">-</span>;

    const src = (record.databaseSource || "").toLowerCase();
    const name = record.sourceName;
    const lower = name.toLowerCase();

    if (src === "eric" || lower.includes("eric")) {
      return (
        <span
          className="inline-flex items-center gap-1 font-semibold text-sky-800 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md text-[11px] max-w-[135px] truncate"
          title={name}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
          {name}
        </span>
      );
    }

    if (src === "bon_rcaap" || lower.includes("b-on") || lower.includes("rcaap")) {
      return (
        <span
          className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px] max-w-[135px] truncate"
          title={name}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          {name}
        </span>
      );
    }

    if (src === "scopus_oa" || lower.includes("scopus") || lower.includes("doi") || lower.includes("unpaywall")) {
      return (
        <span
          className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] max-w-[135px] truncate"
          title={name}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          {name}
        </span>
      );
    }

    if (src === "scielo" || lower.includes("scielo") || lower.includes("dialnet") || src === "openalex") {
      return (
        <span
          className="inline-flex items-center gap-1 font-semibold text-purple-800 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md text-[11px] max-w-[135px] truncate"
          title={name}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
          {name}
        </span>
      );
    }

    if (src === "archive_org" || lower.includes("archive")) {
      return (
        <span
          className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[11px] max-w-[135px] truncate"
          title={name}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
          {name}
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-md text-[11px] max-w-[135px] truncate"
        title={name}
      >
        {name}
      </span>
    );
  };

  const handleCopyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const startEditing = (record: BookRecord) => {
    setEditingId(record.id);
    setEditingUrl(record.pdfUrl || record.readerUrl || "");
  };

  const saveEditing = (id: string) => {
    onUpdateRecordUrl(id, editingUrl);
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingUrl("");
  };

  return (
    <div id="book-table-section" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Table Top Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-table-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por título, autor, cota, ISBN ou biblionumber..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterType === "all"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Todos ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("with_pdf")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterType === "with_pdf"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Com PDF ({records.filter(r => r.pdfUrl || r.readerUrl).length})
          </button>

          {ericCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType("eric")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === "eric"
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
              }`}
            >
              ERIC ({ericCount})
            </button>
          )}

          {bonCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType("bon_rcaap")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === "bon_rcaap"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              b-on / RCAAP ({bonCount})
            </button>
          )}

          {scopusCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType("scopus_oa")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === "scopus_oa"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              Scopus / OA ({scopusCount})
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterType("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterType === "pending"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Pendentes ({records.filter(r => r.status === "pending").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("without_pdf")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterType === "without_pdf"
                ? "bg-slate-700 text-white shadow-2xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Não Encontrados ({records.filter(r => r.status === "not_found").length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table id="catalog-table" className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <th className="py-3 px-3.5 text-center w-12">#</th>
              <th className="py-3 px-3.5 w-24">Biblio Nº</th>
              <th className="py-3 px-4 min-w-[220px]">Título</th>
              <th className="py-3 px-4 min-w-[150px]">Autor</th>
              <th className="py-3 px-3 w-28">ISBN</th>
              <th className="py-3 px-3 w-16 text-center">Ano</th>
              <th className="py-3 px-3.5 w-28">Cota</th>
              <th className="py-3 px-4 min-w-[260px] bg-indigo-50/50 text-indigo-900 border-l border-r border-indigo-100">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Link Direto para o PDF (Nova Coluna)</span>
                </div>
              </th>
              <th className="py-3 px-3.5 w-32">Fonte / Notas</th>
              <th className="py-3 px-3.5 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  Nenhum registo bibliográfico corresponde ao filtro selecionado.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record, index) => {
                const pdfLink = record.pdfUrl || record.readerUrl;
                const isSearching = record.status === "searching";
                const isFound = record.status === "found" || Boolean(pdfLink);
                const isNotFound = record.status === "not_found";

                return (
                  <React.Fragment key={record.id}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSearching ? "bg-indigo-50/30" : isFound ? "bg-emerald-50/15" : ""
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-3.5 text-center text-xs font-mono text-slate-400">
                        {index + 1}
                      </td>

                      {/* biblionumber */}
                      <td className="py-3 px-3.5 font-mono text-xs font-semibold text-slate-700">
                        {record.biblionumber || "-"}
                      </td>

                      {/* title */}
                      <td className="py-3 px-4 font-medium text-slate-900 leading-snug">
                        <div className="font-semibold text-slate-900">{record.title}</div>
                        {record.notes && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {record.notes}
                          </div>
                        )}
                      </td>

                      {/* author */}
                      <td className="py-3 px-4 text-slate-700 text-xs">
                        {record.author || <span className="text-slate-400 italic">Desconhecido</span>}
                      </td>

                      {/* isbn */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-600">
                        {record.isbn || "-"}
                      </td>

                      {/* publicationyear */}
                      <td className="py-3 px-3 text-center font-mono text-xs text-slate-600">
                        {record.publicationyear || "-"}
                      </td>

                      {/* itemcallnumber */}
                      <td className="py-3 px-3.5 font-mono text-xs text-slate-700 bg-slate-50/50 rounded-md">
                        {record.itemcallnumber || "-"}
                      </td>

                      {/* NEW COLUMN: Link direto para o PDF */}
                      <td className="py-3 px-4 bg-indigo-50/25 border-l border-r border-indigo-100">
                        {editingId === record.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="url"
                              value={editingUrl}
                              onChange={(e) => setEditingUrl(e.target.value)}
                              placeholder="https://.../livro.pdf"
                              className="w-full text-xs px-2 py-1 bg-white border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveEditing(record.id)}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                              title="Salvar link"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isSearching ? (
                          <div className="flex items-center gap-2 text-xs text-indigo-700 font-medium">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            <span>A pesquisar na web...</span>
                          </div>
                        ) : pdfLink ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <a
                                href={pdfLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline max-w-[190px] truncate"
                                title={pdfLink}
                              >
                                <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{pdfLink}</span>
                              </a>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(record.id, pdfLink)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60 cursor-pointer transition-colors"
                                  title="Copiar link"
                                >
                                  {copiedId === record.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditing(record)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60 cursor-pointer transition-colors"
                                  title="Editar link manualmente"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  record.isDirectPdf
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {record.isDirectPdf ? "PDF Direto (.pdf)" : "Repositório / Acesso Aberto"}
                              </span>
                              {record.verifiedMetadata && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  title="Título e Autor validados com rigor de catálogo"
                                >
                                  ✓ Autor &amp; Título Validados
                                </span>
                              )}
                              {record.verifiedMetadata?.isbn && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                                  title="ISBN rigorosamente confirmado"
                                >
                                  ✓ ISBN
                                </span>
                              )}
                              {record.verified && (
                                <span className="text-[10px] text-emerald-700 font-medium">✓ Acessível</span>
                              )}
                            </div>
                          </div>
                        ) : isNotFound ? (
                          <div className="flex items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 italic">
                              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                              Não encontrado online
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditing(record)}
                              className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                            >
                              Inserir manual
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              Pendente
                            </span>
                            <button
                              type="button"
                              onClick={() => onSearchSingle(record.id)}
                              disabled={isProcessing}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
                            >
                              Pesquisar agora
                            </button>
                          </div>
                        )}
                      </td>

                      {/* sourceName / Base de Dados / Repositório */}
                      <td className="py-3 px-3.5 text-xs text-slate-600">
                        {renderDatabaseBadge(record)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {pdfLink ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onPreviewPdf(record)}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                                title="Pré-visualizar PDF na aplicação"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <a
                                href={pdfLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Abrir link em nova aba"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSearchSingle(record.id)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="Pesquisar este livro com Gemini + Google Search"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Pesquisar
                            </button>
                          )}

                          {/* Toggle details info */}
                          {record.notes && (
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(expandedRowId === record.id ? null : record.id)}
                              className={`p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer ${
                                expandedRowId === record.id ? "text-indigo-600 bg-indigo-50" : ""
                              }`}
                              title="Ver detalhes da pesquisa"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row for detailed notes and citations */}
                    {expandedRowId === record.id && record.notes && (
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-xs">
                        <td colSpan={10} className="p-4">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-700 space-y-2">
                            <div className="font-semibold text-slate-900 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Relatório de Pesquisa &amp; Validação de Metadados:</span>
                              </div>
                              {record.verifiedMetadata && (
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className={record.verifiedMetadata.title ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                                    Título {record.verifiedMetadata.title ? "✓" : "✗"}
                                  </span>
                                  <span className={record.verifiedMetadata.author ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                                    Autor {record.verifiedMetadata.author ? "✓" : "✗"}
                                  </span>
                                  <span className={record.verifiedMetadata.year ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                                    Ano {record.verifiedMetadata.year ? "✓" : "✗"}
                                  </span>
                                  {record.isbn && (
                                    <span className={record.verifiedMetadata.isbn ? "text-emerald-700 font-semibold" : "text-amber-600"}>
                                      ISBN {record.verifiedMetadata.isbn ? "✓" : "—"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-slate-600">{record.notes}</p>
                            {record.webSources && record.webSources.length > 0 && (
                              <div className="pt-2 border-t border-slate-100">
                                <span className="font-semibold text-slate-700 mr-2">Fontes encontradas:</span>
                                <div className="inline-flex flex-wrap gap-2 mt-1">
                                  {record.webSources.map((s, idx) => (
                                    <a
                                      key={idx}
                                      href={s.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] underline"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      {s.title || s.uri}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div>
          Mostrando <span className="font-semibold text-slate-700">{filteredRecords.length}</span> de{" "}
          <span className="font-semibold text-slate-700">{records.length}</span> livros
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            PDF Encontrado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            Pendente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            Não Encontrado
          </span>
        </div>
      </div>
    </div>
  );
};
