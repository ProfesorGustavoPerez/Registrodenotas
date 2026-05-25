import { Student, Config } from "../types";
import { getLowGradesAnalysis, getStudentCompliance, calculateFinal } from "../utils";

interface LowGradeReportDetailsProps {
  student: Student;
  config: Config;
  rankInfo: { rank: number; total: number };
  groupAvg: number;
  activePeriod: string;
}

export default function LowGradeReportDetails({
  student,
  config,
  rankInfo,
  groupAvg,
  activePeriod
}: LowGradeReportDetailsProps) {
  const finalNote = calculateFinal(student.notes, config);
  const compliance = getStudentCompliance(student.notes, student.reasons);
  const lowNotes = getLowGradesAnalysis(student, config);

  // Calculate lowest grade
  const notesList = student.notes.filter((n): n is number => n !== null);
  const minNote = notesList.length > 0 ? Math.min(...notesList) : 0;

  // Determine standard status level
  let statusText = "Requiere Atención Urgente";
  let statusColorClass = "text-red-700 bg-red-50 border-red-200";
  let badgeColorClass = "bg-red-700 text-white";
  
  if (finalNote >= 9.0) {
    statusText = "Excelente";
    statusColorClass = "text-emerald-800 bg-emerald-50 border-emerald-200";
    badgeColorClass = "bg-emerald-600 text-white";
  } else if (finalNote >= 8.0) {
    statusText = "Muy Bueno";
    statusColorClass = "text-blue-800 bg-blue-50 border-blue-200";
    badgeColorClass = "bg-blue-600 text-white";
  } else if (finalNote >= 6.5) {
    statusText = "Bueno";
    statusColorClass = "text-indigo-800 bg-indigo-50 border-indigo-200";
    badgeColorClass = "bg-indigo-600 text-white";
  }

  // Work done/compliance text
  const missingCount = compliance.total - compliance.count;
  const workRatioText = `Se han entregado y evaluado efectivamente ${compliance.count} de las ${compliance.total} actividades programadas en el periodo, reflejando un ${compliance.percentage}% de cumplimiento general.`;

  // Dynamic pedagogical diagnosis
  let textDiagnosis = `El diagnóstico pedagógico de rendimiento académico para este estudiante establece un nivel de logro calificado como "${statusText.toUpperCase()}", con una calificación global ponderada de ${finalNote.toFixed(1)} (escala de 1.0 a 10.0). ${workRatioText} `;

  // Performance comparison with class average
  const comparedToClass = finalNote >= groupAvg 
    ? `Este promedio sitúa al estudiante por encima de la media académica del grupo de clase (${groupAvg.toFixed(1)}), posicionándose en el puesto #${rankInfo.rank} de un total de ${rankInfo.total} alumnos evaluados.`
    : `Este promedio sitúa al estudiante por debajo de la media académica del grupo de clase (${groupAvg.toFixed(1)}), ubicándole en el puesto #${rankInfo.rank} de un total de ${rankInfo.total} alumnos evaluados.`;

  textDiagnosis += comparedToClass;

  // Specific performance warnings based on custom threshold 6.5
  if (finalNote < 6.5) {
    textDiagnosis += `\n\nESTADO DE ATENCIÓN PRIORITARIA: El estudiante se encuentra en una situación de rezago académico crítico, al no alcanzar el puntaje mínimo de aprobación colegial fijado en 6.5. `;
    
    if (lowNotes.length > 0) {
      textDiagnosis += `Se registran ${lowNotes.length} actividades reprobadas con calificaciones deficientes (menores a 6.5), registrándose un desempeño mínimo crítico con nota de ${minNote.toFixed(1)}. `;
    }

    if (missingCount > 0) {
      textDiagnosis += `La omisión o entrega inconclusa de ${missingCount} actividades representa el principal factor limitante del avance escolar. `;
    }
  }
  else if (finalNote >= 6.5 && finalNote < 8.0) {
    textDiagnosis += `\n\nANÁLISIS DE SEGUIMIENTO (APROBADO - EN PROGRESO): El estudiante mantiene una trayectoria escolar aprobatoria pero regular. Ha superado con solvencia el mínimo requerido por la institución escolar (6.5). `;
    
    if (lowNotes.length > 0) {
      textDiagnosis += `La presencia de ${lowNotes.length} tareas o calificaciones deficientes menores a 6.5 indica incidencias puntuales en el rendimiento, lo que incide de manera directa en la calificación acumulada del periodo. `;
    }
    
    if (missingCount > 0) {
      textDiagnosis += `Se tiene registro de ${missingCount} tareas no reportadas en el periodo. `;
    }
  }
  else if (finalNote >= 8.0 && finalNote < 9.0) {
    textDiagnosis += `\n\nANÁLISIS DE SEGUIMIENTO (DESTACADO): El estudiante demuestra una excelente asimilación de contenidos evaluados y sostiene una participación activa. `;
    
    if (lowNotes.length > 0) {
      textDiagnosis += `Se observa únicamente ${lowNotes.length} sub-actividad por debajo de la nota estándar de aprobación, constituyendo un punto de atención localizado. `;
    } else {
      textDiagnosis += `Presenta un historial de cero actividades reprobadas en este corte, manifestando un balance regular y un aprovechamiento óptimo del programa escolar. `;
    }
  }
  else {
    textDiagnosis += `\n\nANÁLISIS DE OPTIMIZACIÓN Y EXCELENCIA: Desempeño académico brillante y sobresaliente en todas las dimensiones evaluativas de la asignatura. El estudiante cumple con el programa, demostrando habilidades cognitivas y de investigación de nivel superior. `;
    
    if (lowNotes.length === 0) {
      textDiagnosis += `Conserva un historial regular con un índice de reprobación de cero en todas las rúbricas y proyectos elaborados en el periodo. `;
    }
  }

  return (
    <div className="space-y-3.5 print:space-y-2">
      {/* Sección principal de análisis */}
      <h4 className="text-xs font-bold text-gray-800 border-b border-gray-400 pb-1 uppercase tracking-wide">
        Ficha de Rendimiento Académico y Diagnóstico
      </h4>
      
      {/* Unified Metrics Grid */}
      <div className="bg-gray-50/50 border-2 border-black rounded p-3">
        <span className="font-bold text-gray-800 block mb-2 uppercase text-[10px] tracking-wider text-center">
          Resumen de Evaluación del Periodo
        </span>
        <div className="grid grid-cols-3 gap-y-2.5 gap-x-4 text-center text-[10px] leading-tight font-serif">
          {/* Col 1 */}
          <div className="border-r border-gray-300 pr-1 text-center">
            <span className="text-gray-500 font-bold block uppercase text-[8px]">Nivel Obtenido</span>
            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mt-1 ${badgeColorClass}`}>
              {statusText}
            </span>
          </div>

          {/* Col 2 */}
          <div className="border-r border-gray-300 pr-1 text-center">
            <span className="text-gray-500 font-bold block uppercase text-[8px]">Tasa de Entregas</span>
            <span className="text-[11px] font-black text-gray-800 block mt-1">{compliance.count} <span className="text-[9px] font-normal text-gray-550">/ {compliance.total}</span></span>
            <span className="text-[8.5px] text-emerald-800 font-extrabold block">({compliance.percentage}% entregado)</span>
          </div>

          {/* Col 3 */}
          <div className="text-center">
            <span className="text-gray-500 font-bold block uppercase text-[8px]">Lugar en Grupo</span>
            <span className="text-[11px] font-black text-gray-800 block mt-1">Puesto #{rankInfo.rank}</span>
            <span className="text-[8.5px] text-gray-500 block">de {rankInfo.total} alumnos</span>
          </div>

          {/* Separator line */}
          <div className="col-span-3 border-t border-gray-300 my-0.5"></div>

          {/* Col 4 */}
          <div className="border-r border-gray-300 pr-1 text-center">
            <span className="text-gray-500 font-bold block uppercase text-[8px]">Tareas Reprobadas</span>
            <span className={`text-[11px] font-black block mt-1 ${lowNotes.length > 0 ? "text-red-650" : "text-emerald-700"}`}>
              {lowNotes.length} {lowNotes.length === 1 ? "actividad" : "actividades"}
            </span>
            <span className="text-[8.5px] text-gray-500 block">Calificadas menores a 6.5</span>
          </div>

          {/* Col 5 */}
          <div className="border-r border-gray-300 pr-1 text-center">
            <span className="text-gray-500 font-bold block uppercase text-[8px]">Nota Más Baja</span>
            <span className={`text-[11px] font-black block mt-1 ${minNote < 6.5 ? "text-red-650" : "text-gray-800"}`}>
              {minNote.toFixed(1)}
            </span>
            <span className="text-[8.5px] text-gray-500 block">Puntaje mínimo obtenido</span>
          </div>

          {/* Col 6 */}
          <div className="text-center">
            <span className="text-gray-500 font-bold block uppercase text-[8px]">Media del Grupo</span>
            <span className="text-[11px] font-black text-slate-705 block mt-1">{groupAvg.toFixed(1)}</span>
            <span className={`text-[8.5px] font-extrabold block uppercase mt-0.5 ${finalNote >= groupAvg ? "text-emerald-700" : "text-red-650"}`}>
              {finalNote >= groupAvg ? "Arriba del promedio" : "Abajo del promedio"}
            </span>
          </div>
        </div>
      </div>

      {/* Table of specific low activities if they exist */}
      {lowNotes.length > 0 && (
        <div className="border border-gray-350 rounded overflow-hidden">
          <table className="w-full text-[10px] text-left border-collapse font-serif">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-350 font-bold text-gray-800 h-6">
                <th className="p-1 px-2.5">Actividades Reprobadas (Nota inferior a 6.5)</th>
                <th className="p-1 text-center w-16 border-l border-gray-250">Nota</th>
                <th className="p-1 px-2.5 border-l border-gray-250">Incidencia de Libreta / Tipo de Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-250">
              {lowNotes.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 h-5.5">
                  <td className="p-1 px-2.5 font-medium text-gray-850">{item.activityName}</td>
                   <td className="p-1 text-center font-black text-red-650 border-l border-gray-250">{item.note.toFixed(1)}</td>
                  <td className="p-1 px-2.5 italic text-gray-650 font-normal border-l border-gray-250 truncate max-w-xs" title={item.reason || ""}>
                    {item.reason || "Sin observación o justificación cargada"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
