export type TrainingRole = "camp" | "crew" | "lead";

export type WasteStreamId =
  | "KC" | "BC" | "OC" | "AL" | "MR" | "PC"
  | "GL" | "TR" | "LI" | "UO" | "WD" | "GW";

export interface WasteStream {
  id: WasteStreamId;
  name: string;
  icon: string;
  color: string;
  shape: "circle" | "dashed" | "dotted" | "hex" | "square" | "fold" | "diamond" | "octagon" | "triangle" | "pentagon" | "plank" | "wave";
  goesIn: string;
  never: string;
}

export interface PackItem {
  title: string;
  summary: string;
  reason: string;
}

export interface QuizItem {
  icon: string;
  name: string;
  scenario: string;
  answer: WasteStreamId;
  explanation: string;
  source: string;
}

export interface TrainingModule {
  slug: string;
  version: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  required: boolean;
  completionPolicy: { acceptedVersions: readonly string[] };
  content: {
    streams: readonly WasteStream[];
    packItems: readonly PackItem[];
    quizItems: readonly QuizItem[];
  };
}

export interface TrainingProgressState {
  step: number;
  role?: TrainingRole;
  packed: number[];
  quizQueue: number[];
  quizMarks: Record<number, boolean>;
}
