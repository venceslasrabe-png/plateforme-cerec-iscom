import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { CEREC_LOGO_URL } from '../data/seedData';
import { Filiere, Student } from '../types/cerec';

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

const CARD_W = 95; // mm
const CARD_H = 142; // mm

async function renderPvcRecto(
  doc: jsPDF,
  student: Student,
  filiere: Filiere | undefined,
  logoDataUrl: string | null
) {
  const pad = 5;
  const innerW = CARD_W - pad * 2; // 85mm
  const departement = filiere?.nom ?? filiere?.departement ?? 'Sciences de Gestion & Management';
  const optionNom =
    student.option || filiere?.options?.[0] || filiere?.nom || student.filiereCode;
  const cycle = filiere?.cycle ?? 'Licence';
  const initials = `${student.nom.charAt(0)}${student.prenom.charAt(0)}`.toUpperCase();

  // Outer white card frame
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(1.5, 1.5, CARD_W - 3, CARD_H - 3, 2.5, 2.5, 'S');

  // Top Header
  let y = 5.5;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', pad, y, 11.5, 11.5);
  } else {
    doc.setDrawColor(227, 231, 239);
    doc.rect(pad, y, 11.5, 11.5);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(11, 31, 63);
  doc.text('GROUPE CEREC-ISCOM', pad + 14, y + 4.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(pdfText(`${student.campus} · République du Congo`), pad + 14, y + 9.2);

  // Gold Banner
  y += 14;
  doc.setFillColor(224, 165, 38);
  doc.roundedRect(pad, y, innerW, 7.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(7, 20, 43);
  doc.text(pdfText("CARTE D'ÉTUDIANT"), CARD_W / 2, y + 5.1, { align: 'center' });

  // Photo ID + Right Metadata Split
  y += 10;
  const photoW = 30;
  const photoH = 37;

  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(pad, y, photoW, photoH, 1.5, 1.5, 'FD');

  const photoDataUrl = student.photoUrl
    ? await loadImageAsPngDataUrl(student.photoUrl)
    : null;
  if (photoDataUrl) {
    doc.addImage(photoDataUrl, 'PNG', pad + 0.5, y + 0.5, photoW - 1, photoH - 1);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(100, 116, 139);
    doc.text(initials, pad + photoW / 2, y + 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('PHOTO ID', pad + photoW / 2, y + 24, { align: 'center' });
  }

  // Right column metadata
  const metaX = pad + photoW + 3.5;
  const metaW = innerW - photoW - 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('ANNÉE ACADÉMIQUE'), metaX, y + 2.5);

  doc.setFillColor(11, 31, 63);
  doc.roundedRect(metaX, y + 4, metaW, 6.8, 1.2, 1.2, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(255, 255, 255);
  doc.text(student.anneeAcademique, metaX + metaW / 2, y + 8.6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('CYCLE & NIVEAU', metaX, y + 15.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 30, 46);
  doc.text(pdfText(`${cycle} · ${student.niveau}`), metaX, y + 19.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('MATRICULE ÉTUDIANT'), metaX, y + 26.2);

  doc.setFillColor(11, 31, 63);
  doc.roundedRect(metaX, y + 27.8, metaW, 6.8, 1.2, 1.2, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(student.matricule, metaX + metaW / 2, y + 32.4, { align: 'center' });

  // Identity Box
  y += photoH + 3.5;
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(pad, y, innerW, 27, 1.8, 1.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('NOM(S) ET PRÉNOM(S) :'), pad + 3, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(11, 31, 63);
  const fullNameLines = doc.splitTextToSize(
    pdfText(`${student.nom} ${student.prenom}`).toUpperCase(),
    innerW - 6
  );
  doc.text(fullNameLines[0] ?? '', pad + 3, y + 9.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const filiereLine = doc.splitTextToSize(
    pdfText(`FILIÈRE : ${departement}`),
    innerW - 6
  );
  doc.text(filiereLine.slice(0, 2), pad + 3, y + 15.2);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 31, 63);
  const optionLine = doc.splitTextToSize(
    pdfText(`OPTION : ${optionNom}`),
    innerW - 6
  );
  doc.text(optionLine[0] ?? '', pad + 3, y + 23.2);

  // Certified ID + QR Code Row
  y += 30;
  const qrBoxSize = 23.5;
  const certW = innerW - qrBoxSize - 2.5;

  doc.setFillColor(241, 246, 253);
  doc.setDrawColor(202, 217, 238);
  doc.roundedRect(pad, y, certW, qrBoxSize, 1.8, 1.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText('ID ÉTUDIANT CERTIFIÉ'), pad + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(71, 85, 105);
  doc.text(pdfText('Contrôle guérite & présences'), pad + 3, y + 10);
  doc.text(pdfText('Propriété officielle CEREC-ISCOM'), pad + 3, y + 14);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(11, 31, 63);
  doc.text(student.matricule, pad + 3, y + 20);

  // QR Box
  const qrX = pad + certW + 2.5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(qrX, y, qrBoxSize, qrBoxSize, 1.8, 1.8, 'FD');

  const qrPayload = `CEREC-ISCOM|CARTE|${student.matricule}|${student.nom} ${student.prenom}|${student.filiereCode}-${student.niveau}|${student.campus}|${student.anneeAcademique}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 180,
      margin: 1,
      color: { dark: '#0b1f3f', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', qrX + 1.2, y + 1.2, qrBoxSize - 2.4, qrBoxSize - 2.4);
  } catch {
    // ignore QR fallback
  }

  // Footer Band
  const footerH = 8.5;
  doc.setFillColor(224, 165, 38);
  doc.rect(1.5, CARD_H - footerH - 2.5, CARD_W - 3, 1, 'F');

  doc.setFillColor(11, 31, 63);
  doc.rect(1.5, CARD_H - footerH - 1.5, CARD_W - 3, footerH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    pdfText('RÉPUBLIQUE DU CONGO · CEREC-ISCOM'),
    CARD_W / 2,
    CARD_H - 4.3,
    { align: 'center' }
  );
}

function renderPvcVerso(
  doc: jsPDF,
  student: Student,
  filiere: Filiere | undefined,
  logoDataUrl: string | null
) {
  const pad = 5;
  const innerW = CARD_W - pad * 2;
  const departement = filiere?.nom ?? filiere?.departement ?? 'Sciences de Gestion & Management';
  const optionNom =
    student.option || filiere?.options?.[0] || filiere?.nom || student.filiereCode;

  // Outer white card frame
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(1.5, 1.5, CARD_W - 3, CARD_H - 3, 2.5, 2.5, 'S');

  // Navy Header
  doc.setFillColor(11, 31, 63);
  doc.rect(1.5, 1.5, CARD_W - 3, 15.5, 'F');
  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pad, 4.2, 10, 10, 1, 1, 'F');
    doc.addImage(logoDataUrl, 'PNG', pad + 0.5, 4.7, 9, 9);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('GROUPE CEREC-ISCOM', pad + 12.5, 8.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(234, 179, 58);
  doc.text(pdfText('AUTHENTIFICATION & CONTACTS ÉTUDIANT'), pad + 12.5, 12.5);

  let y = 21;

  // Contact Box
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(pad, y, innerW, 24, 1.8, 1.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('NUMÉRO DE TÉLÉPHONE :'), pad + 3, y + 4.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText(student.telephone || 'Non renseigné'), pad + 3, y + 9.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('ADRESSE EMAIL :', pad + 3, y + 14.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(22, 30, 46);
  const emailLines = doc.splitTextToSize(pdfText(student.email || ''), innerW - 6);
  doc.text(emailLines[0] ?? '', pad + 3, y + 19.6);

  // Academic Specialty Box
  y += 27;
  doc.setFillColor(241, 246, 253);
  doc.setDrawColor(202, 217, 238);
  doc.roundedRect(pad, y, innerW, 25, 1.8, 1.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('FILIÈRE ACADÉMIQUE :'), pad + 3, y + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(11, 31, 63);
  const depLines = doc.splitTextToSize(pdfText(departement), innerW - 6);
  doc.text(depLines.slice(0, 2), pad + 3, y + 9.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('OPTION DE SPÉCIALITÉ :'), pad + 3, y + 16.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(11, 31, 63);
  const optLines = doc.splitTextToSize(pdfText(optionNom), innerW - 6);
  doc.text(optLines[0] ?? '', pad + 3, y + 21.2);

  // Birth & Emergency
  y += 29;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(
    pdfText(`Né(e) le : ${student.dateNaissance} à ${student.lieuNaissance}`),
    pad + 1,
    y
  );
  doc.text(
    pdfText(
      `Contact d'urgence : ${student.tuteurNom}${student.tuteurTel ? ` (${student.tuteurTel})` : ''}`
    ),
    pad + 1,
    y + 4.8
  );

  // Security Notice Box
  y += 9;
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(pad, y, innerW, 20, 1.8, 1.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(22, 30, 46);
  doc.text(pdfText('AVIS RÉGLEMENTAIRE & SÉCURITÉ'), CARD_W / 2, y + 5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  const noticeLines = doc.splitTextToSize(
    pdfText(
      `Carte strictement personnelle. Obligatoire sur les campus et examens. En cas de perte, rapporter à la Scolarité : Campus ${student.campus}, CEREC-ISCOM.`
    ),
    innerW - 6
  );
  doc.text(noticeLines, CARD_W / 2, y + 9.8, { align: 'center' });

  // Signature + Certified Badge
  y += 25;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Direction de la Scolarité', pad, y + 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText('Service Scolarité CEREC-ISCOM'), pad, y + 6.5);

  doc.setFillColor(224, 165, 38);
  doc.roundedRect(CARD_W - pad - 28, y, 28, 7.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(7, 20, 43);
  doc.text(pdfText('CEREC-CERTIFIÉ'), CARD_W - pad - 14, y + 4.9, { align: 'center' });

  // Dark Barcode Footer
  const footH = 9;
  doc.setFillColor(7, 20, 43);
  doc.rect(1.5, CARD_H - footH - 1.5, CARD_W - 3, footH, 'F');

  doc.setFillColor(226, 232, 240);
  const leftBars = [0.7, 0.4, 1.0, 0.4, 0.7, 0.4];
  let bx = pad + 4;
  leftBars.forEach((bw) => {
    doc.rect(bx, CARD_H - 7.8, bw, 3.6, 'F');
    bx += bw + 0.6;
  });

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(student.matricule, CARD_W / 2, CARD_H - 4.8, { align: 'center' });

  let rx = CARD_W - pad - 18;
  const rightBars = [0.4, 0.7, 0.4, 1.0, 0.4, 0.7, 0.4];
  rightBars.forEach((bw) => {
    doc.rect(rx, CARD_H - 7.8, bw, 3.6, 'F');
    rx += bw + 0.6;
  });
}

export async function downloadCartePvcPdf(
  student: Student,
  filiere: Filiere | undefined,
  side: 'both' | 'recto' | 'verso' = 'both'
): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CARD_W, CARD_H],
  });
  const logoDataUrl = await loadImageAsPngDataUrl(CEREC_LOGO_URL);

  if (side === 'recto') {
    await renderPvcRecto(doc, student, filiere, logoDataUrl);
  } else if (side === 'verso') {
    renderPvcVerso(doc, student, filiere, logoDataUrl);
  } else {
    await renderPvcRecto(doc, student, filiere, logoDataUrl);
    doc.addPage([CARD_W, CARD_H], 'portrait');
    renderPvcVerso(doc, student, filiere, logoDataUrl);
  }

  const sideTag = side === 'both' ? '' : `_${side}`;
  const fileName = `Carte_PVC_${student.matricule}${sideTag}.pdf`;
  doc.save(fileName);
  return fileName;
}

export async function downloadBatchCartesPvcPdf(
  students: Student[],
  filieres: Filiere[],
  label = 'Cohorte'
): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CARD_W, CARD_H],
  });
  const logoDataUrl = await loadImageAsPngDataUrl(CEREC_LOGO_URL);

  for (let i = 0; i < students.length; i++) {
    const st = students[i];
    const fil = filieres.find((f) => f.code === st.filiereCode);
    if (i > 0) doc.addPage([CARD_W, CARD_H], 'portrait');
    await renderPvcRecto(doc, st, fil, logoDataUrl);
    doc.addPage([CARD_W, CARD_H], 'portrait');
    renderPvcVerso(doc, st, fil, logoDataUrl);
  }

  const safeLabel = label.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const fileName = `Cartes_PVC_${safeLabel}.pdf`;
  doc.save(fileName);
  return fileName;
}
