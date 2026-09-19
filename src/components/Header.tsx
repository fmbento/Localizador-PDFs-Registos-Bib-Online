import React from "react";
import { BookOpen, Sparkles, CheckCircle2, AlertCircle, Clock, FileSpreadsheet } from "lucide-react";
import { BatchStats } from "../types";

interface HeaderProps {
  stats: BatchStats;
}

export const Header: React.FC<HeaderProps> = ({ stats }) => {
  const percentage = stats.total > 0 ? Math.round((stats.found / stats.total) * 100) : 0;

  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Localizador de PDFs Bibliográficos
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  Especializado em Educação & Ciências Sociais
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Upload de catálogo XLSX e pesquisa automática de textos integrais e PDFs em bases científicas e educacionais
              </p>

              {/* Connected Academic Databases Strip */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                  Bases ligadas:
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                  ERIC (Ed.gov)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  b-on & RCAAP (Portugal)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Scopus / CrossRef OA
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  SciELO & Dialnet
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  Internet Archive & DOAB
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {stats.total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                  <span>Total</span>
                </div>
                <div className="text-lg font-bold text-slate-800">{stats.total}</div>
              </div>

              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PDFs ({percentage}%)</span>
                </div>
                <div className="text-lg font-bold text-emerald-700">{stats.found}</div>
              </div>

              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pendentes</span>
                </div>
                <div className="text-lg font-bold text-amber-700">
                  {stats.total - stats.completed}
                </div>
              </div>

              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Não Achados</span>
                </div>
                <div className="text-lg font-bold text-slate-600">{stats.notFound}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
