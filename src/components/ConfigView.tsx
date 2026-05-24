import { AppState, Config, Grade } from "../types";
import { Sliders, Settings, School, Users, GraduationCap, CheckCircle2 } from "lucide-react";

interface ConfigViewProps {
  state: AppState;
  onUpdateConfig: (newConfig: Config) => void;
  onSave: () => void;
  onPeriodChange: (trim: string) => void;
}

export default function ConfigView({ state, onUpdateConfig, onSave, onPeriodChange }: ConfigViewProps) {
  const config = state.config;

  const handleFieldChange = (key: keyof Config, value: any) => {
    const updated = { ...config, [key]: value };
    onUpdateConfig(updated);
  };

  const handleGradeChange = (index: number, key: keyof Grade, value: any) => {
    const gradesCopy = [...config.grades];
    gradesCopy[index] = { ...gradesCopy[index], [key]: value };
    handleFieldChange("grades", gradesCopy);
  };

  // Block names & weights update
  const handleBlockChange = (index: number, name: string, weight: number) => {
    const namesCopy = [...config.blockNames];
    const weightsCopy = [...config.blockWeights];
    namesCopy[index] = name;
    weightsCopy[index] = weight;
    
    const updated = {
      ...config,
      blockNames: namesCopy,
      blockWeights: weightsCopy
    };
    onUpdateConfig(updated);
  };

  const weightSum = config.blockWeights.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Tarjeta Identidad Docente */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b-2 border-[var(--primary)] pb-3 mb-5">
          <School className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="text-base font-bold text-[var(--primary)] uppercase tracking-wider">
            Identidad Institucional y Docente
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre de la Institución / Colegio</label>
            <input
              type="text"
              value={config.school}
              onChange={(e) => handleFieldChange("school", e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre del Docente</label>
            <input
              type="text"
              value={config.teacher}
              onChange={(e) => handleFieldChange("teacher", e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Materia General</label>
            <input
              type="text"
              value={config.subject}
              onChange={(e) => handleFieldChange("subject", e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Modelo de Ciclo Académico</label>
            <select
              value={config.periodCount}
              onChange={(e) => handleFieldChange("periodCount", parseInt(e.target.value))}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
            >
              <option value="3">Básica (3 Periodos)</option>
              <option value="4">Bachillerato (4 Periodos)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Periodo de Trabajo Activo</label>
            <select
              value={state.currentTrim}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="px-3 py-2 bg-gray-50 border-2 border-[var(--primary)] text-[var(--primary)] rounded-md font-bold focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {Array.from({ length: config.periodCount }, (_, i) => (
                <option key={i} value={`T${i + 1}`}>
                  Periodo {i + 1}
                </option>
              ))}
              <option value="ANUAL">Resumen Anual</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloque: Porcentajes de Ponderación */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b-2 border-[var(--primary)] pb-3 mb-2">
              <Sliders className="w-5 h-5 text-[var(--primary)]" />
              <h3 className="text-base font-bold text-[var(--primary)] uppercase tracking-wider">
                Porcentajes por Bloque Evaluativo
              </h3>
            </div>
            
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {config.blockNames.map((n, i) => (
                <div key={i} className="flex gap-4 bg-gray-50 p-3 rounded border border-gray-200 items-end">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Bloque {i + 1}</label>
                    <input
                      type="text"
                      value={n}
                      onChange={(e) => handleBlockChange(i, e.target.value, config.blockWeights[i])}
                      className="px-2 py-1 text-xs border border-gray-200 bg-white rounded font-medium focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div className="w-20 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase text-center">% Peso</label>
                    <input
                      type="number"
                      value={config.blockWeights[i]}
                      onChange={(e) => handleBlockChange(i, n, parseFloat(e.target.value) || 0)}
                      className="px-2 py-1 text-xs border border-gray-200 bg-white rounded font-bold text-center focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs uppercase font-extrabold text-gray-500">Suma Total Ponderación:</span>
            <span className={`text-xl font-black ${
              weightSum === 100 ? "text-emerald-700 bg-emerald-50 px-3 py-1 rounded" : "text-rose-700 bg-rose-50 px-3 py-1 rounded"
            }`}>
              {weightSum}% {weightSum === 100 && "✓"}
            </span>
          </div>
        </div>

        {/* Bloque: Configuración de Grados de Enseñanza */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 border-b-2 border-[var(--primary)] pb-3">
            <Users className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="text-base font-bold text-[var(--primary)] uppercase tracking-wider">
              Control de Grupos de Trabajo
            </h3>
          </div>

          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
            {config.grades.map((g, i) => (
              <div key={g.id} className="bg-gray-50 border border-gray-200 p-4 rounded-md space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400">ID Grupo: {g.id}</span>
                  <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={g.enabled}
                      onChange={(e) => handleGradeChange(i, "enabled", e.target.checked)}
                      className="accent-[var(--primary)]"
                    />
                    HABILITADO
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Etiqueta del Grupo</label>
                  <input
                    type="text"
                    value={g.label}
                    onChange={(e) => handleGradeChange(i, "label", e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed border-gray-200">
                  <div className="flex flex-col gap-1 text-[10px] uppercase font-bold text-gray-500">
                    <label className="mb-1 text-gray-400">Materia</label>
                    <label className="flex items-center gap-1.5 cursor-pointer mb-1.5 text-[10px]">
                      <input
                        type="checkbox"
                        checked={g.useGlobalSubject}
                        onChange={(e) => handleGradeChange(i, "useGlobalSubject", e.target.checked)}
                        className="accent-[var(--primary)]"
                      />
                      Global (Defecto)
                    </label>
                    {!g.useGlobalSubject && (
                      <input
                        type="text"
                        value={g.subject}
                        onChange={(e) => handleGradeChange(i, "subject", e.target.value)}
                        placeholder="Materia específica..."
                        className="px-2 py-1 border border-gray-200 bg-white rounded focus:outline-none text-xs"
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-[10px] uppercase font-bold text-gray-500">
                    <label className="mb-1 text-gray-400">Periodos</label>
                    <label className="flex items-center gap-1.5 cursor-pointer mb-1.5 text-[10px]">
                      <input
                        type="checkbox"
                        checked={g.useGlobalPeriods}
                        onChange={(e) => handleGradeChange(i, "useGlobalPeriods", e.target.checked)}
                        className="accent-[var(--primary)]"
                      />
                      Global (Defecto)
                    </label>
                    {!g.useGlobalPeriods && (
                      <select
                        value={g.periodCount}
                        onChange={(e) => handleGradeChange(i, "periodCount", parseInt(e.target.value))}
                        className="px-2 py-1 border border-gray-200 bg-white rounded text-xs focus:outline-none cursor-pointer"
                      >
                        <option value="3">3 Periodos (L)</option>
                        <option value="4">4 Periodos (L)</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
