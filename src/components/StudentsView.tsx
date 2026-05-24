import React, { useState, useEffect } from "react";
import { AppState, Student } from "../types";
import { calculateFinal, getStudentCompliance, getStudentRank, getAvg } from "../utils";
import StudentActionsDropdown from "./StudentActionsDropdown";
import { Search, X, Users, AlertCircle, ChevronDown, ChevronUp, BookOpen, Pencil } from "lucide-react";

interface GradeInputProps {
  value: number | null;
  onChange: (value: string) => void;
}

function GradeInput({ value, onChange }: GradeInputProps) {
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
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const enabledGrades = state.config.grades.filter(g => g.enabled);

  // Collect all valid/real students across all active groups
  const allStudentsList: { student: Student; gradeId: string; gradeLabel: string }[] = [];

  enabledGrades.forEach(g => {
    const list = state.data["T1"]?.[g.id] || [];
    list.forEach(s => {
      // Filter out raw placeholders if desired, or let them be renamed
      const isPlaceholder = s.name.includes("Estudiante");
      const isHiddenInactive = hideInactive && s.isDisabled;
      
      if (!isPlaceholder && !isHiddenInactive) {
        allStudentsList.push({
          student: s,
          gradeId: g.id,
          gradeLabel: g.label,
        });
      }
    });
  });

  // Filter based on search term (student name)
  const filteredStudents = allStudentsList.filter(item =>
    item.student.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  // Sorting alphabetically by name
  filteredStudents.sort((a, b) => a.student.name.localeCompare(b.student.name));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4 no-print">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <h2 className="text-lg font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-5 h-5" />
            Buscador General de Estudiantes
          </h2>
          
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar estudiante por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-gray-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase">Consultar Periodo:</label>
          <select
            value={state.currentTrim}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-semibold select-custom"
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

      {filteredStudents.length === 0 ? (
        <div className="bg-white border border-gray-200 p-8 rounded-lg text-center font-medium shadow-xs text-gray-500 flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 text-gray-400" />
          {searchTerm.trim()
            ? `No se encontraron estudiantes que coincidan con "${searchTerm}".`
            : "No hay estudiantes registrados o habilitados en ningún grupo."}
        </div>
      ) : (
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
              {filteredStudents.map(({ student, gradeId, gradeLabel }, idx) => {
                // Fetch proper student details for the selected period
                const period = state.currentTrim === "ANUAL" ? "T1" : state.currentTrim;
                const pStudent = state.data[period]?.[gradeId]?.find(x => x.id === student.id) || student;
                
                // Calculate stats
                const compliance = getStudentCompliance(pStudent.notes, pStudent.reasons);
                const rankInfo = getStudentRank(student.id, gradeId, state.currentTrim, state.data, state.config);
                
                let finalScore = 0;
                if (state.currentTrim === "ANUAL") {
                  const g = state.config.grades.find(x => x.id === gradeId);
                  const count = g ? (g.useGlobalPeriods ? state.config.periodCount : g.periodCount) : state.config.periodCount;
                  let totalSum = 0;
                  for (let i = 1; i <= count; i++) {
                    const ps = state.data[`T${i}`]?.[gradeId]?.find(x => x.id === student.id);
                    totalSum += ps ? calculateFinal(ps.notes, state.config) : 0;
                  }
                  finalScore = totalSum / count;
                } else {
                  finalScore = calculateFinal(pStudent.notes, state.config);
                }
                const cName = state.config.blockNames[0] || "Cotidianas";
                const cWeight = state.config.blockWeights[0];
                const sName = state.config.blockNames[1] || "Santillana";
                const sWeight = state.config.blockWeights[1];
                const iName = state.config.blockNames[2] || "Trabajo Integrador";
                const iWeight = state.config.blockWeights[2];
                const pName = state.config.blockNames[3] || "Proyecto";
                const pWeight = state.config.blockWeights[3];
                const hName = state.config.blockNames[4] || "Holística";
                const hWeight = state.config.blockWeights[4];
                const eName = state.config.blockNames[5] || "Evaluación";
                const eWeight = state.config.blockWeights[5];

                const cotidianaNotes = pStudent.notes.slice(0, 10);
                const cotidianaAvg = getAvg(cotidianaNotes);
                const santillanaNotes = pStudent.notes.slice(10, 20);
                const santillanaAvg = getAvg(santillanaNotes);
                const examEscrito = pStudent.notes[23] ?? 0;
                const examRubrica = pStudent.notes[24] ?? 0;
                const avgEx = (examEscrito * 0.85) + (examRubrica * 0.15);

                const isExpanded = expandedStudentId === student.id;

                return (
                  <React.Fragment key={`${student.id}-${gradeId}-${idx}`}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors ${
                        pStudent.isDisabled ? "opacity-45 bg-gray-50/50 italic text-gray-400" : ""
                      } ${isExpanded ? "bg-slate-50/60 font-semibold" : ""}`}
                    >
                      <td className="p-4 py-3">
                        <span className="font-semibold block text-gray-900">{pStudent.name}</span>
                        {pStudent.isDisabled && (
                          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block mt-0.5">
                            🚫 Alumno Inactivo
                          </span>
                        )}
                      </td>
                      <td className="p-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {gradeLabel}
                        </span>
                        <span className="text-xs text-gray-500 block mt-1 font-medium">
                          {state.config.grades.find(x => x.id === gradeId)?.useGlobalSubject ? state.config.subject : state.config.grades.find(x => x.id === gradeId)?.subject}
                        </span>
                      </td>
                      <td className="p-4 py-3 text-center">
                        <span className="font-bold block text-gray-800">
                          {compliance.count} <span className="text-xs text-gray-400 font-normal">/ {compliance.total}</span>
                        </span>
                        <span className="text-xs font-semibold text-gray-500 block">
                          {compliance.percentage}% entregado
                        </span>
                      </td>
                      <td className="p-4 py-3 text-center">
                        <span className="font-bold block text-gray-800">
                          Puesto #{rankInfo.rank}
                        </span>
                        <span className="text-xs text-gray-500 block font-medium">
                          de {rankInfo.total} alumnos
                        </span>
                      </td>
                      <td className="p-4 py-3 text-center font-bold text-base">
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
                            {/* Inner header */}
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

                            {/* Warning if state.currentTrim === "ANUAL" */}
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
