import { useState, useEffect } from "react";
import { AppState, Student } from "../types";
import { 
  calculateFinal, getAvg, getStudentCompliance, getStudentRank, getGroupAverage, findStudentForPeriod
} from "../utils";
import LowGradeReportDetails from "./LowGradeReportDetails";
import { Printer, ArrowLeft, ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";
import { downloadElementsAsPDF } from "../utils/pdfGenerator";

interface FichaViewProps {
  state: AppState;
  studentId: string;
  gradeId: string;
  onBack: () => void;
  onUpdateManualComment: (comment: string) => void;
  onNavigateStudent?: (studentId: string) => void;
  onViewAllReports?: () => void;
}

export default function FichaView({
  state,
  studentId,
  gradeId,
  onBack,
  onUpdateManualComment,
  onNavigateStudent,
  onViewAllReports,
}: FichaViewProps) {
  const [printScale, setPrintScale] = useState(0.95);
  const g = state.config.grades.find(x => x.id === gradeId);

  // Retrieve alphabetical list of active, real students in the grade
  const sortedStudents = (state.data["T1"]?.[gradeId] || [])
    .filter(s => !s.isDisabled && !s.name.includes("Estudiante"))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

  const currentIdx = sortedStudents.findIndex(s => s.id === studentId);
  const prevStudent = currentIdx > 0 ? sortedStudents[currentIdx - 1] : null;
  const nextStudent = currentIdx < sortedStudents.length - 1 ? sortedStudents[currentIdx + 1] : null;
  
  // Base details reference
  const sBase = state.data["T1"]?.[gradeId]?.find(x => x.id === studentId);
  const activePeriod = state.currentTrim;
  const isAnual = activePeriod === "ANUAL";

  // Individual student data matching the period
  const sPeriod = isAnual 
    ? sBase 
    : (findStudentForPeriod(state.data[activePeriod]?.[gradeId], studentId, sBase?.name) || sBase);

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
          const ps = findStudentForPeriod(state.data[`T${i}`]?.[gradeId], studentId, sBase?.name);
          totalSum += ps ? calculateFinal(ps.notes, state.config) : 0;
        }
        return totalSum / count;
      })()
    : calculateFinal(sPeriod.notes, state.config);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    const el = document.getElementById("ficha-print-element");
    if (!el) return;
    setIsDownloading(true);
    try {
      const periodStr = isAnual ? "Resumen-Anual" : `Periodo-${activePeriod.replace("T", "")}`;
      // Filename format as letter size PDF
      const filename = `Informe_${subject}_${g?.label || "Grado"}_${sBase.name.replace(/\s+/g, "_")}_${periodStr}.pdf`;
      await downloadElementsAsPDF([el], filename);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

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
      {/* Barra de control para volver, navegar e imprimir */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 border border-slate-200 bg-white p-3.5 rounded-lg shadow-2xs w-full max-w-4xl mx-auto no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded font-bold text-xs uppercase cursor-pointer hover:bg-slate-50 transition-colors text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          {/* Navigation through students in alphabetical order */}
          {sortedStudents.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded">
              <button
                onClick={() => prevStudent && onNavigateStudent?.(prevStudent.id)}
                disabled={!prevStudent}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  prevStudent ? "text-slate-700 hover:bg-slate-200" : "text-slate-300 cursor-not-allowed"
                }`}
                title={prevStudent ? `Anterior: ${prevStudent.name}` : undefined}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600 min-w-14 text-center">
                {currentIdx !== -1 ? `${currentIdx + 1} / ${sortedStudents.length}` : `-- / ${sortedStudents.length}`}
              </span>
              
              <button
                onClick={() => nextStudent && onNavigateStudent?.(nextStudent.id)}
                disabled={!nextStudent}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  nextStudent ? "text-slate-700 hover:bg-slate-200" : "text-slate-300 cursor-not-allowed"
                }`}
                title={nextStudent ? `Siguiente: ${nextStudent.name}` : undefined}
              >
                <ChevronRight className="w-4 h-4 text-black" />
              </button>
            </div>
          )}
        </div>

        {/* Ajuste de escala interactivo */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider">Escala Impresión:</span>
          <div className="flex border border-slate-300 rounded overflow-hidden shadow-2xs">
            {[1.0, 0.95, 0.90, 0.85, 0.80, 0.75].map((val) => (
              <button
                key={val}
                onClick={() => setPrintScale(val)}
                className={`px-2 py-1 text-xs font-black cursor-pointer transition-colors ${
                  printScale === val 
                    ? "bg-[var(--primary)] text-white" 
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {Math.round(val * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onViewAllReports && (
            <button
              onClick={onViewAllReports}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors"
              title="Ver todos los reportes de este grupo juntos para imprimirlos a la vez"
            >
              <FileText className="w-4 h-4" />
              Ver Todos (Impresión)
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors shadow-sm ${
              isDownloading 
                ? "bg-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Descargando..." : "Descargar Reporte"}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Contenedor Hoja de Impresión */}
      <div 
        className="ficha-page font-serif mx-auto shadow-md border border-gray-300 p-6 md:p-8 w-full max-w-[21.59cm] min-h-[26.5cm] bg-white text-black text-[11px] flex flex-col justify-between"
        id="ficha-print-element"
        style={{
          ["--print-zoom" as any]: printScale,
          zoom: printScale,
        }}
      >
        <div className="space-y-4">
          {/* Encabezado Institucional */}
          <div className="text-center border-b-2 border-double border-black pb-2 space-y-0.5">
            <h1 className="text-lg md:text-xl font-bold uppercase tracking-tight text-black">{state.config.school}</h1>
            <p className="text-xs font-bold tracking-wide italic text-black font-serif">INFORME DE RENDIMIENTO ACADÉMICO INDIVIDUAL</p>
            <span className="inline-block px-3 py-0.5 mt-0.5 text-[10px] font-black uppercase tracking-wider bg-gray-100 rounded border border-gray-300 text-black">
              {isAnual ? "RESUMEN ANUAL" : `PERIODO ${activePeriod.replace("T", "")}`}
            </span>
          </div>

          {/* Ficha técnica estudiante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5 py-0.5 text-xs text-black">
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-black mr-2 uppercase block">Estudiante:</span>
              <span className="font-extrabold text-sm text-black block truncate">{sBase.name}</span>
            </div>
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-black mr-2 uppercase block">Grado:</span>
              <span className="font-extrabold text-sm text-black block truncate">{g.label}</span>
            </div>
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-black mr-2 uppercase block">Materia:</span>
              <span className="font-bold text-black block truncate">{subject}</span>
            </div>
            <div className="flex justify-between items-end border-b border-dotted border-gray-400">
              <span className="font-bold text-black mr-2 uppercase block">Fecha de Emisión:</span>
              <span className="font-bold text-black block">{reportDate}</span>
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
                      const pStudent = findStudentForPeriod(state.data[`T${pNum}`]?.[gradeId], studentId, sBase?.name);
                      const finalNote = pStudent ? calculateFinal(pStudent.notes, state.config) : 0;
                      const pCompliance = pStudent ? getStudentCompliance(pStudent.notes, pStudent.reasons) : { count: 0, total: 25, percentage: 0 };
                      return (
                        <tr key={idx} className="h-8">
                          <td className="p-2 text-left px-4 font-semibold uppercase">Periodo {pNum}</td>
                          <td className="p-2 border-l border-black font-medium">{pCompliance.count} / {pCompliance.total} ({pCompliance.percentage}%)</td>
                          <td className="p-2 border-l border-black font-bold text-sm text-black">
                            {finalNote.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-black bg-gray-50 h-10 font-bold text-black">
                      <td className="p-2 text-right px-4 uppercase text-xs" colSpan={2}>PROMEDIO ANUAL FINAL OBTENIDO:</td>
                      <td className="p-2 border-l border-black font-black text-base text-black">
                        {finalScore.toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Estadísticas comparativas adicionales */}
              <div className="bg-gray-50 border border-gray-300 rounded p-3 text-xs space-y-1 font-serif text-justify text-black">
                <span className="font-bold text-black underline uppercase tracking-tight block mb-1 text-[11px]">
                  Estadísticas Comparativas y Contexto del Grupo
                </span>
                <p>
                  El estudiante se posiciona <b>{rankInfo.rank <= 5 ? `en el Puesto #${rankInfo.rank} de ${rankInfo.total}` : "Fuera del top 5"}</b> en la tabla del grupo. El promedio académico promedio del grupo es de <b>{groupAvg.toFixed(1)}</b>, situándose el estudiante <b>{finalScore >= groupAvg ? "por arriba del promedio" : "por abajo del promedio"}</b> de la clase.
                </p>
                <p>
                  Su regularidad promedio en el cumplimiento de entregas se sitúa al <b>{compliance.percentage}%</b> de efectividad anual para la asignatura de {subject}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 print:space-y-2">
                {/* Desglose ponderado por tipos de evaluación */}
                {(() => {
                  const evaluatedBlocks = blockNames.map((name, idx) => {
                    let blockAvg = 0;
                    if (idx === 0) blockAvg = getAvg(sPeriod.notes.slice(0, 10));
                    else if (idx === 1) blockAvg = getAvg(sPeriod.notes.slice(10, 20));
                    else if (idx === 2) blockAvg = sPeriod.notes[20] ?? 0;
                    else if (idx === 3) blockAvg = sPeriod.notes[21] ?? 0;
                    else if (idx === 4) blockAvg = sPeriod.notes[22] ?? 0;
                    else blockAvg = ((sPeriod.notes[23] ?? 0) * 0.85) + ((sPeriod.notes[24] ?? 0) * 0.15);
                    return { name, weight: blockWeights[idx], avg: blockAvg };
                  });

                  return (
                    <div className="space-y-2 print:space-y-1.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="border border-black rounded overflow-hidden">
                          <table className="w-full text-center border-collapse">
                            <thead>
                              <tr className="bg-gray-100 border-b border-black font-bold h-6 text-[10px] text-black">
                                <th className="p-1 text-left px-2.5">Tipo de Evaluación</th>
                                <th className="p-1 border-l border-black w-20">Ponderación</th>
                                <th className="p-1 border-l border-black w-24">Calificación</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/60">
                              {evaluatedBlocks.slice(0, 3).map((block, idx) => (
                                <tr key={idx} className="h-5.5 text-[10px] text-black">
                                  <td className="p-1 text-left px-2.5 font-semibold truncate text-[9.5px]">{block.name}</td>
                                  <td className="p-1 border-l border-black text-black font-medium text-[9.5px]">{block.weight}%</td>
                                  <td className="p-1 border-l border-black font-bold text-black text-[9.5px]">
                                    {block.avg.toFixed(1)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="border border-black rounded overflow-hidden">
                          <table className="w-full text-center border-collapse">
                            <thead>
                              <tr className="bg-gray-100 border-b border-black font-bold h-6 text-[10px] text-black">
                                <th className="p-1 text-left px-2.5">Tipo de Evaluación</th>
                                <th className="p-1 border-l border-black w-20">Ponderación</th>
                                <th className="p-1 border-l border-black w-24">Calificación</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/60">
                              {evaluatedBlocks.slice(3, 6).map((block, idx) => (
                                <tr key={idx} className="h-5.5 text-[10px] text-black">
                                  <td className="p-1 text-left px-2.5 font-semibold truncate text-[9.5px]">{block.name}</td>
                                  <td className="p-1 border-l border-black text-black font-medium text-[9.5px]">{block.weight}%</td>
                                  <td className="p-1 border-l border-black font-bold text-black text-[9.5px]">
                                    {block.avg.toFixed(1)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="border border-black bg-gray-50/50 rounded p-1 flex justify-between items-center text-[9.5px] font-bold text-black">
                        <span className="uppercase text-black font-bold font-serif tracking-wider pl-1.5 text-[9px]">
                          PROMEDIO DEL PERIODO OBTENIDO:
                        </span>
                        <span className="px-3 py-0.5 border border-black bg-white rounded text-[10.5px] font-black text-black">
                          {finalScore.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

              {/* Justificaciones automáticas por notas bajas y de incidencias */}
              <LowGradeReportDetails 
                student={sPeriod} 
                config={state.config} 
                rankInfo={rankInfo}
                groupAvg={groupAvg}
                activePeriod={activePeriod}
                activityNames={state.activityNames?.[activePeriod]?.[gradeId]}
              />
            </div>
          )}

          {/* Comentarios del docente y observaciones manuales */}
          <div className="border border-black p-2.5 rounded bg-zinc-50/25 font-serif space-y-1.5 print:space-y-1 text-black">
            <span className="font-bold text-black text-[11px] underline block uppercase tracking-tight">
              Observaciones del Docente:
            </span>
            
            {/* Campo no imprimible para editar las observaciones sobre la marcha */}
            <div className="no-print space-y-1">
              <label className="text-[10px] font-bold text-emerald-800 block">Escribir comentario:</label>
              <textarea
                value={sBase.manualComment || ""}
                onChange={(e) => onUpdateManualComment(e.target.value)}
                placeholder="Introduzca el análisis pedagógico, sugerencias o recomendaciones libres..."
                className="w-full h-14 p-2 bg-white text-xs border border-gray-300 rounded font-sans focus:outline-none focus:border-[var(--primary)] text-black"
              />
            </div>
            
            {/* Sección visual para impresión */}
            {(sBase.manualComment && sBase.manualComment.trim()) ? (
              <p className="text-justify text-xs text-black whitespace-pre-wrap leading-relaxed pr-2 font-serif border-l-4 border-black pl-3 italic">
                {sBase.manualComment}
              </p>
            ) : (
              <p className="text-black italic text-[11px] font-bold py-1">
                -- No se registran comentarios manuales complementarios por parte del docente para el presente cierre evaluativo. --
              </p>
            )}
          </div>
        </div>

        {/* Firmas y Cierres en Pie de Página */}
        <div className="pt-6 print:pt-4 text-black">
          <div className="grid grid-cols-2 gap-x-12 text-center items-end">
            <div className="flex flex-col items-center justify-end">
              <div className="h-11 mb-1 w-full flex items-end justify-center">
                {/* Espacio en blanco para firma manuscrita del docente */}
              </div>
              <div className="w-full border-t border-black pt-1 font-bold uppercase tracking-wider text-[9px] text-black">
                Firma del Docente
                <span className="text-[8px] block text-black normal-case font-bold">{state.config.teacher}</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-end">
              <div className="h-8 mb-1 w-full flex items-end justify-center"></div>
              <div className="w-[85%] border-t border-black pt-1 font-bold uppercase tracking-wider text-[9px] text-black">
                Firma del Padre de Familia / Tutor
                <span className="text-[8px] block text-black font-bold select-none">Responsable Legal</span>
              </div>
            </div>
          </div>

          <div className="mt-5 border border-black p-2 bg-gray-50 text-[9.5px] text-black text-center leading-relaxed">
            <p className="font-bold uppercase text-[10px] text-black tracking-tight">Compromiso y Vinculación Académica</p>
            <p>Se solicita al padre de familia, tutor o responsable legal firmar este informe de rendimiento académico individual y coordinar con el estudiante para que lo pegue de forma permanente en su cuaderno de <b>{subject}</b>.</p>
            <p className="italic font-bold text-black mt-0.5">Informe oficial emitido electrónicamente el {reportDate}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
