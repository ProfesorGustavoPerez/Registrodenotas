import { useEffect } from "react";
import { AppState, Student } from "../types";
import { 
  calculateFinal, getAvg, getStudentCompliance, getStudentRank, getGroupAverage 
} from "../utils";
import LowGradeReportDetails from "./LowGradeReportDetails";
import { Printer, ArrowLeft } from "lucide-react";

interface FichaViewProps {
  state: AppState;
  studentId: string;
  gradeId: string;
  onBack: () => void;
  onUpdateManualComment: (comment: string) => void;
}

export default function FichaView({
  state,
  studentId,
  gradeId,
  onBack,
  onUpdateManualComment,
}: FichaViewProps) {
  const g = state.config.grades.find(x => x.id === gradeId);
  
  // Base details reference
  const sBase = state.data["T1"]?.[gradeId]?.find(x => x.id === studentId);
  const activePeriod = state.currentTrim;
  const isAnual = activePeriod === "ANUAL";

  // Individual student data matching the period
  const sPeriod = isAnual 
    ? sBase 
    : (state.data[activePeriod]?.[gradeId]?.find(x => x.id === studentId) || sBase);

  // If they are missing, we should render nothing and trigger onBack in useEffect
  useEffect(() => {
    if (!g || !sBase || !sPeriod) {
      onBack();
    }
  }, [g, sBase, sPeriod, onBack]);

  if (!g || !sBase || !sPeriod) {
    return null;
  }

  const count = g.useGlobalPeriods ? state.config.periodCount : g.periodCount;

  const reportDate = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const subject = g.useGlobalSubject ? state.config.subject : g.subject;
  const blockNames = state.config.blockNames;
  const blockWeights = state.config.blockWeights;

  // Let's calculate standard metrics for displaying
  const compliance = getStudentCompliance(sPeriod.notes, sPeriod.reasons);
  const rankInfo = getStudentRank(studentId, gradeId, activePeriod, state.data, state.config);
  const groupAvg = getGroupAverage(gradeId, activePeriod, state.data, state.config);

  const finalScore = isAnual
    ? (() => {
        let totalSum = 0;
        for (let i = 1; i <= count; i++) {
          const ps = state.data[`T${i}`]?.[gradeId]?.find(x => x.id === studentId);
          totalSum += ps ? calculateFinal(ps.notes, state.config) : 0;
        }
        return totalSum / count;
      })()
    : calculateFinal(sPeriod.notes, state.config);

  const handlePrint = () => {
    const originalTitle = document.title;
    const periodStr = isAnual ? "Resumen Anual" : `Periodo ${activePeriod.replace("T", "")}`;
    const studentName = sBase.name;
    
    // Set format: Materia, Periodo, Nombre
    document.title = `${subject}, ${periodStr}, ${studentName}`;
    
    window.print();
    
    // Brief delay to let browser queue the print dialog with the modified title, then restore it
    setTimeout(() => {
      document.title = originalTitle;
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Barra de control para volver e imprimir */}
      <div className="flex justify-center gap-4 border border-gray-200 bg-white p-3 rounded-lg shadow-2xs w-full max-w-2xl mx-auto no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded font-bold text-xs uppercase cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimir Reporte
        </button>
      </div>

      {/* Contenedor Hoja de Impresión */}
      <div 
        className="ficha-page font-serif mx-auto shadow-md border border-gray-300 p-6 md:p-8 w-full max-w-[21.59cm] min-h-[26.5cm] bg-white text-black text-[11px] flex flex-col justify-between"
        id="ficha-print-element"
      >
        <div className="space-y-4">
          {/* Encabezado Institucional */}
          <div className="text-center border-b-2 border-double border-black pb-2.5 space-y-1">
            <h1 className="text-lg md:text-xl font-bold uppercase tracking-tight">{state.config.school}</h1>
            <p className="text-xs font-bold tracking-wide italic text-gray-700 font-serif">INFORME DE RENDIMIENTO ACADÉMICO INDIVIDUAL</p>
            <span className="inline-block px-3 py-0.5 mt-0.5 text-[10px] font-black uppercase tracking-wider bg-gray-100 rounded border border-gray-300">
              {isAnual ? "RESUMEN ANUAL" : `PERIODO ${activePeriod.replace("T", "")}`}
            </span>
          </div>

          {/* Ficha técnica estudiante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 py-1 text-xs">
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-gray-500 mr-2 uppercase block">Estudiante:</span>
              <span className="font-extrabold text-sm text-gray-900 block truncate">{sBase.name}</span>
            </div>
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-gray-500 mr-2 uppercase block">Grado / Grupo:</span>
              <span className="font-extrabold text-sm text-gray-900 block truncate">{g.label}</span>
            </div>
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-gray-500 mr-2 uppercase block">Materia / Asignatura:</span>
              <span className="font-bold text-gray-900 block truncate">{subject}</span>
            </div>
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-gray-500 mr-2 uppercase block">Fecha de Emisión:</span>
              <span className="font-bold text-gray-900 block">{reportDate}</span>
            </div>
          </div>

          {/* Tabla de notas según el tipo de informe (Anual vs Normal) */}
          {isAnual ? (
            <div className="space-y-4">
              <div className="border-2 border-black rounded overflow-hidden">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black font-bold h-9 text-xs">
                      <th className="p-2 text-left px-4">Periodo Evaluativo</th>
                      <th className="p-2 border-l border-black w-24">Cumplimiento</th>
                      <th className="p-2 border-l border-black w-28">Calificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/60">
                    {Array.from({ length: count }).map((_, idx) => {
                      const pNum = idx + 1;
                      const pStudent = state.data[`T${pNum}`]?.[gradeId]?.find(x => x.id === studentId);
                      const finalNote = pStudent ? calculateFinal(pStudent.notes, state.config) : 0;
                      const pCompliance = pStudent ? getStudentCompliance(pStudent.notes, pStudent.reasons) : { count: 0, total: 25, percentage: 0 };
                      return (
                        <tr key={idx} className="h-8">
                          <td className="p-2 text-left px-4 font-semibold uppercase">Periodo {pNum}</td>
                          <td className="p-2 border-l border-black font-medium">{pCompliance.count} / {pCompliance.total} ({pCompliance.percentage}%)</td>
                          <td className={`p-2 border-l border-black font-bold text-sm ${finalNote < 6.5 ? "text-red-600 font-extrabold" : "text-emerald-800"}`}>
                            {finalNote.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-black bg-gray-50 h-10 font-bold">
                      <td className="p-2 text-right px-4 uppercase text-xs" colSpan={2}>PROMEDIO ANUAL FINAL OBTENIDO:</td>
                      <td className={`p-2 border-l border-black font-black text-base ${finalScore < 6.5 ? "text-red-700" : "text-emerald-800"}`}>
                        {finalScore.toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Estadísticas comparativas adicionales */}
              <div className="bg-gray-50 border border-gray-300 rounded p-3 text-xs space-y-1 font-serif text-justify">
                <span className="font-bold text-gray-800 underline uppercase tracking-tight block mb-1 text-[11px]">
                  Estadísticas Comparativas y Contexto del Grupo
                </span>
                <p>
                  El estudiante se posiciona en el <b>Puesto #{rankInfo.rank} de {rankInfo.total}</b> en la tabla del grupo. El promedio académico promedio del grupo es de <b>{groupAvg.toFixed(1)}</b>, situándose el estudiante <b>{finalScore >= groupAvg ? "por arriba del promedio" : "por abajo del promedio"}</b> de la clase.
                </p>
                <p>
                  Su regularidad promedio en el cumplimiento de entregas se sitúa al <b>{compliance.percentage}%</b> de efectividad anual para la asignatura de {subject}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 print:space-y-2">
              {/* Desglose ponderado por tipos de evaluación */}
              <div className="border border-black rounded overflow-hidden">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black font-bold h-8 text-[11px]">
                      <th className="p-1.5 text-left px-4">Tipo de Evaluación</th>
                      <th className="p-1.5 border-l border-black w-24">Ponderación</th>
                      <th className="p-1.5 border-l border-black w-28">Calificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/60">
                    {blockNames.map((name, idx) => {
                      let blockAvg = 0;
                      if (idx === 0) blockAvg = getAvg(sPeriod.notes.slice(0, 10));
                      else if (idx === 1) blockAvg = getAvg(sPeriod.notes.slice(10, 20));
                      else if (idx === 2) blockAvg = sPeriod.notes[20] ?? 0;
                      else if (idx === 3) blockAvg = sPeriod.notes[21] ?? 0;
                      else if (idx === 4) blockAvg = sPeriod.notes[22] ?? 0;
                      else blockAvg = ((sPeriod.notes[23] ?? 0) * 0.85) + ((sPeriod.notes[24] ?? 0) * 0.15);

                      return (
                        <tr key={idx} className="h-7.5">
                          <td className="p-1.5 text-left px-4 font-semibold">{name}</td>
                          <td className="p-1.5 border-l border-black text-gray-600 font-medium">{blockWeights[idx]}%</td>
                          <td className={`p-1.5 border-l border-black font-bold ${blockAvg < 6.5 ? "text-red-600 font-extrabold" : "text-emerald-800"}`}>
                            {blockAvg.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-black bg-gray-50 h-9 font-bold">
                      <td className="p-2 text-right px-4 uppercase text-[10px]" colSpan={2}>PROMEDIO DEL PERIODO OBTENIDO:</td>
                      <td className={`p-2 border-l border-black font-black text-xs ${finalScore < 6.5 ? "text-red-700" : "text-emerald-900"}`}>
                        {finalScore.toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Justificaciones automáticas por notas bajas y de incidencias */}
              <LowGradeReportDetails 
                student={sPeriod} 
                config={state.config} 
                rankInfo={rankInfo}
                groupAvg={groupAvg}
                activePeriod={activePeriod}
              />
            </div>
          )}

          {/* Comentarios del docente y observaciones manuales */}
          <div className="border border-black p-2.5 rounded bg-zinc-50/25 font-serif space-y-1.5 print:space-y-1">
            <span className="font-bold text-gray-800 text-[11px] underline block uppercase tracking-tight">
              Observaciones del Docente:
            </span>
            
            {/* Campo no imprimible para editar las observaciones sobre la marcha */}
            <div className="no-print space-y-1">
              <label className="text-[10px] font-bold text-emerald-800 block">Escribir comentario libre / observación adicional:</label>
              <textarea
                value={sBase.manualComment || ""}
                onChange={(e) => onUpdateManualComment(e.target.value)}
                placeholder="Introduzca el análisis pedagógico, sugerencias o recomendaciones libres..."
                className="w-full h-14 p-2 bg-white text-xs border border-gray-300 rounded font-sans focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            
            {/* Sección visual para impresión */}
            {(sBase.manualComment && sBase.manualComment.trim()) ? (
              <p className="text-justify text-xs text-gray-800 whitespace-pre-wrap leading-relaxed pr-2 font-serif border-l-4 border-black pl-3 italic">
                {sBase.manualComment}
              </p>
            ) : (
              <p className="text-gray-400 italic text-[11px] font-medium py-1">
                -- No se registran comentarios manuales complementarios por parte de la docencia para el presente cierre evaluativo. --
              </p>
            )}
          </div>
        </div>

        {/* Firmas y Cierres en Pie de Página */}
        <div className="pt-6 print:pt-4">
          <div className="grid grid-cols-2 gap-x-12 text-center items-end">
            <div className="flex flex-col items-center justify-end">
              <div className="h-11 mb-1 w-full flex items-end justify-center">
                {/* Espacio en blanco para firma manuscrita del docente */}
              </div>
              <div className="w-full border-t border-black pt-1 font-bold uppercase tracking-wider text-[9px] text-gray-700">
                Firma del Docente
                <span className="text-[8px] block text-gray-400 normal-case font-medium">{state.config.teacher}</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-end">
              <div className="h-8 mb-1 w-full flex items-end justify-center"></div>
              <div className="w-[85%] border-t border-black pt-1 font-bold uppercase tracking-wider text-[9px] text-gray-700">
                Firma del Padre de Familia / Tutor
                <span className="text-[8px] block text-gray-400 font-medium select-none">Responsable Legal</span>
              </div>
            </div>
          </div>

          <div className="mt-5 border border-black p-2 bg-gray-50 text-[9.5px] text-gray-600 text-center leading-relaxed">
            <p className="font-bold uppercase text-[10px] text-gray-700 tracking-tight">Compromiso y Vinculación Académica</p>
            <p>Se solicita al padre de familia, tutor o responsable legal firmar este informe de rendimiento académico individual y coordinar con el estudiante para que lo pegue de forma permanente en su cuaderno de <b>{subject}</b>.</p>
            <p className="italic font-semibold text-slate-700 mt-0.5">Informe oficial emitido electrónicamente el {reportDate}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
