import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { CEREC_LOGO_URL } from '../data/seedData';
import { CerecState, Student } from '../types/cerec';
import { computeStudentFinance, formatFCFA } from './lmd';

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

export function getInscriptionReceiptRef(student: Student, state: CerecState): string {
  const inscriptionPay = state.payments.find(
    (p) => p.studentId === student.id && p.motif === 'Inscription'
  );
  if (inscriptionPay) return inscriptionPay.numeroRecu;
  const suffix = student.matricule.split('-').pop() || student.id.slice(-4);
  const campusCode = student.campus === 'Pointe-Noire' ? 'PN' : 'BZ';
  return `REC-INS-${campusCode}-${student.anneeAcademique.slice(0, 4)}-${suffix}`;
}

export async function downloadRecuInscriptionPdf(
  student: Student,
  state: CerecState
): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  const filiere = state.filieres.find((f) => f.code === student.filiereCode);
  const fin = computeStudentFinance(student, state.filieres, state.payments);
  const fraisInscription = filiere?.fraisInscription ?? 75000;
  const scolariteApresBourse = Math.round(
    (filiere?.scolariteAnnuelle ?? 480000) * (1 - (student.boursePct || 0) / 100)
  );
  const studentPayments = state.payments
    .filter((p) => p.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const inscriptionPay = studentPayments.find((p) => p.motif === 'Inscription');
  const receiptRef = getInscriptionReceiptRef(student, state);
  const dateEmission = student.dateInscription || new Date().toISOString().slice(0, 10);

  const logoDataUrl = await loadImageAsPngDataUrl(CEREC_LOGO_URL);
  const qrPayload = `CEREC-ISCOM|RECU-INSCRIPTION|${receiptRef}|${student.matricule}|${student.nom} ${student.prenom}|${student.filiereCode}-${student.niveau}|${student.campus}|PAYE:${fin.totalPaye}FCFA`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 220, margin: 1 });

  let y = 14;

  // Header
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', marginX, y, 18, 18);
  } else {
    doc.setDrawColor(11, 31, 63);
    doc.rect(marginX, y, 18, 18);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(197, 139, 18);
  doc.text(
    pdfText('RÉPUBLIQUE DU CONGO · ENSEIGNEMENT SUPÉRIEUR LMD'),
    marginX + 21,
    y + 3.5
  );

  doc.setFontSize(13);
  doc.setTextColor(11, 31, 63);
  doc.text('GROUPE CEREC-ISCOM', marginX + 21, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(`Institut Supérieur de Commerce & Management · Campus de ${student.campus}`),
    marginX + 21,
    y + 13.5
  );
  doc.text(
    pdfText('Partenariat ESTAM Bénin · Scolarité & Caisse Centrale'),
    marginX + 21,
    y + 17.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText("REÇU D'INSCRIPTION"), pageWidth - marginX, y + 5, {
    align: 'right',
  });
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(197, 139, 18);
  doc.text(pdfText(receiptRef), pageWidth - marginX, y + 10.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(`Année ${student.anneeAcademique} · Date : ${dateEmission}`),
    pageWidth - marginX,
    y + 15.5,
    { align: 'right' }
  );

  y += 22;
  doc.setDrawColor(11, 31, 63);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setDrawColor(224, 165, 38);
  doc.setLineWidth(0.4);
  doc.line(marginX, y + 1.2, pageWidth - marginX, y + 1.2);

  y += 7;

  // Title banner
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(marginX, y, contentWidth, 12, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(11, 31, 63);
  doc.text(
    pdfText("ATTESTATION & REÇU DE VALIDATION D'INSCRIPTION ACADÉMIQUE"),
    marginX + contentWidth / 2,
    y + 7.5,
    { align: 'center' }
  );

  y += 17;

  // Student identity box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(marginX, y, contentWidth, 34, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(197, 139, 18);
  doc.text(pdfText('ÉTUDIANT INSCRIT'), marginX + 4, y + 5.5);

  doc.setFontSize(11);
  doc.setTextColor(22, 30, 46);
  doc.text(pdfText(`${student.nom} ${student.prenom}`), marginX + 4, y + 11.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText(`Matricule : ${student.matricule}`), pageWidth - marginX - 4, y + 11.5, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(
      `Filière : ${filiere ? `${filiere.code} - ${filiere.nom}` : student.filiereCode}${
        student.option ? ` (${student.option})` : ''
      }`
    ),
    marginX + 4,
    y + 18
  );
  doc.text(
    pdfText(
      `Niveau : ${student.niveau}  |  Campus : ${student.campus}  |  Dossier : ${student.statutDossier}`
    ),
    marginX + 4,
    y + 23.5
  );
  doc.text(
    pdfText(
      `Téléphone : ${student.telephone || 'Non renseigné'}  |  Né(e) le : ${
        student.dateNaissance
      } à ${student.lieuNaissance}`
    ),
    marginX + 4,
    y + 29
  );

  y += 39;

  // Parent & Garant two-column box
  const colW = (contentWidth - 4) / 2;
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(marginX, y, colW, 24, 1.5, 1.5, 'FD');
  doc.roundedRect(marginX + colW + 4, y, colW, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText('PARENT / TUTEUR LÉGAL'), marginX + 4, y + 5.5);
  doc.text(pdfText('GARANT (FINANCIER & MORAL)'), marginX + colW + 8, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 30, 46);
  doc.text(
    pdfText(
      `${student.tuteurNom}${student.parentLien ? ` (${student.parentLien})` : ''}`
    ),
    marginX + 4,
    y + 11.5
  );
  doc.text(
    pdfText(
      `${student.garantNom || student.tuteurNom}${
        student.garantLien ? ` (${student.garantLien})` : ''
      }`
    ),
    marginX + colW + 8,
    y + 11.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(`Tél : ${student.tuteurTel || 'Non renseigné'}`),
    marginX + 4,
    y + 16.5
  );
  doc.text(
    pdfText(`Tél : ${student.garantTel || student.tuteurTel || 'Non renseigné'}`),
    marginX + colW + 8,
    y + 16.5
  );
  if (student.parentProfession || student.parentAdresse) {
    doc.text(
      pdfText([student.parentProfession, student.parentAdresse].filter(Boolean).join(' - ')),
      marginX + 4,
      y + 21
    );
  }
  if (student.garantCni || student.garantProfession) {
    doc.text(
      pdfText(
        [student.garantCni ? `ID: ${student.garantCni}` : '', student.garantProfession]
          .filter(Boolean)
          .join(' - ')
      ),
      marginX + colW + 8,
      y + 21
    );
  }

  y += 30;

  // Financial Breakdown Box + QR Code
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(11, 31, 63);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, y, contentWidth, 50, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText('DÉCOMPTE FINANCIER DE L’INSCRIPTION'), marginX + 4, y + 6.5);

  const infoW = contentWidth - 36;
  const rows: Array<[string, string, boolean?]> = [
    ["Frais d'inscription académique", formatFCFA(fraisInscription)],
    [
      `Scolarité annuelle${student.boursePct > 0 ? ` (bourse -${student.boursePct}%)` : ''}`,
      formatFCFA(scolariteApresBourse),
    ],
    ['Total annuel engagé', formatFCFA(fin.totalDu), true],
    [
      inscriptionPay
        ? `Montant réglé à ce jour (Reçu ${inscriptionPay.numeroRecu})`
        : 'Montant encaissé à ce jour',
      formatFCFA(fin.totalPaye),
      true,
    ],
    ['Reste à payer (Caisse Centrale)', formatFCFA(fin.resteAPayer), true],
  ];

  let ry = y + 13;
  rows.forEach(([label, val, bold]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(pdfText(label), marginX + 4, ry);

    doc.setFont('courier', 'bold');
    doc.setTextColor(11, 31, 63);
    doc.text(pdfText(val), marginX + infoW, ry, { align: 'right' });

    doc.setDrawColor(235, 238, 245);
    doc.setLineWidth(0.2);
    doc.line(marginX + 4, ry + 1.8, marginX + infoW, ry + 1.8);
    ry += 7;
  });

  // QR Code on right
  doc.addImage(qrDataUrl, 'PNG', pageWidth - marginX - 28, y + 9, 24, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('Vérification QR'), pageWidth - marginX - 16, y + 36.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(fin.totalPaye >= fraisInscription ? 4 : 180, fin.totalPaye >= fraisInscription ? 120 : 83, fin.totalPaye >= fraisInscription ? 87 : 9);
  doc.text(
    pdfText(
      fin.totalPaye >= fraisInscription ? 'INSCRIPTION RÉGLÉE' : 'À RÉGLER À LA CAISSE'
    ),
    pageWidth - marginX - 16,
    y + 43,
    { align: 'center' }
  );

  y += 60;

  // Footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfText(
      "Ce reçu atteste la validation administrative de l'inscription au sein du Groupe CEREC-ISCOM. La présentation à la Caisse Centrale reste requise pour tout règlement de frais ou retrait de quittance de paiement."
    ),
    marginX,
    y,
    { maxWidth: contentWidth }
  );

  y += 16;

  // Signatures
  const sigW = contentWidth / 3;
  const sigLabels = [
    "L'Étudiant / Parent",
    'Service Scolarité',
    'Cachet & Visa Caisse',
  ];
  sigLabels.forEach((lbl, idx) => {
    const cx = marginX + sigW * idx + sigW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(pdfText(lbl), cx, y, { align: 'center' });
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(marginX + sigW * idx + 6, y + 16, marginX + sigW * (idx + 1) - 6, y + 16);
    doc.setLineDashPattern([], 0);
  });

  const fileName = `Recu_Inscription_${student.matricule.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(fileName);
  return fileName;
}

export async function downloadRecuPaiementPdf(
  payment: import('../types/cerec').Payment,
  state: CerecState
): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  const st = state.students.find((s) => s.id === payment.studentId);
  const filiere = st
    ? state.filieres.find((f) => f.code === st.filiereCode)
    : undefined;
  const hasPayment = state.payments.some((p) => p.id === payment.id);
  const effectivePayments = hasPayment ? state.payments : [payment, ...state.payments];
  const fin = st
    ? computeStudentFinance(st, state.filieres, effectivePayments)
    : null;

  const logoDataUrl = await loadImageAsPngDataUrl(CEREC_LOGO_URL);
  const qrPayload = `CEREC-ISCOM|RECU|${payment.numeroRecu}|${
    st?.matricule ?? payment.studentId
  }|${payment.montant}FCFA|${payment.motif}|${payment.date}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 220, margin: 1 });

  let y = 14;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', marginX, y, 18, 18);
  } else {
    doc.setDrawColor(11, 31, 63);
    doc.rect(marginX, y, 18, 18);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(197, 139, 18);
  doc.text(
    pdfText('RÉPUBLIQUE DU CONGO · ENSEIGNEMENT SUPÉRIEUR LMD'),
    marginX + 21,
    y + 3.5
  );

  doc.setFontSize(13);
  doc.setTextColor(11, 31, 63);
  doc.text('GROUPE CEREC-ISCOM', marginX + 21, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(`Institut Supérieur de Commerce & Management · Campus de ${payment.campus}`),
    marginX + 21,
    y + 13.5
  );
  doc.text(
    pdfText('Caisse Centrale & Comptabilité · Partenariat ESTAM Bénin'),
    marginX + 21,
    y + 17.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText('REÇU DE PAIEMENT OFFICIEL'), pageWidth - marginX, y + 5, {
    align: 'right',
  });
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(197, 139, 18);
  doc.text(pdfText(payment.numeroRecu), pageWidth - marginX, y + 10.5, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(
      `Date : ${payment.date}${
        st ? ` · Année ${st.anneeAcademique}` : ''
      }`
    ),
    pageWidth - marginX,
    y + 15.5,
    { align: 'right' }
  );

  y += 22;
  doc.setDrawColor(11, 31, 63);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setDrawColor(224, 165, 38);
  doc.setLineWidth(0.4);
  doc.line(marginX, y + 1.2, pageWidth - marginX, y + 1.2);

  y += 8;

  // Student & Amount summary box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(227, 231, 239);
  doc.roundedRect(marginX, y, contentWidth, 30, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('REÇU DE'), marginX + 4, y + 6);
  doc.text(pdfText('MONTANT ENCAISSÉ'), pageWidth - marginX - 4, y + 6, {
    align: 'right',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(22, 30, 46);
  doc.text(
    pdfText(st ? `${st.nom} ${st.prenom}` : payment.studentId),
    marginX + 4,
    y + 12.5
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(4, 120, 87);
  doc.text(pdfText(formatFCFA(payment.montant)), pageWidth - marginX - 4, y + 12.5, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfText(
      st
        ? `${st.matricule} · ${filiere ? `${filiere.code} - ${filiere.nom}` : st.filiereCode} (${st.niveau})`
        : payment.campus
    ),
    marginX + 4,
    y + 19.5
  );
  doc.text(
    pdfText(`Mode de règlement : ${payment.mode}`),
    pageWidth - marginX - 4,
    y + 19.5,
    { align: 'right' }
  );
  if (st) {
    doc.text(
      pdfText(`Campus : ${payment.campus} · Tél : ${st.telephone || 'Non renseigné'}`),
      marginX + 4,
      y + 25
    );
  }

  y += 36;

  // Operation details & QR Code
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(11, 31, 63);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, y, contentWidth, 48, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText('DÉTAILS DU RÈGLEMENT & SITUATION DE COMPTE'), marginX + 4, y + 6.5);

  const infoW = contentWidth - 36;
  const detailRows: Array<[string, string, boolean?]> = [
    ['Motif du versement', payment.motif, true],
    ["Date d'opération", payment.date],
    ['Caissier(ère) émetteur', payment.caissier],
    ...(fin
      ? ([
          ['Cumul total payé', formatFCFA(fin.totalPaye), true],
          ['Reste à payer sur scolarité', formatFCFA(fin.resteAPayer), true],
        ] as Array<[string, string, boolean?]>)
      : []),
  ];

  let ry = y + 13;
  detailRows.forEach(([label, val, bold]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(pdfText(label), marginX + 4, ry);

    doc.setFont('courier', 'bold');
    doc.setTextColor(11, 31, 63);
    doc.text(pdfText(val), marginX + infoW, ry, { align: 'right' });

    doc.setDrawColor(227, 231, 239);
    doc.setLineWidth(0.2);
    doc.line(marginX + 4, ry + 1.8, marginX + infoW, ry + 1.8);
    ry += 6.5;
  });

  if (payment.observation) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfText(`Observation : ${payment.observation}`), marginX + 4, y + 45.5, {
      maxWidth: infoW,
    });
  }

  doc.addImage(qrDataUrl, 'PNG', pageWidth - marginX - 28, y + 9, 24, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfText('Vérification QR'), pageWidth - marginX - 16, y + 36.5, {
    align: 'center',
  });
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(11, 31, 63);
  doc.text(pdfText(payment.numeroRecu), pageWidth - marginX - 16, y + 41.5, {
    align: 'center',
  });

  y += 62;

  // Signatures
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(pdfText(`Établi par : ${payment.caissier}`), marginX, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(pdfText('Cachet & Signature Caisse'), pageWidth - marginX - 26, y, {
    align: 'center',
  });
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(pageWidth - marginX - 52, y + 16, pageWidth - marginX, y + 16);
  doc.setLineDashPattern([], 0);

  const fileName = `Recu_${payment.numeroRecu.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(fileName);
  return fileName;
}

