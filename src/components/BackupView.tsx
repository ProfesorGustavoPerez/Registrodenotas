import { useState, useEffect, ChangeEvent } from "react";
import { AppState, Student } from "../types";
import { calculateFinal, getAvg } from "../utils";
import * as XLSX from "xlsx";
import { 
  Database, FileSpreadsheet, Download, Upload, Trash2, HelpCircle,
  Cloud, RefreshCw, LogIn, LogOut, CheckCircle2, AlertTriangle, Loader2 
} from "lucide-react";
import { User } from "firebase/auth";
import { 
  initAuth, googleSignIn, googleSignOut, getAccessToken,
  listDriveBackups, uploadDriveBackup, downloadDriveBackup, deleteDriveBackup, DriveBackupFile 
} from "../drive";

interface BackupViewProps {
  state: AppState;
  onImportJSON: (importedState: any) => void;
  onExportJSON: () => void;
  onResetSystem: () => void;
  onImportXLSX: (gradeId: string, periodId: string, parsedStudents: { name: string; notes: (number | null)[] }[]) => void;
}

export default function BackupView({
  state,
  onImportJSON,
  onExportJSON,
  onResetSystem,
  onImportXLSX,
}: BackupViewProps) {
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  // Cloud backup states
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cloudSuccessMessage, setCloudSuccessMessage] = useState<string | null>(null);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    type: "restore" | "delete" | null;
    backup: DriveBackupFile | null;
  }>({ type: null, backup: null });

  const enabledGrades = state.config.grades.filter(g => g.enabled);

  // Auto-initialize selected values if empty
  if (enabledGrades.length > 0 && !selectedGradeId) {
    setSelectedGradeId(enabledGrades[0].id);
  }
  const currentGrade = state.config.grades.find(x => x.id === selectedGradeId);
  const periodCount = currentGrade
    ? currentGrade.useGlobalPeriods
      ? state.config.periodCount
      : currentGrade.periodCount
    : state.config.periodCount;

  if (periodCount > 0 && !selectedPeriodId) {
    setSelectedPeriodId("T1");
  }

  // Fetch backups from Google Drive
  const fetchBackups = async (accessToken: string) => {
    setIsLoadingBackups(true);
    setActionError(null);
    try {
      const files = await listDriveBackups(accessToken);
      setBackups(files);
    } catch (err: any) {
      console.error(err);
      setActionError("No se pudieron cargar los respaldos de Google Drive. Intente iniciar sesión nuevamente.");
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Listen to Google Auth session State
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setAuthChecking(false);
        fetchBackups(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Handle Google OAuth Sign In
  const handleSignIn = async () => {
    setActionError(null);
    setCloudSuccessMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await fetchBackups(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setActionError("Error al iniciar sesión con Google. Permita las ventanas emergentes si se solicita.");
    }
  };

  // Handle Google Sign Out
  const handleSignOut = async () => {
    setActionError(null);
    setCloudSuccessMessage(null);
    try {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setBackups([]);
    } catch (err) {
      console.error(err);
    }
  };

  // Upload Current System State to Drive
  const handleUploadToDrive = async () => {
    const activeToken = token || getAccessToken();
    if (!activeToken) {
      setActionError("La sesión de Google Drive no está disponible. Inicie sesión de nuevo.");
      return;
    }
    setIsUploading(true);
    setActionError(null);
    setCloudSuccessMessage(null);

    try {
      const cleanSchool = state.config.school.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
      const cleanTeacher = state.config.teacher.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
      const todayStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5).replace(":", "h");
      
      const filename = `Registro_Backup_${cleanSchool}_${cleanTeacher}_${todayStr}_${timeStr}.json`;

      await uploadDriveBackup(activeToken, filename, state);
      setCloudSuccessMessage("✓ ¡Respaldo guardado exitosamente en su Google Drive!");
      await fetchBackups(activeToken);
      
      setTimeout(() => setCloudSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      setActionError(`Error al subir respaldo: ${err.message || "Intente nuevamente."}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Download and Restore State (overwrites local storage)
  const handleRestoreFromDrive = (backup: DriveBackupFile) => {
    const activeToken = token || getAccessToken();
    if (!activeToken) {
      setActionError("La sesión de Google Drive no está disponible. Inicie sesión de nuevo.");
      return;
    }
    setConfirmModal({ type: "restore", backup });
  };

  const executeRestoreFromDrive = async (backup: DriveBackupFile) => {
    const activeToken = token || getAccessToken();
    if (!activeToken) return;

    setLoadingFileId(backup.id);
    setActionError(null);
    setCloudSuccessMessage(null);

    try {
      const restoredState = await downloadDriveBackup(activeToken, backup.id);
      if (restoredState && restoredState.config && restoredState.data) {
        onImportJSON(restoredState);
        setCloudSuccessMessage(`✓ Respaldo "${backup.name}" restaurado e instalado correctamente.`);
        setTimeout(() => setCloudSuccessMessage(null), 5000);
      } else {
        setActionError("El archivo descargado no cuenta con el formato de respaldo válido.");
      }
    } catch (err: any) {
      console.error(err);
      setActionError(`Error al descargar o aplicar el respaldo: ${err.message || "Intente de nuevo."}`);
    } finally {
      setLoadingFileId(null);
    }
  };

  // Delete Backup File from Drive
  const handleDeleteFromDrive = (backup: DriveBackupFile) => {
    const activeToken = token || getAccessToken();
    if (!activeToken) {
      setActionError("La sesión de Google Drive no está disponible. Inicie sesión de nuevo.");
      return;
    }
    setConfirmModal({ type: "delete", backup });
  };

  const executeDeleteFromDrive = async (backup: DriveBackupFile) => {
    const activeToken = token || getAccessToken();
    if (!activeToken) return;

    setDeletingFileId(backup.id);
    setActionError(null);
    setCloudSuccessMessage(null);

    try {
      await deleteDriveBackup(activeToken, backup.id);
      setCloudSuccessMessage("✓ Respaldo eliminado de la nube correctamente.");
      await fetchBackups(activeToken);
      setTimeout(() => setCloudSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      setActionError(`Error al borrar de Drive: ${err.message || "Intente de nuevo."}`);
    } finally {
      setDeletingFileId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString()} a las ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return dateStr;
    }
  };

  // Export group/grade notes to Excel
  const exportToExcel = () => {
    if (!selectedGradeId || !selectedPeriodId) return;
    const g = state.config.grades.find(x => x.id === selectedGradeId)!;
    const b = state.config.blockNames;
    const isAnual = selectedPeriodId === "ANUAL";

    const labelPeriodInternal = isAnual ? "Anual" : selectedPeriodId.replace("T", "L");
    const labelPeriodDisplay = isAnual ? "RESUMEN ANUAL" : `PERIODO ${selectedPeriodId.replace("T", "")}`;

    const cleanExcelString = (str: string): string => {
      if (!str) return "";
      return str.replace(/[“”"«»‘’']/g, "").trim();
    };

    // Institution meta headers
    const metaRows = [
      ["COLEGIO:", cleanExcelString(state.config.school)],
      ["DOCENTE:", cleanExcelString(state.config.teacher)],
      ["GRADO:", cleanExcelString(g.label)],
      ["MATERIA:", cleanExcelString(g.useGlobalSubject ? state.config.subject : g.subject)],
      ["TIEMPO:", cleanExcelString(labelPeriodDisplay)],
      [] // separator row
    ];

    let headers: string[] = [];
    let rows: any[][] = [];

    const baseList = state.data["T1"]?.[selectedGradeId] || [];
    const activeList = baseList.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));

    if (isAnual) {
      headers = [cleanExcelString("Estudiante")];
      for (let i = 1; i <= periodCount; i++) headers.push(`L${i}`);
      headers.push(cleanExcelString("PROMEDIO ANUAL"));

      rows = activeList.map(s => {
        const studentRow = [cleanExcelString(s.name)];
        let sum = 0;
        for (let i = 1; i <= periodCount; i++) {
          const ps = state.data[`T${i}`]?.[selectedGradeId]?.find(x => x.id === s.id);
          const f = ps ? calculateFinal(ps.notes, state.config) : 0;
          sum += f;
          studentRow.push(f.toFixed(1));
        }
        studentRow.push((sum / periodCount).toFixed(1));
        return studentRow;
      });
    } else {
      const bClean = b.map(cleanExcelString);
      headers = [cleanExcelString("Estudiante")];
      for (let i = 1; i <= 10; i++) headers.push(`${bClean[0]} ${i}`);
      headers.push(`Promedio ${bClean[0]}`);
      for (let i = 1; i <= 10; i++) headers.push(`${bClean[1]} ${i}`);
      headers.push(
        `Promedio ${bClean[1]}`, 
        bClean[2], 
        bClean[3], 
        bClean[4], 
        `${bClean[5]} (Examen)`, 
        `${bClean[5]} (Rúbrica)`, 
        `Promedio Exámenes`, 
        "PROMEDIO FINAL"
      );

      const pList = state.data[selectedPeriodId]?.[selectedGradeId] || [];
      const pActiveList = pList.filter(s => !s.isDisabled && !s.name.includes("Estudiante"));

      rows = pActiveList.map(s => {
        const studentRow: (string | number | null)[] = [cleanExcelString(s.name)];
        
        // Cotidianas 0-9
        for (let i = 0; i < 10; i++) studentRow.push(s.notes[i]);
        studentRow.push(getAvg(s.notes.slice(0, 10)).toFixed(1));

        // Santillana 10-19
        for (let i = 10; i < 20; i++) studentRow.push(s.notes[i]);
        studentRow.push(getAvg(s.notes.slice(10, 20)).toFixed(1));

        // Integradora, Proyecto, Holistica
        studentRow.push(s.notes[20], s.notes[21], s.notes[22]);

        // Exámenes
        studentRow.push(s.notes[23], s.notes[24]);
        studentRow.push((((s.notes[23] ?? 0) * 0.85) + ((s.notes[24] ?? 0) * 0.15)).toFixed(1));

        // Final weighted
        studentRow.push(calculateFinal(s.notes, state.config));
        
        return studentRow;
      });
    }

    const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...rows]);
    const wb = XLSX.utils.book_new();
    
    // Auto fit column widths
    ws["!cols"] = [{ wch: 30 }, ...Array(30).fill({ wch: 10 })];
    XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
    
    // Write out workbook
    const fileLabelClean = cleanExcelString(g.label).replace(/\s+/g, "_");
    const filePeriodClean = cleanExcelString(labelPeriodInternal);
    XLSX.writeFile(wb, `Registro_${fileLabelClean}_${filePeriodClean}.xlsx`);
  };

  // Upload Excel list into state
  const handleExcelUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGradeId || !selectedPeriodId) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      
      // Look for the "Estudiante" cell index
      let studentHeaderRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const firstCell = rows[i][0];
        if (firstCell && firstCell.toString().trim().toLowerCase() === "estudiante") {
          studentHeaderRowIndex = i;
          break;
        }
      }

      if (studentHeaderRowIndex === -1) {
        setActionError("Estructura de Excel inválida. No se localizó la columna del encabezado 'Estudiante'.");
        return;
      }

      const parsedStudents: { name: string; notes: (number | null)[] }[] = [];

      for (let i = studentHeaderRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const studentName = row[0]?.toString().trim();
        if (!studentName) continue;

        const parseNote = (val: any) => {
          if (val === undefined || val === null || val === "") return null;
          const num = parseFloat(val.toString().replace(",", "."));
          return isNaN(num) ? null : num;
        };

        const notes: (number | null)[] = Array(25).fill(null);

        if (selectedPeriodId !== "ANUAL") {
          // Normal period
          // Cotidianas: cells indices 1 to 10 mapped to notes 0 to 9
          for (let n = 0; n < 10; n++) notes[n] = parseNote(row[n + 1]);
          
          // Santillana: cells indices 12 to 21 mapped to notes 10 to 19 (skip element index 11 which is average)
          for (let n = 0; n < 10; n++) notes[n + 10] = parseNote(row[n + 13]); // column average is index 12

          // Integradora, Proyecto, Holistica indexes 23, 24, 25 in Excel
          notes[20] = parseNote(row[24]); // Excel Col index 24 (following Avg Santillana at 23)
          notes[21] = parseNote(row[25]);
          notes[22] = parseNote(row[26]);

          // Exámenes: indices 26 and 27 mapped to notes 23 and 24
          notes[23] = parseNote(row[27]);
          notes[24] = parseNote(row[28]);
        }

        parsedStudents.push({
          name: studentName,
          notes
        });
      }

      onImportXLSX(selectedGradeId, selectedPeriodId, parsedStudents);
      e.target.value = ""; // Clear file input
    };
    reader.readAsArrayBuffer(file);
  };

  // Full identity JSON backups
  const handleJSONUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = evt.target?.result as string;
        const parsed = JSON.parse(raw);
        if (parsed.config && parsed.data) {
          onImportJSON(parsed);
        } else {
          setActionError("El archivo no es un respaldo de calificaciones válido.");
        }
      } catch (err) {
        setActionError("Ocurrió un error al procesar el archivo de respaldo.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Sincronización con Google Drive (Nube) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-indigo-600 animate-pulse" />
            <h3 className="text-base font-bold text-indigo-600 uppercase tracking-wider">
              Sincronización de Calificaciones en la Nube (Google Drive)
            </h3>
          </div>
          <div>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded font-black uppercase tracking-wider">
              Google Drive Cloud
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Guarde todo su progreso académico, configuraciones e informes en la carpeta dedicada <span className="font-bold text-indigo-700">"Registro de Notas"</span> de su cuenta personal de Google Drive. Esto le permitirá recuperar sus datos, sincronizar entre múltiples dispositivos (móvil, tablet u otra computadora) y mantener su información siempre respaldada. <span className="font-bold text-indigo-700">La aplicación crea automáticamente la carpeta si no existe y realiza una copia de seguridad automática cada 24 horas.</span>
        </p>

        {authChecking ? (
          <div className="flex items-center gap-2 py-4 text-xs text-gray-500 font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            Verificando sesión con Google...
          </div>
        ) : !user ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Sin conexión activa con la Nube</h4>
              <p className="text-[11px] text-gray-500">Conecte su correo Gmail para listar y guardar sus respaldos históricos en línea.</p>
            </div>
            
            <button
              onClick={handleSignIn}
              className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100/80 text-slate-700 text-xs font-bold transition-all shadow-xs hover:shadow-sm cursor-pointer select-none shrink-0"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 flex-shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>Conectar mi Nube (Gmail)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-indigo-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {user.email?.[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Conectado como {user.displayName}</span>
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />
                  </div>
                  <div className="text-[10px] text-gray-500">{user.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleUploadToDrive}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-300 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5" />
                  )}
                  {isUploading ? "Guardando..." : "Subir Copia a Drive"}
                </button>

                <button
                  onClick={() => token && fetchBackups(token)}
                  disabled={isLoadingBackups}
                  title="Actualizar lista de Drive"
                  className="flex items-center justify-center p-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? "animate-spin text-indigo-600" : ""}`} />
                </button>

                <button
                  onClick={handleSignOut}
                  title="Cerrar sesión"
                  className="flex items-center justify-center p-2 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Success and error cloud alerts */}
            {cloudSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {cloudSuccessMessage}
              </div>
            )}

            {actionError && (
              <div className="bg-red-50 border border-red-200 p-3 rounded text-red-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                {actionError}
              </div>
            )}

            {/* List back-ups in Google Drive container */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                  Copias de Seguridad Disponibles en tu Nube
                </h4>
              </div>

              {isLoadingBackups ? (
                <div className="p-8 text-center text-xs text-gray-500 font-bold flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  Buscando archivos de respaldo filtrados en tu Google Drive...
                </div>
              ) : backups.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 leading-normal">
                  <Cloud className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No se encontraron respaldos de este formato en su Google Drive.<br />
                  Haga clic en <span className="font-bold text-indigo-600">"Subir Copia a Drive"</span> para registrar su primera copia.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {backups.map((fc) => (
                    <div key={fc.id} className="p-3 px-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate" title={fc.name}>
                          {fc.name}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Guardado el: {formatDate(fc.modifiedTime || fc.createdTime)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRestoreFromDrive(fc)}
                          disabled={loadingFileId !== null || deletingFileId !== null}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-bold rounded text-[10px] uppercase cursor-pointer transition-colors flex items-center gap-1"
                        >
                          {loadingFileId === fc.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          Restaurar
                        </button>

                        <button
                          onClick={() => handleDeleteFromDrive(fc)}
                          disabled={loadingFileId !== null || deletingFileId !== null}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors cursor-pointer"
                          title="Eliminar de Drive"
                        >
                          {deletingFileId === fc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Respaldo global JSON */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b-2 border-[var(--primary)] pb-3 mb-4">
          <Database className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="text-base font-bold text-[var(--primary)] uppercase tracking-wider">
            Respaldo Completo Integral del Sistema (.JSON)
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          Guarde, transfiera o restaure toda la base de datos de calificaciones, configuraciones e informes del docente en un único archivo seguro offline .json.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onExportJSON}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Base Completa
          </button>

          <label className="flex items-center gap-1.5 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Importar Base Completa
            <input
              type="file"
              accept=".json"
              onChange={handleJSONUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={onResetSystem}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            Borrar Datos
          </button>
        </div>
      </div>

      {/* Gestión de hojas de Excel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-3 border-b-2 border-[var(--primary)] pb-3">
          <FileSpreadsheet className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="text-base font-bold text-[var(--primary)] uppercase tracking-wider">
            Gestión de Grados y Periodos (Hojas de Excel .xlsx)
          </h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Permite exportar plantillas de notas completamente formuladas para cargarlas sin conexión, o importar calificaciones directamente desde hojas de Excel previamente llenadas.
        </p>

        {enabledGrades.length === 0 ? (
          <div className="bg-amber-50 p-4 rounded text-amber-800 text-xs border border-amber-200">
            No hay grupos habilitados. Por favor habilítelos en configuración para poder exportarlos.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Seleccione el Grado</label>
              <select
                value={selectedGradeId}
                onChange={(e) => {
                  setSelectedGradeId(e.target.value);
                  setSelectedPeriodId("T1"); // reset trim on change
                }}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm cursor-pointer focus:outline-none"
              >
                {enabledGrades.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Seleccione el Periodo</label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm cursor-pointer focus:outline-none"
              >
                {Array.from({ length: periodCount }, (_, i) => (
                  <option key={i} value={`T${i + 1}`}>
                    Periodo {i + 1}
                  </option>
                ))}
                <option value="ANUAL">Resumen Anual</option>
              </select>
            </div>
          </div>
        )}

        {enabledGrades.length > 0 && (
          <div className="flex gap-3 pt-4 border-t border-gray-100 flex-wrap">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar Excel (.xlsx)
            </button>

            {selectedPeriodId !== "ANUAL" && (
              <label className="flex items-center gap-1.5 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded text-xs uppercase cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                Cargar Notas de Excel (.xlsx)
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>

      {confirmModal.type && confirmModal.backup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white border-2 border-slate-300 rounded-lg shadow-xl max-w-md w-full overflow-hidden transform transition-all scale-100 p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-full ${confirmModal.type === 'restore' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'} shrink-0`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wide">
                  {confirmModal.type === "restore" ? "Confirmar Restauración de Datos" : "Confirmar Eliminación"}
                </h3>
                <div className="text-xs text-slate-600 leading-relaxed">
                  {confirmModal.type === "restore" ? (
                    <div>
                      ¿Desea <span className="font-bold text-amber-800">RESTAURAR</span> el respaldo <span className="font-bold text-slate-800">"{confirmModal.backup.name}"</span>?
                      <br /><br />
                      <span className="font-bold text-rose-650">⚠️ ADVERTENCIA:</span> Esta acción <span className="font-bold">SOBREESCRIBIRÁ por completo</span> todos los datos de calificaciones actuales con el contenido descargado de la nube.
                      <br /><br />
                      <span className="font-bold text-slate-700">Firma actual del respaldo:</span>
                      <div className="mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[11px] font-mono leading-normal text-slate-550">
                        <div>Colegio: {state.config.school}</div>
                        <div>Docente: {state.config.teacher}</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      ¿Desea <span className="font-bold text-rose-700">ELIMINAR</span> el archivo <span className="font-bold text-slate-800">"{confirmModal.backup.name}"</span> de su Google Drive de forma permanente? Esta acción no se puede deshacer.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setConfirmModal({ type: null, backup: null })}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] uppercase cursor-pointer transition-colors"
                id="btn-confirm-cancel"
              >
                No, Cancelar
              </button>
              <button
                onClick={() => {
                  const activeBackup = confirmModal.backup;
                  const activeType = confirmModal.type;
                  setConfirmModal({ type: null, backup: null });
                  if (activeBackup && activeType === "restore") {
                    executeRestoreFromDrive(activeBackup);
                  } else if (activeBackup && activeType === "delete") {
                    executeDeleteFromDrive(activeBackup);
                  }
                }}
                className={`px-4 py-2 text-white font-bold rounded text-[11px] uppercase cursor-pointer transition-colors ${confirmModal.type === 'restore' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                id="btn-confirm-action"
              >
                Sí, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

