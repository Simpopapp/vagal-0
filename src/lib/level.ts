import { lookupWord } from "./lexicon";
import type { CefrLevel } from "./types";

const ORDER: CefrLevel[] = ["a1", "a2", "b1", "b2", "c1"];

export function levelRank(level: CefrLevel): number {
  return ORDER.indexOf(level);
}

export const LEVEL_LABELS: Record<CefrLevel, string> = {
  a1: "A1 · começando",
  a2: "A2 · básico",
  b1: "B1 · intermediário",
  b2: "B2 · independente",
  c1: "C1 · avançado",
};

/**
 * Palavras que o app não sugere em nenhum nível: função gramatical e o núcleo
 * do vocabulário básico. Marcá-las continua possível — só não são convite.
 */
const FUNCTION_WORDS = new Set(
  [
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "so",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "of",
    "on",
    "to",
    "up",
    "with",
    "about",
    "after",
    "before",
    "over",
    "under",
    "into",
    "than",
    "then",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
    "my",
    "your",
    "his",
    "its",
    "our",
    "their",
    "this",
    "that",
    "these",
    "those",
    "who",
    "what",
    "when",
    "where",
    "why",
    "how",
    "be",
    "am",
    "is",
    "are",
    "was",
    "were",
    "been",
    "being",
    "do",
    "does",
    "did",
    "have",
    "has",
    "had",
    "will",
    "would",
    "can",
    "could",
    "should",
    "may",
    "might",
    "must",
    "not",
    "no",
    "yes",
    "all",
    "any",
    "some",
    "more",
    "most",
    "very",
    "too",
    "just",
    "only",
    "there",
    "here",
    "now",
    "still",
    "also",
    "again",
    "one",
    "two",
    "three",
    "first",
    "last",
    "say",
    "said",
    "use",
    "used",
    "make",
    "made",
    "get",
    "got",
    "put",
    "take",
    "took",
    "call",
    "myself",
    "yourself",
    "himself",
    "herself",
    "itself",
    "ourselves",
    "themselves",
  ].map((word) => word),
);

/** Só um convite: sublinhado sutil, que o usuário confirma ou ignora. */
export function isSuggestedWord(
  norm: string,
  level: CefrLevel,
  known: Record<string, number>,
): boolean {
  if (!norm || norm.length < 3) return false;
  // contrações ("don't", "can't") são gramática, não vocabulário novo
  if (/['’]/.test(norm)) return false;
  if (FUNCTION_WORDS.has(norm)) return false;
  if (knows(known, norm)) return false;

  const entry = lookupWord(norm);
  if (entry) return levelRank(entry.level) > levelRank(level);

  // Fora do léxico: sugere se tem corpo de palavra de conteúdo.
  return norm.length >= 4;
}

export function knows(known: Record<string, number>, norm: string): boolean {
  return Object.prototype.hasOwnProperty.call(known, norm);
}

export function isCommonWord(norm: string): boolean {
  return FUNCTION_WORDS.has(norm);
}
