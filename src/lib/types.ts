import { z } from "zod";

/** Régua de nível declarada pelo usuário (régua de base da pré-marcação). */
export const cefrLevelSchema = z.enum(["a1", "a2", "b1", "b2", "c1"]);
export type CefrLevel = z.infer<typeof cefrLevelSchema>;

/** Os dois modos de toque da leitura. */
export const tapModeSchema = z.enum(["card", "collect"]);
export type TapMode = z.infer<typeof tapModeSchema>;

export const wordStatusSchema = z.enum(["new", "studying", "mastered"]);
export type WordStatus = z.infer<typeof wordStatusSchema>;

/** ✗ errado · ✓ certo · ◐ certo, mas menos cabível. */
export const verdictSchema = z.enum(["wrong", "right", "mcbc"]);
export type Verdict = z.infer<typeof verdictSchema>;

export const cardEngineSchema = z.enum(["local", "remote"]);
export type CardEngine = z.infer<typeof cardEngineSchema>;

export const wordCardSchema = z.object({
  term: z.string().min(1),
  lemma: z.string().min(1),
  pos: z.string().min(1),
  register: z.string().min(1),
  literal: z.string().min(1),
  inPhrase: z.string().min(1),
  whyNot: z.object({
    synonym: z.string().min(1),
    verdict: verdictSchema,
    reason: z.string().min(1),
  }),
  engine: cardEngineSchema,
  generatedAt: z.number(),
});
export type WordCard = z.infer<typeof wordCardSchema>;

export const dossierSchema = z.object({
  commonUses: z.array(z.string()),
  collocations: z.array(z.string()),
  register: z.string().min(1),
  confusables: z.array(z.object({ term: z.string(), note: z.string() })),
  avoid: z.array(z.string()),
  engine: cardEngineSchema,
  generatedAt: z.number(),
});
export type Dossier = z.infer<typeof dossierSchema>;

export type SongSource = "catalog" | "vagalume";
export type Song = {
  id: string;
  title: string;
  artist: string;
  lines: string[];
  source: SongSource;
  addedAt: number;
  language: "en";
};

export type Occurrence = {
  songId: string;
  lineIndex: number;
  phrase: string;
  addedAt: number;
};

export type ReviewAngle = "context" | "synonym" | "gap";

/** Estado de agendamento (SM-2 simplificado). */
export type SrsState = {
  due: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  streak: number;
};

export type ReviewLog = { at: number; angle: ReviewAngle; correct: boolean };

export type CardState = "pending" | "ready" | "failed";

export type VocabularyEntry = {
  id: string;
  term: string;
  lemma: string;
  songId: string;
  lineIndex: number;
  phrase: string;
  status: WordStatus;
  starred: boolean;
  category: string;
  card: WordCard | null;
  cardState: CardState;
  cardNote: string | null;
  dossier: Dossier | null;
  occurrences: Occurrence[];
  srs: SrsState;
  reviewLog: ReviewLog[];
  createdAt: number;
  updatedAt: number;
};

export const providerKindSchema = z.enum(["local", "remote"]);
export type ProviderKind = z.infer<typeof providerKindSchema>;

export type ProviderConfig = {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
};

export type Settings = {
  level: CefrLevel;
  tapMode: TapMode;
  provider: ProviderConfig;
};

export type AppState = {
  version: 1;
  songs: Record<string, Song>;
  vocabulary: Record<string, VocabularyEntry>;
  known: Record<string, number>;
  settings: Settings;
};

/** Candidata de busca — antes de virar `Song`. */
export type SongCandidate = {
  id: string;
  title: string;
  artist: string;
  source: SongSource;
  lines: string[];
  score: number;
};
