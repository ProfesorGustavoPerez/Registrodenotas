import { useState, ChangeEvent } from "react";
import { AppState } from "../types";
import { calculateFinal, getAvg } from "../utils";
import * as XLSX from "xlsx";
import { 
  Database, FileSpreadsheet, Download, Upload, Trash2, AlertTriangle 
} from "lucide-react";

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
  const [localError, setLocalError] = useState<string | null>(null);

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

    setLocalError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
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
          setLocalError("Estructura de Excel inválida. No se localizó la columna del encabezado 'Estudiante'.");
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
      } catch (err) {
        setLocalError("Error al procesar el archivo Excel. Asegúrese de que tenga el formato de plantilla correcto.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Full identity JSON backups
  const handleJSONUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = evt.target?.result as string;
        const parsed = JSON.parse(raw);
        if (parsed.config && parsed.data) {
          onImportJSON(parsed);
        } else {
          setLocalError("El archivo no es un respaldo de calificaciones válido.");
        }
      } catch (err) {
        setLocalError("Ocurrió un error al procesar el archivo de respaldo.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Alert banner for local errors */}
      {localError && (
        <div className="bg-rose-50 border border-rose-250 text-rose-800 text-xs font-bold p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{localError}</span>
        </div>
      )}

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
    </div>
  );
}
