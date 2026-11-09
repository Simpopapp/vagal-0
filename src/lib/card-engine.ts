import { lookupWord } from "./lexicon";
import type { CefrLevel, Dossier, WordCard } from "./types";

export type CardResult = { ok: true; card: WordCard } | { ok: false; reason: string };

/**
 * Motor local: gera o card a partir do léxico curado.
 * Palavra fora da curadoria **não** recebe card aproximado — devolve o motivo.
 */
export function buildLocalCard(
  term: string,
  norm: string,
  _level: CefrLevel,
  now = Date.now(),
): CardResult {
  const entry = lookupWord(norm);
  if (!entry) {
    return {
      ok: false,
      reason:
        "esta palavra ainda não tem curadoria local — conecte um provedor de IA em Ajustes para gerar o card",
    };
  }

  return {
    ok: true,
    card: {
      term,
      lemma: entry.term,
      pos: entry.pos,
      register: entry.register,
      literal: entry.literal,
      inPhrase: entry.inPhrase,
      whyNot: entry.whyNot,
      engine: "local",
      generatedAt: now,
    },
  };
}

/** Dossiê local: usos, combinações, registro, parecidas e o que evitar. */
export function buildLocalDossier(norm: string, now = Date.now()): Dossier | null {
  const entry = lookupWord(norm);
  if (!entry) return null;

  return {
    commonUses:
      entry.commonUses.length > 0
        ? entry.commonUses
        : [`${entry.term} aparece sobretudo como ${entry.pos}.`],
    collocations:
      entry.collocations.length > 0
        ? entry.collocations
        : [`${entry.term} + substantivo`, `verbo + ${entry.term}`],
    register: entry.register,
    confusables:
      entry.confusables && entry.confusables.length > 0
        ? entry.confusables
        : [{ term: entry.whyNot.synonym, note: entry.whyNot.reason }],
    avoid:
      entry.avoid && entry.avoid.length > 0
        ? entry.avoid
        : [`evite trocar ${entry.term} por “${entry.whyNot.synonym}” para dizer exatamente isto`],
    engine: "local",
    generatedAt: now,
  };
}

export const VERDICT_LABEL: Record<"wrong" | "right" | "mcbc", string> = {
  wrong: "errado",
  right: "certo",
  mcbc: "certo, mas menos cabível",
};
