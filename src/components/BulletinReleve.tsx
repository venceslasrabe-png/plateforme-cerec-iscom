import { CEREC_LOGO_URL } from '../data/seedData';
import { CerecState, Student } from '../types/cerec';
import {
  computeCohortRank,
  computeStudentSemesterSummary,
  formatOrdinalFr,
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

  // Determine semester label (e.g., S1 -> SEMESTRE 1)
  const inferredSem =
    semestre || summary.details[0]?.ue.semestre || 'S1';
  const semNumber = inferredSem.replace(/\D/g, '') || '1';
  const docNumber = `${student.matricule.split('-').pop() || '0001'}${inferredSem}`;
  const dateStr = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="space-y-5 text-xs text-[#161e2e] bg-white">
      {/* Top 3-Zone Institutional Header matching official model */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={CEREC_LOGO_URL}
            alt="Logo Groupe CEREC-ISCOM"
            referrerPolicy="no-referrer"
            className="w-14 h-14 object-contain rounded border border-[#e3e7ef] bg-white p-0.5 shrink-0"
          />
          <div>
            <p className="font-bold text-sm text-[#0b1f3f] tracking-tight uppercase">
              GROUPE CEREC-ISCOM
            </p>
            <p className="text-[11px] text-slate-600">
              {student.campus} · République du Congo
            </p>
          </div>
        </div>

        <div className="text-center pt-1">
          <h4 className="text-lg font-bold text-[#161e2e] leading-tight">
            Relevé de notes
          </h4>
          <p className="font-mono text-xs font-semibold text-[#0b1f3f] mt-1">
            N° {docNumber}
          </p>
        </div>

        <div className="w-24 h-28 border border-slate-400 flex items-center justify-center shrink-0 bg-slate-50/40 overflow-hidden">
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={`${student.nom} ${student.prenom}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              Photo
            </span>
          )}
        </div>
      </div>

      {/* Student Identification Block */}
      <div className="grid grid-cols-[150px_1fr] gap-y-1.5 text-xs max-w-lg -mt-4">
        <span className="text-slate-600">Étudiant :</span>
        <span className="font-mono font-bold text-[#0b1f3f]">{student.matricule}</span>

        <span className="text-slate-600">Nom :</span>
        <span className="font-bold text-[#161e2e]">
          {student.nom} {student.prenom}
        </span>

        <span className="text-slate-600">Filière :</span>
        <span className="font-bold text-[#161e2e]">
          {filiere?.nom ?? student.filiereCode}
        </span>

        <span className="text-slate-600">Option :</span>
        <span className="font-bold text-[#0b1f3f]">
          {student.option || filiere?.options?.[0] || filiere?.nom || student.filiereCode}
        </span>

        <span className="text-slate-600">Cycle :</span>
        <span className="font-bold text-[#161e2e]">{filiere?.cycle ?? 'Licence'}</span>

        <span className="text-slate-600">Niveau :</span>
        <span className="font-bold text-[#161e2e]">{student.niveau}</span>

        <span className="text-slate-600">Année académique :</span>
        <span className="font-bold font-mono text-[#161e2e]">
          {student.anneeAcademique}
        </span>
      </div>

      {/* Session Title */}
      <div className="pt-1">
        <h5 className="text-sm font-bold uppercase tracking-wide text-[#0b1f3f]">
          EXAMEN SEMESTRE {semNumber}
        </h5>
      </div>

      {/* UE Grouped Grade Tables */}
      <div className="space-y-4">
        {summary.ueGroups.map((group) => (
          <div key={group.uniteNom} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#161e2e]">
              <span>Unité d’enseignement : {group.uniteNom}</span>
              <span className="font-mono tabular-nums text-[#0b1f3f]">
                Moyenne UE :{' '}
                {group.moyenneUe !== null ? group.moyenneUe.toFixed(2) : '—'}
              </span>
            </div>

            <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
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
        ))}

        {summary.ueGroups.length === 0 && (
          <div className="p-4 border border-slate-300 text-center text-slate-500">
            Aucune Unité d’Enseignement configurée pour {student.filiereCode}{' '}
            {student.niveau}.
          </div>
        )}
      </div>

      {/* Bottom 2-Row Summary Grid matching PDF model */}
      <table className="w-full border-collapse border border-slate-400 text-xs">
        <tbody>
          <tr>
            <td className="py-2 px-3 border border-slate-300 bg-[#f1f4f9] font-medium w-44">
              Moyenne Semestre {semNumber}
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

      {/* Signature Footer + Verifiable QR */}
      <div className="flex items-end justify-between gap-4 pt-4 text-xs">
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
