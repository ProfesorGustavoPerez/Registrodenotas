import { useState, useMemo, useEffect, ChangeEvent, Fragment } from "react";
import { AppState, Student } from "../types";
import { calculateFinal, getAvg, getStudentCompliance, getStudentRank } from "../utils";
import StudentActionsDropdown from "./StudentActionsDropdown";
import { 
  ArrowLeft, GraduationCap, Award, Sliders, ToggleLeft, ToggleRight, 
  Eye, EyeOff, UserX, UserCheck, Sparkles, AlertTriangle, PlusCircle, HelpCircle
} from "lucide-react";

interface GradeInputProps {
  value: number | null;
  onChange: (value: string) => void;
}

function GradeInput({ value, onChange }: GradeInputProps) {
  const [localVal, setLocalVal] = useState<string>(value === null ? "" : String(value));

  useEffect(() => {
    // If external status/notes state changes, sync our local input state
    const formatted = value === null ? "" : String(value);
    if (parseFloat(localVal) !== value) {
      setLocalVal(formatted);
    }
  }, [value]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(",", ".");
    let sanitized = raw.replace(/[^0-9.]/g, "");
    
    // Permit maximum one decimal point
    const parts = sanitized.split(".");
    if (parts.length > 2) return;

    // Direct range check to prevent numbers above 10
    const num = parseFloat(sanitized);
    if (!isNaN(num) && num > 10) return;

    setLocalVal(sanitized);

    // If the value doesn't end in '.', push state up, else leave it to complete
    if (sanitized === "" || sanitized === ".") {
      onChange("");
    } else if (!sanitized.endsWith(".")) {
      onChange(sanitized);
    }
  };

  const handleBlur = () => {
    if (localVal.endsWith(".")) {
      const cleaned = localVal.slice(0, -1);
      setLocalVal(cleaned);
      onChange(cleaned);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={localVal}
      onChange={handleInputChange}
      onBlur={handleBlur}
      className="w-full h-full text-center bg-transparent outline-none select-all font-bold text-xs"
      onFocus={(e) => e.target.select()}
    />
  );
}

interface SheetViewProps {
  state: AppState;
  onBack: () => void;
  onRename: (studentId: string) => void;
  onToggleStatus: (studentId: string) => void;
  onMigrate: (studentId: string) => void;
  onViewReport: (studentId: string) => void;
  onDelete: (studentId: string) => void;
  onAddStudentsClick: () => void;
  onUpdateNote: (studentId: string, noteIndex: number, value: string) => void;
  onOpenReason: (studentId: string, noteIndex: number) => void;
  onPeriodChange: (trim: string) => void;
  onToggleRankings: (visible: boolean) => void;
  onToggleHideInactive: (hide: boolean) => void;
  onToggleListNumber: (listNumberOnly: boolean) => void;
}

const getNoteCellWidth = (idx: number): { width: string; minWidth: string } => {
  if (idx >= 0 && idx <= 9) return { width: "62px", minWidth: "62px" }; // Cotidianas
  if (idx >= 10 && idx <= 19) return { width: "62px", minWidth: "62px" }; // Santillana
  if (idx >= 20 && idx <= 22) return { width: "100px", minWidth: "100px" }; // Trabajos integradores, Proyectos, Holística
  if (idx >= 23 && idx <= 24) return { width: "65px", minWidth: "65px" }; // Examen escrito, Examen rúbrica
  return { width: "62px", minWidth: "62px" };
};

export default function SheetView({
  state,
  onBack,
  onRename,
  onToggleStatus,
  onMigrate,
  onViewReport,
  onDelete,
  onAddStudentsClick,
  onUpdateNote,
  onOpenReason,
  onPeriodChange,
  onToggleRankings,
  onToggleHideInactive,
  onToggleListNumber,
}: SheetViewProps) {
  const [sortColumn, setSortColumn] = useState<{
    id: "name" | "final" | "note" | "avgC" | "avgS" | "avgEx" | "period";
    index?: number;
    direction: "asc" | "desc";
  }>({ id: "name", direction: "asc" });

  const [activeDropdownStudentId, setActiveDropdownStudentId] = useState<string | null>(null);

  const gid = state.currentGradeId;
  const g = gid ? state.config.grades.find(x => x.id === gid) : undefined;

  useEffect(() => {
    if (!gid || !g) {
      onBack();
    }
  }, [gid, g, onBack]);

  if (!gid || !g) {
    return null;
  }

  const count = g.useGlobalPeriods ? state.config.periodCount : g.periodCount;
  
  // Clean values for headers
  const blockNames = state.config.blockNames;
  const blockWeights = state.config.blockWeights;

  // Process standard data copy
  const baseStudents = state.data["T1"]?.[gid] || [];

  const selectValue = useMemo(() => {
    if (sortColumn.id === "name") {
      return sortColumn.direction === "asc" ? "alphabetical" : "alphabetical-desc";
    }
    if (sortColumn.id === "final") {
      return sortColumn.direction === "desc" ? "best" : "worst";
    }
    return "custom";
  }, [sortColumn]);

  const handleSelectSortChange = (val: string) => {
    if (val === "alphabetical") {
      setSortColumn({ id: "name", direction: "asc" });
    } else if (val === "alphabetical-desc") {
      setSortColumn({ id: "name", direction: "desc" });
    } else if (val === "best") {
      setSortColumn({ id: "final", direction: "desc" });
    } else if (val === "worst") {
      setSortColumn({ id: "final", direction: "asc" });
    }
  };

  const toggleSort = (id: "name" | "final" | "note" | "avgC" | "avgS" | "avgEx" | "period", index?: number) => {
    setSortColumn((prev) => {
      const isSame = prev.id === id && prev.index === index;
      if (isSame) {
        return {
          id,
          index,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      } else {
        // Alumnos de A-Z por defecto, notas/promedios de Mayor a Menor por defecto
        const defaultDir = id === "name" ? "asc" : "desc";
        return { id, index, direction: defaultDir };
      }
    });
  };

  const renderSortIndicator = (id: "name" | "final" | "note" | "avgC" | "avgS" | "avgEx" | "period", index?: number) => {
    if (sortColumn.id !== id || sortColumn.index !== index) {
      return <span className="text-slate-300 opacity-30 group-hover:opacity-100 transition-opacity ml-1 font-mono text-[9px] no-print">↕</span>;
    }
    return (
      <span className="text-indigo-600 font-extrabold ml-1 font-mono text-[9px] no-print">
        {sortColumn.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  // Filter out students based on hideInactive flag
  const processedStudents = useMemo(() => {
    let list = [...baseStudents];
    
    // Filter logic:
    if (state.hideInactive) {
      // Hide inactive (isDisabled=true) AND raw placeholders ("Estudiante X")
      list = list.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));
    }
    
    // Sorting logic:
    list.sort((a, b) => {
      // Always push placeholders/empty students to the bottom
      const dummyA = a.name.includes("Estudiante");
      const dummyB = b.name.includes("Estudiante");
      if (dummyA && !dummyB) return 1;
      if (!dummyA && dummyB) return -1;
      
      let comparison = 0;

      if (sortColumn.id === "name") {
        comparison = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      } else if (sortColumn.id === "final") {
        const getFinalVal = (s: Student) => {
          if (state.currentTrim === "ANUAL") {
            let totalSum = 0;
            for (let i = 1; i <= count; i++) {
              const ps = state.data[`T${i}`]?.[gid]?.find(x => x.id === s.id);
              totalSum += ps ? calculateFinal(ps.notes, state.config) : 0;
            }
            return totalSum / count;
          } else {
            const ps = state.data[state.currentTrim]?.[gid]?.find(x => x.id === s.id);
            return ps ? calculateFinal(ps.notes, state.config) : 0;
          }
        };
        comparison = getFinalVal(a) - getFinalVal(b);
      } else if (sortColumn.id === "note" && sortColumn.index !== undefined) {
        const getNoteVal = (s: Student) => {
          const ps = state.data[state.currentTrim]?.[gid]?.find(x => x.id === s.id);
          const notes = ps ? ps.notes : s.notes || [];
          return notes[sortColumn.index!] ?? 0;
        };
        comparison = getNoteVal(a) - getNoteVal(b);
      } else if (sortColumn.id === "avgC") {
        const getAvgC = (s: Student) => {
          const ps = state.data[state.currentTrim]?.[gid]?.find(x => x.id === s.id);
          const notes = ps ? ps.notes : s.notes || [];
          return getAvg(notes.slice(0, 10));
        };
        comparison = getAvgC(a) - getAvgC(b);
      } else if (sortColumn.id === "avgS") {
        const getAvgS = (s: Student) => {
          const ps = state.data[state.currentTrim]?.[gid]?.find(x => x.id === s.id);
          const notes = ps ? ps.notes : s.notes || [];
          return getAvg(notes.slice(10, 20));
        };
        comparison = getAvgS(a) - getAvgS(b);
      } else if (sortColumn.id === "avgEx") {
        const getAvgEx = (s: Student) => {
          const ps = state.data[state.currentTrim]?.[gid]?.find(x => x.id === s.id);
          const notes = ps ? ps.notes : s.notes || [];
          const written = notes[23] ?? 0;
          const rubric = notes[24] ?? 0;
          return (written * 0.85) + (rubric * 0.15);
        };
        comparison = getAvgEx(a) - getAvgEx(b);
      } else if (sortColumn.id === "period" && sortColumn.index !== undefined) {
        const getPeriodVal = (s: Student) => {
          const pStudent = state.data[`T${sortColumn.index! + 1}`]?.[gid]?.find(x => x.id === s.id);
          return pStudent ? calculateFinal(pStudent.notes, state.config) : 0;
        };
        comparison = getPeriodVal(a) - getPeriodVal(b);
      }

      // If values are equal, fallback to alphabetical
      if (comparison === 0) {
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      }

      return sortColumn.direction === "asc" ? comparison : -comparison;
    });

    return list;
  }, [baseStudents, state.hideInactive, state.currentTrim, sortColumn, state.data, gid, count, state.config]);

  const colWidth = useMemo(() => {
    let maxCharCount = 14;
    processedStudents.forEach(s => {
      const nameLen = state.showListNumberOnly 
        ? 14 
        : (s.name || "").length;
      if (nameLen > maxCharCount) {
        maxCharCount = nameLen;
      }
    });
    // Highly optimized width: reduced multipliers and tight margins to avoid wasted horizontal space
    const calculated = maxCharCount * 6.0 + 105;
    return Math.max(185, Math.min(360, Math.round(calculated)));
  }, [processedStudents, state.showListNumberOnly]);

  // Calculate Honors and Alert rankings
  const rankings = useMemo(() => {
    const list = baseStudents.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));
    if (list.length === 0) return { honors: [], alerts: [] };

    const scoreList = list.map(s => {
      let score = 0;
      if (state.currentTrim === "ANUAL") {
        let totalSum = 0;
        for (let i = 1; i <= count; i++) {
          const ps = state.data[`T${i}`]?.[gid]?.find(x => x.id === s.id);
          totalSum += ps ? calculateFinal(ps.notes, state.config) : 0;
        }
        score = totalSum / count;
      } else {
        const ps = state.data[state.currentTrim]?.[gid]?.find(x => x.id === s.id);
        score = ps ? calculateFinal(ps.notes, state.config) : 0;
      }
      return { student: s, score };
    });

    const sortedHonors = [...scoreList].sort((a, b) => b.score - a.score).slice(0, 3);
    const sortedAlerts = scoreList.filter(x => x.score < 6.5).sort((a, b) => a.score - b.score).slice(0, 5);

    return {
      honors: sortedHonors,
      alerts: sortedAlerts
    };
  }, [baseStudents, state.currentTrim, state.data, gid, count, state.config]);

  const activeRealStudentsCount = baseStudents.filter(s => !s.name.includes("Estudiante") && !s.isDisabled).length;

  return (
    <div className="space-y-4">
      {/* Barra de Controles Superior */}
      <div className="flex justify-between items-center flex-wrap gap-4 no-print pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center p-2 rounded border border-slate-250 hover:bg-white hover:text-indigo-650 bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Volver al panel"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <GraduationCap className="text-[var(--primary)] w-5 h-5" />
              {g.label}
              <span className="text-[10px] bg-slate-100/80 text-slate-500 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase tracking-wider">
                {activeRealStudentsCount} alumnos activos
              </span>
            </h2>
          </div>
        </div>

        {/* Grupo de Controles para Filtrado, Ancho, Rankings, Ocultamiento */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs select-none">

          {/* Toggle Rankings🏆 */}
          <button
            onClick={() => onToggleRankings(!state.showRankings)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer text-[10px] font-black uppercase tracking-wider ${
              state.showRankings
                ? "bg-amber-50 border-amber-300 text-amber-800"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            RANK
          </button>

          {/* Toggle Alumnos Inactivos 🚫 */}
          <button
            onClick={() => onToggleHideInactive(!state.hideInactive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer text-[10px] font-black uppercase tracking-wider ${
              state.hideInactive
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title="Oculta o muestra alumnos inactivos y las plantillas vacías de la lista"
          >
            {state.hideInactive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Ocultar Vacíos
          </button>

          {/* Toggle Modo Número de Lista 🔢 */}
          <button
            onClick={() => onToggleListNumber(!state.showListNumberOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all cursor-pointer text-[10px] font-black uppercase tracking-wider ${
              state.showListNumberOnly
                ? "bg-indigo-50 border-indigo-300 text-indigo-800"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
            title="Toma anónima reemplazando los nombres con números de lista"
          >
            🔢 {state.showListNumberOnly ? "Mostrar Nombres" : "Modo Anónimo"}
          </button>

          {/* Orden de clasificación de alumnos */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-2xs">
            <Sliders className="w-3 h-3 text-slate-400" />
            <select
              value={selectValue}
              onChange={(e) => handleSelectSortChange(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase focus:outline-none cursor-pointer text-slate-600 tracking-wider"
            >
              <option value="alphabetical">Nombre del Alumno (A → Z)</option>
              <option value="alphabetical-desc">Nombre del Alumno (Z → A)</option>
              <option value="best">Promedio Final (Mayor a Menor)</option>
              <option value="worst">Promedio Final (Menor a Mayor)</option>
              {selectValue === "custom" && (
                <option value="custom">Orden Especial por Columna</option>
              )}
            </select>
          </div>

          {/* Botones de acción principal */}
          <button
            onClick={onAddStudentsClick}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-black uppercase cursor-pointer transition-colors tracking-wider"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            + Alumnos
          </button>

          {/* Selector de periodo evaluativo activo */}
          <select
            value={state.currentTrim}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded text-[10px] font-black text-slate-800 uppercase focus:outline-none tracking-wider cursor-pointer font-sans"
          >
            {Array.from({ length: count }, (_, i) => (
              <option key={i} value={`T${i + 1}`}>
                PERIODO {i + 1}
              </option>
            ))}
            <option value="ANUAL">RESUMEN ANUAL</option>
          </select>
        </div>
      </div>

      {/* Panel Rankings (Cuadro de Honor y Alerta) */}
      {state.showRankings && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 shadow-xs no-print">
          {/* Cuadro de Honor */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold uppercase tracking-wider text-xs border-b border-gray-100 pb-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              🏆 Cuadro de Honor (Mejores Promedios)
            </div>
            {rankings.honors.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No hay suficientes estudiantes registrados.</p>
            ) : (
              <div className="space-y-2">
                {rankings.honors.map((item, idx) => (
                  <div key={`${item.student.id}-honor-${idx}`} className="flex justify-between items-center text-xs text-gray-700 bg-gray-50/50 p-1.5 px-2 rounded border border-gray-100">
                    <span className="font-semibold">
                      <span className={`inline-block w-5 h-5 rounded-full text-[10px] font-black leading-5 text-center mr-1.5 text-white ${
                        idx === 0 ? "bg-amber-400 text-amber-900" : idx === 1 ? "bg-slate-300 text-slate-800" : "bg-amber-600"
                      }`}>
                        {idx + 1}
                      </span>
                      {item.student.name}
                    </span>
                    <span className="font-extrabold text-emerald-700 font-mono text-sm">{item.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerta de bajo rendimiento */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-800 font-extrabold uppercase tracking-wider text-xs border-b border-gray-100 pb-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              ⚠️ Zona de Alerta (Riesgo Académico &lt; 6.5)
            </div>
            {rankings.alerts.length === 0 ? (
              <p className="text-xs text-emerald-600 italic bg-emerald-50/50 p-2 border border-emerald-100 rounded">
                ✓ ¡Extraordinario! No hay alumnos en riesgo académico en este periodo.
              </p>
            ) : (
              <div className="space-y-2">
                {rankings.alerts.map((item, idx) => (
                  <div key={`${item.student.id}-alert-${idx}`} className="flex justify-between items-center text-xs text-gray-700 bg-red-50/40 p-1.5 px-2 rounded border border-red-100/60">
                    <span className="font-medium">
                      <span className="inline-block w-5 h-5 rounded-full text-[10px] font-black leading-5 text-center bg-red-600 text-white mr-1.5">
                        !
                      </span>
                      {item.student.name}
                    </span>
                    <span className="font-extrabold text-red-600 font-mono text-sm">{item.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenedor Hoja de Notas en Tabla */}
      {processedStudents.length === 0 ? (
        <div className="bg-white border border-gray-200 p-8 rounded-lg text-center font-medium shadow-xs text-gray-500 flex flex-col items-center gap-2">
          <HelpCircle className="w-8 h-8 text-gray-400" />
          No hay estudiantes visibles en la nómina.
          <button
            onClick={onAddStudentsClick}
            className="mt-2 text-xs font-bold text-[var(--primary)] underline uppercase"
          >
            Añadir Estudiantes Ahora
          </button>
        </div>
      ) : (
        <div className="table-container rounded-lg border border-gray-200 bg-white no-print">
          <table className="w-full border-collapse border-spacing-0 text-xs">
            {/* Headers sizing configuration */}
            <colgroup>
              {[
                <col key="col-student" style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }} />,
                ...(state.currentTrim !== "ANUAL"
                  ? [
                      ...Array.from({ length: 10 }).map((_, i) => (
                        <col key={`col1-${i}`} style={{ width: "62px", minWidth: "62px" }} />
                      )),
                      <col key="col-promc" style={{ width: "72px", minWidth: "72px" }} />,
                      ...Array.from({ length: 10 }).map((_, i) => (
                        <col key={`col2-${i}`} style={{ width: "62px", minWidth: "62px" }} />
                      )),
                      <col key="col-proms" style={{ width: "72px", minWidth: "72px" }} />,
                      <col key="col-integradores" style={{ width: "100px", minWidth: "100px" }} />,
                      <col key="col-proyectos" style={{ width: "100px", minWidth: "100px" }} />,
                      <col key="col-holistica" style={{ width: "100px", minWidth: "100px" }} />,
                      <col key="col-escrito" style={{ width: "65px", minWidth: "65px" }} />,
                      <col key="col-rubrica" style={{ width: "65px", minWidth: "65px" }} />,
                      <col key="col-promex" style={{ width: "75px", minWidth: "75px" }} />,
                      <col key="col-promfinal" style={{ width: "130px", minWidth: "130px" }} />
                    ]
                  : [
                      ...Array.from({ length: count }).map((_, i) => (
                        <col key={`colanual-${i}`} style={{ width: "110px", minWidth: "110px" }} />
                      )),
                      <col key="col-promanual" style={{ width: "160px", minWidth: "160px" }} />
                    ])
              ]}
            </colgroup>

            {/* Encabezados de la Tabla */}
            <thead>
              {state.currentTrim === "ANUAL" ? (
                <tr className="bg-gray-100 border-b border-gray-200 font-bold text-gray-700 uppercase tracking-wider text-center h-12">
                  <th
                    className="left-0 z-50 bg-gray-200 border-r border-gray-200 text-left p-3 sticky font-black shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-b cursor-pointer select-none hover:bg-gray-300 transition-colors group/th"
                    style={{ position: "sticky", left: 0, minWidth: `${colWidth}px`, width: `${colWidth}px`, zIndex: 60 }}
                    onClick={() => toggleSort("name")}
                    title="Haga clic para ordenar por Nombre (Ascendente / Descendente)"
                  >
                    <div className="flex items-center justify-between">
                      <span>Estudiante</span>
                      {renderSortIndicator("name")}
                    </div>
                  </th>
                  {Array.from({ length: count }).map((_, i) => (
                    <th
                      key={i}
                      className="border-r border-gray-200 border-b bg-gray-50 text-gray-700 font-bold p-2 text-center cursor-pointer select-none hover:bg-slate-200 transition-colors group/th"
                      style={{ width: "110px", minWidth: "110px" }}
                      onClick={() => toggleSort("period", i)}
                      title={`Haga clic para ordenar por Periodo ${i + 1}`}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Periodo {i + 1}</span>
                        {renderSortIndicator("period", i)}
                      </div>
                    </th>
                  ))}
                  <th
                    className="bg-indigo-100 text-indigo-950 font-extrabold border-b text-center border-r border-gray-200 p-2 cursor-pointer select-none hover:bg-indigo-200 transition-colors group/th"
                    style={{ width: "160px", minWidth: "160px" }}
                    onClick={() => toggleSort("final")}
                    title="Haga clic para ordenar por Promedio Anual"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span>PROMEDIO ANUAL</span>
                      {renderSortIndicator("final")}
                    </div>
                  </th>
                </tr>
              ) : (
                <>
                  {/* Primera fila de encabezados agrupados */}
                  <tr className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-center h-12">
                    <th
                      className="left-0 z-50 bg-gray-200 border-r border-gray-300 border-b-2 text-left p-3 sticky font-black shadow-[2px_0_5px_rgba(0,0,0,0.06)] cursor-pointer select-none hover:bg-gray-300 transition-colors group/th"
                      rowSpan={2}
                      style={{ position: "sticky", left: 0, minWidth: `${colWidth}px`, width: `${colWidth}px`, zIndex: 60 }}
                      onClick={() => toggleSort("name")}
                      title="Haga clic para ordenar por Nombre (Ascendente / Descendente)"
                    >
                      <div className="flex items-center justify-between">
                        <span>Estudiante ({processedStudents.filter(s => !s.name.includes("Estudiante")).length})</span>
                        {renderSortIndicator("name")}
                      </div>
                    </th>
                    <th className="p-2 border-r border-b bg-slate-100 border-gray-200 select-none" colSpan={11} style={{ width: "692px", minWidth: "692px" }}>
                      {blockNames[0]} ({blockWeights[0]}%)
                    </th>
                    <th className="p-2 border-r border-b bg-slate-100 border-gray-200 select-none" colSpan={11} style={{ width: "692px", minWidth: "692px" }}>
                      {blockNames[1]} ({blockWeights[1]}%)
                    </th>
                    <th
                      className="p-1 px-1 border-r border-b-2 text-[10px] uppercase tracking-tight leading-3 text-center bg-slate-50 text-gray-700 font-bold cursor-pointer select-none hover:bg-slate-200 transition-colors group/th"
                      rowSpan={2}
                      style={{ width: "100px", minWidth: "100px" }}
                      onClick={() => toggleSort("note", 20)}
                      title={`Haga clic para ordenar por ${blockNames[2]}`}
                    >
                      <div className="font-bold min-h-[24px] flex items-center justify-center gap-0.5" title={blockNames[2]}>
                        <span>{blockNames[2]}</span>
                        {renderSortIndicator("note", 20)}
                      </div>
                      <div className="text-emerald-700 font-extrabold mt-0.5">({blockWeights[2]}%)</div>
                    </th>
                    <th
                      className="p-1 px-1 border-r border-b-2 text-[10px] uppercase tracking-tight leading-3 text-center bg-slate-50 text-gray-700 font-bold cursor-pointer select-none hover:bg-slate-200 transition-colors group/th"
                      rowSpan={2}
                      style={{ width: "100px", minWidth: "100px" }}
                      onClick={() => toggleSort("note", 21)}
                      title={`Haga clic para ordenar por ${blockNames[3]}`}
                    >
                      <div className="font-bold min-h-[24px] flex items-center justify-center gap-0.5" title={blockNames[3]}>
                        <span>{blockNames[3]}</span>
                        {renderSortIndicator("note", 21)}
                      </div>
                      <div className="text-emerald-700 font-extrabold mt-0.5">({blockWeights[3]}%)</div>
                    </th>
                    <th
                      className="p-1 px-1 border-r border-b-2 text-[10px] uppercase tracking-tight leading-3 text-center bg-slate-50 text-gray-700 font-bold cursor-pointer select-none hover:bg-slate-200 transition-colors group/th"
                      rowSpan={2}
                      style={{ width: "100px", minWidth: "100px" }}
                      onClick={() => toggleSort("note", 22)}
                      title={`Haga clic para ordenar por ${blockNames[4]}`}
                    >
                      <div className="font-bold min-h-[24px] flex items-center justify-center gap-0.5" title={blockNames[4]}>
                        <span>{blockNames[4]}</span>
                        {renderSortIndicator("note", 22)}
                      </div>
                      <div className="text-emerald-700 font-extrabold mt-0.5">({blockWeights[4]}%)</div>
                    </th>
                    <th className="p-2 border-r border-b bg-slate-100 border-gray-200 select-none" colSpan={3} style={{ width: "205px", minWidth: "205px" }}>
                      {blockNames[5]} ({blockWeights[5]}%)
                    </th>
                    <th
                      className="bg-emerald-100 text-emerald-950 border-b-2 font-black text-center text-xs p-2 border-r border-gray-300 cursor-pointer select-none hover:bg-emerald-200 transition-colors group/th"
                      rowSpan={2}
                      style={{ width: "130px", minWidth: "130px" }}
                      onClick={() => toggleSort("final")}
                      title="Haga clic para ordenar por Promedio Final"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>PROMEDIO FINAL</span>
                        {renderSortIndicator("final")}
                      </div>
                    </th>
                  </tr>

                  {/* Segunda fila de sub-encabezados */}
                  <tr className="bg-slate-50 text-gray-600 font-bold text-[10px] text-center h-12 border-b-2 border-gray-200">
                    {/* Cotidianas columns */}
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <th
                        key={`c-${idx}`}
                        className="border-r border-gray-200 border-b bg-white font-semibold text-center text-gray-500 cursor-pointer select-none hover:bg-slate-100 transition-colors group/th"
                        style={{ width: "62px", minWidth: "62px" }}
                        onClick={() => toggleSort("note", idx)}
                        title={`Ordenar por Nota Cotidiana ${idx + 1}`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span>C{idx + 1}</span>
                          {renderSortIndicator("note", idx)}
                        </div>
                      </th>
                    ))}
                    <th
                      className="bg-blue-100 text-blue-900 border-r border-gray-300 font-black uppercase tracking-tight border-b text-center text-[10px] cursor-pointer select-none hover:bg-blue-200 transition-colors group/th"
                      style={{ width: "72px", minWidth: "72px" }}
                      onClick={() => toggleSort("avgC")}
                      title="Ordenar por Promedio Cotidiano"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>PROM C</span>
                        {renderSortIndicator("avgC")}
                      </div>
                    </th>

                    {/* Santillana columns */}
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <th
                        key={`s-${idx}`}
                        className="border-r border-gray-200 border-b bg-white font-semibold text-center text-gray-500 cursor-pointer select-none hover:bg-slate-100 transition-colors group/th"
                        style={{ width: "62px", minWidth: "62px" }}
                        onClick={() => toggleSort("note", idx + 10)}
                        title={`Ordenar por Nota Santillana ${idx + 1}`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span>S{idx + 1}</span>
                          {renderSortIndicator("note", idx + 10)}
                        </div>
                      </th>
                    ))}
                    <th
                      className="bg-blue-100 text-blue-900 border-r border-gray-300 font-black uppercase tracking-tight border-b text-center text-[10px] cursor-pointer select-none hover:bg-blue-200 transition-colors group/th"
                      style={{ width: "72px", minWidth: "72px" }}
                      onClick={() => toggleSort("avgS")}
                      title="Ordenar por Promedio Santillana"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>PROM S</span>
                        {renderSortIndicator("avgS")}
                      </div>
                    </th>

                    {/* Examen sub columns */}
                    <th
                      className="border-r border-gray-200 border-b bg-white font-semibold text-center text-gray-500 cursor-pointer select-none hover:bg-slate-100 transition-colors group/th"
                      style={{ width: "65px", minWidth: "65px" }}
                      onClick={() => toggleSort("note", 23)}
                      title="Ordenar por Examen Escrito"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Escrito</span>
                        {renderSortIndicator("note", 23)}
                      </div>
                    </th>
                    <th
                      className="border-r border-gray-200 border-b bg-white font-semibold text-center text-gray-500 cursor-pointer select-none hover:bg-slate-100 transition-colors group/th"
                      style={{ width: "65px", minWidth: "65px" }}
                      onClick={() => toggleSort("note", 24)}
                      title="Ordenar por Examen Rúbrica"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Rúbrica</span>
                        {renderSortIndicator("note", 24)}
                      </div>
                    </th>
                    <th
                      className="bg-blue-100 text-blue-900 border-r border-gray-300 font-black uppercase tracking-tight border-b text-center text-[10px] cursor-pointer select-none hover:bg-blue-200 transition-colors group/th"
                      style={{ width: "75px", minWidth: "75px" }}
                      onClick={() => toggleSort("avgEx")}
                      title="Ordenar por Promedio Examen"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>PROM EX</span>
                        {renderSortIndicator("avgEx")}
                      </div>
                    </th>
                  </tr>
                </>
              )}
            </thead>

            {/* Cuerpo de la Tabla */}
            <tbody className="divide-y divide-gray-200">
              {processedStudents.map((s, visualSidx) => {
                const isPlaceholder = s.name.includes("Estudiante");
                
                // Get correct student data for the current active period/trim, fallback to s
                const activeStudent = state.currentTrim !== "ANUAL"
                  ? (state.data[state.currentTrim]?.[gid]?.find(x => x.id === s.id) || s)
                  : s;
                
                const notes = activeStudent.notes || Array(25).fill(0);
                const reasons = activeStudent.reasons || Array(25).fill("");

                // Fetch student stats for visual info based on current active notes
                const compliance = getStudentCompliance(notes, reasons);
                const rankInfo = getStudentRank(s.id, gid, state.currentTrim, state.data, state.config);

                // Render Anual view rows
                if (state.currentTrim === "ANUAL") {
                  let totalSum = 0;
                  return (
                    <tr
                      key={`${s.id}-anual-${visualSidx}`}
                      className="group hover:bg-slate-50 transition-colors h-14"
                    >
                      <td
                        className={`left-0 border-r border-gray-200 font-bold px-2.5 py-3 text-left sticky shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] transition-colors duration-150 ${
                          s.isDisabled 
                            ? "bg-slate-100/100 text-gray-400 italic" 
                            : "bg-white text-slate-800 group-hover:bg-slate-50"
                        }`}
                        style={{ position: "sticky", left: 0, minWidth: `${colWidth}px`, width: `${colWidth}px`, zIndex: activeDropdownStudentId === s.id ? 55 : 22 }}
                      >
                        <div className="flex justify-between items-center w-full h-full gap-1">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="truncate pr-0.5" title={s.name}>
                              {state.showListNumberOnly 
                                ? `Estudiante #${visualSidx + 1}` 
                                : s.name}
                            </span>
                            {!isPlaceholder && (
                              <span 
                                className="text-[9px] text-slate-500 font-bold bg-slate-50 px-1 py-0.5 rounded border border-slate-200 flex-shrink-0"
                                title={`Entregadas: ${compliance.count}/${compliance.total} (${compliance.percentage}%)\nPosición: #${rankInfo.rank}`}
                              >
                                E:{compliance.count} • P:{rankInfo.rank}
                              </span>
                            )}
                          </div>
                          <div className="flex-shrink-0 ml-1 opacity-60 hover:opacity-100 transition-opacity">
                            <StudentActionsDropdown
                              student={s}
                              onRename={onRename}
                              onToggleStatus={onToggleStatus}
                              onMigrate={onMigrate}
                              onViewReport={onViewReport}
                              onDelete={onDelete}
                              alignLeft={true}
                              onOpenChange={(isOpen) => setActiveDropdownStudentId(isOpen ? s.id : null)}
                            />
                          </div>
                        </div>
                      </td>

                      {Array.from({ length: count }).map((_, idx) => {
                        const pNum = idx + 1;
                        const pStudent = state.data[`T${pNum}`]?.[gid]?.find(x => x.id === s.id);
                        const final = pStudent ? calculateFinal(pStudent.notes, state.config) : 0;
                        totalSum += final;
                        return (
                          <td
                            key={idx}
                            className={`border-r border-gray-200 text-center font-bold text-sm h-12 ${
                              s.isDisabled 
                                ? "bg-slate-50/50 text-gray-400 select-none opacity-30 pointer-events-none" 
                                : final < 6.5 ? "text-red-600 bg-red-50/10" : "text-emerald-700"
                            }`}
                            style={{ width: "110px", minWidth: "110px" }}
                          >
                            {final.toFixed(1)}
                          </td>
                        );
                      })}

                      {/* Promedio Anual */}
                      <td
                        className={`text-center font-black text-base h-12 ${
                          s.isDisabled 
                            ? "bg-slate-100/50 text-gray-400 select-none opacity-30" 
                            : totalSum / count < 6.5 ? "text-red-700 bg-red-50/20" : "text-emerald-800 bg-emerald-50/20"
                        }`}
                        style={{ width: "160px", minWidth: "160px" }}
                      >
                        {(totalSum / count).toFixed(1)}
                      </td>
                    </tr>
                  );
                }

                // Normal view rows
                const finalScore = calculateFinal(notes, state.config);
                const avgC = getAvg(notes.slice(0, 10));
                const avgS = getAvg(notes.slice(10, 20));
                const examEscrito = notes[23] ?? 0;
                const examRubrica = notes[24] ?? 0;
                const avgEx = (examEscrito * 0.85) + (examRubrica * 0.15);

                return (
                  <tr
                    key={`${s.id}-${visualSidx}`}
                    className="group hover:bg-slate-50 transition-colors h-14"
                  >
                    {/* Columna sticky Alumno */}
                    <td
                      className={`left-0 border-r border-gray-200 font-semibold px-2.5 py-3 sticky shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] text-left transition-colors duration-150 ${
                        s.isDisabled 
                          ? "bg-slate-100/100 text-gray-400 italic" 
                          : "bg-white text-slate-800 group-hover:bg-slate-50"
                      }`}
                      style={{ position: "sticky", left: 0, minWidth: `${colWidth}px`, width: `${colWidth}px`, zIndex: activeDropdownStudentId === s.id ? 55 : 22 }}
                    >
                      <div className="flex justify-between items-center w-full h-full gap-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="truncate pr-0.5" title={s.name}>
                            {state.showListNumberOnly 
                              ? `Estudiante #${visualSidx + 1}` 
                              : s.name}
                          </span>
                          {!isPlaceholder && (
                            <span 
                              className="text-[9px] text-slate-500 font-bold bg-slate-50 px-1 py-0.5 rounded border border-slate-200 flex-shrink-0"
                              title={`Entregadas: ${compliance.count}/${compliance.total} (${compliance.percentage}%)\nPosición: #${rankInfo.rank}`}
                            >
                              E:{compliance.count} • P:{rankInfo.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-1 opacity-60 hover:opacity-100 transition-opacity">
                          <StudentActionsDropdown
                              student={s}
                              onRename={onRename}
                              onToggleStatus={onToggleStatus}
                              onMigrate={onMigrate}
                              onViewReport={onViewReport}
                              onDelete={onDelete}
                              alignLeft={true}
                              onOpenChange={(isOpen) => setActiveDropdownStudentId(isOpen ? s.id : null)}
                            />
                        </div>
                      </div>
                    </td>

                    {/* Celdas de Calificaciones */}
                    {notes.map((noteVal, noteIdx) => {
                      const reason = reasons[noteIdx];
                      const isPermiso = reason && reason.startsWith("Presentó Permiso");
                      const cellStyle = getNoteCellWidth(noteIdx);
                      const classNameExtra = (noteIdx >= 20 && noteIdx <= 22) ? "bg-slate-50/40" : "";

                      // Custom elements spacing based on design rules
                      const cellElement = (
                        <td
                          key={noteIdx}
                          className={`border-r border-gray-200 text-center font-semibold p-0 ${classNameExtra} ${
                            s.isDisabled ? "opacity-30 pointer-events-none select-none bg-slate-50/50" : ""
                          }`}
                          style={cellStyle}
                        >
                          <div className="relative flex items-stretch h-12 w-full focus-within:bg-blue-50/80 transition-colors">
                            <GradeInput
                              value={noteVal}
                              onChange={(val) => onUpdateNote(s.id, noteIdx, val)}
                            />
                            <button
                              onClick={() => onOpenReason(s.id, noteIdx)}
                              className={`w-3.5 flex items-center justify-center text-[8px] font-black border-l border-gray-100 transition-colors ${
                                reason
                                  ? isPermiso
                                    ? "bg-emerald-500 text-white"
                                    : "bg-amber-400 text-white"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                              }`}
                              title={reason || "Haga clic para agregar de observación/incidencia"}
                            >
                              i
                            </button>
                          </div>
                        </td>
                      );

                      // Add helper aggregate columns at logical indices
                      if (noteIdx === 9) {
                        return (
                          <Fragment key={`cell-block-c-${noteIdx}`}>
                            {cellElement}
                            <td 
                              className={`font-black text-center border-r border-gray-300 text-sm h-12 ${
                                s.isDisabled 
                                  ? "bg-slate-100/50 text-gray-400 select-none opacity-30" 
                                  : "bg-blue-50 text-blue-800"
                              }`}
                              style={{ width: "72px", minWidth: "72px" }}
                            >
                              {avgC.toFixed(1)}
                            </td>
                          </Fragment>
                        );
                      }

                      if (noteIdx === 19) {
                        return (
                          <Fragment key={`cell-block-s-${noteIdx}`}>
                            {cellElement}
                            <td 
                              className={`font-black text-center border-r border-gray-300 text-sm h-12 ${
                                s.isDisabled 
                                  ? "bg-slate-100/50 text-gray-400 select-none opacity-30" 
                                  : "bg-blue-50 text-blue-800"
                              }`}
                              style={{ width: "72px", minWidth: "72px" }}
                            >
                              {avgS.toFixed(1)}
                            </td>
                          </Fragment>
                        );
                      }

                      if (noteIdx === 24) {
                        return (
                          <Fragment key={`cell-block-ex-${noteIdx}`}>
                            {cellElement}
                            <td 
                              className={`font-black text-center border-r border-gray-300 text-sm h-12 ${
                                s.isDisabled 
                                  ? "bg-slate-100/50 text-gray-400 select-none opacity-30" 
                                  : "bg-blue-50 text-blue-800"
                              }`}
                              style={{ width: "75px", minWidth: "75px" }}
                            >
                              {avgEx.toFixed(1)}
                            </td>
                          </Fragment>
                        );
                      }

                      return cellElement;
                    })}

                    {/* Nota Final de Periodo */}
                    <td
                      className={`text-center font-black text-base h-12 ${
                        s.isDisabled
                          ? "bg-slate-100/50 text-gray-400 select-none opacity-30"
                          : finalScore < 6.5 ? "text-red-700 bg-red-50/20" : "text-emerald-800 bg-emerald-50/20"
                      }`}
                      style={{ width: "130px", minWidth: "130px" }}
                    >
                      {finalScore.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
