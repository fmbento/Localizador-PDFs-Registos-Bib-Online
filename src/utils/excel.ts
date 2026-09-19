import * as XLSX from "xlsx";
import { BookRecord } from "../types";

// Helper to normalize header keys
function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Find matching key from common variations
function findMatchingValue(row: Record<string, any>, possibleKeys: string[]): string {
  const rowKeys = Object.keys(row);
  for (const pKey of possibleKeys) {
    const normalizedTarget = normalizeKey(pKey);
    const foundKey = rowKeys.find(k => normalizeKey(k) === normalizedTarget);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return String(row[foundKey]).trim();
    }
  }
  return "";
}

export async function parseExcelFile(file: File): Promise<{ records: BookRecord[]; rawHeaders: string[] }> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  
  if (!workbook.SheetNames.length) {
    throw new Error("O ficheiro Excel não contém folhas de cálculo válidas.");
  }

  // Use the first worksheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Parse rows as raw objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("A folha de cálculo está vazia.");
  }

  const rawHeaders = Object.keys(rawRows[0] || {});

  const records: BookRecord[] = rawRows.map((row, index) => {
    const biblionumber = findMatchingValue(row, ["biblionumber", "biblio_number", "biblio", "id", "recordid", "numero"]);
    const title = findMatchingValue(row, ["title", "titulo", "título", "nome", "livro", "obra"]);
    const author = findMatchingValue(row, ["author", "autor", "autores", "autoria"]);
    const isbn = findMatchingValue(row, ["isbn", "isbn13", "isbn10", "issn"]);
    const publicationyear = findMatchingValue(row, ["publicationyear", "publication_year", "publication year", "year", "ano", "anodepublicacao", "data"]);
    const itemcallnumber = findMatchingValue(row, ["itemcallnumber", "item_callnumber", "item call number", "callnumber", "cota", "localizacao"]);

    // If PDF link column already exists in uploaded file, capture it
    const existingPdf = findMatchingValue(row, ["link_pdf", "pdf_url", "link direto pdf", "link pdf", "pdf", "link texto integral"]);

    return {
      id: `row-${index + 1}-${Date.now()}`,
      biblionumber: biblionumber || String(index + 1),
      title: title || "Sem título",
      author: author || "",
      isbn: isbn || "",
      publicationyear: publicationyear || "",
      itemcallnumber: itemcallnumber || "",
      pdfUrl: existingPdf || null,
      readerUrl: null,
      rawColumns: row,
      status: existingPdf ? "found" : "pending",
      isDirectPdf: Boolean(existingPdf && existingPdf.toLowerCase().includes(".pdf")),
    };
  });

  return { records, rawHeaders };
}

export function exportToExcel(records: BookRecord[], originalHeaders?: string[], filename = "catalogo_com_links_pdf.xlsx") {
  // Construct rows with all original columns plus the new PDF column
  const rows = records.map(record => {
    // Start with raw columns if preserved, else standard columns
    const rowObj: Record<string, any> = record.rawColumns ? { ...record.rawColumns } : {};

    // Ensure standard columns exist if not in rawColumns
    if (!rowObj.biblionumber) rowObj.biblionumber = record.biblionumber;
    if (!rowObj.title) rowObj.title = record.title;
    if (!rowObj.author) rowObj.author = record.author;
    if (!rowObj.isbn) rowObj.isbn = record.isbn;
    if (!rowObj.publicationyear) rowObj.publicationyear = record.publicationyear;
    if (!rowObj.itemcallnumber) rowObj.itemcallnumber = record.itemcallnumber;

    // Add the NEW requested column: direct link to PDF
    const directLink = record.pdfUrl || record.readerUrl || "";
    rowObj["link_pdf"] = directLink;
    rowObj["fonte_texto_integral"] = record.sourceName || (directLink ? "Online" : "");
    rowObj["estado_pesquisa"] = record.status === "found" ? "Encontrado" : record.status === "not_found" ? "Não Encontrado" : "Pendente";

    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for better aesthetics
  worksheet["!cols"] = [
    { wch: 14 }, // biblionumber
    { wch: 35 }, // title
    { wch: 25 }, // author
    { wch: 18 }, // isbn
    { wch: 16 }, // publicationyear
    { wch: 18 }, // itemcallnumber
    { wch: 45 }, // link_pdf
    { wch: 22 }, // fonte
    { wch: 16 }, // estado
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Catálogo com PDFs");

  XLSX.writeFile(workbook, filename);
}

export function exportToCsv(records: BookRecord[], filename = "catalogo_com_links_pdf.csv") {
  const rows = records.map(r => ({
    biblionumber: r.biblionumber,
    title: r.title,
    author: r.author,
    isbn: r.isbn,
    publicationyear: r.publicationyear,
    itemcallnumber: r.itemcallnumber,
    link_pdf: r.pdfUrl || r.readerUrl || "",
    fonte_texto_integral: r.sourceName || "",
    estado_pesquisa: r.status === "found" ? "Encontrado" : r.status === "not_found" ? "Não Encontrado" : "Pendente",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyTableForGoogleSheets(records: BookRecord[]): string {
  const headers = ["biblionumber", "title", "author", "isbn", "publicationyear", "itemcallnumber", "link_pdf", "fonte_texto_integral", "estado_pesquisa"];
  const lines = [headers.join("\t")];

  for (const r of records) {
    const row = [
      r.biblionumber,
      r.title.replace(/[\t\n\r]/g, " "),
      r.author.replace(/[\t\n\r]/g, " "),
      r.isbn,
      r.publicationyear,
      r.itemcallnumber,
      r.pdfUrl || r.readerUrl || "",
      r.sourceName || "",
      r.status === "found" ? "Encontrado" : r.status === "not_found" ? "Não Encontrado" : "Pendente",
    ];
    lines.push(row.join("\t"));
  }

  return lines.join("\n");
}
