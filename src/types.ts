export interface Student {
  id: string;
  name: string;
  notes: (number | null)[]; // 25 elements matching block weights
  reasons: (string | null)[]; // 25 elements for notes comments/incidences
  isDisabled: boolean;
  manualComment: string;
}

export interface Grade {
  id: string;
  label: string;
  enabled: boolean;
  useGlobalSubject: boolean;
  subject: string;
  useGlobalPeriods: boolean;
  periodCount: number;
}

export interface Config {
  school: string;
  teacher: string;
  subject: string;
  periodCount: number;
  defaultPeriod: string;
  blockNames: string[];
  blockWeights: number[];
  grades: Grade[];
  theme: string;
}

export interface AppState {
  config: Config;
  currentTrim: string;
  currentGradeId: string | null;
  currentView: string;
  showRankings: boolean;
  hideInactive: boolean;
  showListNumberOnly: boolean;
  data: Record<string, Record<string, Student[]>>; // Trim (T1, T2...) -> GradeId (G1, G2...) -> List of Student
}
