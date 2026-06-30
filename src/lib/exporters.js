// ════════════════════════════════════════════════════════════════════════════
//  Exporteurs de rapports — CSV / Excel (.xlsx) / PDF
//
//  Interface commune : on reçoit un « payload » normalisé et on produit un
//  fichier téléchargé par le navigateur.
//
//    payload = {
//      columns: [{ key, label, format?(value, row) }],
//      rows:    [ { [key]: value, ... } ],
//      meta:    { title, period?, client?: { displayName, logoUrl } },
//    }
//
//  Usage : await exportReport('xlsx', payload, 'planning_general');
//  Les libs lourdes (xlsx / jspdf) sont importées dynamiquement pour ne pas
//  alourdir le bundle initial : elles ne chargent qu'au premier export.
// ════════════════════════════════════════════════════════════════════════════

/** Coerce une valeur en quelque chose d'affichable (les objets → JSON, jamais "[object Object]"). */
const coerce = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return value;
};

/** Valeur formatée pour l'affichage (CSV / PDF) — applique le formateur de colonne. */
const displayCell = (col, row) => {
  const raw = row?.[col.key];
  const value = typeof col.format === 'function' ? col.format(raw, row) : raw;
  return coerce(value);
};

/** Valeur brute pour Excel — conserve les nombres en numérique (somme/tri possibles). */
const rawCell = (col, row) => coerce(row?.[col.key]);

/** Déclenche le téléchargement d'un Blob côté navigateur. */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Libère l'URL objet (léger délai pour laisser le clic se propager).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ── CSV ─────────────────────────────────────────────────────────────────────
const csvEscape = (value) => {
  const s = String(value);
  // On entoure systématiquement de guillemets et on double les guillemets internes.
  return `"${s.replace(/"/g, '""')}"`;
};

const exportCsv = ({ columns, rows }, filename) => {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => csvEscape(displayCell(c, row))).join(','))
    .join('\r\n');
  // BOM UTF-8 pour qu'Excel détecte l'encodage (accents).
  const blob = new Blob(['﻿', header, '\r\n', body], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(blob, `${filename}.csv`);
};

// ── Excel (.xlsx) ─────────────────────────────────────────────────────────────
const exportXlsx = async ({ columns, rows, meta }, filename) => {
  const XLSX = await import('xlsx');
  const aoa = [
    columns.map((c) => c.label),
    ...rows.map((row) => columns.map((c) => rawCell(c, row))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Largeurs de colonnes approximatives selon le contenu (longueur affichée).
  ws['!cols'] = columns.map((c) => {
    const maxLen = Math.max(
      String(c.label).length,
      ...rows.map((row) => String(displayCell(c, row)).length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  const wb = XLSX.utils.book_new();
  const sheetName = (meta?.title || 'Rapport').slice(0, 31); // Excel limite à 31 car.
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ── PDF ───────────────────────────────────────────────────────────────────────
/** Charge un logo distant en dataURL (best-effort, n'échoue jamais). */
const loadLogoDataUrl = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
        } catch {
          resolve(null); // canvas « tainted » (CORS) → on ignore le logo.
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });

const exportPdf = async ({ columns, rows, meta }, filename) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const clientName = meta?.client?.displayName || '';

  // En-tête : logo (best-effort) + nom du client + titre + période.
  const logo = await loadLogoDataUrl(meta?.client?.logoUrl);
  let headerLeft = 40;
  if (logo?.dataUrl) {
    const h = 32;
    const w = Math.min((logo.w / logo.h) * h, 120);
    try {
      doc.addImage(logo.dataUrl, 'PNG', 40, 28, w, h);
      headerLeft = 40 + w + 12;
    } catch {
      /* ignore */
    }
  }
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(clientName, headerLeft, 42);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(meta?.title || 'Rapport', headerLeft, 58);
  if (meta?.period) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(meta.period, pageWidth - 40, 42, { align: 'right' });
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: 78,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => String(displayCell(c, row)))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      // Pied de page : pagination.
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} / ${page}`,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 16,
        { align: 'right' }
      );
      doc.setTextColor(0);
    },
  });

  doc.save(`${filename}.pdf`);
};

// ── Point d'entrée ─────────────────────────────────────────────────────────────
export const EXPORT_FORMATS = [
  { key: 'csv', label: 'CSV' },
  { key: 'xlsx', label: 'Excel' },
  { key: 'pdf', label: 'PDF' },
];

/**
 * Exporte un rapport dans le format demandé.
 * @returns {Promise<string>} le nom de fichier produit (sans extension).
 */
export const exportReport = async (format, payload, baseName = 'rapport') => {
  if (!payload?.columns?.length) throw new Error('Aucune colonne à exporter.');
  switch (format) {
    case 'csv':
      exportCsv(payload, baseName);
      break;
    case 'xlsx':
      await exportXlsx(payload, baseName);
      break;
    case 'pdf':
      await exportPdf(payload, baseName);
      break;
    default:
      throw new Error(`Format d'export inconnu : ${format}`);
  }
  return baseName;
};
