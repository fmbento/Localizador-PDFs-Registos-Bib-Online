export interface BookRecord {
  id: string; // Unique row ID
  biblionumber: string;
  title: string;
  author: string;
  isbn: string;
  publicationyear: string;
  itemcallnumber: string;
  // Extra columns from original file preserved
  rawColumns?: Record<string, any>;
  
  // Results added by AI / Search
  pdfUrl?: string | null;
  readerUrl?: string | null;
  sourceName?: string;
  databaseSource?: string;
  confidence?: "high" | "medium" | "low" | "none";
  notes?: string;
  isDirectPdf?: boolean;
  verified?: boolean;
  verifiedMetadata?: {
    title: boolean;
    author: boolean;
    year: boolean;
    isbn: boolean;
    notes?: string;
  };
  webSources?: { title?: string; uri?: string }[];
  quotaExceeded?: boolean;
  
  // Processing state
  status: "pending" | "searching" | "found" | "not_found" | "error";
  errorMessage?: string;
}

export interface BatchStats {
  total: number;
  completed: number;
  found: number;
  notFound: number;
  errors: number;
  inProgress: boolean;
}
