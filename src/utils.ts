import { Student, Config } from "./types";

export function getAvg(arr: (number | null)[]): number {
  const valid = arr.filter((n): n is number => n !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

export function calculateFinal(notes: (number | null)[], config: Config): number {
  if (!notes) return 0;
  const w = config.blockWeights;
  const p1 = getAvg(notes.slice(0, 10)); // Cotidianas
  const p2 = getAvg(notes.slice(10, 20)); // Santillana
  const p3 = notes[20] ?? 0; // Integradora
  const p4 = notes[21] ?? 0; // Proyecto
  const p5 = notes[22] ?? 0; // Holística
  const p6 = ((notes[23] ?? 0) * 0.85) + ((notes[24] ?? 0) * 0.15); // Examen + Rúbrica
  
  const finalVal = (p1 * w[0] / 100) + 
                   (p2 * w[1] / 100) + 
                   (p3 * w[2] / 100) + 
                   (p4 * w[3] / 100) + 
                   (p5 * w[4] / 100) + 
                   (p6 * w[5] / 100);
                   
  return parseFloat(finalVal.toFixed(1));
}

export function isNoEntregoIncident(reason: string | null | undefined): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized.includes("no entrego s.p.") || normalized.includes("no entrego sp");
}

export interface StudentCompliance {
  count: number;
  total: number;
  percentage: number;
}

export function getStudentCompliance(notes: (number | null)[], reasons?: (string | null)[]): StudentCompliance {
  const rs = reasons || Array(notes.length).fill(null);
  
  let deliveredCount = 0;
  let missedButExpectedCount = 0;
  
  for (let i = 0; i < notes.length; i++) {
    const hasNote = notes[i] !== null;
    const isMissed = isNoEntregoIncident(rs[i]);
    
    if (isMissed) {
      missedButExpectedCount++;
    } else if (hasNote) {
      deliveredCount++;
    }
  }
  
  const total = deliveredCount + missedButExpectedCount;
  
  return {
    count: deliveredCount,
    total: total > 0 ? total : 25,
    percentage: total > 0 ? parseFloat(((deliveredCount / total) * 100).toFixed(0)) : 100
  };
}

export function getGradeAvance(students: Student[]): number {
  const realStudents = students.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));
  if (realStudents.length === 0) return 0;
  
  let totalNotesCount = 0;
  let filledNotesCount = 0;
  
  realStudents.forEach(s => {
    totalNotesCount += 25;
    filledNotesCount += s.notes.filter(n => n !== null).length;
  });
  
  return parseFloat(((filledNotesCount / totalNotesCount) * 100).toFixed(1));
}

export interface RankInfo {
  rank: number;
  total: number;
}

export function getStudentRank(
  studentId: string, 
  gradeId: string, 
  currentTrim: string, 
  data: Record<string, Record<string, Student[]>>,
  config: Config
): RankInfo {
  const sourceTrim = currentTrim === "ANUAL" ? "T1" : currentTrim;
  const baseStudents = data[sourceTrim]?.[gradeId] || [];
  const activeStudents = baseStudents.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));
  
  if (activeStudents.length === 0) return { rank: 1, total: 1 };
  
  const studentScores = activeStudents.map(s => {
    let finalScore = 0;
    if (currentTrim === "ANUAL") {
      const g = config.grades.find(x => x.id === gradeId);
      const count = g ? (g.useGlobalPeriods ? config.periodCount : g.periodCount) : config.periodCount;
      let totalSum = 0;
      for (let i = 1; i <= count; i++) {
        const ps = data[`T${i}`]?.[gradeId]?.find(x => x.id === s.id);
        totalSum += ps ? calculateFinal(ps.notes, config) : 0;
      }
      finalScore = totalSum / count;
    } else {
      const ps = data[currentTrim]?.[gradeId]?.find(x => x.id === s.id);
      finalScore = ps ? calculateFinal(ps.notes, config) : 0;
    }
    return { id: s.id, score: finalScore };
  });
  
  studentScores.sort((a, b) => b.score - a.score);
  
  const studentIndex = studentScores.findIndex(x => x.id === studentId);
  const rank = studentIndex !== -1 ? studentIndex + 1 : activeStudents.length;
  
  return {
    rank,
    total: activeStudents.length
  };
}

export function getGroupAverage(
  gradeId: string, 
  currentTrim: string, 
  data: Record<string, Record<string, Student[]>>,
  config: Config
): number {
  const sourceTrim = currentTrim === "ANUAL" ? "T1" : currentTrim;
  const baseStudents = data[sourceTrim]?.[gradeId] || [];
  const activeStudents = baseStudents.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));
  
  if (activeStudents.length === 0) return 0;
  
  let sum = 0;
  activeStudents.forEach(s => {
    if (currentTrim === "ANUAL") {
      const g = config.grades.find(x => x.id === gradeId);
      const count = g ? (g.useGlobalPeriods ? config.periodCount : g.periodCount) : config.periodCount;
      let totalSum = 0;
      for (let i = 1; i <= count; i++) {
        const ps = data[`T${i}`]?.[gradeId]?.find(x => x.id === s.id);
        totalSum += ps ? calculateFinal(ps.notes, config) : 0;
      }
      sum += totalSum / count;
    } else {
      const ps = data[currentTrim]?.[gradeId]?.find(x => x.id === s.id);
      sum += ps ? calculateFinal(ps.notes, config) : 0;
    }
  });
  
  return parseFloat((sum / activeStudents.length).toFixed(1));
}

export interface LowGradeAnalysis {
  activityName: string;
  note: number;
  blockName: string;
  reason: string | null;
}

export function getLowGradesAnalysis(student: Student, config: Config): LowGradeAnalysis[] {
  const result: LowGradeAnalysis[] = [];
  const blockNames = config.blockNames;
  
  student.notes.forEach((note, index) => {
    if (note !== null && note < 6.5) {
      let blockName = "";
      let activityName = "";
      
      if (index < 10) {
        blockName = blockNames[0];
        activityName = `${blockNames[0]} (Actividad ${index + 1})`;
      } else if (index < 20) {
        blockName = blockNames[1];
        activityName = `${blockNames[1]} (Actividad ${index - 9})`;
      } else if (index === 20) {
        blockName = blockNames[2];
        activityName = blockNames[2];
      } else if (index === 21) {
        blockName = blockNames[3];
        activityName = blockNames[3];
      } else if (index === 22) {
        blockName = blockNames[4];
        activityName = blockNames[4];
      } else {
        blockName = blockNames[5];
        activityName = index === 23 ? `${blockNames[5]} - Escrito` : `${blockNames[5]} - Rúbrica`;
      }
      
      result.push({
        activityName,
        note,
        blockName,
        reason: student.reasons[index]
      });
    }
  });
  
  return result;
}

export function generatePedagogicalJustification(
  student: Student, 
  config: Config, 
  avgNote: number,
  compliance: StudentCompliance
): string {
  if (avgNote >= 8.5) {
    return "El estudiante demuestra un desempeño excepcional en la materia. Mantiene un cumplimiento de actividades del " + compliance.percentage + "%, con excelente calidad en sus participaciones, demostrando gran interés y entendimiento de los temas abordados.";
  }
  
  if (avgNote >= 6.5) {
    const lowNotesCount = student.notes.filter(v => v !== null && v < 6.5).length;
    let text = "El estudiante presenta un desempeño satisfactorio en general, cumpliendo con el " + compliance.percentage + "% de las actividades.";
    if (lowNotesCount > 0) {
      text += " No obstante, se registran " + lowNotesCount + " notas bajas puntuales que limitan su promedio acumulado.";
    } else {
      text += " Mantiene una constancia regular en el cumplimiento de las entregas.";
    }
    return text;
  }
  
  // Rendimiento bajo (nota < 6.5)
  const missingCount = student.notes.filter((v, idx) => v === null && isNoEntregoIncident(student.reasons[idx])).length;
  const lowNotes = getLowGradesAnalysis(student, config);
  const lowNotesCount = lowNotes.length;
  
  let justification = "Justificación Pedagógica: El estudiante se encuentra en condición de riesgo académico con un promedio de " + avgNote.toFixed(1) + ". ";
  
  // Razon de tareas no presentadas
  if (missingCount > 3) {
    justification += "El factor principal del bajo rendimiento es el incumplimiento de tareas, habiendo omitido la entrega de " + missingCount + " actividades en el periodo (Cumplimiento de tareas del " + compliance.percentage + "%). ";
  } else {
    justification += "Aunque conserva un cumplimiento de entregas del " + compliance.percentage + "%, ";
  }
  
  // Razon de bajas notas
  if (lowNotesCount > 0) {
    const categoriesSet = new Set(lowNotes.map(x => x.blockName));
    const categoriesText = Array.from(categoriesSet).join(", ");
    justification += "Se observa baja asimilación o preparación baja en contenidos de " + categoriesText + ", donde obtuvo promedios inferiores al mínimo requerido. ";
  }
  
  // Coleccionar incidencias registradas
  const incidences = student.reasons.filter((r): r is string => r !== null && r !== "");
  if (incidences.length > 0) {
    // Tomar hasta 3 incidencias unicas
    const uniqueInc = Array.from(new Set(incidences)).slice(0, 3);
    justification += "Adicionalmente, se registran las siguientes incidencias en la libreta digital: '" + uniqueInc.join("', '") + "'. ";
  }
  
  return justification;
}
