import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { CEREC_LOGO_URL } from '../data/seedData';
import { CerecState, Student } from '../types/cerec';
import {
  computeCohortRank,
  computeStudentSemesterSummary,
  formatOrdinalFr,
} from './lmd';

function pdfText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .replace(/[\u00A0\u202F]/g, ' ');
}

async function loadImageAsPngDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load error'));
      el.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 200;
    canvas.height = img.naturalHeight || 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function renderBulletinPage(
  doc: jsPDF,
  student: Student,
  state: CerecState,
  semestre: string | undefined,
  logoDataUrl: string | null
) {
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm for A4
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  const filiere = state.filieres.find((f) => f.code === student.filiereCode);
  const summary = computeStudentSemesterSummary(
    student,
    state.ues,
    state.grades,
    state.settings,
    semestre
  );
  const { rang, totalCandidats } = computeCohortRank(
    student,
    state.students,
    state.ues,
    state.grades,
    state.settings,
    semestre
  );

  const inferredSem = semestre || summary.details[0]?.ue.semestre || 'S1';
  const semNumber = inferredSem.replace(/\D/g, '') || '1';
  const docNumber = `${student.matricule.split('-').pop() || '0001'}${inferredSem}`;
  const dateStr = new Date().toLocaleDateString('fr-FR');

  // Top 3-zone header
  let y = 14;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', marginX, y, 16, 16);
  } else {
    doc.setDrawColor(11, 31, 63);
    doc.rect(marginX, y, 16, 16);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(11, 31, 63);
  doc.text('GROUPE CEREC-ISCOM', marginX + 19, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(pdfText(`${student.campus} · République du Congo`), marginX + 19, y + 11);
  doc.text(pdfText('Partenariat ESTAM Bénin · Système LMD'), marginX + 19, y + 15.5);

  // Center Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(22, 30, 46);
  doc.text(pdfText('Relevé de notes'), pageWidth / 2, y + 7, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 31, 63);
  doc.text(`N° ${docNumber}`, pageWidth / 2, y + 13, { align: 'center' });

  // Top-right photo box
  const photoW = 24;
  const photoH = 28;
  const photoX = pageWidth - marginX - photoW;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.rect(photoX, y, photoW, photoH);
  const photoDataUrl = student.photoUrl
    ? await loadImageAsPngDataUrl(student.photoUrl)
    : null;
  if (photoDataUrl) {
    doc.addImage(photoDataUrl, 'PNG', photoX + 0.5, y + 0.5, photoW - 1, photoH - 1);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('PHOTO', photoX + photoW / 2, y + photoH / 2 + 1, { align: 'center' });
  }

  // Student Identification Block
  y += 22;
  const infoRows: [string, string, boolean][] = [
    ['Étudiant :', student.matricule, true],
    ['Nom :', `${student.nom} ${student.prenom}`, false],
    ['Filière :', filiere?.nom ?? student.filiereCode, false],
    [
      'Option :',
      student.option || filiere?.options?.[0] || filiere?.nom || student.filiereCode,
      false,
    ],
    ['Cycle :', filiere?.cycle ?? 'Licence', false],
    ['Niveau :', student.niveau, false],
    ['Année académique :', student.anneeAcademique, true],
  ];

  infoRows.forEach(([label, val, mono]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText(label), marginX, y);

    doc.setFont(mono ? 'courier' : 'helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(11, 31, 63);
    doc.text(pdfText(val), marginX + 36, y);
    y += 5;
  });

  // Session Banner
  y += 3;
  doc.setDrawColor(11, 31, 63);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(11, 31, 63);
  doc.text(
    semestre ? `EXAMEN SEMESTRE ${semNumber}` : 'RELEVÉ LMD CONSOLIDÉ',
    marginX,
    y
  );
  y += 4;

  // UE Groups Tables
  const getLastY = () =>
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  for (const group of summary.ueGroups) {
    if (y > 248) {
      doc.addPage();
      y = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 30, 46);
    doc.text(pdfText(`Unité d'enseignement : ${group.uniteNom}`), marginX, y + 3);

    doc.setTextColor(11, 31, 63);
    doc.text(
      `Moyenne UE : ${group.moyenneUe !== null ? group.moyenneUe.toFixed(2) : '-'}`,
      pageWidth - marginX,
      y + 3,
      { align: 'right' }
    );

    const bodyRows = group.rows.map((row, idx) => {
      const examScore =
        row.grade?.rattrapage !== null && row.grade?.rattrapage !== undefined
          ? row.grade.rattrapage.toFixed(2)
          : row.grade?.examen !== null && row.grade?.examen !== undefined
          ? row.grade.examen.toFixed(2)
          : '-';

      const baseCells: (string | { content: string; rowSpan: number; styles: Record<string, unknown> })[] = [
        pdfText(row.ue.intitule),
        row.grade?.cc !== null && row.grade?.cc !== undefined ? row.grade.cc.toFixed(2) : '',
        row.grade?.td !== null && row.grade?.td !== undefined ? row.grade.td.toFixed(2) : '',
        row.grade?.tp !== null && row.grade?.tp !== undefined ? row.grade.tp.toFixed(2) : '',
        row.moyClasse !== null ? row.moyClasse.toFixed(2) : '-',
        examScore,
        String(row.ue.coefficient),
        row.moyenneFinale !== null ? row.moyenneFinale.toFixed(2) : '-',
      ];

      if (idx === 0) {
        baseCells.push({
          content: group.creditsUe.toFixed(2),
          rowSpan: group.rows.length,
          styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' },
        });
      }
      return baseCells;
    });

    autoTable(doc, {
      startY: y + 5,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      head: [
        [
          pdfText('Élément constitutif'),
          'Note Classe',
          'TD',
          'TP',
          'Moy. Classe',
          'Examen',
          'Coef',
          pdfText('Moy. Gén'),
          pdfText('Crédit'),
        ],
      ],
      body: bodyRows,
      headStyles: {
        fillColor: [11, 31, 63],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 1.8,
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
      },
      bodyStyles: {
        fontSize: 7.8,
        textColor: [22, 30, 46],
        cellPadding: 1.8,
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 64 },
        1: { halign: 'center' },
        2: { halign: 'center', cellWidth: 11 },
        3: { halign: 'center', cellWidth: 11 },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center', cellWidth: 12 },
        7: { halign: 'center', fontStyle: 'bold' },
        8: { halign: 'center', cellWidth: 15 },
      },
    });

    y = getLastY() + 4;
  }

  if (summary.ueGroups.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfText(
        `Aucune Unité d'Enseignement configurée pour ${student.filiereCode} ${student.niveau}.`
      ),
      marginX,
      y + 6
    );
    y += 14;
  }

  // Summary Table + Signature + QR block
  if (y > 232) {
    doc.addPage();
    y = 18;
  }

  autoTable(doc, {
    startY: y + 1,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    body: [
      [
        {
          content: semestre ? `Moyenne Semestre ${semNumber}` : 'Moyenne Générale',
          styles: { fillColor: [241, 244, 249], fontStyle: 'bold' },
        },
        {
          content:
            summary.moyenneGenerale !== null ? summary.moyenneGenerale.toFixed(2) : '-',
          styles: { halign: 'center', fontStyle: 'bold', textColor: [11, 31, 63] },
        },
        {
          content: pdfText('Nombre de crédits validés'),
          styles: { fillColor: [241, 244, 249], fontStyle: 'bold' },
        },
        {
          content: `${summary.creditsAcquis} Sur ${summary.creditsTotaux}`,
          colSpan: 2,
          styles: { halign: 'center', fontStyle: 'bold', textColor: [11, 31, 63] },
        },
      ],
      [
        {
          content: 'Rang',
          styles: { fillColor: [241, 244, 249], fontStyle: 'bold' },
        },
        {
          content: pdfText(`${formatOrdinalFr(rang)} sur ${totalCandidats} candidats`),
          colSpan: 2,
          styles: { halign: 'center', fontStyle: 'bold' },
        },
        {
          content: 'Mention',
          styles: { fillColor: [241, 244, 249], fontStyle: 'bold', halign: 'center' },
        },
        {
          content: pdfText(summary.mention),
          styles: { halign: 'center', fontStyle: 'bold', textColor: [11, 31, 63] },
        },
      ],
    ],
    bodyStyles: {
      fontSize: 8.5,
      textColor: [22, 30, 46],
      cellPadding: 2.3,
      lineColor: [148, 163, 184],
      lineWidth: 0.25,
    },
  });

  const footerY = getLastY() + 8;

  // Footer text & Signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(pdfText(`Fait à ${student.campus}, le ${dateStr}`), marginX, footerY + 4);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfText('Document authentifié par QR Code · Groupe CEREC-ISCOM'),
    marginX,
    footerY + 9
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(11, 31, 63);
  doc.text(
    pdfText('Service de la scolarité et des examens'),
    pageWidth - marginX - 24,
    footerY + 4,
    { align: 'right' }
  );

  // Scannable QR Code image
  const qrPayload = `CEREC-ISCOM|RELEVE|${docNumber}|${student.matricule}|MOY:${summary.moyenneGenerale?.toFixed(2) ?? 'NA'}|CREDITS:${summary.creditsAcquis}/${summary.creditsTotaux}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 180,
      margin: 1,
      color: { dark: '#0b1f3f', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', pageWidth - marginX - 20, footerY - 2, 20, 20);
  } catch {
    // ignore QR fallback
  }

  // Thin bottom gold accent bar
  doc.setFillColor(224, 165, 38);
  doc.rect(marginX, doc.internal.pageSize.getHeight() - 10, contentWidth, 0.8, 'F');
}

export async function downloadBulletinPdf(
  student: Student,
  state: CerecState,
  semestre?: string
): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadImageAsPngDataUrl(CEREC_LOGO_URL);
  await renderBulletinPage(doc, student, state, semestre, logoDataUrl);
  const semTag = semestre ? `_${semestre}` : '';
  const fileName = `Releve_Notes_${student.matricule}${semTag}_${student.anneeAcademique}.pdf`;
  doc.save(fileName);
  return fileName;
}

export async function downloadBatchBulletinsPdf(
  students: Student[],
  state: CerecState,
  semestre: string | undefined,
  cohortLabel: string
): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadImageAsPngDataUrl(CEREC_LOGO_URL);

  for (let i = 0; i < students.length; i++) {
    if (i > 0) doc.addPage();
    await renderBulletinPage(doc, students[i], state, semestre, logoDataUrl);
  }

  const semTag = semestre ? `_${semestre}` : '';
  const safeLabel = cohortLabel.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const fileName = `Releves_Notes_${safeLabel}${semTag}_${state.settings.anneeAcademique}.pdf`;
  doc.save(fileName);
  return fileName;
}
