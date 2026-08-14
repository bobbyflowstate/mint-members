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

interface TrainingModuleBase {
  version: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  required: boolean;
  completionPolicy: { acceptedVersions: readonly string[] };
}

export interface LntTrainingModule extends TrainingModuleBase {
  slug: "lnt";
  content: {
    streams: readonly WasteStream[];
    packItems: readonly PackItem[];
    quizItems: readonly QuizItem[];
  };
}

export interface TrainingVideo {
  title: string;
  description: string;
  youtubeId?: string;
  credit?: string;
  interim?: string;
}

export interface SafetyItem {
  icon: string;
  title: string;
  written: string;
  owed: string;
  interim: string;
}

export interface BikeSpot {
  x: number;
  y: number;
  bad: boolean;
  why: string;
}

export interface LawItem {
  icon: string;
  title: string;
  source: string;
  authoredByCamp: boolean;
  paragraphs: readonly string[];
  link?: { href: string; label: string };
}

export interface BarRule {
  icon: string;
  title: string;
  source: string;
  external: boolean;
  paragraphs: readonly string[];
}

export interface MojitoStep {
  group?: string;
  text: string;
  key?: boolean;
}

export interface GeneralQuizItem {
  question: string;
  options: readonly string[];
  answer: number;
  critical: boolean;
  explanation: string;
  source: string;
}

export interface GeneralTrainingModule extends TrainingModuleBase {
  slug: "general";
  content: {
    videos: readonly TrainingVideo[];
    safetyItems: readonly SafetyItem[];
    bikes: readonly BikeSpot[];
    lawItems: readonly LawItem[];
    barRules: readonly BarRule[];
    mojitoSteps: readonly MojitoStep[];
    cultureQuiz: readonly GeneralQuizItem[];
    barQuiz: readonly GeneralQuizItem[];
  };
}

export type TrainingModule = LntTrainingModule | GeneralTrainingModule;

export interface TrainingProgressState {
  step: number;
  role?: TrainingRole;
  packed: number[];
  quizQueue: number[];
  quizMarks: Record<number, boolean>;
}

export type GeneralKind = "first" | "return" | "lead";

export interface GeneralQuizState {
  queue: number[];
  marks: Record<number, boolean>;
}

export interface GeneralProgressState {
  step: number;
  kind?: GeneralKind;
  videos: number[];
  safety: number[];
  bikes: number[];
  law: number[];
  bar: number[];
  mojito: number[];
  cultureQuiz: GeneralQuizState;
  barQuiz: GeneralQuizState;
}
