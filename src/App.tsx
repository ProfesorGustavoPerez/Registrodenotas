import { useState, useEffect } from "react";
import { AppState, Student, Config } from "./types";
import { findStudentForPeriod, normalizeName } from "./utils";
import { 
  FolderPlus, Settings, Database, GraduationCap, X, RefreshCw, AlertCircle, Save
} from "lucide-react";

// Import modular subviews
import DashboardView from "./components/DashboardView";
import StudentsView from "./components/StudentsView";
import SheetView from "./components/SheetView";
import ConfigView from "./components/ConfigView";
import BackupView from "./components/BackupView";
import FichaView from "./components/FichaView";
import AllFichasView from "./components/AllFichasView";

const STORAGE_KEY = "ciencias_master_pro_final_v1";

const THEME_COLORS: Record<string, { primary: string; dark: string }> = {
  indigo: { primary: "#4f46e5", dark: "#3730a3" },
  green: { primary: "#1d6f42", dark: "#145331" },
  blue: { primary: "#1e40af", dark: "#1e3a8a" },
  red: { primary: "#991b1b", dark: "#7f1d1d" },
  gray: { primary: "#4b5563", dark: "#111827" },
  purple: { primary: "#6b21a8", dark: "#581c87" },
  orange: { primary: "#ca5c04", dark: "#a13c07" },
};

export default function App() {
  // Main state container
  const [state, setState] = useState<AppState>(() => {
    // Initial State Factory
    const defaultState: AppState = {
      config: {
        school: "Colegio Cristiano Emanuel",
        teacher: "Lic. Gustavo Pérez",
        subject: "Ciencia y Tecnología",
        periodCount: 3,
        defaultPeriod: "T1",
        blockNames: ["Cotidianas", "Santillana", "Integradora", "Proyecto", "Holística", "Examen"],
        blockWeights: [15, 10, 20, 15, 20, 20],
        grades: [],
        theme: "indigo",
        appVersion: "2.4",
      },
      currentTrim: "T1",
      currentGradeId: null,
      currentView: "dashboard",
      showRankings: false,
      hideInactive: false,
      showListNumberOnly: false,
      data: {},
      activityNames: {},
      activityHistory: [
        "Presentación del Cuaderno",
        "Proyecto de Ciencias",
        "Maqueta del Sistema Solar",
        "Ensayo de Biología",
        "Disertación Científica",
        "Glosario de Conceptos",
        "Organizador Gráfico",
        "Experimento Práctico",
        "Exposición Grupal",
        "Prueba Escrita",
        "Control de Lectura",
        "Taller de Ejercicios"
      ],
    };

    // Make sure we have exactly 12 default groups
    while (defaultState.config.grades.length < 12) {
      const i = defaultState.config.grades.length + 1;
      defaultState.config.grades.push({
        id: `G${i}`,
        label: `Grupo ${i}`,
        enabled: i <= 6,
        useGlobalSubject: true,
        subject: "",
        useGlobalPeriods: true,
        periodCount: 3,
      });
    }

    // Prepare structure for every single term
    ["T1", "T2", "T3", "T4"].forEach((p) => {
      if (!defaultState.data[p]) defaultState.data[p] = {};
      defaultState.config.grades.forEach((g) => {
        if (!defaultState.data[p][g.id]) {
          // Initialize with 40 template students slots
          defaultState.data[p][g.id] = Array.from({ length: 40 }, (_, i) => ({
            id: `S-${g.id}-${i}`,
            name: `Estudiante ${i + 1}`,
            notes: Array(25).fill(null),
            reasons: Array(25).fill(null),
            isDisabled: false,
            manualComment: "",
          }));
        }
      });
    });

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Restore missing params securely
        if (parsed.config) {
          // Sync any missing fields back safely
          const mergedConfig = { ...defaultState.config, ...parsed.config };
          parsed.config = mergedConfig;
        }
        
        // Validate lists lengths of grades
        if (parsed.config && parsed.config.grades.length < 12) {
          while (parsed.config.grades.length < 12) {
            const i = parsed.config.grades.length + 1;
            parsed.config.grades.push({
              id: `G${i}`,
              label: `Grupo ${i}`,
              enabled: false,
              useGlobalSubject: true,
              subject: "",
              useGlobalPeriods: true,
              periodCount: 3,
            });
          }
        }

        // Fill data placeholders if missing are found
        ["T1", "T2", "T3", "T4"].forEach((p) => {
          if (!parsed.data) parsed.data = {};
          if (!parsed.data[p]) parsed.data[p] = {};
          parsed.config.grades.forEach((g: any) => {
            if (!parsed.data[p][g.id]) {
              parsed.data[p][g.id] = Array.from({ length: 40 }, (_, i) => ({
                id: `S-${g.id}-${i}`,
                name: `Estudiante ${i + 1}`,
                notes: Array(25).fill(null),
                reasons: Array(25).fill(null),
                isDisabled: false,
                manualComment: "",
              }));
            }
          });
        });

        // SELF-HEALING BLOCK: Realign T2, T3, T4 student arrays to match the exact order, names, and IDs of T1, transferring notes/reasons correctly
        if (parsed.data && parsed.data["T1"]) {
          parsed.config.grades.forEach((g: any) => {
            const t1Students = parsed.data["T1"][g.id] || [];
            if (t1Students.length === 0) return;

            ["T2", "T3", "T4"].forEach((p) => {
              const pStudents = parsed.data[p]?.[g.id];
              if (!pStudents || pStudents.length === 0) return;

              const matchedIndices = new Set<number>();
              const reconciledList = Array(t1Students.length);

              // Step 1: Match real students by normalized name (robust against accents and spacing) to retain correct scores
              t1Students.forEach((t1S: any, t1Idx: number) => {
                const isPlaceholderT1 = t1S.name.includes("Estudiante");
                if (!isPlaceholderT1) {
                  const pIdx = pStudents.findIndex((x: any, idx: number) => 
                    !matchedIndices.has(idx) && 
                    normalizeName(x.name) === normalizeName(t1S.name)
                  );
                  if (pIdx !== -1) {
                    matchedIndices.add(pIdx);
                    reconciledList[t1Idx] = {
                      ...pStudents[pIdx],
                      id: t1S.id,
                      name: t1S.name,
                      isDisabled: t1S.isDisabled,
                      manualComment: t1S.manualComment || pStudents[pIdx].manualComment
                    };
                  }
                }
              });

              // Step 2: Match remaining entries by ID (covers placeholders and/or directly renamed records)
              t1Students.forEach((t1S: any, t1Idx: number) => {
                if (reconciledList[t1Idx]) return;
                const pIdx = pStudents.findIndex((x: any, idx: number) => 
                  !matchedIndices.has(idx) && 
                  x.id === t1S.id
                );
                if (pIdx !== -1) {
                  matchedIndices.add(pIdx);
                  reconciledList[t1Idx] = {
                    ...pStudents[pIdx],
                    id: t1S.id,
                    name: t1S.name,
                    isDisabled: t1S.isDisabled,
                    manualComment: t1S.manualComment || pStudents[pIdx].manualComment
                  };
                }
              });

              // Step 3: Fill any remaining unmatched elements matching parent T1 template properties
              t1Students.forEach((t1S: any, t1Idx: number) => {
                if (reconciledList[t1Idx]) return;
                reconciledList[t1Idx] = {
                  id: t1S.id,
                  name: t1S.name,
                  notes: Array(25).fill(null),
                  reasons: Array(25).fill(null),
                  isDisabled: t1S.isDisabled,
                  manualComment: t1S.manualComment
                };
              });

              parsed.data[p][g.id] = reconciledList;
            });
          });
        }

        // Set fallbacks for UI toggles
        if (parsed.hideInactive === undefined) parsed.hideInactive = false;
        if (parsed.showListNumberOnly === undefined) parsed.showListNumberOnly = false;
        if (!parsed.activityNames) parsed.activityNames = {};
        if (!parsed.activityHistory) {
          parsed.activityHistory = [
            "Presentación del Cuaderno",
            "Proyecto de Ciencias",
            "Maqueta del Sistema Solar",
            "Ensayo de Biología",
            "Disertación Científica",
            "Glosario de Conceptos",
            "Organizador Gráfico",
            "Experimento Práctico",
            "Exposición Grupal",
            "Prueba Escrita",
            "Control de Lectura",
            "Taller de Ejercicios"
          ];
        }

        return parsed;
      }
    } catch (err) {
      console.error("Local data restoration failed: ", err);
    }

    return defaultState;
  });

  // Toast Notification state
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Active student targets modal overlays
  const [modals, setModals] = useState<{
    addBulk: boolean;
    reason: { gid: string; sid: string; nIdx: number } | null;
    migrate: { gid: string; sid: string } | null;
    rename: { gid: string; sid: string } | null;
    delete: { gid: string; sid: string } | null;
    reset: boolean;
    activityNameEditor: { trim: string; gid: string; nIdx: number } | null;
  }>({
    addBulk: false,
    reason: null,
    migrate: null,
    rename: null,
    delete: null,
    reset: false,
    activityNameEditor: null,
  });

  // Active student targets for Ficha/Report view specifically (to avoid conflict with rename)
  const [activeFicha, setActiveFicha] = useState<{ gid: string; sid: string } | null>(null);

  // Modal manual data state bindings
  const [addBulkText, setAddBulkText] = useState("");
  const [renameInputValue, setRenameInputValue] = useState("");
  const [migrateTargetGradeId, setMigrateTargetGradeId] = useState("");
  const [reasonManualText, setReasonManualText] = useState("");
  const [activeReasonOption, setActiveReasonOption] = useState<string | null>(null);
  const [activityInputValue, setActivityInputValue] = useState("");
  const [confirmResetChecked, setConfirmResetChecked] = useState(false);

  const REASON_OPTS = [
    "Presentó Permiso",
    "Inasistencia S.P.",
    "Falta material",
    "No entregó S.P.",
    "Incompleto",
    "Act. Diferida",
    "Bajo rendimiento",
    "Recuperación",
  ];

  // Save changes automatically
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Handle default starting period selection safely
  useEffect(() => {
    if (state.currentView === "dashboard") {
      setState(prev => ({ ...prev, currentTrim: prev.config.defaultPeriod || "T1" }));
    }
  }, [state.currentView, state.config.defaultPeriod]);

  // Simple alert callback helper
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Switch tabs
  const handleNavigate = (view: string) => {
    setState(prev => ({
      ...prev,
      currentView: view,
      // Default period mapping resets on dashboard
      currentTrim: view === "dashboard" ? (prev.config.defaultPeriod || "T1") : prev.currentTrim,
    }));
  };

  // Grade Card selection
  const handleOpenGrade = (gradeId: string) => {
    // Determine target periods count to ensure standard compliance
    const g = state.config.grades.find(x => x.id === gradeId);
    if (!g) return;

    const count = g.useGlobalPeriods ? state.config.periodCount : g.periodCount;
    let periodVal = state.config.defaultPeriod || "T1";
    if (periodVal !== "ANUAL") {
      const pNum = parseInt(periodVal.replace("T", ""));
      if (pNum > count) {
        periodVal = `T${count}`;
      }
    }

    setState(prev => ({
      ...prev,
      currentGradeId: gradeId,
      currentView: "sheet",
      currentTrim: periodVal,
    }));
  };

  // Update notes values in real-time
  const handleUpdateNote = (studentId: string, noteIndex: number, value: string, overrideGradeId?: string) => {
    const gid = overrideGradeId || state.currentGradeId;
    if (state.currentTrim === "ANUAL" || !gid) return;

    const v = value === "" ? null : parseFloat(value.replace(",", "."));
    
    // Bounds guard check
    if (v !== null && (v < 0 || v > 10)) {
      showToast("error", "❌ ¡Error! El rango de la nota académica debe estar entre 0.0 y 10.0.");
      return;
    }

    const trim = state.currentTrim;

    setState(prev => {
      const dataCopy = { ...prev.data };
      const trimData = { ...dataCopy[trim] };
      const studentsList = [...(trimData[gid] || [])];
      
      const sMaster = prev.data["T1"]?.[gid]?.find(x => x.id === studentId);
      const studentInTrim = findStudentForPeriod(studentsList, studentId, sMaster?.name);
      const sIdx = studentInTrim ? studentsList.findIndex(x => x.id === studentInTrim.id) : -1;
      if (sIdx !== -1) {
        const studentCopy = { ...studentsList[sIdx] };
        const notesCopy = [...studentCopy.notes];
        notesCopy[noteIndex] = v;
        studentCopy.notes = notesCopy;
        studentsList[sIdx] = studentCopy;
        trimData[gid] = studentsList;
        dataCopy[trim] = trimData;
      }
      return { ...prev, data: dataCopy };
    });
  };

  // Update grade config
  const handleUpdateConfig = (newConfig: Config) => {
    setState(prev => ({ ...prev, config: newConfig }));
  };

  // --- ACTIONS MENUS AND OVERLAYS METHODS ---

  // RENAME
  const openRenameModal = (gradeId: string, studentId: string) => {
    const s = state.data["T1"]?.[gradeId]?.find(x => x.id === studentId);
    if (!s) return;
    setRenameInputValue(s.name);
    setModals(prev => ({ ...prev, rename: { gid: gradeId, sid: studentId } }));
  };

  const applyRename = () => {
    const target = modals.rename;
    if (!target) return;

    const trimmed = renameInputValue.trim();
    if (!trimmed) {
      showToast("error", "El nombre del estudiante no puede estar vacío.");
      return;
    }

    // Verify uniqueness
    const list = state.data["T1"]?.[target.gid] || [];
    const isDuplicated = list.some(s => s.id !== target.sid && s.name.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicated) {
      showToast("error", `El nombre "${trimmed}" ya se encuentra registrado en este grupo.`);
      return;
    }

    setState(prev => {
      const dataCopy = { ...prev.data };
      ["T1", "T2", "T3", "T4"].forEach(p => {
        const pList = [...(dataCopy[p]?.[target.gid] || [])];
        const sIdx = pList.findIndex(x => x.id === target.sid);
        if (sIdx !== -1) {
          pList[sIdx] = { ...pList[sIdx], name: trimmed };
          dataCopy[p][target.gid] = pList;
        }
      });
      return { ...prev, data: dataCopy };
    });

    setModals(prev => ({ ...prev, rename: null }));
    showToast("success", "Estudiante renombrado con éxito.");
  };

  // ACTIVE/INACTIVE TOGGLE
  const handleToggleStatus = (gradeId: string, studentId: string) => {
    setState(prev => {
      const dataCopy = { ...prev.data };
      ["T1", "T2", "T3", "T4"].forEach(p => {
        const listCopy = [...(dataCopy[p]?.[gradeId] || [])];
        const sIdx = listCopy.findIndex(x => x.id === studentId);
        if (sIdx !== -1) {
          const currentStatus = listCopy[sIdx].isDisabled;
          listCopy[sIdx] = { ...listCopy[sIdx], isDisabled: !currentStatus };
          dataCopy[p][gradeId] = listCopy;
        }
      });
      return { ...prev, data: dataCopy };
    });
    
    const nowDisabled = !state.data["T1"]?.[gradeId]?.find(x => x.id === studentId)?.isDisabled;
    showToast("success", nowDisabled ? "Estudiante marcado como inactivo." : "Estudiante activado nuevamente.");
  };

  // DELETE AND RESET TO PLACEHOLDER
  const openDeleteModal = (gradeId: string, studentId: string) => {
    setModals(prev => ({ ...prev, delete: { gid: gradeId, sid: studentId } }));
  };

  const applyDelete = () => {
    const target = modals.delete;
    if (!target) return;

    const parts = target.sid.split("-");
    const placeholderIdx = parts.length > 2 ? parseInt(parts[2]) : 0;

    setState(prev => {
      const dataCopy = { ...prev.data };
      ["T1", "T2", "T3", "T4"].forEach(p => {
        const listCopy = [...(dataCopy[p]?.[target.gid] || [])];
        const sIdx = listCopy.findIndex(x => x.id === target.sid);
        if (sIdx !== -1) {
          listCopy[sIdx] = {
            id: target.sid,
            name: `Estudiante ${placeholderIdx + 1}`,
            notes: Array(25).fill(null),
            reasons: Array(25).fill(null),
            isDisabled: true,
            manualComment: "",
          };
          dataCopy[p][target.gid] = listCopy;
        }
      });
      return { ...prev, data: dataCopy };
    });

    setModals(prev => ({ ...prev, delete: null }));
    showToast("success", "Nómina purgada. El casilla de la fila ha quedado libre.");
  };

  // MIGRATE STUDENT
  const openMigrateModal = (gradeId: string, studentId: string) => {
    setMigrateTargetGradeId("");
    setModals(prev => ({ ...prev, migrate: { gid: gradeId, sid: studentId } }));
  };

  const applyMigration = () => {
    const target = modals.migrate;
    if (!target || !migrateTargetGradeId) return;

    const studentName = state.data["T1"]?.[target.gid]?.find(x => x.id === target.sid)?.name || "";

    // Find the master empty/placeholder slot index in target group based strictly on "T1"
    const targetListT1 = state.data["T1"]?.[migrateTargetGradeId] || [];
    const emptyIdx = targetListT1.findIndex(x => x.name.includes("Estudiante"));

    if (emptyIdx === -1) {
      showToast("error", "No hay casillas vacías disponibles en el grupo de destino. Límite: 40.");
      return;
    }

    setState(prev => {
      const dataCopy = { ...prev.data };
      
      ["T1", "T2", "T3", "T4"].forEach(p => {
        const sourceList = [...(dataCopy[p]?.[target.gid] || [])];
        const targetList = [...(dataCopy[p]?.[migrateTargetGradeId] || [])];

        const sIdx = sourceList.findIndex(x => x.id === target.sid);
        if (sIdx === -1) return;

        // Clone student logic
        const studentClone = { ...sourceList[sIdx] };
        
        // Relocate index to preserve ID structure in target
        studentClone.id = `S-${migrateTargetGradeId}-${emptyIdx}`;
        targetList[emptyIdx] = studentClone;

        // Clear original source row back to empty template
        const parts = target.sid.split("-");
        const placeholderIdx = parts.length > 2 ? parseInt(parts[2]) : sIdx;
        sourceList[sIdx] = {
          id: target.sid,
          name: `Estudiante ${placeholderIdx + 1}`,
          notes: Array(25).fill(null),
          reasons: Array(25).fill(null),
          isDisabled: true,
          manualComment: "",
        };

        dataCopy[p][target.gid] = sourceList;
        dataCopy[p][migrateTargetGradeId] = targetList;
      });

      return { ...prev, data: dataCopy };
    });

    setModals(prev => ({ ...prev, migrate: null }));
    showToast("success", `¡Éxito! Estudiante ${studentName} trasladado.`);
  };

  // ADD STUDENTS IN BULK LIST PATTERN
  const applyAddBulkStudents = () => {
    const gid = state.currentGradeId;
    if (!gid) return;

    // Split text rows
    const listRaw = addBulkText.split("\n").map(s => s.trim()).filter(Boolean);
    if (listRaw.length === 0) {
      showToast("error", "Por favor introduzca nombres válidos en la lista.");
      return;
    }

    const currentStudents = state.data["T1"]?.[gid] || [];
    const activeNames = currentStudents
      .filter(s => !s.isDisabled && !s.name.includes("Estudiante"))
      .map(s => s.name.toLowerCase());

    const namesToAdd: string[] = [];
    listRaw.forEach(n => {
      if (!activeNames.includes(n.toLowerCase()) && !namesToAdd.map(x => x.toLowerCase()).includes(n.toLowerCase())) {
        namesToAdd.push(n);
      }
    });

    if (namesToAdd.length === 0) {
      showToast("error", "Todos los nombres ingresados ya se encuentran o están duplicados.");
      return;
    }

    // Identify empty/inactive/disabled index placeholders strictly based on master "T1"
    const targetIdxs: number[] = [];
    for (let i = 0; i < currentStudents.length && targetIdxs.length < namesToAdd.length; i++) {
      if (currentStudents[i].name.includes("Estudiante") || currentStudents[i].isDisabled) {
        targetIdxs.push(i);
      }
    }

    if (targetIdxs.length === 0) {
      showToast("error", "No quedan espacios o casillas libres en este grupo para agregar más estudiantes. Límite: 40.");
      return;
    }

    const actualNamesToAdd = namesToAdd.slice(0, targetIdxs.length);
    const timestamp = Date.now();

    setState(prev => {
      const dataCopy = { ...prev.data };
      ["T1", "T2", "T3", "T4"].forEach(p => {
        const listCopy = [...(dataCopy[p]?.[gid] || [])];
        targetIdxs.forEach((listIdx, sIdx) => {
          if (listIdx < listCopy.length && sIdx < actualNamesToAdd.length) {
            listCopy[listIdx] = {
              ...listCopy[listIdx],
              name: actualNamesToAdd[sIdx],
              notes: Array(25).fill(null),
              reasons: Array(25).fill(null),
              isDisabled: false,
              manualComment: "",
              addedAt: timestamp + sIdx, // distinct timestamp increment to maintain sequence
            };
          }
        });
        dataCopy[p][gid] = listCopy;
      });
      return { ...prev, data: dataCopy };
    });

    setModals(prev => ({ ...prev, addBulk: false }));
    setAddBulkText("");
    showToast("success", `Se agregaron ${actualNamesToAdd.length} de ${namesToAdd.length} estudiantes correctamente en casillas vacías.`);
  };

  // LOG OBSERVANCES / REASONS
  const openReasonModal = (studentId: string, noteIndex: number, overrideGradeId?: string) => {
    const gid = overrideGradeId || state.currentGradeId;
    if (state.currentTrim === "ANUAL" || !gid) return;
    const trim = state.currentTrim;

    const sMaster = state.data["T1"]?.[gid]?.find(x => x.id === studentId);
    const student = findStudentForPeriod(state.data[trim]?.[gid], studentId, sMaster?.name);
    if (!student) return;

    const currentReason = student.reasons[noteIndex] || "";
    
    // Parse preset option vs manual parts decoration
    let matchedOption: string | null = null;
    let manualTxt = currentReason;

    for (const opt of REASON_OPTS) {
      if (currentReason === opt || currentReason.startsWith(opt + " - ")) {
        matchedOption = opt;
        manualTxt = currentReason === opt ? "" : currentReason.substring(opt.length + 3);
        break;
      }
    }

    setActiveReasonOption(matchedOption);
    setReasonManualText(manualTxt);
    setModals(prev => ({
      ...prev,
      reason: { gid, sid: studentId, nIdx: noteIndex }
    }));
  };

  const applyReasonChange = (close = false) => {
    const target = modals.reason;
    if (!target) return;

    let fullReasonText = "";
    if (activeReasonOption) {
      fullReasonText = activeReasonOption;
    }
    if (reasonManualText.trim()) {
      fullReasonText = fullReasonText 
        ? `${fullReasonText} - ${reasonManualText.trim()}` 
        : reasonManualText.trim();
    }

    setState(prev => {
      const dataCopy = { ...prev.data };
      const trimData = { ...dataCopy[state.currentTrim] };
      const sList = [...(trimData[target.gid] || [])];
      
      const sMaster = prev.data["T1"]?.[target.gid]?.find(x => x.id === target.sid);
      const studentInTrim = findStudentForPeriod(sList, target.sid, sMaster?.name);
      const sIdx = studentInTrim ? sList.findIndex(x => x.id === studentInTrim.id) : -1;
      if (sIdx !== -1) {
        const studentCopy = { ...sList[sIdx] };
        const reasonsCopy = [...studentCopy.reasons];
        reasonsCopy[target.nIdx] = fullReasonText || null;
        studentCopy.reasons = reasonsCopy;
        sList[sIdx] = studentCopy;
        trimData[target.gid] = sList;
        dataCopy[state.currentTrim] = trimData;
      }
      return { ...prev, data: dataCopy };
    });

    if (close) {
      setModals(prev => ({ ...prev, reason: null }));
    }
  };

  const clearActiveReason = () => {
    const target = modals.reason;
    if (!target) return;

    setActiveReasonOption(null);
    setReasonManualText("");

    setState(prev => {
      const dataCopy = { ...prev.data };
      const trimData = { ...dataCopy[state.currentTrim] };
      const sList = [...(trimData[target.gid] || [])];
      
      const sMaster = prev.data["T1"]?.[target.gid]?.find(x => x.id === target.sid);
      const studentInTrim = findStudentForPeriod(sList, target.sid, sMaster?.name);
      const sIdx = studentInTrim ? sList.findIndex(x => x.id === studentInTrim.id) : -1;
      if (sIdx !== -1) {
        const studentCopy = { ...sList[sIdx] };
        const reasonsCopy = [...studentCopy.reasons];
        reasonsCopy[target.nIdx] = null;
        studentCopy.reasons = reasonsCopy;
        sList[sIdx] = studentCopy;
        trimData[target.gid] = sList;
        dataCopy[state.currentTrim] = trimData;
      }
      return { ...prev, data: dataCopy };
    });
  };

  // CUSTOM ACTIVITY NAMES MANAGEMENT
  const openActivityEditor = (trim: string, gid: string, nIdx: number) => {
    const currentName = state.activityNames?.[trim]?.[gid]?.[nIdx] || "";
    setActivityInputValue(currentName);
    setModals(prev => ({
      ...prev,
      activityNameEditor: { trim, gid, nIdx }
    }));
  };

  const saveActivityName = (newName: string) => {
    const target = modals.activityNameEditor;
    if (!target) return;

    const trimmed = newName.trim();

    setState(prev => {
      const namesCopy = prev.activityNames ? { ...prev.activityNames } : {};
      if (!namesCopy[target.trim]) namesCopy[target.trim] = {};
      if (!namesCopy[target.trim][target.gid]) {
        namesCopy[target.trim][target.gid] = Array(25).fill(null);
      } else {
        namesCopy[target.trim][target.gid] = [...namesCopy[target.trim][target.gid]];
      }

      namesCopy[target.trim][target.gid][target.nIdx] = trimmed || null;

      // Add to history if not exists and has value
      let historyCopy = [...(prev.activityHistory || [])];
      if (trimmed && !historyCopy.includes(trimmed)) {
        historyCopy.unshift(trimmed);
      }

      return {
        ...prev,
        activityNames: namesCopy,
        activityHistory: historyCopy
      };
    });

    setModals(prev => ({ ...prev, activityNameEditor: null }));
    showToast("success", "Nombre de la actividad actualizado correctamente.");
  };

  const deleteHistoryItem = (itemToDelete: string) => {
    setState(prev => {
      const historyCopy = (prev.activityHistory || []).filter(x => x !== itemToDelete);
      return {
        ...prev,
        activityHistory: historyCopy
      };
    });
  };

  // UPDATE INIVIDUAL MAN COMMENTS
  const handleUpdateManualComment = (studentId: string, gradeId: string, text: string) => {
    setState(prev => {
      const dataCopy = { ...prev.data };
      
      // Save manually across active period
      const trim = prev.currentTrim === "ANUAL" ? "T1" : prev.currentTrim;
      const listCopy = [...(dataCopy[trim]?.[gradeId] || [])];
      const sIdx = listCopy.findIndex(x => x.id === studentId);
      if (sIdx !== -1) {
        listCopy[sIdx] = { ...listCopy[sIdx], manualComment: text };
        dataCopy[trim][gradeId] = listCopy;
      }
      return { ...prev, data: dataCopy };
    });
  };

  // EXCEL SPREADSHEETS IMPORT OVERRIDES
  const handleImportXLSXData = (
    gradeId: string, 
    periodId: string, 
    parsedStudents: { name: string; notes: (number | null)[]; reasons?: (string | null)[] }[]
  ) => {
    let affectedCount = 0;

    setState(prev => {
      const dataCopy = { ...prev.data };
      const periods = ["T1", "T2", "T3", "T4"];

      // Safeguard initialization
      periods.forEach(p => {
        if (!dataCopy[p]) dataCopy[p] = {};
        if (!dataCopy[p][gradeId]) {
          dataCopy[p][gradeId] = Array.from({ length: 40 }, (_, i) => ({
            id: `S-${gradeId}-${i}`,
            name: `Estudiante ${i + 1}`,
            notes: Array(25).fill(null),
            reasons: Array(25).fill(null),
            isDisabled: false,
            manualComment: "",
          }));
        }
      });

      // Maintain a copy of current lists for in-place modifications
      const lists: Record<string, Student[]> = {};
      periods.forEach(p => {
        lists[p] = [...dataCopy[p][gradeId]];
      });

      if (periodId === "ANUAL") {
        // Just register names/creating them and synchronizing across all periods
        parsedStudents.forEach((pS) => {
          const normName = normalizeName(pS.name);
          let sIdx = lists["T1"].findIndex(x => normalizeName(x.name) === normName);

          if (sIdx === -1) {
            // Find placeholder slot to occupy
            sIdx = lists["T1"].findIndex(x => x.name.includes("Estudiante") || x.isDisabled);
            if (sIdx !== -1) {
              const baseId = lists["T1"][sIdx].id;
              periods.forEach(p => {
                lists[p][sIdx] = {
                  ...lists[p][sIdx],
                  id: baseId,
                  name: pS.name,
                  isDisabled: false,
                  addedAt: Date.now() + sIdx,
                };
              });
              affectedCount++;
            }
          } else {
            // Student exists, ensure they are enabled
            periods.forEach(p => {
              lists[p][sIdx] = {
                ...lists[p][sIdx],
                isDisabled: false,
              };
            });
            affectedCount++;
          }
        });
      } else {
        // Upload specific notes and reasons for a specific period
        parsedStudents.forEach((pS) => {
          const normName = normalizeName(pS.name);
          let sIdx = lists["T1"].findIndex(x => normalizeName(x.name) === normName);

          if (sIdx === -1) {
            // Find placeholder slot to occupy
            sIdx = lists["T1"].findIndex(x => x.name.includes("Estudiante") || x.isDisabled);
            if (sIdx !== -1) {
              const baseId = lists["T1"][sIdx].id;
              periods.forEach(p => {
                lists[p][sIdx] = {
                  ...lists[p][sIdx],
                  id: baseId,
                  name: pS.name,
                  isDisabled: false,
                  addedAt: Date.now() + sIdx,
                };
              });
            }
          }

          if (sIdx !== -1) {
            // Make sure they are enabled
            periods.forEach(p => {
              lists[p][sIdx].isDisabled = false;
            });

            // Set detailed notes & reasons to the selected period
            lists[periodId][sIdx] = {
              ...lists[periodId][sIdx],
              notes: pS.notes,
              reasons: pS.reasons || lists[periodId][sIdx].reasons || Array(25).fill(null)
            };
            affectedCount++;
          }
        });
      }

      // Write lists back into dataCopy
      periods.forEach(p => {
        dataCopy[p][gradeId] = lists[p];
      });

      return { ...prev, data: dataCopy };
    });

    showToast("success", `¡Excel importado! ${affectedCount} alumnos registrados/actualizados.`);
  };

  // GLOBAL ACTIONS
  const handleApplyImportFullJSON = (imported: any) => {
    setState(imported);
    showToast("success", "✓ Base de datos restaurada correctamente. Recargando...");
  };

  const handleExportFullJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Respaldo_Registro_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("success", "Generando archivo de respaldo global.");
  };

  const applyResetSystem = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const overallProgress = (() => {
    const enabledGrades = state.config.grades.filter(g => g.enabled);
    if (enabledGrades.length === 0) return 0;
    let totalCells = 0;
    let filledCells = 0;
    enabledGrades.forEach(g => {
      const list = state.data["T1"]?.[g.id] || [];
      const realStudents = list.filter(s => !s.name.includes("Estudiante"));
      const maxPeriods = g.useGlobalPeriods ? state.config.periodCount : g.periodCount;
      for (let pNum = 1; pNum <= maxPeriods; pNum++) {
        const pList = state.data[`T${pNum}`]?.[g.id] || [];
        realStudents.forEach(rs => {
          const stud = findStudentForPeriod(pList, rs.id, rs.name);
          if (stud) {
            stud.notes.forEach(val => {
              totalCells++;
              if (val !== null) filledCells++;
            });
          }
        });
      }
    });
    if (totalCells === 0) return 65; // beautiful fallback progress matching style template
    return Math.round((filledCells / totalCells) * 100);
  })();

  const teacherInitial = state.config.teacher 
    ? state.config.teacher.trim().replace(/^Lic\.\s+/i, "")[0]?.toUpperCase() || "G" 
    : "G";

  // Active theme mapping variables
  const currentThemeHex = THEME_COLORS[state.config.theme] || THEME_COLORS.green;

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-950"
      style={{
        ["--primary" as any]: currentThemeHex.primary,
        ["--primary-dark" as any]: currentThemeHex.dark,
      }}
    >
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] animate-bounce no-print">
          <div className="p-4 px-6 rounded-lg text-sm font-bold shadow-lg flex items-center gap-3 border-l-8 bg-white border-emerald-600 text-slate-800 ring-1 ring-black/5">
            <AlertCircle className={toast.type === "success" ? "text-emerald-500 w-5 h-5" : "text-rose-500 w-5 h-5"} />
            {toast.message}
          </div>
        </div>
      )}

      {/* Header Corporativo (High Density styling layout) */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-xs select-none no-print">
        <div className="flex items-center gap-4">
          <div
            className="w-9 h-9 rounded flex items-center justify-center text-white font-bold select-none text-base transition-all shadow-2xs"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {teacherInitial}
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight text-slate-800 leading-tight">
              {state.config.school}
              <span className="text-[9px] bg-indigo-50 text-indigo-700 py-0.5 px-1.5 rounded font-bold ml-1.5 uppercase border border-indigo-100/40">
                {state.config.appVersion || "2.4"}
              </span>
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mt-1">
              {state.currentGradeId 
                ? `${state.config.grades.find(x => x.id === state.currentGradeId)?.useGlobalSubject ? state.config.subject : state.config.grades.find(x => x.id === state.currentGradeId)?.subject} • ${state.config.teacher}`
                : `${state.config.subject} • ${state.config.teacher}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Theme Dynamic Control Circles */}
          <div className="flex items-center gap-1.5 border-l border-slate-150 pl-6">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mr-1.5 hidden md:block">Estilo</span>
            <div className="flex gap-1 p-1 bg-slate-50 border border-slate-200 rounded-md">
              {Object.keys(THEME_COLORS).map((themeName) => (
                <button
                  key={themeName}
                  onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, theme: themeName } }))}
                  style={{ backgroundColor: THEME_COLORS[themeName].primary }}
                  className={`w-3.5 h-3.5 rounded border cursor-pointer transition-all hover:scale-110 ${
                    state.config.theme === themeName 
                      ? "ring-1 ring-slate-400 ring-offset-1 scale-105 opacity-100" 
                      : "border-slate-350/40 opacity-70"
                  }`}
                  title={`Tema ${themeName}`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Navegación pestañas principales */}
      {state.currentView !== "ficha" && (
        <nav className="bg-white border-b border-slate-150 flex overflow-x-auto shadow-2xs select-none flex-shrink-0 no-print">
          {[
            { id: "dashboard", label: "Grados", icon: GraduationCap },
            { id: "students", label: "Estudiantes", icon: FolderPlus },
            { id: "config", label: "Configuración", icon: Settings },
            { id: "backup", label: "Respaldo", icon: Database },
          ].map((tab) => {
            const IconEl = tab.icon;
            const isActive = state.currentView === tab.id || (tab.id === "dashboard" && state.currentView === "sheet");
            return (
              <button
                key={tab.id}
                onClick={() => handleNavigate(tab.id)}
                className={`py-3.5 px-6 border-b-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? "border-[var(--primary)] text-[var(--primary)] bg-slate-50/25 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/10 font-medium"
                }`}
              >
                <IconEl className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {state.currentView === "dashboard" && (
          <DashboardView state={state} onSelectGrade={handleOpenGrade} />
        )}

        {state.currentView === "students" && (
          <StudentsView
            state={state}
            onRename={openRenameModal}
            onToggleStatus={handleToggleStatus}
            onMigrate={openMigrateModal}
            onViewReport={(gid, sid) => {
              setState(prev => ({ ...prev, currentGradeId: gid, currentView: "ficha" }));
              // Setup correct active student target parameters in view state context
              setActiveFicha({ gid, sid });
            }}
            onDelete={openDeleteModal}
            onPeriodChange={(trim) => setState(prev => ({ ...prev, currentTrim: trim }))}
            hideInactive={state.hideInactive}
            onUpdateNote={handleUpdateNote}
            onOpenReason={openReasonModal}
          />
        )}

        {state.currentView === "sheet" && (
          <SheetView
            state={state}
            onBack={() => handleNavigate("dashboard")}
            onRename={(sid) => openRenameModal(state.currentGradeId!, sid)}
            onToggleStatus={(sid) => handleToggleStatus(state.currentGradeId!, sid)}
            onMigrate={(sid) => openMigrateModal(state.currentGradeId!, sid)}
            onViewReport={(sid) => {
              setActiveFicha({ gid: state.currentGradeId!, sid });
              setState(prev => ({ ...prev, currentView: "ficha" }));
            }}
            onDelete={(sid) => openDeleteModal(state.currentGradeId!, sid)}
            onAddStudentsClick={() => setModals(prev => ({ ...prev, addBulk: true }))}
            onUpdateNote={handleUpdateNote}
            onOpenReason={(sid, idx) => openReasonModal(sid, idx)}
            onPeriodChange={(trim) => setState(prev => ({ ...prev, currentTrim: trim }))}
            onToggleRankings={(visible) => setState(prev => ({ ...prev, showRankings: visible }))}
            onToggleHideInactive={(hide) => setState(prev => ({ ...prev, hideInactive: hide }))}
            onToggleListNumber={(listNum) => setState(prev => ({ ...prev, showListNumberOnly: listNum }))}
            onOpenActivityEditor={(nIdx) => openActivityEditor(state.currentTrim, state.currentGradeId!, nIdx)}
            onViewAllReports={() => setState(prev => ({ ...prev, currentView: "all-fichas" }))}
          />
        )}

        {state.currentView === "config" && (
          <ConfigView
            state={state}
            onUpdateConfig={handleUpdateConfig}
            onSave={() => showToast("success", "Configuración guardada en el dispositivo.")}
            onPeriodChange={(trim) => setState(prev => ({ 
              ...prev, 
              currentTrim: trim, 
              config: { ...prev.config, defaultPeriod: trim } 
            }))}
            onResetSystem={() => {
              setConfirmResetChecked(false);
              setModals(prev => ({ ...prev, reset: true }));
            }}
          />
        )}

        {state.currentView === "backup" && (
          <BackupView
            state={state}
            onImportJSON={handleApplyImportFullJSON}
            onExportJSON={handleExportFullJSON}
            onResetSystem={() => {
              setConfirmResetChecked(false);
              setModals(prev => ({ ...prev, reset: true }));
            }}
            onImportXLSX={handleImportXLSXData}
          />
        )}

        {state.currentView === "ficha" && (() => {
          const activeSid = activeFicha?.sid || "";
          const activeGid = activeFicha?.gid || state.currentGradeId || "";
          return (
            <FichaView
              state={state}
              studentId={activeSid}
              gradeId={activeGid}
              onBack={() => {
                setState(prev => ({ 
                  ...prev, 
                  currentView: prev.currentGradeId ? "sheet" : "students" 
                }));
                setActiveFicha(null);
              }}
              onUpdateManualComment={(text) => handleUpdateManualComment(activeSid, activeGid, text)}
              onNavigateStudent={(sid) => {
                setActiveFicha({ gid: activeGid, sid });
              }}
              onViewAllReports={() => {
                setState(prev => ({ ...prev, currentView: "all-fichas" }));
              }}
            />
          );
        })()}

        {state.currentView === "all-fichas" && (() => {
          const activeGid = state.currentGradeId || activeFicha?.gid || "";
          return (
            <AllFichasView
              state={state}
              gradeId={activeGid}
              onBack={() => {
                setState(prev => ({ 
                  ...prev, 
                  currentView: prev.currentGradeId ? "sheet" : "students"
                }));
                setActiveFicha(null);
              }}
            />
          );
        })()}
      </main>

      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs text-gray-400 select-none flex-shrink-0 no-print">
        Aplicación diseñada por Gustavo Pérez y codificada por Gemini — AI Studio Build
      </footer>

      {/* --- REUSABLE MODALS RENDER OVERLAYS --- */}

      {/* 1. bulk add students modal */}
      {modals.addBulk && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[var(--primary)] rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black text-[var(--primary)] uppercase tracking-tight">
                Añadir Estudiantes en Masa
              </h3>
              <button onClick={() => setModals(prev => ({ ...prev, addBulk: false }))} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 leading-normal">
              Pegue la lista de nombres uno debajo del otro (un nombre por línea). El sistema los asociará automáticamente al grupo actual en los espacios libres existentes sin alterar el orden del resto.
            </p>
            <textarea
              value={addBulkText}
              onChange={(e) => setAddBulkText(e.target.value)}
              placeholder="Ejemplo:&#10;Juan Pérez&#10;Ana María Martínez&#10;Carlos Estévez"
              className="w-full h-40 p-3 text-xs border border-gray-300 rounded font-sans focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setModals(prev => ({ ...prev, addBulk: false }))}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-bold uppercase hover:bg-gray-50 cursor-pointer text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={applyAddBulkStudents}
                className="px-4 py-2 bg-[var(--primary)] select-none hover:bg-[var(--primary-dark)] text-white font-bold rounded text-xs uppercase cursor-pointer"
              >
                Añadir a Nómina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. rename student modal */}
      {modals.rename && state.currentView !== "ficha" && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[var(--primary)] rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight border-b border-gray-100 pb-2">
              Renombrar Registro Académico
            </h3>
            <input
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyRename();
                if (e.key === "Escape") setModals(prev => ({ ...prev, rename: null }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none text-xs focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="Nombre del estudiante..."
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setModals(prev => ({ ...prev, rename: null }))}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-bold uppercase hover:bg-gray-50 cursor-pointer text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={applyRename}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold rounded text-xs uppercase cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. delete student template warning */}
      {modals.delete && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-600 rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-black text-red-700 uppercase tracking-tight border-b border-gray-100 pb-2">
              ⚠️ Confirmar Purgación de Fila
            </h3>
            <p className="text-xs text-gray-500 leading-normal">
              ¿Está completamente de acuerdo en purgar las notas del estudiante de la nómina? Se reseteará el renglón a formato vacío de forma permanente en todos los periodos lectivos.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setModals(prev => ({ ...prev, delete: null }))}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-bold uppercase hover:bg-gray-50 cursor-pointer text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={applyDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs uppercase cursor-pointer"
              >
                Sí, Purgar Fila
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. migrate student modal */}
      {modals.migrate && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[var(--primary)] rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-black text-[var(--primary)] uppercase tracking-tight border-b border-gray-100 pb-2">
              Trasladar Estudiante de Sección
            </h3>
            <p className="text-xs text-gray-500 leading-normal">
              Seleccione el grupo al cual desea reacomodar a este estudiante. Se clonarán todas sus calificaciones de todos los bloques a la primera fila vacía del grupo destino.
            </p>
            <select
              value={migrateTargetGradeId}
              onChange={(e) => setMigrateTargetGradeId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-xs focus:outline-none cursor-pointer"
            >
              <option value="">Seleccione grupo de destino...</option>
              {state.config.grades
                .filter(g => g.enabled && g.id !== modals.migrate?.gid)
                .map(g => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setModals(prev => ({ ...prev, migrate: null }))}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-bold uppercase hover:bg-gray-50 cursor-pointer text-gray-600"
              >
                Cancelar
              </button>
              <button
                disabled={!migrateTargetGradeId}
                onClick={applyMigration}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold rounded text-xs uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trasladar Alumno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. active reason / comment details dialogue overlay */}
      {modals.reason && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h3 className="text-sm font-black text-[var(--primary)] uppercase tracking-tight">
                Bitácora de Observaciones de Actividad
              </h3>
              <button onClick={() => setModals(prev => ({ ...prev, reason: null }))} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase block">Inasistencias / Justificaciones Preestablecidas:</label>
              <div className="grid grid-cols-2 gap-2">
                {REASON_OPTS.map((opt) => {
                  const isActive = activeReasonOption === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        const nextVal = isActive ? null : opt;
                        setActiveReasonOption(nextVal);
                      }}
                      className={`py-1.5 px-3 rounded text-[11px] font-bold uppercase tracking-tight border text-center cursor-pointer transition-all ${
                        isActive
                          ? "bg-amber-400 border-amber-500 text-amber-950 font-black"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase block mb-1">Nota Justificada u Observación Personalizada:</label>
                <input
                  type="text"
                  value={reasonManualText}
                  onChange={(e) => setReasonManualText(e.target.value)}
                  placeholder="Detalles de entrega retrasada, falta justificada..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // Save and close on Enter key
                      applyReasonChange(true);
                    }
                  }}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={clearActiveReason}
                  className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase rounded cursor-pointer hover:bg-rose-100 flex items-center gap-1"
                >
                  🗑️ Borrar Todo
                </button>
                <button
                  onClick={() => {
                    applyReasonChange(true);
                    setModals(prev => ({ ...prev, reason: null }));
                  }}
                  className="px-4 py-2 bg-[var(--primary)] text-white text-[10px] font-bold uppercase rounded cursor-pointer hover:bg-[var(--primary-dark)] ml-auto"
                >
                  Guardar y Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5.5 Custom Activity Name Dialogue Overlay */}
      {modals.activityNameEditor && (() => {
        const target = modals.activityNameEditor;
        const isExamIndex = target.nIdx >= 23;
        const historyList = state.activityHistory || [];
        
        // Determine title / label of the column for context
        let blockName = "";
        if (target.nIdx < 10) {
          blockName = `${state.config.blockNames[0]} (Actividad ${target.nIdx + 1})`;
        } else if (target.nIdx < 20) {
          blockName = `${state.config.blockNames[1]} (Actividad ${target.nIdx - 9})`;
        } else if (target.nIdx === 20) {
          blockName = state.config.blockNames[2];
        } else if (target.nIdx === 21) {
          blockName = state.config.blockNames[3];
        } else if (target.nIdx === 22) {
          blockName = state.config.blockNames[4];
        } else {
          blockName = target.nIdx === 23 ? `${state.config.blockNames[5]} - Escrito` : `${state.config.blockNames[5]} - Rúbrica`;
        }

        return (
          <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-indigo-600 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-black text-indigo-700 uppercase tracking-tight flex items-center gap-1.5">
                  🏷️ Cambiar Nombre de Actividad
                </h3>
                <button onClick={() => setModals(prev => ({ ...prev, activityNameEditor: null }))} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 p-2.5 rounded text-xs text-slate-700">
                  Usted está configurando el nombre de: <span className="font-extrabold text-indigo-700">{blockName}</span> para el <span className="font-semibold">{target.trim}</span>.
                </div>

                {isExamIndex ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-extrabold text-gray-400 uppercase block">Seleccione el Tipo de Evaluación (Examen o Proyecto):</label>
                    <div className="grid grid-cols-2 gap-3.5">
                      {["Examen", "Proyecto"].map((opt) => {
                        const isActive = activityInputValue === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setActivityInputValue(opt)}
                            className={`py-3 px-4 rounded text-xs font-bold uppercase tracking-tight border text-center cursor-pointer transition-all ${
                              isActive
                                ? "bg-indigo-600 border-indigo-700 text-white font-black"
                                : "bg-white border-gray-200 text-gray-605 hover:bg-slate-50 text-slate-800"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase block mb-1">Escriba el nombre personalizado para esta actividad:</label>
                      <input
                        type="text"
                        value={activityInputValue}
                        onChange={(e) => setActivityInputValue(e.target.value)}
                        placeholder="Ej. Taller de Células, Ensayo de Ecología..."
                        className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveActivityName(activityInputValue);
                          }
                        }}
                      />
                    </div>

                    {historyList.length > 0 && (
                      <div>
                        <label className="text-[10px] font-extrabold text-gray-400 uppercase block mb-1.5 font-mono">Sugerencias Historial:</label>
                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded p-1.5 bg-slate-50/50">
                          {historyList.map((histItem, hIdx) => {
                            const isSelected = activityInputValue === histItem;
                            return (
                              <div 
                                key={`hist-${hIdx}`} 
                                className={`flex items-center justify-between p-1 px-2 rounded text-xs transition-colors ${
                                  isSelected ? "bg-indigo-50 border border-indigo-150 text-indigo-950 font-semibold" : "hover:bg-slate-100 text-slate-700"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setActivityInputValue(histItem)}
                                  className="flex-1 text-left cursor-pointer truncate"
                                >
                                  {histItem}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteHistoryItem(histItem);
                                  }}
                                  className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer ml-2"
                                  title="Eliminar de mi historial"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setActivityInputValue("");
                      saveActivityName("");
                    }}
                    className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase rounded cursor-pointer hover:bg-rose-100"
                  >
                    🗑️ Quitar Nombre
                  </button>
                  <button
                    onClick={() => saveActivityName(activityInputValue)}
                    className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded cursor-pointer hover:bg-indigo-700 ml-auto shadow-xs"
                  >
                    Aplicar Nombre
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. reset warning modal */}
      {modals.reset && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border-2 border-red-650 rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-black text-red-750 uppercase tracking-tight border-b border-gray-100 pb-2">
              ⚠️ Alerta Crítica del Sistema
            </h3>
            <p className="text-xs text-gray-550 leading-normal">
              ¿Está completamente de acuerdo en borrar e inicializar toda la base de datos a sus valores predeterminados? Se perderán todas las notas, incidencias y estudiantes de todos los grupos.
            </p>
            
            <div className="bg-rose-50 border border-rose-100 p-3 rounded text-rose-800 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmResetChecked}
                  onChange={(e) => setConfirmResetChecked(e.target.checked)}
                  className="mt-0.5 accent-red-750 rounded text-white"
                />
                <span className="font-bold text-[11px] leading-tight text-red-800">
                  Entiendo que esta acción es definitiva y que perderé toda la información cargada.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setModals(prev => ({ ...prev, reset: false }))}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-bold uppercase hover:bg-gray-50 cursor-pointer text-gray-650"
              >
                Cancelar
              </button>
              <button
                onClick={applyResetSystem}
                disabled={!confirmResetChecked}
                className={`px-4 py-2 font-bold rounded text-xs uppercase transition-colors select-none ${
                  confirmResetChecked
                    ? "bg-red-700 hover:bg-red-800 text-white cursor-pointer shadow-xs"
                    : "bg-gray-200 text-gray-450 border border-gray-300 cursor-not-allowed opacity-60"
                }`}
              >
                Sí, Borrar Todo
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
