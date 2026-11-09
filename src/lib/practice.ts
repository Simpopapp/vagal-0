import { lexiconLiterals } from "./lexicon";
import { pickAngle } from "./srs";
import { blankWord } from "./tokenize";
import type { AppState, ReviewAngle, VocabularyEntry } from "./types";

export type PracticeOption = { id: string; label: string; correct: boolean };

export type PracticeQuestion = {
  entryId: string;
  angle: ReviewAngle;
  heading: string;
  prompt: string;
  context: string;
  options: PracticeOption[];
  explanation: string;
};

export type PracticeSession = {
  questions: PracticeQuestion[];
  dueCount: number;
  short: boolean;
};

const ANGLE_HEADING: Record<ReviewAngle, string> = {
  context: "Qual o significado nesse contexto?",
  synonym: "Esse sinônimo cabe aqui?",
  gap: "Qual palavra falta na letra?",
};

const VERDICT_OPTIONS: PracticeOption[] = [
  { id: "wrong", label: "✗ errado", correct: false },
  { id: "right", label: "✓ certo", correct: false },
  { id: "mcbc", label: "◐ certo, mas menos cabível", correct: false },
];

/** Entradas prontas para revisão, vencidas primeiro e erros antes. */
export function dueEntries(state: AppState, now = Date.now()): VocabularyEntry[] {
  return Object.values(state.vocabulary)
    .filter((entry) => entry.card && entry.cardState === "ready")
    .sort((a, b) => a.srs.due - b.srs.due || b.srs.lapses - a.srs.lapses)
    .filter((entry) => entry.srs.due <= now + 60_000);
}

export function buildSession(
  state: AppState,
  seed = Date.now() % 100_000,
  now = Date.now(),
  limit = 10,
): PracticeSession {
  const due = dueEntries(state, now);
  const chosen = due.slice(0, limit);
  const random = mulberry32(seed);

  const pool = Object.values(state.vocabulary).filter(
    (entry) => entry.card && entry.cardState === "ready",
  );
  const fallback = lexiconLiterals(60);

  const questions = chosen.map((entry) => {
    const angle = pickAngle(entry.id, entry.srs.reps);
    return buildQuestion(entry, angle, pool, fallback, random);
  });

  return { questions, dueCount: due.length, short: due.length < 3 };
}

function buildQuestion(
  entry: VocabularyEntry,
  angle: ReviewAngle,
  pool: VocabularyEntry[],
  fallback: { term: string; literal: string }[],
  random: () => number,
): PracticeQuestion {
  const card = entry.card;
  if (!card) {
    return {
      entryId: entry.id,
      angle,
      heading: ANGLE_HEADING[angle],
      prompt: entry.phrase,
      context: "",
      options: [],
      explanation: "",
    };
  }

  if (angle === "synonym") {
    const options = VERDICT_OPTIONS.map((option) => ({
      ...option,
      correct: option.id === card.whyNot.verdict,
    }));
    return {
      entryId: entry.id,
      angle,
      heading: ANGLE_HEADING.synonym,
      prompt: `Trocar “${entry.term}” por “${card.whyNot.synonym}” nesta frase?`,
      context: entry.phrase,
      options,
      explanation: card.whyNot.reason,
    };
  }

  if (angle === "gap") {
    const line = entry.phrase;
    const distractors = uniqueBy(
      pool.filter((other) => other.id !== entry.id).map((other) => other.term),
      (term) => term,
    )
      .slice(0, 12)
      .sort(() => random() - 0.5)
      .slice(0, 3);

    return {
      entryId: entry.id,
      angle,
      heading: ANGLE_HEADING.gap,
      prompt: blankWord(line, entry.term),
      context: "",
      options: shuffle(
        [
          { id: entry.id, label: entry.term, correct: true },
          ...distractors.map((term) => ({ id: term, label: term, correct: false })),
        ],
        random,
      ),
      explanation: `A palavra é “${entry.term}” — ${card.literal}.`,
    };
  }

  const literals = uniqueBy(
    pool
      .filter((other) => other.id !== entry.id && other.card)
      .map((other) => other.card?.literal ?? ""),
    (value) => value,
  ).filter((value) => value && value !== card.literal);

  const extras = fallback
    .map((item) => item.literal)
    .filter((value) => value !== card.literal && !literals.includes(value));

  const distractors = shuffle([...literals, ...extras], random).slice(0, 3);

  return {
    entryId: entry.id,
    angle: "context",
    heading: ANGLE_HEADING.context,
    prompt: `O que “${entry.term}” significa aqui?`,
    context: blankWord(entry.phrase, entry.term),
    options: shuffle(
      [
        { id: entry.id, label: card.literal, correct: true },
        ...distractors.map((label, index) => ({ id: `d${index}`, label, correct: false })),
      ],
      random,
    ),
    explanation: card.inPhrase,
  };
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = copy[i];
    const other = copy[j];
    if (current === undefined || other === undefined) continue;
    copy[i] = other;
    copy[j] = current;
  }
  return copy;
}

function mulberry32(seed: number): () => number {
  let a = seed + 0x6d2b79f5;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
