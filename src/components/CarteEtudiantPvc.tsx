import { User } from 'lucide-react';
import { CEREC_LOGO_URL } from '../data/seedData';
import { Filiere, Student } from '../types/cerec';
import { QrCodeSvg } from './QrCodeSvg';

interface CarteEtudiantPvcProps {
  student: Student;
  filiere?: Filiere;
  side?: 'both' | 'recto' | 'verso';
}

export function CarteEtudiantPvc({
  student,
  filiere,
  side = 'both',
}: CarteEtudiantPvcProps) {
  const showRecto = side === 'both' || side === 'recto';
  const showVerso = side === 'both' || side === 'verso';

  const departement = filiere?.nom ?? filiere?.departement ?? 'Sciences de Gestion & Management';
  const optionNom =
    student.option || filiere?.options?.[0] || filiere?.nom || student.filiereCode;
  const cycle = filiere?.cycle ?? 'Licence';
  const initials = `${student.nom.charAt(0)}${student.prenom.charAt(0)}`.toUpperCase();

  return (
    <div
      className={`grid gap-6 justify-items-center ${
        side === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
      }`}
    >
      {/* PAGE 1 : RECTO */}
      {showRecto && (
        <div className="w-full max-w-[360px] bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between print:break-after-page">
          <div className="p-4 space-y-3.5">
            {/* Institution Header */}
            <div className="flex items-center gap-3">
              <img
                src={CEREC_LOGO_URL}
                alt="Logo Groupe CEREC-ISCOM"
                referrerPolicy="no-referrer"
                className="w-12 h-12 object-contain rounded border border-[#e3e7ef] bg-white p-0.5 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#0b1f3f] tracking-tight truncate">
                  GROUPE CEREC-ISCOM
                </p>
                <p className="text-[11px] text-slate-600 truncate">
                  {student.campus} · République du Congo
                </p>
              </div>
            </div>

            {/* Gold Title Banner */}
            <div className="bg-[#e0a526] text-[#07142b] text-center py-2 rounded-lg font-bold text-sm tracking-wide uppercase">
              CARTE D’ÉTUDIANT
            </div>

            {/* Photo + Academic Metadata Split */}
            <div className="grid grid-cols-[120px_1fr] gap-3.5 items-stretch">
              <div className="w-[120px] h-[146px] rounded-md border border-[#e3e7ef] bg-[#f8f9fb] overflow-hidden flex flex-col items-center justify-center">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={`${student.nom} ${student.prenom}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-1 p-2 text-center">
                    <User className="w-9 h-9 text-[#0b1f3f]/30" />
                    <span className="font-serif text-base font-bold text-[#0b1f3f]/60">
                      {initials}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">
                      Photo ID
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between py-0.5 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Année académique
                  </p>
                  <div className="mt-1 bg-[#0b1f3f] text-white font-mono text-xs font-bold py-1.5 px-2.5 rounded-md text-center tabular-nums">
                    {student.anneeAcademique}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Cycle & Niveau
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-[#161e2e]">
                    {cycle} · {student.niveau}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Matricule étudiant
                  </p>
                  <div className="mt-1 bg-[#0b1f3f] text-white font-mono text-xs font-bold py-1.5 px-2.5 rounded-md text-center tabular-nums">
                    {student.matricule}
                  </div>
                </div>
              </div>
            </div>

            {/* Identity Box */}
            <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Nom(s) et Prénom(s) :
              </p>
              <p className="text-sm font-bold text-[#0b1f3f] uppercase tracking-tight">
                {student.nom} {student.prenom}
              </p>
              <div className="pt-1 space-y-0.5 text-[11px]">
                <p className="text-slate-600">
                  <span className="text-slate-500 mr-1.5">FILIÈRE :</span>
                  <span className="font-semibold text-[#161e2e]">{departement}</span>
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-500 mr-1.5">OPTION :</span>
                  <span className="font-semibold text-[#0b1f3f]">{optionNom}</span>
                </p>
              </div>
            </div>

            {/* Certified ID + QR Code */}
            <div className="grid grid-cols-[1fr_92px] gap-2.5 items-stretch">
              <div className="bg-[#f1f6fd] border border-[#cad9ee] rounded-lg p-2.5 flex flex-col justify-between">
                <p className="text-[10px] font-bold uppercase text-[#0b1f3f]">
                  ID Étudiant Certifié
                </p>
                <div className="space-y-0.5 text-[10px] text-slate-600 my-1">
                  <p>Contrôle guérite & présences</p>
                  <p>Propriété officielle CEREC-ISCOM</p>
                </div>
                <p className="font-mono text-[11px] font-bold text-[#0b1f3f] tabular-nums">
                  {student.matricule}
                </p>
              </div>

              <div className="border border-[#e3e7ef] rounded-lg p-1 bg-white flex items-center justify-center">
                <QrCodeSvg
                  value={`CEREC-ISCOM|CARTE|${student.matricule}|${student.nom} ${student.prenom}|${student.filiereCode}-${student.niveau}|${student.campus}|${student.anneeAcademique}`}
                  size={82}
                  className="border-0 p-0"
                />
              </div>
            </div>
          </div>

          {/* Footer Band */}
          <div className="border-t-4 border-[#e0a526] bg-[#0b1f3f] text-white text-center py-2 px-3">
            <p className="text-[10px] font-bold tracking-wider uppercase">
              RÉPUBLIQUE DU CONGO · CEREC-ISCOM
            </p>
          </div>
        </div>
      )}

      {/* PAGE 2 : VERSO */}
      {showVerso && (
        <div className="w-full max-w-[360px] bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            {/* Dark Navy Header */}
            <div className="bg-[#0b1f3f] text-white px-4 py-3 flex items-center gap-3">
              <img
                src={CEREC_LOGO_URL}
                alt="Logo Groupe CEREC-ISCOM"
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain rounded bg-white p-0.5 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-xs tracking-tight uppercase truncate">
                  GROUPE CEREC-ISCOM
                </p>
                <p className="text-[10px] font-semibold text-[#eab33a] uppercase tracking-wide truncate">
                  AUTHENTIFICATION & CONTACTS ÉTUDIANT
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Contact Box */}
              <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    Numéro de téléphone :
                  </p>
                  <p className="font-mono text-xs font-bold text-[#0b1f3f] mt-0.5 tabular-nums">
                    {student.telephone || 'Non renseigné'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    Adresse email :
                  </p>
                  <p className="text-xs font-semibold text-[#161e2e] mt-0.5 break-all">
                    {student.email}
                  </p>
                </div>
              </div>

              {/* Academic Specialty Box */}
              <div className="bg-[#f1f6fd] border border-[#cad9ee] rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    Filière académique :
                  </p>
                  <p className="text-xs font-bold text-[#0b1f3f] mt-0.5">{departement}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">
                    Option de spécialité :
                  </p>
                  <p className="text-xs font-bold text-[#0b1f3f] mt-0.5">{optionNom}</p>
                </div>
              </div>

              {/* Birth & Emergency */}
              <div className="space-y-1 text-[11px] text-slate-700 px-1">
                <p>
                  Né(e) le : <span className="font-mono">{student.dateNaissance}</span> à{' '}
                  {student.lieuNaissance}
                </p>
                <p>
                  Contact d’urgence : {student.tuteurNom}{' '}
                  {student.tuteurTel ? `(${student.tuteurTel})` : ''}
                </p>
              </div>

              {/* Security Notice */}
              <div className="bg-[#f8f9fb] border border-[#e3e7ef] rounded-lg p-3 text-center space-y-1">
                <p className="text-[10px] font-bold uppercase text-[#161e2e]">
                  Avis réglementaire & sécurité
                </p>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Carte strictement personnelle. Obligatoire sur les campus et examens.
                  <br />
                  En cas de perte, rapporter à la Scolarité : Campus {student.campus}, CEREC-ISCOM.
                </p>
              </div>

              {/* Direction Signature & Certified Badge */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-[11px]">
                  <p className="text-slate-500">Direction de la Scolarité</p>
                  <p className="font-bold text-[#0b1f3f] mt-0.5">
                    Service Scolarité CEREC-ISCOM
                  </p>
                </div>
                <div className="bg-[#e0a526] text-[#07142b] font-bold text-[10px] uppercase tracking-wide px-3.5 py-2 rounded-lg shrink-0">
                  CEREC-CERTIFIÉ
                </div>
              </div>
            </div>
          </div>

          {/* Dark Barcode Footer */}
          <div className="bg-[#07142b] text-white px-4 py-2.5 flex items-center justify-center gap-4">
            <div className="flex items-center gap-[2px]" aria-hidden="true">
              {[2, 1, 3, 1, 2, 1].map((w, i) => (
                <span
                  key={i}
                  className="bg-white/80 h-3.5 inline-block"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
            <span className="font-mono text-[11px] font-semibold tracking-widest tabular-nums">
              {student.matricule}
            </span>
            <div className="flex items-center gap-[2px]" aria-hidden="true">
              {[1, 2, 1, 3, 1, 2, 1, 2, 1].map((w, i) => (
                <span
                  key={i}
                  className="bg-white/80 h-3.5 inline-block"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
