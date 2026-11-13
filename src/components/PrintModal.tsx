import { ArrowLeft, Download, Printer, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CEREC_LOGO_URL } from '../data/seedData';

interface PrintModalProps {
  title: string;
  subtitle?: string;
  printLabel?: string;
  pdfButtonLabel?: string;
  onDownloadPdf?: () => Promise<void> | void;
  toolbarExtra?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

export function PrintModal({
  title,
  subtitle,
  printLabel = 'Imprimer / PDF',
  pdfButtonLabel = 'Télécharger PDF',
  onDownloadPdf,
  toolbarExtra,
  onClose,
  children,
}: PrintModalProps) {
  const [printHint, setPrintHint] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    setPrintHint(false);
    try {
      window.focus();
      window.print();
    } catch {
      setPrintHint(true);
    }
  };

  const handlePdfClick = async () => {
    if (!onDownloadPdf || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await onDownloadPdf();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const modal = (
    <div
      id="cerec-print-portal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142b]/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="cerec-print-modal-card"
        className="bg-white border border-[#e3e7ef] rounded-xl w-full max-w-4xl shadow-xl overflow-hidden my-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[#e3e7ef] bg-[#f8f9fb] print:hidden">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#e3e7ef] hover:border-[#0b1f3f] bg-white hover:bg-slate-50 text-[#0b1f3f] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour
            </button>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-[#161e2e] truncate">{title}</h3>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            {toolbarExtra}
            {onDownloadPdf && (
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={handlePdfClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e0a526] hover:bg-[#c58b12] disabled:opacity-50 text-[#07142b] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingPdf ? 'Génération PDF…' : pdfButtonLabel}
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0b1f3f] hover:bg-[#143263] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#eab33a]" />
              {printLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'aperçu"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {printHint && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 print:hidden">
            Utilisez le raccourci Ctrl+P (ou Cmd+P sur Mac) pour lancer l’impression A4 ou enregistrer en PDF.
          </div>
        )}

        <div id="cerec-print-scroll" className="p-3 sm:p-6 max-h-[78vh] overflow-y-auto bg-slate-100/70">
          <div
            id="cerec-print-sheet"
            className="bg-white border border-[#e3e7ef] rounded-lg p-4 sm:p-6 mx-auto shadow-xs text-[#161e2e] overflow-x-auto print:overflow-visible"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function OfficialDocumentHeader({
  campus,
  docTitle,
  docRef,
  academicYear = '2025-2026',
}: {
  campus: string;
  docTitle: string;
  docRef: string;
  academicYear?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row print:flex-row items-start justify-between gap-4 sm:gap-6 pb-4 mb-5 border-b-2 border-[#0b1f3f]">
      <div className="flex items-center gap-3 sm:gap-4">
        <img
          src={CEREC_LOGO_URL}
          alt="Logo Groupe CEREC-ISCOM"
          referrerPolicy="no-referrer"
          className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded border border-[#e3e7ef] bg-white p-1 shrink-0"
        />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c58b12]">
            République du Congo · Enseignement Supérieur
          </p>
          <h4 className="font-serif text-base sm:text-lg font-bold text-[#0b1f3f] leading-tight">
            Groupe CEREC-ISCOM
          </h4>
          <p className="text-xs text-slate-600 mt-0.5">
            Institut Supérieur de Commerce et de Management · Campus de {campus}
          </p>
          <p className="text-[11px] text-slate-500">
            Partenariat ESTAM Bénin · Formation LMD & Qualifiante
          </p>
        </div>
      </div>
      <div className="sm:text-right print:text-right shrink-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#0b1f3f]">{docTitle}</p>
        <p className="font-mono text-xs text-slate-600 mt-1 tabular-nums">{docRef}</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Année {academicYear}
        </p>
      </div>
    </div>
  );
}
