import { CEREC_LOGO_URL } from '../data/seedData';
import { CerecState, Student } from '../types/cerec';
import {
  computeCohortRank,
  computeStudentSemesterSummary,
  formatOrdinalFr,
  isTrimesterCode,
} from '../utils/lmd';
import { QrCodeSvg } from './QrCodeSvg';

interface BulletinReleveProps {
  student: Student;
  state: CerecState;
  semestre?: string;
}

export function BulletinReleve({ student, state, semestre }: BulletinReleveProps) {
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

  const inferredSem =
    semestre || summary.details[0]?.ue.semestre || 'S1';
  const semNumber = inferredSem.replace(/\D/g, '') || '1';
  const isTrim = isTrimesterCode(semestre ?? inferredSem);
  const periodWord = isTrim ? 'Trimestre' : 'Semestre';
  const docNumber = `${student.matricule.split('-').pop() || '0001'}-${inferredSem}`;
  const dateStr = new Date().toLocaleDateString('fr-FR');
  const optionLabel =
    student.option || filiere?.options?.[0] || filiere?.nom || student.filiereCode;
  const sessionTitle = semestre
    ? `EXAMEN ${periodWord.toUpperCase()} ${semNumber}`
    : 'RELEVÉ DE NOTES LMD CONSOLIDÉ';

  return (
    <div className="space-y-4 text-xs text-[#161e2e] bg-white">
      {/* Tier 1: Institutional Masthead */}
      <div className="border-b-2 border-[#0b1f3f] pb-3">
        <div className="flex flex-col sm:flex-row print:flex-row items-start sm:items-center print:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={CEREC_LOGO_URL}
              alt="Logo Groupe CEREC-ISCOM"
              referrerPolicy="no-referrer"
              className="w-16 h-16 object-contain rounded border border-[#e3e7ef] bg-white p-1 shrink-0"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#c58b12]">
                République du Congo · Enseignement Supérieur LMD
              </p>
              <p className="font-serif font-bold text-base sm:text-lg print:text-lg text-[#0b1f3f] tracking-tight leading-tight">
                GROUPE CEREC-ISCOM
              </p>
              <p className="text-[11px] text-slate-600">
                Institut Supérieur de Commerce &amp; Management · Partenariat ESTAM Bénin
              </p>
              <p className="text-[11px] font-medium text-[#0b1f3f]">
                Campus de {student.campus}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto print:w-auto sm:text-right print:text-right bg-[#f8f9fb] border border-[#e3e7ef] rounded-md px-3.5 py-2.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Document Académique Officiel
            </p>
            <h4 className="font-serif text-base sm:text-lg print:text-lg font-bold text-[#0b1f3f] leading-tight mt-0.5">
              Relevé de notes
            </h4>
            <p className="font-mono text-xs font-bold text-[#c58b12] mt-1 tabular-nums">
              Réf. N° {docNumber}
            </p>
          </div>
        </div>
        <div className="h-0.5 bg-[#e0a526] mt-2.5 w-full" />
      </div>

      {/* Tier 2: Structured Student Identification Card + Framed Photo */}
      <div className="border border-[#e3e7ef] bg-[#f8f9fb] rounded-md p-3.5 sm:p-4 print:p-3.5">
        <div className="flex flex-col-reverse sm:flex-row print:flex-row items-start justify-between gap-4">
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Matricule Étudiant
              </span>
              <span className="font-mono font-bold text-[#0b1f3f] text-sm">
                {student.matricule}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Année Académique
              </span>
              <span className="font-mono font-bold text-[#161e2e] text-sm">
                {student.anneeAcademique}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Nom &amp; Prénoms
              </span>
              <span className="font-bold text-[#161e2e] text-sm">
                {student.nom} {student.prenom}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Date &amp; Lieu de Naissance
              </span>
              <span className="font-medium text-[#161e2e]">
                {student.dateNaissance} à {student.lieuNaissance}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Filière de Formation
              </span>
              <span className="font-bold text-[#161e2e]">
                {filiere?.nom ?? student.filiereCode}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Cycle &amp; Niveau
              </span>
              <span className="font-bold text-[#161e2e]">
                {filiere?.cycle ?? 'Licence'} · {student.niveau}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Option / Spécialité
              </span>
              <span className="font-bold text-[#0b1f3f]">{optionLabel}</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Campus d’Attache
              </span>
              <span className="font-semibold text-[#161e2e]">{student.campus}</span>
            </div>
          </div>

          <div className="w-24 h-28 border border-slate-300 rounded bg-white flex items-center justify-center shrink-0 overflow-hidden self-center sm:self-start print:self-start">
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt={`${student.nom} ${student.prenom}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] text-slate-400 uppercase tracking-wider text-center px-1">
                Photo d’identité
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tier 3: Academic Session Banner */}
      <div className="bg-[#0b1f3f] text-white px-3.5 py-2 rounded-md flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-xs sm:text-sm print:text-xs font-bold uppercase tracking-wider text-white">
          {sessionTitle}
        </h5>
        <span className="font-mono text-[11px] text-[#eab33a] font-semibold tabular-nums">
          Crédits évalués : {summary.creditsTotaux} ECTS · Seuil LMD :{' '}
          {state.settings.seuilValidation}/20
        </span>
      </div>

      {/* UE Grouped Grade Tables */}
      <div className="space-y-4">
        {summary.ueGroups.map((group) => (
          <div key={group.uniteNom} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#161e2e]">
              <span>Unité d’enseignement : {group.uniteNom}</span>
              <span className="font-mono tabular-nums text-[#0b1f3f]">
                Moyenne UE :{' '}
                {group.moyenneUe !== null ? group.moyenneUe.toFixed(2) : '—'}
              </span>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[620px] print:min-w-0 text-left border-collapse border border-slate-300 text-[11px]">
              <thead>
                <tr className="bg-[#0b1f3f] text-white font-semibold">
                  <th className="py-1.5 px-2.5 border border-slate-400">
                    Élément constitutif
                  </th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">
                    Note Classe
                  </th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">TD</th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">TP</th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">
                    Moy. Classe
                  </th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">
                    Examen
                  </th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">
                    Coef
                  </th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">
                    Moy. Gén
                  </th>
                  <th className="py-1.5 px-2 border border-slate-400 text-center">
                    Crédit
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, idx) => (
                  <tr key={row.ue.id} className="bg-white">
                    <td className="py-1.5 px-2.5 border border-slate-300 font-medium text-[#161e2e]">
                      {row.ue.intitule}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-mono tabular-nums">
                      {row.grade?.cc !== null && row.grade?.cc !== undefined
                        ? row.grade.cc.toFixed(2)
                        : ''}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-mono tabular-nums">
                      {row.grade?.td !== null && row.grade?.td !== undefined
                        ? row.grade.td.toFixed(2)
                        : ''}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-mono tabular-nums">
                      {row.grade?.tp !== null && row.grade?.tp !== undefined
                        ? row.grade.tp.toFixed(2)
                        : ''}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-mono tabular-nums">
                      {row.moyClasse !== null ? row.moyClasse.toFixed(2) : '—'}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-mono tabular-nums">
                      {row.grade?.rattrapage !== null &&
                      row.grade?.rattrapage !== undefined
                        ? row.grade.rattrapage.toFixed(2)
                        : row.grade?.examen !== null &&
                          row.grade?.examen !== undefined
                        ? row.grade.examen.toFixed(2)
                        : '—'}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-mono tabular-nums">
                      {row.ue.coefficient}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-mono font-semibold tabular-nums">
                      {row.moyenneFinale !== null ? row.moyenneFinale.toFixed(2) : '—'}
                    </td>
                    {idx === 0 && (
                      <td
                        rowSpan={group.rows.length}
                        className="py-1.5 px-2 border border-slate-300 text-center font-mono tabular-nums align-top"
                      >
                        {group.creditsUe.toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ))}

        {summary.ueGroups.length === 0 && (
          <div className="p-4 border border-slate-300 text-center text-slate-500">
            Aucune Unité d’Enseignement configurée pour {student.filiereCode}{' '}
            {student.niveau}.
          </div>
        )}
      </div>

      {/* Bottom 2-Row Summary Grid matching PDF model */}
      <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[520px] print:min-w-0 border-collapse border border-slate-400 text-xs">
        <tbody>
          <tr>
            <td className="py-2 px-3 border border-slate-300 bg-[#f1f4f9] font-medium w-44">
              Moyenne {periodWord} {semNumber}
            </td>
            <td className="py-2 px-3 border border-slate-300 text-center font-mono font-bold text-[#0b1f3f] tabular-nums w-32">
              {summary.moyenneGenerale !== null
                ? summary.moyenneGenerale.toFixed(2)
                : '—'}
            </td>
            <td className="py-2 px-3 border border-slate-300 bg-[#f1f4f9] font-medium">
              Nombre de crédits validés
            </td>
            <td
              colSpan={2}
              className="py-2 px-3 border border-slate-300 text-center font-mono font-bold text-[#0b1f3f] tabular-nums"
            >
              {summary.creditsAcquis} Sur {summary.creditsTotaux}
            </td>
          </tr>
          <tr>
            <td className="py-2 px-3 border border-slate-300 bg-[#f1f4f9] font-medium">
              Rang
            </td>
            <td
              colSpan={2}
              className="py-2 px-3 border border-slate-300 text-center font-bold text-[#161e2e]"
            >
              {formatOrdinalFr(rang)} sur {totalCandidats} candidats
            </td>
            <td className="py-2 px-3 border border-slate-300 bg-[#f1f4f9] font-medium text-center w-24">
              Mention
            </td>
            <td className="py-2 px-3 border border-slate-300 text-center font-bold text-[#0b1f3f] w-28">
              {summary.mention}
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* Signature Footer + Verifiable QR */}
      <div className="flex flex-col sm:flex-row print:flex-row sm:items-end print:items-end justify-between gap-4 pt-4 text-xs">
        <div className="space-y-1">
          <p className="text-slate-700">
            Fait à {student.campus}, le {dateStr}
          </p>
          <p className="text-[10px] text-slate-500">
            Document authentifié par QR Code · CEREC-ISCOM
          </p>
        </div>

        <div className="flex items-end gap-4">
          <p className="font-bold text-[#0b1f3f] pb-1">
            Service de la scolarité et des examens
          </p>
          <QrCodeSvg
            value={`CEREC-ISCOM|RELEVE|${docNumber}|${student.matricule}|MOY:${summary.moyenneGenerale?.toFixed(2) ?? 'NA'}|CREDITS:${summary.creditsAcquis}/${summary.creditsTotaux}`}
            size={68}
          />
        </div>
      </div>
    </div>
  );
}
