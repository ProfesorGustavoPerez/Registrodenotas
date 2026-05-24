import { AppState, Grade } from "../types";
import { GraduationCap, BookOpen, Users, CalendarCheck, CheckSquare } from "lucide-react";

interface DashboardViewProps {
  state: AppState;
  onSelectGrade: (gradeId: string) => void;
}

export default function DashboardView({ state, onSelectGrade }: DashboardViewProps) {
  const enabledGrades = state.config.grades.filter(g => g.enabled);
  
  // Quick system metrics
  const totalGroups = enabledGrades.length;
  
  const totalStudents = enabledGrades.reduce((sum, g) => {
    const list = state.data["T1"]?.[g.id] || [];
    return sum + list.filter(s => !s.name.includes("Estudiante")).length;
  }, 0);

  const activeTrimsCount = state.config.periodCount;

  return (
    <div className="space-y-5">
      {/* Tarjetas de Métricas Generales (High Density) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 no-print select-none">
        <div className="bg-white border border-slate-200 p-3.5 px-5 rounded flex items-center gap-4 shadow-xs">
          <div className="p-2.5 bg-emerald-50 rounded text-emerald-700 border border-emerald-100">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block pb-0.5">Grupos de Trabajo</span>
            <span className="text-xl font-black text-slate-800 leading-none">
              {totalGroups} <span className="text-xs font-medium text-slate-400 normal-case ml-1">habilitados</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 px-5 rounded flex items-center gap-4 shadow-xs">
          <div className="p-2.5 bg-indigo-50 rounded text-indigo-700 border border-indigo-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block pb-0.5">Estudiantes Registrados</span>
            <span className="text-xl font-black text-slate-800 leading-none">
              {totalStudents} <span className="text-xs font-medium text-slate-400 normal-case ml-1">alumnos</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 px-5 rounded flex items-center gap-4 shadow-xs">
          <div className="p-2.5 bg-amber-50 rounded text-amber-700 border border-amber-100">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block pb-0.5">Periodos del Ciclo</span>
            <span className="text-xl font-black text-slate-800 leading-none">
              {activeTrimsCount} <span className="text-xs font-medium text-slate-400 normal-case ml-1">bloques</span>
            </span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-3.5 flex items-center gap-1.5 py-1 border-b border-slate-150">
          💼 Mis Grupos Académicos
        </h2>
        
        {enabledGrades.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-5 rounded text-sm text-center font-bold">
            No hay grupos de trabajo habilitados. Por favor diríjase a la sección de "Configuración" para habilitar sus grados de enseñanza.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {enabledGrades
              .sort((a, b) => a.label.localeCompare(b.label))
              .map(g => {
                const subjectName = g.useGlobalSubject ? state.config.subject : g.subject;
                const periodCount = g.useGlobalPeriods ? state.config.periodCount : g.periodCount;
                
                // Base student count is from T1 as it is the master listing for that grade
                const baselineStudents = state.data["T1"]?.[g.id] || [];
                const realStudentsCount = baselineStudents.filter(s => !s.name.includes("Estudiante")).length;
                
                // Calculate actual progress based on current selected period
                let av = 0;
                if (state.currentTrim === "ANUAL") {
                  // If ANUAL, average of all enabled period counts for this grade
                  let totalFilled = 0;
                  let totalPossible = 0;
                  for (let pIdx = 1; pIdx <= periodCount; pIdx++) {
                    const pList = state.data[`T${pIdx}`]?.[g.id] || [];
                    const activePStudents = pList.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));
                    totalPossible += activePStudents.length * 25;
                    totalFilled += activePStudents.reduce((acc, s) => acc + s.notes.filter(n => n !== null).length, 0);
                  }
                  av = totalPossible > 0 ? parseFloat(((totalFilled / totalPossible) * 100).toFixed(1)) : 0;
                } else {
                  // For a specific period, fetch student notes specifically for that period
                  const pList = state.data[state.currentTrim]?.[g.id] || [];
                  const activePStudents = pList.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));
                  const totalPossible = activePStudents.length * 25;
                  const totalFilled = activePStudents.reduce((acc, s) => acc + s.notes.filter(n => n !== null).length, 0);
                  av = totalPossible > 0 ? parseFloat(((totalFilled / totalPossible) * 100).toFixed(1)) : 0;
                }

                const avLabel = state.currentTrim === "ANUAL" ? "Avance General Anual" : `Avance Periodo ${state.currentTrim.replace("T", "")}`;

                return (
                  <div
                    key={g.id}
                    onClick={() => onSelectGrade(g.id)}
                    className="bg-white border border-slate-200 hover:border-[var(--primary)] p-4 rounded flex flex-col justify-between gap-4 cursor-pointer hover:shadow-xs transition-all group relative overflow-hidden"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-[var(--primary)] group-hover:text-[var(--primary-dark)] flex items-center gap-1.5 uppercase tracking-wide">
                        <GraduationCap className="w-4.5 h-4.5 flex-shrink-0" />
                        {g.label}
                      </h3>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                        <BookOpen className="w-3.5 h-3.5" />
                        {subjectName}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase tracking-widest pt-2.5 border-t border-slate-100">
                        <span>{periodCount} Periodos</span>
                        <span>{realStudentsCount} Alumnos</span>
                      </div>

                      {/* Bar de Progreso Especial para Avance de Periodo */}
                      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center text-[9px] uppercase font-black text-slate-400 tracking-wider">
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3 text-[var(--primary)]" />
                            {avLabel}
                          </span>
                          <span className="text-[var(--primary)] font-bold">{av}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                          <div
                            className="bg-[var(--primary)] h-full rounded-full transition-all duration-550"
                            style={{ width: `${av}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
