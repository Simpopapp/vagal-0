import { useEffect, useSyncExternalStore } from "react";

import { categoryOf, lemmaOf } from "./lexicon";
import { buildLocalCard } from "./card-engine";
import { defaultProviderConfig, migrateProviderConfig } from "./providers";
import { normalizeWord, phraseOf } from "./tokenize";
import { initialSrs, schedule } from "./srs";
import type {
  AppState,
  CefrLevel,
  ReviewAngle,
  Settings,
  Song,
  VocabularyEntry,
  WordCard,
  Dossier,
} from "./types";

const STORAGE_KEY = "verso.state.v1";

export function emptyState(): AppState {
  return {
    version: 1,
    songs: {},
    vocabulary: {},
    known: {},
    settings: {
      level: "b1",
      tapMode: "collect",
      provider: defaultProviderConfig(),
    },
  };
}

const SERVER_STATE: AppState = emptyState();

let state: AppState = SERVER_STATE;
const listeners = new Set<() => void>();
let hydrateStarted = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): AppState {
  return state;
}

/** Snapshot constante: o SSR não vê `localStorage` e não quebra a hidratação. */
export function getServerSnapshot(): AppState {
  return SERVER_STATE;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Hidrata uma vez, no cliente. Chamado pelo shell em efeito. */
export function hydrate(): void {
  if (hydrateStarted || typeof window === "undefined") return;
  hydrateStarted = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const previousSettings = (parsed.settings ?? {}) as Partial<Settings>;
    state = {
      ...emptyState(),
      ...parsed,
      settings: {
        ...emptyState().settings,
        ...previousSettings,
        // Migra o provedor salvo por versões anteriores sem perder a URL/modelo.
        provider: migrateProviderConfig(previousSettings.provider),
      },
    };
    emit();
  } catch (error) {
    console.warn("[verso] estado local ilegível, começando limpo", error);
  }
}

export function useStoreHydration(): void {
  useEffect(() => {
    hydrate();
  }, []);
}

function emit(): void {
  for (const listener of listeners) listener();
}

function commit(next: AppState): void {
  state = next;
  emit();
  schedulePersist();
}

function schedulePersist(): void {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 250);
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Nunca perder vocabulário por causa do histórico: descarta o log de revisão.
    try {
      const light: AppState = {
        ...state,
        vocabulary: Object.fromEntries(
          Object.entries(state.vocabulary).map(([id, entry]) => [
            id,
            { ...entry, reviewLog: entry.reviewLog.slice(-10) },
          ]),
        ),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch (fatal) {
      console.warn("[verso] não foi possível salvar neste dispositivo", fatal, error);
    }
  }
}

/* ——— ações ——— */

export function addSong(song: Song): void {
  commit({ ...state, songs: { ...state.songs, [song.id]: song } });
}

export function saveSettings(patch: Partial<Settings>): void {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

export function setTapMode(tapMode: Settings["tapMode"]): void {
  saveSettings({ tapMode });
}

export function setLevel(level: CefrLevel): void {
  saveSettings({ level });
}

export type MarkResult = { entryId: string; created: boolean };

export function markWord(input: {
  songId: string;
  lineIndex: number;
  term: string;
  phrase: string;
  termRaw?: string;
}): MarkResult {
  const norm = normalizeWord(input.term);
  const lemma = lemmaOf(norm);
  const entryId = lemma;
  const now = Date.now();
  const phrase = phraseOf(input.phrase);

  const existing = state.vocabulary[entryId];
  if (existing) {
    const alreadyThere = existing.occurrences.some(
      (occurrence) =>
        occurrence.songId === input.songId && occurrence.lineIndex === input.lineIndex,
    );
    if (alreadyThere) return { entryId, created: false };

    const updated: VocabularyEntry = {
      ...existing,
      updatedAt: now,
      occurrences: [
        ...existing.occurrences,
        { songId: input.songId, lineIndex: input.lineIndex, phrase, addedAt: now },
      ],
      // Reaparecer em outra música conta como revisão neutra.
      srs: existing.occurrences.some((occurrence) => occurrence.songId !== input.songId)
        ? schedule(existing.srs, 1, now)
        : existing.srs,
    };
    commit({
      ...state,
      vocabulary: { ...state.vocabulary, [entryId]: updated },
    });
    return { entryId, created: false };
  }

  const local = buildLocalCard(input.termRaw ?? input.term, norm, state.settings.level, now);
  const entry: VocabularyEntry = {
    id: entryId,
    term: norm,
    lemma,
    songId: input.songId,
    lineIndex: input.lineIndex,
    phrase,
    status: "new",
    starred: false,
    category: categoryOf(norm),
    card: local.ok ? local.card : null,
    cardState: local.ok ? "ready" : "pending",
    cardNote: local.ok ? null : local.reason,
    dossier: null,
    occurrences: [{ songId: input.songId, lineIndex: input.lineIndex, phrase, addedAt: now }],
    srs: initialSrs(now),
    reviewLog: [],
    createdAt: now,
    updatedAt: now,
  };

  commit({
    ...state,
    vocabulary: { ...state.vocabulary, [entryId]: entry },
  });
  return { entryId, created: true };
}

export function dismissWord(term: string): void {
  const norm = normalizeWord(term);
  if (!norm) return;
  commit({ ...state, known: { ...state.known, [norm]: Date.now() } });
}

export function patchEntry(id: string, patch: Partial<VocabularyEntry>): void {
  const entry = state.vocabulary[id];
  if (!entry) return;
  commit({
    ...state,
    vocabulary: { ...state.vocabulary, [id]: { ...entry, ...patch, updatedAt: Date.now() } },
  });
}

export function setCard(id: string, card: WordCard): void {
  patchEntry(id, { card, cardState: "ready", cardNote: null });
}

export function failCard(id: string, reason: string): void {
  patchEntry(id, { cardState: "failed", cardNote: reason });
}

export function setDossier(id: string, dossier: Dossier): void {
  patchEntry(id, { dossier });
}

export function toggleStar(id: string): void {
  const entry = state.vocabulary[id];
  if (!entry) return;
  patchEntry(id, { starred: !entry.starred });
}

export function setStatus(id: string, status: VocabularyEntry["status"]): void {
  patchEntry(id, { status });
}

export function reviewWord(id: string, angle: ReviewAngle, correct: boolean): void {
  const entry = state.vocabulary[id];
  if (!entry) return;
  const now = Date.now();
  const srs = schedule(entry.srs, correct ? 2 : 0, now);
  patchEntry(id, {
    srs,
    status: srs.streak >= 3 ? "mastered" : entry.status === "new" ? "studying" : entry.status,
    reviewLog: [...entry.reviewLog, { at: now, angle, correct }].slice(-200),
  });
}

export function resetData(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  commit(emptyState());
}

/* ——— derivações usadas pela UI ——— */

export function pendingCount(current: AppState): number {
  return Object.values(current.vocabulary).filter((entry) => entry.cardState !== "ready").length;
}

export function readyCount(current: AppState): number {
  return Object.values(current.vocabulary).filter((entry) => entry.cardState === "ready").length;
}

export function entriesOfSong(current: AppState, songId: string): VocabularyEntry[] {
  return Object.values(current.vocabulary)
    .filter((entry) => entry.occurrences.some((occurrence) => occurrence.songId === songId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function songUsageCount(current: AppState, lemma: string): number {
  const entry = current.vocabulary[lemma];
  if (!entry) return 0;
  return new Set(entry.occurrences.map((occurrence) => occurrence.songId)).size;
}
