import React, { useState, useEffect, useMemo } from "react";
import { AppState, Student } from "../types";
import { calculateFinal, getStudentCompliance, getStudentRank, getAvg, findStudentForPeriod } from "../utils";
import StudentActionsDropdown from "./StudentActionsDropdown";
import { 
  Search, X, Users, AlertCircle, ChevronDown, ChevronUp, BookOpen, 
  Pencil, LayoutGrid, List, Sliders 
} from "lucide-react";

interface GradeInputProps {
  value: number | null;
  onChange: (value: string) => void;
  rowIndex?: number;
  colIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function GradeInput({ value, onChange, rowIndex, colIndex, onKeyDown }: GradeInputProps) {
  const [localVal, setLocalVal] = useState<string>(value === null ? "" : String(value));

  useEffect(() => {
    const formatted = value === null ? "" : String(value);
    if (parseFloat(localVal) !== value) {
      setLocalVal(formatted);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      onKeyDown={onKeyDown}
      data-row-index={rowIndex}
      data-col-index={colIndex}
      className="w-full h-full text-center bg-transparent outline-none select-all font-bold text-xs"
      onFocus={(e) => e.target.select()}
    />
  );
}

interface StudentsViewProps {
  state: AppState;
  onRename: (gradeId: string, studentId: string) => void;
  onToggleStatus: (gradeId: string, studentId: string) => void;
  onMigrate: (gradeId: string, studentId: string) => void;
  onViewReport: (gradeId: string, studentId: string) => void;
  onDelete: (gradeId: string, studentId: string) => void;
  onPeriodChange: (trim: string) => void;
  hideInactive: boolean;
  onUpdateNote: (studentId: string, noteIndex: number, value: string, overrideGradeId?: string) => void;
  onOpenReason: (studentId: string, noteIndex: number, overrideGradeId?: string) => void;
}

const getNoteCellWidth = (idx: number): { width: string; minWidth: string } => {
  if (idx >= 0 && idx <= 9) return { width: "62px", minWidth: "62px" }; // Cotidianas
  if (idx >= 10 && idx <= 19) return { width: "62px", minWidth: "62px" }; // Santillana
  if (idx >= 20 && idx <= 22) return { width: "100px", minWidth: "100px" }; // Trabajo, Proyecto, Holistica
  if (idx >= 23 && idx <= 24) return { width: "65px", minWidth: "65px" }; // Escrito, Rubrica
  return { width: "62px", minWidth: "62px" };
};

export default function StudentsView({
  state,
  onRename,
  onToggleStatus,
  onMigrate,
  onViewReport,
  onDelete,
  onPeriodChange,
  hideInactive,
  onUpdateNote,
  onOpenReason,
}: StudentsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid"); // Defaults to "grid" as requested for fast editing!
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [activeDropdownStudentId, setActiveDropdownStudentId] = useState<string | null>(null);

  const [sortColumn, setSortColumn] = useState<{
    id: "name" | "final" | "note" | "avgC" | "avgS" | "avgEx" | "period";
    index?: number;
    direction: "asc" | "desc";
  }>({ id: "name", direction: "asc" });

  const enabledGrades = state.config.grades.filter(g => g.enabled);

  // Re-read block metadata from config
  const blockNames = state.config.blockNames;
  const blockWeights = state.config.blockWeights;

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
        const defaultDir = id === "name" ? "asc" : "desc";
        return { id, index, direction: defaultDir };
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    const rowIndex = parseInt(target.getAttribute("data-row-index") || "0", 10);
    const colIndex = parseInt(target.getAttribute("data-col-index") || "0", 10);
    const container = target.closest("tbody");
    if (!container) return;

    if (e.key === "Tab") {
      e.preventDefault();
      const isShift = e.shiftKey;
      let nextRow = rowIndex;
      let nextCol = colIndex;

      if (!isShift) {
        nextCol = colIndex + 1;
        if (nextCol > 24) {
          nextCol = 0;
          nextRow = rowIndex + 1;
        }
      } else {
        nextCol = colIndex - 1;
        if (nextCol < 0) {
          nextCol = 24;
          nextRow = rowIndex - 1;
        }
      }

      const nextInput = container.querySelector<HTMLInputElement>(
        `input[data-row-index="${nextRow}"][data-col-index="${nextCol}"]`
      );
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const isShift = e.shiftKey;
      const nextRow = isShift ? rowIndex - 1 : rowIndex + 1;
      const nextCol = colIndex;

      const nextInput = container.querySelector<HTMLInputElement>(
        `input[data-row-index="${nextRow}"][data-col-index="${nextCol}"]`
      );
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const renderSortIndicator = (id: "name" | "final" | "note" | "avgC" | "avgS" | "avgEx" | "period", index?: number) => {
    if (sortColumn.id !== id || sortColumn.index !== index) {
      return <span className="text-slate-300 opacity-30 group-hover:opacity-100 transition-opacity ml-1 font-mono text-[9px]">↕</span>;
    }
    return (
      <span className="text-indigo-600 font-extrabold ml-1 font-mono text-[9px]">
        {sortColumn.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  // Filter and sort students list with high performance
  const processedStudents = useMemo(() => {
    // Collect all valid/real students across all active groups
    let list: { student: Student; gradeId: string; gradeLabel: string }[] = [];

    enabledGrades.forEach(g => {
      const gStudents = state.data["T1"]?.[g.id] || [];
      gStudents.forEach(s => {
        const isPlaceholder = s.name.includes("Estudiante");
        const isHiddenInactive = hideInactive && s.isDisabled;
        
        if (!isPlaceholder && !isHiddenInactive) {
          list.push({
            student: s,
            gradeId: g.id,
            gradeLabel: g.label,
          });
        }
      });
    });

    // Filter based on search term (student name or group label or subject representation)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(item => {
        const gradeSubject = state.config.grades.find(x => x.id === item.gradeId)?.useGlobalSubject 
          ? state.config.subject 
          : state.config.grades.find(x => x.id === item.gradeId)?.subject || "";
        return (
          item.student.name.toLowerCase().includes(q) ||
          item.gradeLabel.toLowerCase().includes(q) ||
          gradeSubject.toLowerCase().includes(q)
        );
      });
    }

    // Sort list based on sortColumn state
    list.sort((a, b) => {
      let comparison = 0;

      const period = state.currentTrim === "ANUAL" ? "T1" : state.currentTrim;
      const pA = findStudentForPeriod(state.data[period]?.[a.gradeId], a.student.id, a.student.name) || a.student;
      const pB = findStudentForPeriod(state.data[period]?.[b.gradeId], b.student.id, b.student.name) || b.student;

      if (sortColumn.id === "name") {
        comparison = pA.name.localeCompare(pB.name, "es", { sensitivity: "base" });
      } else if (sortColumn.id === "final") {
        const getFinalVal = (item: { student: Student; gradeId: string }) => {
          const g = state.config.grades.find(x => x.id === item.gradeId);
          const count = g ? (g.useGlobalPeriods ? state.config.periodCount : g.periodCount) : state.config.periodCount;
          if (state.currentTrim === "ANUAL") {
            let totalSum = 0;
            for (let i = 1; i <= count; i++) {
              const ps = findStudentForPeriod(state.data[`T${i}`]?.[item.gradeId], item.student.id, item.student.name);
              totalSum += ps ? calculateFinal(ps.notes, state.config) : 0;
            }
            return totalSum / count;
          } else {
            const ps = findStudentForPeriod(state.data[state.currentTrim]?.[item.gradeId], item.student.id, item.student.name);
            return ps ? calculateFinal(ps.notes, state.config) : 0;
          }
        };
        comparison = getFinalVal(a) - getFinalVal(b);
      } else if (sortColumn.id === "note" && sortColumn.index !== undefined) {
        const getNoteVal = (item: { student: Student; gradeId: string }) => {
          const ps = findStudentForPeriod(state.data[state.currentTrim]?.[item.gradeId], item.student.id, item.student.name);
          const notes = ps ? ps.notes : item.student.notes || [];
          return notes[sortColumn.index!] ?? 0;
        };
        comparison = getNoteVal(a) - getNoteVal(b);
      } else if (sortColumn.id === "avgC") {
        const getAvgC = (item: { student: Student; gradeId: string }) => {
          const ps = findStudentForPeriod(state.data[state.currentTrim]?.[item.gradeId], item.student.id, item.student.name);
          const notes = ps ? ps.notes : item.student.notes || [];
          return getAvg(notes.slice(0, 10));
        };
        comparison = getAvgC(a) - getAvgC(b);
      } else if (sortColumn.id === "avgS") {
        const getAvgS = (item: { student: Student; gradeId: string }) => {
          const ps = findStudentForPeriod(state.data[state.currentTrim]?.[item.gradeId], item.student.id, item.student.name);
          const notes = ps ? ps.notes : item.student.notes || [];
          return getAvg(notes.slice(10, 20));
        };
        comparison = getAvgS(a) - getAvgS(b);
      } else if (sortColumn.id === "avgEx") {
        const getAvgEx = (item: { student: Student; gradeId: string }) => {
          const ps = findStudentForPeriod(state.data[state.currentTrim]?.[item.gradeId], item.student.id, item.student.name);
          const notes = ps ? ps.notes : item.student.notes || [];
          const written = notes[23] ?? 0;
          const rubric = notes[24] ?? 0;
          return (written * 0.85) + (rubric * 0.15);
        };
        comparison = getAvgEx(a) - getAvgEx(b);
      } else if (sortColumn.id === "period" && sortColumn.index !== undefined) {
        const getPeriodVal = (item: { student: Student; gradeId: string }) => {
          const pStudent = findStudentForPeriod(state.data[`T${sortColumn.index! + 1}`]?.[item.gradeId], item.student.id, item.student.name);
          return pStudent ? calculateFinal(pStudent.notes, state.config) : 0;
        };
        comparison = getPeriodVal(a) - getPeriodVal(b);
      }

      if (comparison === 0) {
        return pA.name.localeCompare(pB.name, "es", { sensitivity: "base" });
      }

      return sortColumn.direction === "asc" ? comparison : -comparison;
    });

    return list;
  }, [state.data, state.config, state.currentTrim, hideInactive, searchTerm, sortColumn, enabledGrades]);

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

  return (
    <div className="space-y-4">
      {/* Search and control bar */}
      <div className="flex justify-between items-center flex-wrap gap-4 no-print bg-slate-50/50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <h2 className="text-lg font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-5 h-5" />
            Buscador y Planilla de Estudiantes
          </h2>
          
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar estudiante, materia o grupo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-gray-850"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* View Mode Switching Tabs */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-md shadow-3xs">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 px-3 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Editar directamente todas las notas en una planilla unificada"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cuadro de Notas
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 px-3 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Ver buscador individual tradicional con resumen de rendimiento"
            >
              <List className="w-3.5 h-3.5" />
              Resumen
            </button>
          </div>

          {/* Quick Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded shadow-2xs">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectValue}
              onChange={(e) => handleSelectSortChange(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase focus:outline-none cursor-pointer text-slate-600 tracking-wider"
            >
              <option value="alphabetical">Alumno (A → Z)</option>
              <option value="alphabetical-desc">Alumno (Z → A)</option>
              <option value="best">Promedio (Mayor a Menor)</option>
              <option value="worst">Promedio (Menor a Mayor)</option>
              {selectValue === "custom" && (
                <option value="custom">Orden Especial por Columna</option>
              )}
            </select>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Periodo:</label>
            <select
              value={state.currentTrim}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-bold uppercase select-custom cursor-pointer"
            >
              {Array.from({ length: state.config.periodCount }, (_, i) => (
                <option key={i} value={`T${i + 1}`}>
                  Periodo {i + 1}
                </option>
              ))}
              <option value="ANUAL">Resumen Anual</option>
            </select>
          </div>
        </div>
      </div>

      {processedStudents.length === 0 ? (
        <div className="bg-white border border-gray-200 p-8 rounded-lg text-center font-medium shadow-xs text-gray-500 flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 text-gray-400" />
          {searchTerm.trim()
            ? `No se encontraron estudiantes que coincidan con "${searchTerm}".`
            : "No hay estudiantes registrados o habilitados en ningún grupo."}
        </div>
      ) : viewMode === "grid" ? (
        /* ================== GRID VIEW MODE (Spreadsheet) ================== */
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm no-print">
          <table className="w-full border-collapse text-left text-xs text-gray-800">
            <thead>
              {state.currentTrim === "ANUAL" ? (
                /* Header layout for ANUAL view */
                <tr className="bg-gray-100 border-b border-gray-200 font-bold text-gray-700 uppercase tracking-wider text-center h-12">
                  <th
                    className="left-0 z-50 bg-gray-200 border-r border-gray-250 text-left p-3 sticky font-black shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-b cursor-pointer select-none hover:bg-gray-300 transition-colors group/th"
                    style={{ position: "sticky", left: 0, minWidth: "260px", width: "260px", zIndex: 60 }}
                    onClick={() => toggleSort("name")}
                    title="Ordenar por Nombre de Estudiante"
                  >
                    <div className="flex items-center justify-between">
                      <span>Estudiante / Grupo Académico</span>
                      {renderSortIndicator("name")}
                    </div>
                  </th>
                  {Array.from({ length: state.config.periodCount }).map((_, i) => (
                    <th
                      key={i}
                      className="border-r border-gray-200 border-b bg-gray-50 text-gray-700 font-bold p-2 text-center cursor-pointer select-none hover:bg-slate-250 transition-colors group/th"
                      style={{ width: "110px", minWidth: "110px" }}
                      onClick={() => toggleSort("period", i)}
                      title={`Ordenar por notas del Periodo ${i + 1}`}
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
                    title="Ordenar por Promedio Anual final"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span>PROMEDIO ANUAL</span>
                      {renderSortIndicator("final")}
                    </div>
                  </th>
                </tr>
              ) : (
                /* Header layout for interactive Normal Period view */
                <>
                  <tr className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-center h-12">
                    <th
                      className="left-0 z-50 bg-gray-200 border-r border-gray-300 border-b-2 text-left p-3 sticky font-black shadow-[2px_0_5px_rgba(0,0,0,0.06)] cursor-pointer select-none hover:bg-gray-300 transition-colors group/th"
                      rowSpan={2}
                      style={{ position: "sticky", left: 0, minWidth: "260px", width: "260px", zIndex: 60 }}
                      onClick={() => toggleSort("name")}
                      title="Ordenar por Nombre de Estudiante"
                    >
                      <div className="flex items-center justify-between">
                        <span>Estudiante / Grupo Académico</span>
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
                      title={`Ordenar por ${blockNames[2]}`}
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
                      title={`Ordenar por ${blockNames[3]}`}
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
                      title={`Ordenar por ${blockNames[4]}`}
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
                      className="bg-emerald-100 text-emerald-950 border-b-2 font-black text-center text-xs p-2 border-r border-gray-300 cursor-pointer select-none hover:bg-emerald-200 transition-colors group/th animate-pulse-once"
                      rowSpan={2}
                      style={{ width: "130px", minWidth: "130px" }}
                      onClick={() => toggleSort("final")}
                      title="Ordenar por Promedio Final"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>PROMEDIO FINAL</span>
                        {renderSortIndicator("final")}
                      </div>
                    </th>
                  </tr>

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
                      title="Ordenar por Promedio de Examen"
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

            <tbody className="divide-y divide-gray-200">
              {processedStudents.map((item, visualSidx) => {
                const s = item.student;
                const gid = item.gradeId;
                const gradeLabel = item.gradeLabel;
                const isPlaceholder = s.name.includes("Estudiante");

                // Retrieve active period student record
                const activeStudent = state.currentTrim !== "ANUAL"
                  ? (findStudentForPeriod(state.data[state.currentTrim]?.[gid], s.id, s.name) || s)
                  : s;

                const notes = activeStudent.notes || Array(25).fill(0);
                const reasons = activeStudent.reasons || Array(25).fill("");

                // Compliance metrics & Rank info
                const compliance = getStudentCompliance(notes, reasons);
                const rankInfo = getStudentRank(s.id, gid, state.currentTrim, state.data, state.config);

                // If period is ANUAL
                if (state.currentTrim === "ANUAL") {
                  let totalSum = 0;
                  const g = state.config.grades.find(x => x.id === gid);
                  const count = g ? (g.useGlobalPeriods ? state.config.periodCount : g.periodCount) : state.config.periodCount;

                  return (
                    <tr key={`${s.id}-anual-${visualSidx}`} className="group hover:bg-slate-50 transition-colors h-14">
                      {/* Sticky Alumno column */}
                      <td
                        className={`left-0 border-r border-gray-200 font-bold px-2.5 py-3 text-left sticky shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] transition-colors duration-150 ${
                          s.isDisabled 
                            ? "bg-slate-100/100 text-gray-400 italic" 
                            : "bg-white text-slate-800 group-hover:bg-slate-50"
                        }`}
                        style={{ position: "sticky", left: 0, minWidth: "260px", width: "260px", zIndex: activeDropdownStudentId === s.id ? 55 : 22 }}
                      >
                        <div className="flex justify-between items-center w-full h-full gap-1">
                          <div className="flex flex-col min-w-0 flex-1 leading-tight">
                            <span className="truncate text-slate-900 font-extrabold text-xs" title={s.name}>
                              {s.name}
                            </span>
                            <span className="inline-flex items-center text-[9px] font-black uppercase text-indigo-700 tracking-wider mt-0.5">
                              {gradeLabel}
                            </span>
                          </div>
                          <div className="flex-shrink-0 ml-1 opacity-60 hover:opacity-100 transition-opacity">
                            <StudentActionsDropdown
                              student={s}
                              onRename={(sid) => onRename(gid, sid)}
                              onToggleStatus={(sid) => onToggleStatus(gid, sid)}
                              onMigrate={(sid) => onMigrate(gid, sid)}
                              onViewReport={(sid) => onViewReport(gid, sid)}
                              onDelete={(sid) => onDelete(gid, sid)}
                              alignLeft={true}
                              onOpenChange={(isOpen) => setActiveDropdownStudentId(isOpen ? s.id : null)}
                            />
                          </div>
                        </div>
                      </td>

                      {Array.from({ length: state.config.periodCount }).map((_, idx) => {
                        const pNum = idx + 1;
                        const pStudent = findStudentForPeriod(state.data[`T${pNum}`]?.[gid], s.id, s.name);
                        const final = pStudent ? calculateFinal(pStudent.notes, state.config) : 0;
                        totalSum += final;
                        return (
                          <td
                            key={idx}
                            className={`border-r border-gray-200 text-center font-bold text-sm h-12 ${
                              s.isDisabled 
                                ? "bg-slate-50/50 text-gray-400 select-none opacity-30 pointer-events-none" 
                                : final < 6.5 ? "text-red-650 bg-red-50/10" : "text-emerald-700"
                            }`}
                            style={{ width: "110px", minWidth: "110px" }}
                          >
                            {final.toFixed(1)}
                          </td>
                        );
                      })}

                      {/* annual average */}
                      <td
                        className={`text-center font-black text-base h-12 ${
                          s.isDisabled 
                            ? "bg-slate-100/50 text-gray-400 select-none opacity-30" 
                            : totalSum / count < 6.5 ? "text-red-750 bg-red-50/20" : "text-emerald-800 bg-emerald-50/20"
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

                const gradeSubject = state.config.grades.find(x => x.id === gid)?.useGlobalSubject 
                  ? state.config.subject 
                  : state.config.grades.find(x => x.id === gid)?.subject || "";

                return (
                  <tr key={`${s.id}-${visualSidx}`} className="group hover:bg-slate-50/80 transition-colors h-14">
                    {/* Alumno Sticky left */}
                    <td
                      className={`left-0 border-r border-gray-200 font-semibold px-2.5 py-3 sticky shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] text-left transition-colors duration-150 ${
                        s.isDisabled 
                          ? "bg-slate-100/100 text-gray-400 italic" 
                          : "bg-white text-slate-800 group-hover:bg-slate-50"
                      }`}
                      style={{ position: "sticky", left: 0, minWidth: "260px", width: "260px", zIndex: activeDropdownStudentId === s.id ? 55 : 22 }}
                    >
                      <div className="flex justify-between items-center w-full h-full gap-1">
                        <div className="flex flex-col min-w-0 flex-1 leading-tight">
                          <span className="truncate text-slate-900 font-extrabold text-xs" title={s.name}>
                            {s.name}
                          </span>
                          <span className="text-[9px] font-bold text-gray-400 block truncate uppercase mt-0.5" title={`${gradeLabel} • ${gradeSubject}`}>
                            <span className="text-emerald-800 font-extrabold">{gradeLabel}</span> • {gradeSubject}
                          </span>
                        </div>
                        <div className="flex-shrink-0 ml-1 opacity-60 hover:opacity-100 transition-opacity">
                          <StudentActionsDropdown
                            student={s}
                            onRename={(sid) => onRename(gid, sid)}
                            onToggleStatus={(sid) => onToggleStatus(gid, sid)}
                            onMigrate={(sid) => onMigrate(gid, sid)}
                            onViewReport={(sid) => onViewReport(gid, sid)}
                            onDelete={(sid) => onDelete(gid, sid)}
                            alignLeft={true}
                            onOpenChange={(isOpen) => setActiveDropdownStudentId(isOpen ? s.id : null)}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Note input cells */}
                    {notes.map((noteVal, noteIdx) => {
                      const reason = reasons[noteIdx];
                      const isPermiso = reason && reason.startsWith("Presentó Permiso");
                      const cellStyle = getNoteCellWidth(noteIdx);
                      const classNameExtra = (noteIdx >= 20 && noteIdx <= 22) ? "bg-slate-50/40" : "";

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
                              onChange={(val) => onUpdateNote(s.id, noteIdx, val, gid)}
                              rowIndex={visualSidx}
                              colIndex={noteIdx}
                              onKeyDown={handleKeyDown}
                            />
                            <button
                              onClick={() => onOpenReason(s.id, noteIdx, gid)}
                              className={`w-3.5 flex items-center justify-center text-[8px] font-black border-l border-gray-100 transition-colors ${
                                reason
                                  ? isPermiso
                                    ? "bg-emerald-500 text-white"
                                    : "bg-amber-400 text-white"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                              }`}
                              title={reason || "Haga clic para agregar observación"}
                            >
                              i
                            </button>
                          </div>
                        </td>
                      );

                      if (noteIdx === 9) {
                        return (
                          <React.Fragment key={`cell-block-c-${noteIdx}`}>
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
                          </React.Fragment>
                        );
                      }

                      if (noteIdx === 19) {
                        return (
                          <React.Fragment key={`cell-block-s-${noteIdx}`}>
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
                          </React.Fragment>
                        );
                      }

                      if (noteIdx === 24) {
                        return (
                          <React.Fragment key={`cell-block-ex-${noteIdx}`}>
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
                          </React.Fragment>
                        );
                      }

                      return cellElement;
                    })}

                    {/* Final grade of the period */}
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
      ) : (
        /* ================== CLASSIC LIST VIEW MODE ================== */
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-xs no-print">
          <table className="w-full border-collapse text-left text-sm text-gray-800">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="p-4 py-3">Estudiante</th>
                <th className="p-4 py-3">Grupo / Materia</th>
                <th className="p-4 py-3 text-center">Cumplimiento</th>
                <th className="p-4 py-3 text-center">Rendimiento (Lugar)</th>
                <th className="p-4 py-3 text-center">Nota Promedio</th>
                <th className="p-4 py-3 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedStudents.map(({ student, gradeId, gradeLabel }, idx) => {
                const period = state.currentTrim === "ANUAL" ? "T1" : state.currentTrim;
                const pStudent = findStudentForPeriod(state.data[period]?.[gradeId], student.id, student.name) || student;
                
                const compliance = getStudentCompliance(pStudent.notes, pStudent.reasons);
                const rankInfo = getStudentRank(student.id, gradeId, state.currentTrim, state.data, state.config);
                
                let finalScore = 0;
                if (state.currentTrim === "ANUAL") {
                  const g = state.config.grades.find(x => x.id === gradeId);
                  const count = g ? (g.useGlobalPeriods ? state.config.periodCount : g.periodCount) : state.config.periodCount;
                  let totalSum = 0;
                  for (let i = 1; i <= count; i++) {
                    const ps = findStudentForPeriod(state.data[`T${i}`]?.[gradeId], student.id, student.name);
                    totalSum += ps ? calculateFinal(ps.notes, state.config) : 0;
                  }
                  finalScore = totalSum / count;
                } else {
                  finalScore = calculateFinal(pStudent.notes, state.config);
                }

                const cotidianaNotes = pStudent.notes.slice(0, 10);
                const cotidianaAvg = getAvg(cotidianaNotes);
                const santillanaNotes = pStudent.notes.slice(10, 20);
                const santillanaAvg = getAvg(santillanaNotes);
                const examEscrito = pStudent.notes[23] ?? 0;
                const examRubrica = pStudent.notes[24] ?? 0;
                const avgEx = (examEscrito * 0.85) + (examRubrica * 0.15);

                const isExpanded = expandedStudentId === student.id;
                const gradeSubject = state.config.grades.find(x => x.id === gradeId)?.useGlobalSubject ? state.config.subject : state.config.grades.find(x => x.id === gradeId)?.subject;

                const cName = blockNames[0] || "Cotidianas";
                const cWeight = blockWeights[0];
                const sName = blockNames[1] || "Santillana";
                const sWeight = blockWeights[1];
                const iName = blockNames[2] || "Trabajo Integrador";
                const iWeight = blockWeights[2];
                const pName = blockNames[3] || "Proyecto";
                const pWeight = blockWeights[3];
                const hName = blockNames[4] || "Holística";
                const hWeight = blockWeights[4];
                const eName = blockNames[5] || "Evaluación";
                const eWeight = blockWeights[5];

                return (
                  <React.Fragment key={`${student.id}-${gradeId}-${idx}`}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors ${
                        pStudent.isDisabled ? "opacity-45 bg-gray-50/50 italic text-gray-400" : ""
                      } ${isExpanded ? "bg-slate-50/60 font-semibold" : ""}`}
                    >
                      <td className="p-4 py-3">
                        <span className="font-semibold block text-gray-900 text-xs">{pStudent.name}</span>
                        {pStudent.isDisabled && (
                          <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider block mt-0.5">
                            🚫 Alumno Inactivo
                          </span>
                        )}
                      </td>
                      <td className="p-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {gradeLabel}
                        </span>
                        <span className="text-[11px] text-gray-500 block mt-1 font-semibold truncate max-w-[160px]">
                          {gradeSubject}
                        </span>
                      </td>
                      <td className="p-4 py-3 text-center">
                        <span className="font-bold block text-gray-800 text-xs">
                          {compliance.count} <span className="text-[10px] text-gray-400 font-normal">/ {compliance.total}</span>
                        </span>
                        <span className="text-[10px] font-semibold text-gray-500 block">
                          {compliance.percentage}% entregado
                        </span>
                      </td>
                      <td className="p-4 py-3 text-center">
                        <span className="font-bold block text-gray-800 text-xs">
                          Puesto #{rankInfo.rank}
                        </span>
                        <span className="text-[10px] text-gray-500 block font-medium">
                          de {rankInfo.total} alumnos
                        </span>
                      </td>
                      <td className="p-4 py-3 text-center font-bold text-sm">
                        <span className={finalScore < 6.5 ? "text-red-650" : "text-emerald-700"}>
                          {finalScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-4 py-3 text-center overflow-visible">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                            className={`p-1.5 px-2.5 rounded border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors ${
                              isExpanded
                                ? "bg-slate-800 text-white border-slate-800"
                                : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-3xs"
                            }`}
                            title={isExpanded ? "Ocultar panel de calificación" : "Ingresar / Editar Notas"}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {isExpanded ? "Cerrar" : "Notas"}
                          </button>
                          <StudentActionsDropdown
                            student={student}
                            onRename={(sid) => onRename(gradeId, sid)}
                            onToggleStatus={(sid) => onToggleStatus(gradeId, sid)}
                            onMigrate={(sid) => onMigrate(gradeId, sid)}
                            onViewReport={(sid) => onViewReport(gradeId, sid)}
                            onDelete={(sid) => onDelete(gradeId, sid)}
                            alignLeft={true}
                          />
                        </div>
                      </td>
                    </tr>

                    {/* Expandable row edit notes section */}
                    {isExpanded && (
                      <tr className="bg-slate-50 border-b-2 border-slate-205">
                        <td colSpan={6} className="p-4 bg-slate-50/80 border-t border-slate-200">
                          <div className="bg-white border-2 border-slate-200 p-5 rounded-lg shadow-sm space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                              <div>
                                <h4 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-[var(--primary)]" />
                                  Registro Académico Individual — {pStudent.name}
                                </h4>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                                  Sección: {gradeLabel} | Período: {state.currentTrim === "ANUAL" ? "Resumen Anual (Ver-Solamente)" : "PERIODO DE TRABAJO " + state.currentTrim.replace("T", "")}
                                </p>
                              </div>
                              <button
                                onClick={() => setExpandedStudentId(null)}
                                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-205 rounded text-[10px] font-black uppercase cursor-pointer"
                              >
                                Ocultar Panel
                              </button>
                            </div>

                            {state.currentTrim === "ANUAL" ? (
                              <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-xs font-bold leading-relaxed space-y-1">
                                <p className="flex items-center gap-2 text-amber-900">
                                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                  ¡Modo de Solo Lectura Activado!
                                </p>
                                <p className="font-normal text-gray-600">
                                  El "Resumen Anual" es un reporte compilado. Para ingresar, editar o modificar las calificaciones individuales, por favor elija un período específico (Periodo 1, 2, etc.) utilizando el selector de períodos en la esquina superior derecha del buscador.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                {/* Left portion: Cotidianas and Santillana grids */}
                                <div className="lg:col-span-8 space-y-4">
                                  {/* Block 1: Cotidianas */}
                                  <div className="border border-slate-150 rounded-lg p-3 bg-white space-y-2">
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                      <span className="text-xs font-black uppercase text-slate-705 tracking-wider flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                        {cName} ({cWeight}%)
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-0.5 rounded border border-slate-200">
                                        PROM: <span className="font-mono text-indigo-700 font-extrabold">{cotidianaAvg.toFixed(1)}</span>
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {Array.from({ length: 10 }).map((_, idx) => {
                                        const noteIdx = idx;
                                        const reason = pStudent.reasons[noteIdx];
                                        const isPermiso = reason && reason.startsWith("Presentó Permiso");
                                        return (
                                          <div key={noteIdx} className="flex flex-col items-center bg-gray-50/50 border border-slate-200 rounded overflow-hidden">
                                            <span className="text-[10px] text-gray-400 font-bold bg-slate-100/85 w-full text-center py-0.5 border-b border-slate-200 uppercase tracking-tight">C{idx + 1}</span>
                                            <div className="h-9 w-full flex items-stretch">
                                              <GradeInput
                                                value={pStudent.notes[noteIdx]}
                                                onChange={(val) => onUpdateNote(student.id, noteIdx, val, gradeId)}
                                              />
                                              <button
                                                onClick={() => onOpenReason(student.id, noteIdx, gradeId)}
                                                className={`w-4 border-l border-slate-100 flex items-center justify-center text-[10px] font-black transition-colors ${
                                                  reason
                                                    ? isPermiso
                                                      ? "bg-emerald-500 text-white"
                                                      : "bg-amber-400 text-white"
                                                    : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                }`}
                                                title={reason || "Haga clic para agregar de observación/incidencia"}
                                              >
                                                i
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Block 2: Santillana / Tareas */}
                                  <div className="border border-slate-150 rounded-lg p-3 bg-white space-y-2">
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                      <span className="text-xs font-black uppercase text-slate-705 tracking-wider flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                                        {sName} ({sWeight}%)
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-0.5 rounded border border-slate-200">
                                        PROM: <span className="font-mono text-emerald-800 font-extrabold">{santillanaAvg.toFixed(1)}</span>
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {Array.from({ length: 10 }).map((_, idx) => {
                                        const noteIdx = idx + 10;
                                        const reason = pStudent.reasons[noteIdx];
                                        const isPermiso = reason && reason.startsWith("Presentó Permiso");
                                        return (
                                          <div key={noteIdx} className="flex flex-col items-center bg-gray-50/50 border border-slate-200 rounded overflow-hidden">
                                            <span className="text-[10px] text-gray-400 font-bold bg-slate-100/85 w-full text-center py-0.5 border-b border-slate-200 uppercase tracking-tight">S{idx + 1}</span>
                                            <div className="h-9 w-full flex items-stretch">
                                              <GradeInput
                                                value={pStudent.notes[noteIdx]}
                                                onChange={(val) => onUpdateNote(student.id, noteIdx, val, gradeId)}
                                              />
                                              <button
                                                onClick={() => onOpenReason(student.id, noteIdx, gradeId)}
                                                className={`w-4 border-l border-slate-100 flex items-center justify-center text-[10px] font-black transition-colors ${
                                                  reason
                                                    ? isPermiso
                                                      ? "bg-emerald-500 text-white"
                                                      : "bg-amber-400 text-white"
                                                    : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                }`}
                                                title={reason || "Haga clic para agregar de observación/incidencia"}
                                              >
                                                i
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* Right portion: Single items, Exams, and calculations card */}
                                <div className="lg:col-span-4 space-y-4">
                                  {/* Section: Individual block items */}
                                  <div className="border border-slate-150 rounded-lg p-3 bg-white space-y-2">
                                    <span className="text-xs font-black uppercase text-slate-705 tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
                                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                      Criterios Libres
                                    </span>
                                    <div className="space-y-2">
                                      {[
                                        { idx: 20, name: iName, weight: iWeight },
                                        { idx: 21, name: pName, weight: pWeight },
                                        { idx: 22, name: hName, weight: hWeight }
                                      ].map(({ idx, name, weight }) => {
                                        const reason = pStudent.reasons[idx];
                                        const isPermiso = reason && reason.startsWith("Presentó Permiso");
                                        return (
                                          <div key={idx} className="flex justify-between items-center bg-gray-50/40 p-1.5 px-2 border border-slate-200 rounded-md">
                                            <div className="min-w-0 pr-1">
                                              <span className="font-extrabold text-[11px] text-slate-700 block truncate leading-tight" title={name}>{name}</span>
                                              <span className="text-[9px] font-bold text-gray-500 tracking-tight block">Peso: {weight}%</span>
                                            </div>
                                            <div className="flex items-center border border-slate-250 bg-white rounded overflow-hidden h-8 w-20 flex-shrink-0">
                                              <GradeInput
                                                value={pStudent.notes[idx]}
                                                onChange={(val) => onUpdateNote(student.id, idx, val, gradeId)}
                                              />
                                              <button
                                                onClick={() => onOpenReason(student.id, idx, gradeId)}
                                                className={`w-4 border-l border-slate-100 h-full flex items-center justify-center text-[10px] font-black transition-colors ${
                                                  reason
                                                    ? isPermiso
                                                      ? "bg-emerald-500 text-white"
                                                      : "bg-amber-400 text-white"
                                                    : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                }`}
                                                title={reason || "Haga clic para agregar de observación/incidencia"}
                                              >
                                                i
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Section: Block exam rubrics */}
                                  <div className="border border-slate-150 rounded-lg p-3 bg-white space-y-2.5">
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                      <span className="text-xs font-black uppercase text-slate-705 tracking-wider flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                                        {eName} ({eWeight}%)
                                      </span>
                                      <span className="text-[10px] font-bold text-red-700 bg-red-50/50 px-2 py-0.5 rounded border border-red-150">
                                        EX: <span className="font-mono font-extrabold">{avgEx.toFixed(1)}</span>
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {[
                                        { idx: 23, label: "Escrito (85%)" },
                                        { idx: 24, label: "Rúbrica (15%)" }
                                      ].map(({ idx, label }) => {
                                        const reason = pStudent.reasons[idx];
                                        const isPermiso = reason && reason.startsWith("Presentó Permiso");
                                        return (
                                          <div key={idx} className="flex flex-col items-center bg-gray-50/50 border border-slate-200 rounded overflow-hidden">
                                            <span className="text-[9px] text-gray-500 font-black bg-slate-100 w-full text-center py-1 border-b border-slate-200 uppercase tracking-tight">{label}</span>
                                            <div className="h-8 w-full flex items-stretch">
                                              <GradeInput
                                                value={pStudent.notes[idx]}
                                                onChange={(val) => onUpdateNote(student.id, idx, val, gradeId)}
                                              />
                                              <button
                                                onClick={() => onOpenReason(student.id, idx, gradeId)}
                                                className={`w-4 border-l border-slate-100 flex items-center justify-center text-[10px] font-black transition-colors ${
                                                  reason
                                                    ? isPermiso
                                                      ? "bg-emerald-500 text-white"
                                                      : "bg-amber-400 text-white"
                                                    : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                }`}
                                                title={reason || "Haga clic para agregar de observación/incidencia"}
                                              >
                                                i
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Final calculation indicator */}
                                  <div className="border border-slate-200 bg-slate-850 text-white rounded-lg p-3.5 space-y-1 bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-[var(--primary)] shadow-sm">
                                    <div className="flex justify-between items-center text-[10px] text-slate-350 font-bold uppercase tracking-wide">
                                      <span>Entregas Completadas:</span>
                                      <span className="font-extrabold text-white font-mono">{compliance.count}/{compliance.total} ({compliance.percentage}%)</span>
                                    </div>
                                    <div className="border-t border-slate-700/50 my-1.5"></div>
                                    <div className="flex justify-between items-center pt-0.5">
                                      <span className="text-[10px] text-slate-300 uppercase tracking-wider font-black">PROMEDIO OBTENIDO:</span>
                                      <span className={`text-2xl font-black font-mono tracking-tight leading-none ${finalScore < 6.5 ? "text-rose-400" : "text-emerald-400"}`}>
                                        {finalScore.toFixed(1)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
