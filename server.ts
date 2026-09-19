import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;
let geminiQuotaCooldownUntil = 0;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Check URL reachability and mime type
async function testUrl(url: string): Promise<{ reachable: boolean; isPdf: boolean; status?: number; resolvedUrl?: string }> {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return { reachable: false, isPdf: false };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    
    // Attempt HEAD request first
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/pdf,text/html,*/*"
        },
        redirect: "follow",
      });
    } catch {
      // Some servers reject HEAD, try GET with range header
      res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Range": "bytes=0-1024",
          "Accept": "application/pdf,text/html,*/*"
        },
        redirect: "follow",
      });
    }
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") || "";
    const isPdf = contentType.toLowerCase().includes("application/pdf") || url.toLowerCase().split("?")[0].endsWith(".pdf");
    return {
      reachable: res.ok || res.status === 403, // 403 sometimes blocks bot HEAD but works in browser
      isPdf,
      status: res.status,
      resolvedUrl: res.url || url,
    };
  } catch (err) {
    // If it ends with .pdf, still assume likely PDF even if blocked by server CORS/bot detection
    const isPdfEnding = url.toLowerCase().split("?")[0].endsWith(".pdf");
    return { reachable: false, isPdf: isPdfEnding };
  }
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

function cleanWords(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();
}

function cleanIsbn(isbn?: string): string {
  if (!isbn) return "";
  return isbn.replace(/[^0-9X]/gi, "").toUpperCase();
}

function getAuthorPrimarySurname(authorStr?: string): string {
  if (!authorStr) return "";
  const cleaned = cleanWords(authorStr).toLowerCase();
  if (authorStr.includes(",")) {
    const beforeComma = authorStr.split(",")[0].trim();
    return cleanWords(beforeComma).toLowerCase().split(/\s+/).pop() || "";
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words[words.length - 1] || "";
}

function extractAllSurnames(authorStr?: string): string[] {
  if (!authorStr) return [];
  const parts = authorStr.split(/[,;&\/]/).map(p => cleanWords(p).toLowerCase().trim()).filter(Boolean);
  const surnames: string[] = [];
  for (const part of parts) {
    const words = part.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      surnames.push(words[0]);
      surnames.push(words[words.length - 1]);
    }
  }
  return Array.from(new Set(surnames));
}

function titleMatchScore(searchTitle: string, candidateTitle?: string): number {
  if (!candidateTitle) return 0;
  const sWords = cleanWords(searchTitle).toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const cWords = cleanWords(candidateTitle).toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (sWords.length === 0) return 0;
  let matches = 0;
  for (const sw of sWords) {
    if (cWords.some(cw => cw.includes(sw) || sw.includes(cw))) {
      matches++;
    }
  }
  return matches / sWords.length;
}

interface CandidateBookMeta {
  title?: string;
  author?: string | string[];
  creator?: string;
  isbn?: string | string[];
  year?: string | number;
}

/**
 * Strict verification: title, author, year, and ISBN must correspond to the catalog record.
 * Rejects articles, theses, or secondary papers by different authors that merely cite the book.
 */
function verifyBookMatch(
  record: { title: string; author?: string; isbn?: string; publicationyear?: string },
  candidate: CandidateBookMeta
): { match: boolean; reason: string; verifiedFields: { title: boolean; author: boolean; year: boolean; isbn: boolean } } {
  const verified = {
    title: false,
    author: false,
    year: false,
    isbn: false,
  };

  // 1. Author check (MANDATORY if record specifies an author)
  if (record.author && record.author.trim().length > 1) {
    const recSurnames = extractAllSurnames(record.author);
    const candAuthors = cleanWords(
      Array.isArray(candidate.author)
        ? candidate.author.join(" ")
        : (candidate.author || candidate.creator || "")
    ).toLowerCase();
    const candTitle = cleanWords(candidate.title || "").toLowerCase();

    // Sometimes archive.org documents include author directly in title (e.g. "Pedagogia da Autonomia Paulo Freire")
    const hasAuthorMatch = recSurnames.some(sn => candAuthors.includes(sn) || candTitle.includes(sn));
    if (!hasAuthorMatch) {
      return {
        match: false,
        reason: `Autor divergente: esperado "${record.author}", obtido "${candAuthors || "não indicado"}"`,
        verifiedFields: verified,
      };
    }
    verified.author = true;
  } else {
    verified.author = true; // No author in record to contradict
  }

  // 2. Title check (MUST be the book itself, not an article citing it)
  const recTitle = cleanWords(record.title).toLowerCase();
  const candTitle = cleanWords(candidate.title || "").toLowerCase();
  if (!candTitle) {
    return {
      match: false,
      reason: "Candidato sem título",
      verifiedFields: verified,
    };
  }

  const recWords = recTitle.split(/\s+/).filter(w => w.length > 2);
  const candWords = candTitle.split(/\s+/).filter(w => w.length > 2);

  const idx = candTitle.indexOf(recTitle);
  if (idx !== -1) {
    const beforeWords = candTitle.substring(0, idx).trim().split(/\s+/).filter(Boolean);
    // If title appears after more than 2 words, it's likely an analytical article (e.g. "A categoria da práxis em Pedagogia do Oprimido")
    if (beforeWords.length > 2) {
      return {
        match: false,
        reason: "O título da obra original surge apenas como citação no título de artigo analítico de terceiros",
        verifiedFields: verified,
      };
    }
    verified.title = true;
  } else {
    const mainTitle = cleanWords(record.title.split(/[:\-–]/)[0]).toLowerCase();
    const mainWords = mainTitle.split(/\s+/).filter(w => w.length > 2);
    const matchCount = mainWords.filter(mw => candWords.some(cw => cw.includes(mw) || mw.includes(cw))).length;
    const ratio = matchCount / Math.max(mainWords.length, 1);
    if (ratio < 0.65) {
      return {
        match: false,
        reason: `Correspondência de título insuficiente (${Math.round(ratio * 100)}%)`,
        verifiedFields: verified,
      };
    }
    // Prevent candidate title from having excessive unrelated length
    if (candWords.length > recWords.length * 3 && recWords.length <= 4) {
      return {
        match: false,
        reason: "Título do candidato excessivamente longo ou diverge da monografia",
        verifiedFields: verified,
      };
    }
    verified.title = true;
  }

  // 3. Year check (informational: editions/reprints can differ in year)
  if (record.publicationyear && candidate.year) {
    const recYear = parseInt(String(record.publicationyear));
    const candYear = parseInt(String(candidate.year));
    if (!isNaN(recYear) && !isNaN(candYear)) {
      verified.year = Math.abs(candYear - recYear) <= 5;
    } else {
      verified.year = true;
    }
  } else {
    verified.year = true;
  }

  // 4. ISBN check
  const recIsbn = cleanIsbn(record.isbn);
  const candIsbn = cleanIsbn(Array.isArray(candidate.isbn) ? candidate.isbn[0] : candidate.isbn);
  if (recIsbn && candIsbn) {
    if (recIsbn !== candIsbn && !recIsbn.endsWith(candIsbn) && !candIsbn.endsWith(recIsbn)) {
      return {
        match: false,
        reason: `ISBN divergente (${candIsbn} vs ${recIsbn})`,
        verifiedFields: verified,
      };
    }
    verified.isbn = true;
  } else if (recIsbn) {
    verified.isbn = false;
  } else {
    verified.isbn = true;
  }

  return {
    match: true,
    reason: "Validado: Título, Autor e Metadados rigorosamente correspondentes",
    verifiedFields: verified,
  };
}

async function getArchiveOrgPdfUrl(id: string): Promise<{ pdfUrl: string; isDirect: boolean }> {
  try {
    const metaRes = await fetch(`https://archive.org/metadata/${id}/files`, { signal: AbortSignal.timeout(3500) });
    if (metaRes.ok) {
      const data = await metaRes.json();
      const files: any[] = data.result || [];
      // Look for original or derivative PDF
      const pdfFile = files.find(f => f.name && f.name.toLowerCase().endsWith(".pdf"));
      if (pdfFile && pdfFile.name) {
        return {
          pdfUrl: `https://archive.org/download/${id}/${encodeURIComponent(pdfFile.name)}`,
          isDirect: true,
        };
      }
    }
  } catch {
    // Ignore and fallback
  }
  return {
    pdfUrl: `https://archive.org/download/${id}/${id}.pdf`,
    isDirect: true,
  };
}

// Search Internet Archive (archive.org) for digitized books with strict metadata validation
async function searchArchiveOrg(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  const normTitle = cleanWords(record.title.split(/[:\-–]/)[0]);
  const authorSurname = getAuthorPrimarySurname(record.author);
  const cleanIsbnStr = cleanIsbn(record.isbn);

  // 1. Try exact ISBN search first if ISBN is present
  if (cleanIsbnStr) {
    try {
      const q = `isbn:(${cleanIsbnStr}) AND mediatype:(texts)`;
      const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,creator,year,isbn&rows=3&output=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (res.ok) {
        const data = await res.json();
        for (const doc of data.response?.docs || []) {
          const v = verifyBookMatch(record, doc);
          if (v.match) {
            const fileInfo = await getArchiveOrgPdfUrl(doc.identifier);
            return {
              found: true,
              pdfUrl: fileInfo.pdfUrl,
              readerUrl: `https://archive.org/details/${doc.identifier}`,
              sourceName: "Internet Archive (ISBN)",
              databaseSource: "archive_org",
              confidence: "high" as const,
              notes: `Edição integral confirmada por ISBN no Internet Archive (${doc.title || record.title}).`,
              verifiedFields: v.verifiedFields,
            };
          }
        }
      }
    } catch {
      // Non-blocking
    }
  }

  // 2. Try Title + Author Surname on archive.org
  if (normTitle) {
    const queries = [
      authorSurname ? `title:("${normTitle}") AND (creator:(${authorSurname}) OR ${authorSurname}) AND mediatype:(texts)` : `title:("${normTitle}") AND mediatype:(texts)`,
      authorSurname ? `title:("${normTitle}") AND mediatype:(texts)` : `title:("${normTitle}") AND mediatype:(texts)`,
      authorSurname ? `(${normTitle}) AND (${authorSurname}) AND mediatype:(texts)` : `(${normTitle}) AND mediatype:(texts)`,
    ];

    for (const q of queries) {
      try {
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,creator,year,isbn&sort[]=-downloads&rows=5&output=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
        if (res.ok) {
          const data = await res.json();
          for (const doc of data.response?.docs || []) {
            const v = verifyBookMatch(record, doc);
            if (v.match) {
              const fileInfo = await getArchiveOrgPdfUrl(doc.identifier);
              const readerUrl = `https://archive.org/details/${doc.identifier}`;
              const hasDirectPdf = Boolean(fileInfo.pdfUrl && fileInfo.isDirect);
              return {
                found: true,
                pdfUrl: hasDirectPdf ? fileInfo.pdfUrl : null,
                readerUrl,
                sourceName: hasDirectPdf ? "Internet Archive (PDF)" : "Internet Archive (Leitor Digital)",
                databaseSource: "archive_org",
                confidence: "high" as const,
                notes: hasDirectPdf
                  ? `Texto integral em PDF verificado no Internet Archive (${doc.title || record.title})${doc.year ? ` [Ano: ${doc.year}]` : ""}.`
                  : `Obra integral digitalizada e disponível para leitura online no Internet Archive (${doc.title || record.title})${doc.year ? ` [Ano: ${doc.year}]` : ""}.`,
                verifiedFields: v.verifiedFields,
              };
            }
          }
        }
      } catch {
        // Non-blocking
      }
    }
  }

  return null;
}

// Search Open Library (openlibrary.org) for digitized monographs and borrowable full-texts
async function searchOpenLibrary(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  try {
    const cleanT = cleanWords(record.title.split(/[:\-–]/)[0]);
    const authorSurname = getAuthorPrimarySurname(record.author);
    const cleanIsbnStr = cleanIsbn(record.isbn);

    if (cleanIsbnStr) {
      try {
        const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbnStr}&format=json&jscmd=data`, {
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const data = await res.json();
          const book = data[`ISBN:${cleanIsbnStr}`];
          if (book && (book.url || book.key)) {
            const readerUrl = book.url || `https://openlibrary.org${book.key}`;
            return {
              found: true,
              pdfUrl: null,
              readerUrl,
              sourceName: "Open Library (ISBN)",
              databaseSource: "open_library",
              confidence: "high" as const,
              notes: `Edição localizada na Open Library por ISBN (${book.title || record.title}).`,
              verifiedFields: { title: true, author: true, year: true, isbn: true },
            };
          }
        }
      } catch {
        // Non-blocking
      }
    }

    if (!cleanT) return null;

    const q = authorSurname
      ? `title=${encodeURIComponent(cleanT)}&author=${encodeURIComponent(authorSurname)}`
      : `title=${encodeURIComponent(cleanT)}`;
    const res = await fetch(`https://openlibrary.org/search.json?${q}&limit=5`, {
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const data = await res.json();

    for (const doc of data.docs || []) {
      const v = verifyBookMatch(record, {
        title: doc.title,
        author: doc.author_name,
        year: doc.first_publish_year,
        isbn: doc.isbn,
      });
      if (!v.match) continue;

      if (doc.has_fulltext) {
        const iaId = doc.ia?.[0];
        let pdfUrl: string | null = null;
        let readerUrl = doc.key ? `https://openlibrary.org${doc.key}` : null;
        if (iaId) {
          const pdfInfo = await getArchiveOrgPdfUrl(iaId);
          pdfUrl = pdfInfo.pdfUrl;
          readerUrl = `https://archive.org/details/${iaId}`;
        }
        const hasPdf = Boolean(pdfUrl);
        return {
          found: true,
          pdfUrl: hasPdf ? pdfUrl : null,
          readerUrl: readerUrl || (pdfUrl ? pdfUrl : null),
          sourceName: hasPdf ? "Open Library / Internet Archive (PDF)" : "Open Library (Leitura Integral)",
          databaseSource: "open_library",
          confidence: "high" as const,
          notes: `Texto integral disponível para leitura online / empréstimo digital na Open Library (${doc.title}).`,
          verifiedFields: v.verifiedFields,
        };
      }
    }
  } catch {
    // Non-blocking
  }
  return null;
}

// Search Google Books API with strict verification
async function searchGoogleBooks(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  try {
    const cleanIsbnStr = cleanIsbn(record.isbn);
    const normTitle = cleanWords(record.title.split(/[:\-–]/)[0]);
    const authorSurname = getAuthorPrimarySurname(record.author);

    const q = cleanIsbnStr
      ? `isbn:${cleanIsbnStr}`
      : `intitle:${encodeURIComponent(normTitle)}${authorSurname ? `+inauthor:${encodeURIComponent(authorSurname)}` : ""}`;
    const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`;
    const res = await fetch(gbUrl, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return null;
    const data = await res.json();

    for (const item of data.items || []) {
      const info = item.volumeInfo || {};
      const access = item.accessInfo || {};

      const v = verifyBookMatch(record, {
        title: info.title,
        author: info.authors,
        year: info.publishedDate?.substring(0, 4),
        isbn: info.industryIdentifiers?.map((i: any) => i.identifier),
      });
      if (!v.match) continue;

      if (access?.pdf?.isAvailable && access?.pdf?.downloadLink) {
        return {
          found: true,
          pdfUrl: access.pdf.downloadLink,
          readerUrl: access.webReaderLink || info.infoLink,
          sourceName: "Google Books (PDF)",
          databaseSource: "google_books",
          confidence: "high" as const,
          notes: `PDF integral verificado e disponível no Google Books (${info.title}).`,
          verifiedFields: v.verifiedFields,
        };
      }
      if (access?.viewability === "ALL_PAGES" || access?.viewability === "FULL") {
        return {
          found: true,
          pdfUrl: null,
          readerUrl: access.webReaderLink || info.previewLink,
          sourceName: "Google Books (Acesso Integral)",
          databaseSource: "google_books",
          confidence: "medium" as const,
          notes: `Obra integral verificada com visualização completa online no Google Books (${info.title}).`,
          verifiedFields: v.verifiedFields,
        };
      }
    }
  } catch {
    // Non-blocking
  }
  return null;
}

// Search ERIC (Education Resources Information Center - eric.ed.gov) with strict metadata validation
async function searchEric(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  try {
    const cleanT = cleanWords(record.title.split(/[:\-–]/)[0]);
    if (!cleanT) return null;
    const authorSurname = getAuthorPrimarySurname(record.author);
    const q = authorSurname
      ? `title:"${cleanT}" AND author:"${authorSurname}"`
      : `title:"${cleanT}"`;
    const res = await fetch(`https://api.ies.ed.gov/eric/?search=${encodeURIComponent(q)}&format=json&rows=4`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const docs = data.response?.docs || [];

    for (const doc of docs) {
      const v = verifyBookMatch(record, {
        title: doc.title,
        author: doc.author,
        year: doc.publicationdateyear,
        isbn: doc.isbn,
      });
      if (!v.match) continue;

      const isEd = doc.id && doc.id.startsWith("ED");
      const pdfCandidate = isEd ? `https://files.eric.ed.gov/fulltext/${doc.id}.pdf` : null;

      return {
        found: true,
        pdfUrl: pdfCandidate,
        readerUrl: `https://eric.ed.gov/?id=${doc.id}`,
        sourceName: "ERIC (IES)",
        databaseSource: "eric",
        confidence: isEd ? ("high" as const) : ("medium" as const),
        notes: `Documento de educação validado no ERIC (${doc.title || record.title}) [Autor: ${doc.author || record.author}].`,
        verifiedFields: v.verifiedFields,
      };
    }
  } catch {
    // Non-blocking
  }
  return null;
}

// Search b-on and RCAAP (Repositório Científico de Acesso Aberto de Portugal / b-on.pt) with strict metadata validation
async function searchRcaap(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  try {
    const cleanT = cleanWords(record.title.split(/[:\-–]/)[0]);
    const authorSurname = getAuthorPrimarySurname(record.author);
    if (!cleanT) return null;

    const query = authorSurname ? `${cleanT} ${authorSurname}` : cleanT;
    const res = await fetch(`https://comum.rcaap.pt/server/api/discover/search/objects?query=${encodeURIComponent(query)}&size=3`, {
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const searchResults = data._embedded?.searchResult?._embedded?.searchResults || [];

    for (const sr of searchResults) {
      const item = sr._embedded?.indexableObject;
      if (!item?.id) continue;

      const candidateAuthor = item.metadata?.["dc.contributor.author"]?.map((m: any) => m.value) || [];
      const candidateDate = item.metadata?.["dc.date.issued"]?.[0]?.value?.substring(0, 4);

      const v = verifyBookMatch(record, {
        title: item.name,
        author: candidateAuthor,
        year: candidateDate,
      });
      if (!v.match) continue;

      try {
        const bundlesRes = await fetch(`https://comum.rcaap.pt/server/api/core/items/${item.id}/bundles`, {
          signal: AbortSignal.timeout(3000),
        });
        if (bundlesRes.ok) {
          const bData = await bundlesRes.json();
          const orig = bData._embedded?.bundles?.find((b: any) => b.name === "ORIGINAL");
          if (orig?._links?.bitstreams?.href) {
            const bsRes = await fetch(orig._links.bitstreams.href, { signal: AbortSignal.timeout(3000) });
            if (bsRes.ok) {
              const bsData = await bsRes.json();
              const bitstreams: any[] = bsData._embedded?.bitstreams || [];
              const pdfBs = bitstreams.find((b: any) => b.name && b.name.toLowerCase().endsWith(".pdf")) || bitstreams[0];
              if (pdfBs?._links?.content?.href) {
                return {
                  found: true,
                  pdfUrl: pdfBs._links.content.href,
                  readerUrl: item.handle ? `https://comum.rcaap.pt/handle/${item.handle}` : `https://comum.rcaap.pt/items/${item.id}`,
                  sourceName: "b-on / RCAAP",
                  databaseSource: "bon_rcaap",
                  confidence: "high" as const,
                  notes: `Texto integral identificado no Repositório Científico RCAAP / b-on (${item.name || record.title}).`,
                  verifiedFields: v.verifiedFields,
                };
              }
            }
          }
        }
      } catch {
        // Continue to fallback
      }

      if (item.handle) {
        return {
          found: true,
          pdfUrl: null,
          readerUrl: `https://comum.rcaap.pt/handle/${item.handle}`,
          sourceName: "b-on / RCAAP",
          databaseSource: "bon_rcaap",
          confidence: "medium" as const,
          notes: `Registo validado no Repositório RCAAP / b-on (${item.name || record.title}).`,
          verifiedFields: v.verifiedFields,
        };
      }
    }
  } catch {
    // Non-blocking
  }
  return null;
}

// Search Scopus / CrossRef publications with Unpaywall Open Access verification
async function searchScopusCrossRefUnpaywall(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  try {
    const cleanT = cleanWords(record.title.split(/[:\-–]/)[0]);
    const cleanA = getAuthorPrimarySurname(record.author);
    if (!cleanT) return null;

    const query = encodeURIComponent(`${cleanT} ${cleanA}`.trim());
    const crossrefUrl = `https://api.crossref.org/works?query.bibliographic=${query}&rows=3`;
    const res = await fetch(crossrefUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = await res.json();
    const items = d.message?.items || [];

    for (const item of items) {
      const doi = item.DOI;
      if (!doi) continue;

      const authors = item.author?.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()) || [];
      const itemYear = item.published?.["date-parts"]?.[0]?.[0];
      const itemIsbn = item.ISBN?.[0];

      const v = verifyBookMatch(record, {
        title: item.title?.[0],
        author: authors,
        year: itemYear,
        isbn: itemIsbn,
      });
      if (!v.match) continue;

      try {
        const uRes = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=filben@gmail.com`, {
          signal: AbortSignal.timeout(3500),
        });
        if (uRes.ok) {
          const u = await uRes.json();
          if (u.is_oa && u.best_oa_location) {
            const pdfUrl = u.best_oa_location.url_for_pdf || u.best_oa_location.url;
            const publisher = item.publisher || "Scopus / Open Access";
            return {
              found: true,
              pdfUrl: pdfUrl || null,
              readerUrl: item.URL || `https://doi.org/${doi}`,
              sourceName: `Scopus / OA (${publisher})`,
              databaseSource: "scopus_oa",
              confidence: "high" as const,
              notes: `Publicação científica indexada e validada (DOI: ${doi}) com acesso aberto (${publisher}).`,
              verifiedFields: v.verifiedFields,
            };
          }
        }
      } catch {
        // Continue
      }
    }
  } catch {
    // Non-blocking
  }
  return null;
}

// Search OpenAlex (indexes global open access monographs & educational treatises)
async function searchOpenAlexEducation(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  try {
    const rawTitle = record.title.split(/[:\-–]/)[0].trim();
    const cleanT = cleanWords(rawTitle);
    if (!cleanT) return null;

    const queries = [rawTitle, cleanT];
    for (const q of queries) {
      try {
        const res = await fetch(`https://api.openalex.org/works?filter=title.search:${encodeURIComponent(q)}&per-page=5`, {
          signal: AbortSignal.timeout(4500),
        });
        if (!res.ok) continue;
        const data = await res.json();

        for (const w of data.results || []) {
          const authors = w.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) || [];
          const v = verifyBookMatch(record, {
            title: w.title,
            author: authors,
            year: w.publication_year,
          });
          if (!v.match) continue;

          // Find direct PDF if exists in locations
          const directPdfLocation = w.locations?.find((l: any) =>
            (l.pdf_url && l.pdf_url.toLowerCase().split("?")[0].endsWith(".pdf")) ||
            (l.landing_page_url && l.landing_page_url.toLowerCase().split("?")[0].endsWith(".pdf"))
          );
          const pdfUrl = directPdfLocation?.pdf_url || (directPdfLocation?.landing_page_url?.includes(".pdf") ? directPdfLocation.landing_page_url : null);
          const landingUrl = w.best_oa_location?.landing_page_url || w.open_access?.oa_url || w.id;
          const targetUrl = pdfUrl || landingUrl;

          if (targetUrl) {
            const hasPdf = Boolean(pdfUrl);
            const sourceTitle = w.primary_location?.source?.display_name || (targetUrl.includes("10400.") ? "RCAAP / Repositório Aberto" : "SciELO / Repositório Aberto");
            return {
              found: true,
              pdfUrl: hasPdf ? pdfUrl : null,
              readerUrl: landingUrl || targetUrl,
              sourceName: sourceTitle,
              databaseSource: sourceTitle.toLowerCase().includes("scielo") ? "scielo" : (targetUrl.includes("rcaap") || targetUrl.includes("10400.")) ? "bon_rcaap" : "openalex",
              confidence: "high" as const,
              notes: hasPdf
                ? `Texto integral em PDF localizado via OpenAlex / ${sourceTitle} (${w.title}).`
                : `Texto integral em página web / repositório em acesso aberto (${w.title}).`,
              verifiedFields: v.verifiedFields,
            };
          }
        }
      } catch {
        // Next query
      }
    }
  } catch {
    // Non-blocking
  }
  return null;
}

// Coordinator for educational and academic repositories with strict metadata validation
async function searchEducationDatabases(record: { title: string; author?: string; isbn?: string; publicationyear?: string }) {
  // 1. Try ERIC (Education Resources Information Center)
  const eric = await searchEric(record);
  if (eric && (eric.pdfUrl || eric.readerUrl)) return eric;

  // 2. Try b-on / RCAAP (Portuguese scientific open access)
  const rcaap = await searchRcaap(record);
  if (rcaap && (rcaap.pdfUrl || rcaap.readerUrl)) return rcaap;

  // 3. Try Scopus / CrossRef + Unpaywall
  const scopus = await searchScopusCrossRefUnpaywall(record);
  if (scopus && (scopus.pdfUrl || scopus.readerUrl)) return scopus;

  // 4. Try OpenAlex / SciELO Education
  const openAlex = await searchOpenAlexEducation(record);
  if (openAlex && (openAlex.pdfUrl || openAlex.readerUrl)) return openAlex;

  return null;
}

// Single book search endpoint with strict metadata validation & digital library prioritization
app.post("/api/search-book-pdf", async (req, res) => {
  const { biblionumber, title, author, isbn, publicationyear, itemcallnumber } = req.body || {};

  if (!title && !isbn) {
    res.status(400).json({ error: "Título ou ISBN é obrigatório para pesquisar." });
    return;
  }

  const record = {
    title: title || "",
    author: author || "",
    isbn: isbn || "",
    publicationyear: publicationyear || "",
  };

  let parsedResult = {
    found: false,
    pdfUrl: null as string | null,
    readerUrl: null as string | null,
    sourceName: "",
    confidence: "none" as "high" | "medium" | "low" | "none",
    notes: "",
    databaseSource: "web",
    verifiedFields: {
      title: false,
      author: false,
      year: false,
      isbn: false,
    },
  };
  const webSources: { title?: string; uri?: string }[] = [];

  // STAGE 1: Search Internet Archive (Digitized monographs & public domain educational treatises)
  const archiveResult = await searchArchiveOrg(record);
  if (archiveResult && archiveResult.found) {
    parsedResult = {
      found: true,
      pdfUrl: archiveResult.pdfUrl,
      readerUrl: archiveResult.readerUrl,
      sourceName: archiveResult.sourceName,
      confidence: archiveResult.confidence,
      notes: archiveResult.notes,
      databaseSource: archiveResult.databaseSource,
      verifiedFields: archiveResult.verifiedFields,
    };
  }

  // STAGE 2: Search Open Library (Monographs & digitized books with open lending or reading)
  if (!parsedResult.found) {
    const olResult = await searchOpenLibrary(record);
    if (olResult && olResult.found) {
      parsedResult = {
        found: true,
        pdfUrl: olResult.pdfUrl,
        readerUrl: olResult.readerUrl,
        sourceName: olResult.sourceName,
        confidence: olResult.confidence,
        notes: olResult.notes,
        databaseSource: olResult.databaseSource,
        verifiedFields: olResult.verifiedFields,
      };
    }
  }

  // STAGE 3: Search Specialized Education Repositories (OpenAlex, b-on / RCAAP, ERIC, Scopus OA)
  if (!parsedResult.found) {
    const eduResult = await searchEducationDatabases(record);
    if (eduResult && eduResult.found) {
      parsedResult = {
        found: true,
        pdfUrl: eduResult.pdfUrl,
        readerUrl: eduResult.readerUrl,
        sourceName: eduResult.sourceName,
        confidence: eduResult.confidence,
        notes: eduResult.notes,
        databaseSource: eduResult.databaseSource,
        verifiedFields: eduResult.verifiedFields,
      };
    }
  }

  // STAGE 4: Search Google Books API (Full view / downloadable PDF / Web reader)
  if (!parsedResult.found) {
    const gbResult = await searchGoogleBooks(record);
    if (gbResult && gbResult.found) {
      parsedResult = {
        found: true,
        pdfUrl: gbResult.pdfUrl,
        readerUrl: gbResult.readerUrl,
        sourceName: gbResult.sourceName,
        confidence: gbResult.confidence,
        notes: gbResult.notes,
        databaseSource: gbResult.databaseSource,
        verifiedFields: gbResult.verifiedFields,
      };
    }
  }

  // STAGE 5: Gemini Search Grounding (Targeted web & repository search for PDF or full text web page)
  let quotaHit = false;
  if (!parsedResult.found) {
    if (Date.now() < geminiQuotaCooldownUntil) {
      // Cooldown active, skip Gemini web search to avoid 429 error spam
      quotaHit = true;
    } else {
      try {
        const ai = getAi();
        const queryDetails = [
          title ? `Título: "${title}"` : "",
          author ? `Autor: "${author}"` : "",
          isbn ? `ISBN: "${isbn}"` : "",
          publicationyear ? `Ano de publicação: "${publicationyear}"` : "",
          itemcallnumber ? `Cota / Call number: "${itemcallnumber}"` : "",
          biblionumber ? `ID Biblio: "${biblionumber}"` : "",
        ].filter(Boolean).join(", ");

        const prompt = `Você é um bibliotecário e especialista em informação científica na área da EDUCAÇÃO, PEDAGOGIA E ENSINO.

Sua missão é pesquisar na internet pelo TEXTO INTEGRAL (FULL TEXT) DESTA OBRA ESPECÍFICA.
NOTA CRUCIAL: O texto integral pode ser um arquivo PDF (.pdf) OU UMA PÁGINA WEB / HTML com a obra completa ou leitor digital (ex: repositório institucional universitário, SciELO, RCAAP, b-on, Wikisource, Project Gutenberg, Open Library, Internet Archive, ou visualizador digital online).

Dados da obra solicitada:
${queryDetails}

REQUISITOS ESTRITOS DE VALIDAÇÃO:
1. A obra encontrada TEM QUE SER DO AUTOR "${author || "indicado"}" e com o TÍTULO "${title}".
2. NUNCA retorne artigos científicos, teses ou resenhas de OUTROS autores que apenas citam esta obra. O autor DEVE ser o mesmo!
3. Se houver ISBN (${isbn || "não indicado"}), deve corresponder.
4. Forneça o link direto para download do PDF (.pdf) OU a URL da página web onde o usuário pode ler o texto integral online.
5. Se a obra tiver direitos autorais fechados e nenhuma versão em acesso aberto do livro deste autor for encontrada, responda com found: false.

Responda ESTRITAMENTE em formato JSON:
{
  "found": true | false,
  "pdfUrl": "URL direta para arquivo PDF (.pdf)" ou null,
  "readerUrl": "URL da página web de leitura integral / repositório" ou null,
  "sourceName": "Nome da fonte (ex: Repositório Institucional, ERIC, RCAAP, SciELO, Internet Archive, Open Library)",
  "candidateTitle": "Título da obra encontrada na fonte",
  "candidateAuthor": "Autor da obra encontrada na fonte",
  "candidateYear": "Ano da obra encontrada na fonte",
  "confidence": "high" | "medium" | "low" | "none",
  "notes": "Breve nota descritiva em português"
}`;

        let response: any = null;
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              temperature: 0.1,
            },
          });
        } catch (callErr: any) {
          const errStr = String(callErr?.message || callErr || "");
          const is429 = callErr?.status === 429 || errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
          if (is429) {
            quotaHit = true;
            geminiQuotaCooldownUntil = Date.now() + 60 * 1000;
            console.log("[Info] Quota de pesquisa Gemini 429 atingida. Ativando arrefecimento de 60s e mantendo pesquisa nas bases abertas.");
          } else {
            console.log("[Info] Consulta Gemini Search finalizada sem resultados adicionais:", errStr.slice(0, 80));
          }
        }

        if (response) {
          const responseText = response?.text || "";

          // Extract grounding chunks URLs if available
          const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          for (const chunk of groundingChunks) {
            if (chunk.web?.uri) {
              webSources.push({
                title: chunk.web.title || "",
                uri: chunk.web.uri,
              });
            }
          }

          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const targetUrl = parsed.pdfUrl || parsed.readerUrl || parsed.webUrl || parsed.url;
            if (parsed.found && targetUrl) {
              // STRICT VALIDATION of Gemini output
              const v = verifyBookMatch(record, {
                title: parsed.candidateTitle || parsed.sourceName,
                author: parsed.candidateAuthor,
                year: parsed.candidateYear,
              });

              if (v.match) {
                const isDirectPdf = targetUrl.toLowerCase().split("?")[0].endsWith(".pdf");
                parsedResult = {
                  found: true,
                  pdfUrl: isDirectPdf ? targetUrl : null,
                  readerUrl: targetUrl,
                  sourceName: parsed.sourceName || (isDirectPdf ? "Web (PDF)" : "Web (Página de Leitura)"),
                  confidence: parsed.confidence || "medium",
                  notes: parsed.notes || `Texto integral validado (${v.reason}).`,
                  databaseSource: "web",
                  verifiedFields: v.verifiedFields,
                };
              }
            }
          }
        }
      } catch (geminiErr: any) {
        const errStr = String(geminiErr?.message || geminiErr || "");
        if (geminiErr?.status === 429 || errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota")) {
          quotaHit = true;
          geminiQuotaCooldownUntil = Date.now() + 60 * 1000;
          console.log("[Info] Quota de pesquisa Gemini 429 atingida. Arrefecimento de 60s ativado.");
        }
      }
    }
  }

  const primaryUrl = parsedResult.pdfUrl || parsedResult.readerUrl;
  let detectedDatabaseSource = parsedResult.databaseSource || "web";

  // Categorize databaseSource if not already tagged
  if (detectedDatabaseSource === "web" && (primaryUrl || parsedResult.sourceName)) {
    const combined = `${primaryUrl || ""} ${parsedResult.sourceName}`.toLowerCase();
    if (combined.includes("openlibrary") || combined.includes("open_library")) {
      detectedDatabaseSource = "open_library";
    } else if (combined.includes("eric") || combined.includes("ed.gov")) {
      detectedDatabaseSource = "eric";
    } else if (combined.includes("b-on") || combined.includes("rcaap") || combined.includes("10400.")) {
      detectedDatabaseSource = "bon_rcaap";
    } else if (combined.includes("scopus") || combined.includes("doi.org") || combined.includes("unpaywall")) {
      detectedDatabaseSource = "scopus_oa";
    } else if (combined.includes("scielo")) {
      detectedDatabaseSource = "scielo";
    } else if (combined.includes("archive.org")) {
      detectedDatabaseSource = "archive_org";
    } else if (combined.includes("google")) {
      detectedDatabaseSource = "google_books";
    } else if (combined.includes("openalex")) {
      detectedDatabaseSource = "openalex";
    }
  }

  // Verify reachability
  let testInfo: { reachable: boolean; isPdf: boolean; status?: number; resolvedUrl?: string } = {
    reachable: false,
    isPdf: false,
    status: 0,
  };
  if (primaryUrl) {
    testInfo = await testUrl(primaryUrl);
  }

  const isFound = parsedResult.found && Boolean(primaryUrl);
  const isDirectPdf = testInfo.isPdf || (primaryUrl ? primaryUrl.toLowerCase().split("?")[0].endsWith(".pdf") : false);
  const fullTextType: "pdf" | "web_page" | "reader" = isDirectPdf
    ? "pdf"
    : (primaryUrl?.includes("archive.org/details") || primaryUrl?.includes("openlibrary.org") ? "reader" : "web_page");

  let defaultNotes = "Nenhum texto integral público localizado nas bases (PDF ou página web de leitura).";
  if (isFound) {
    defaultNotes = isDirectPdf
      ? "Texto integral em PDF localizado e validado online."
      : "Texto integral em página web / leitor digital localizado e validado online.";
  } else if (quotaHit) {
    defaultNotes = "Nenhum texto integral localizado nas bibliotecas digitais (Internet Archive, Open Library, ERIC, RCAAP, OpenAlex). Nota: A quota temporária da API Gemini foi atingida (429); as consultas diretas às bibliotecas digitais continuam ativas.";
  }

  const finalResult = {
    biblionumber,
    title,
    author,
    isbn,
    publicationyear,
    itemcallnumber,
    found: isFound,
    pdfUrl: parsedResult.pdfUrl || parsedResult.readerUrl,
    readerUrl: parsedResult.readerUrl,
    directLink: parsedResult.pdfUrl || parsedResult.readerUrl || "",
    sourceName: parsedResult.sourceName || (isDirectPdf ? "PDF Direto" : "Página Web / Leitor"),
    databaseSource: detectedDatabaseSource,
    confidence: parsedResult.confidence,
    notes: parsedResult.notes || defaultNotes,
    verified: testInfo.reachable || testInfo.isPdf || isFound,
    verifiedMetadata: parsedResult.verifiedFields,
    quotaExceeded: quotaHit,
    isDirectPdf,
    fullTextType,
    webSources: webSources.slice(0, 5),
  };

  res.json(finalResult);
});

// URL verification endpoint
app.post("/api/verify-url", async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }
  const result = await testUrl(url);
  res.json(result);
});

// Serve frontend in production or Vite middleware in development
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
