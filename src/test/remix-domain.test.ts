import { describe, expect, it } from "vitest";

import { buildLocalCard } from "../lib/card-engine";
import { buildSession } from "../lib/practice";
import { defaultProviderConfig } from "../lib/providers";
import { editDistance, interpretQuery, normalizeQuery } from "../lib/search";
import { initialSrs } from "../lib/srs";
import type { AppState, VocabularyEntry } from "../lib/types";

describe("busca interpretada", () => {
  it("resolve título digitado com erro de digitação", () => {
    const result = interpretQuery("paper boot");
    expect(result.matches[0]?.title).toBe("Paper Boats");
    expect(result.confidence).toBe("high");
  });

  it("resolve palavra sem as últimas letras", () => {
    expect(interpretQuery("neon statc").matches[0]?.title).toBe("Neon Static");
  });

  it("ignora ruído de busca", () => {
    expect(interpretQuery("slow tide letra").matches[0]?.title).toBe("Slow Tide");
  });

  it("não inventa candidata quando não há correspondência", () => {
    const result = interpretQuery("zzzzqqq");
    expect(result.matches).toHaveLength(0);
    expect(result.confidence).toBe("low");
  });

  it("normaliza acentos e pontuação da consulta", () => {
    expect(normalizeQuery("Música, Ao Vivo!")).toBe("musica ao vivo");
  });

  it("mede distância de edição", () => {
    expect(editDistance("paper", "paper")).toBe(0);
    expect(editDistance("paper", "pape")).toBe(1);
  });
});

describe("motor local de cards", () => {
  it("gera card completo para palavra curada", () => {
    const result = buildLocalCard("hollow", "hollow", "b1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.literal.length).toBeGreaterThan(0);
      expect(result.card.inPhrase.length).toBeGreaterThan(0);
      expect(["wrong", "right", "mcbc"]).toContain(result.card.whyNot.verdict);
      expect(result.card.engine).toBe("local");
    }
  });

  it("reconhece flexão simples", () => {
    const result = buildLocalCard("boats", "boats", "a2");
    expect(result.ok && result.card.lemma).toBe("boat");
  });

  it("não inventa card para palavra fora do léxico", () => {
    const result = buildLocalCard("xilofone", "xilofone", "b1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("curadoria");
  });
});

function entry(index: number, term: string): VocabularyEntry {
  const card = buildLocalCard(term, term, "b1");
  return {
    id: term,
    term,
    lemma: term,
    songId: "paper-boats",
    lineIndex: index,
    phrase: `a line with ${term} inside it`,
    status: "new",
    starred: false,
    category: "verbo",
    card: card.ok ? card.card : null,
    cardState: card.ok ? "ready" : "pending",
    cardNote: card.ok ? null : card.reason,
    dossier: null,
    occurrences: [
      {
        songId: "paper-boats",
        lineIndex: index,
        phrase: `a line with ${term} inside it`,
        addedAt: 0,
      },
    ],
    srs: initialSrs(0),
    reviewLog: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("sessão de prática", () => {
  const state: AppState = {
    version: 1,
    songs: {},
    vocabulary: {
      "let go": entry(0, "let go"),
      hollow: entry(1, "hollow"),
      drown: entry(2, "drown"),
    },
    known: {},
    settings: {
      level: "b1",
      tapMode: "collect",
      provider: defaultProviderConfig(),
    },
  };

  it("monta uma questão por palavra vencida", () => {
    const session = buildSession(state, 42, 1000);
    expect(session.questions).toHaveLength(3);
    expect(session.short).toBe(false);
  });

  it("cobra ângulos diferentes para a mesma palavra", () => {
    const angles = buildSession(state, 7, 1000).questions.map((question) => question.angle);
    expect(new Set(angles).size).toBeGreaterThan(1);
  });

  it("toda questão tem exatamente uma resposta correta", () => {
    const session = buildSession(state, 99, 1000);
    for (const question of session.questions) {
      expect(question.options.filter((option) => option.correct)).toHaveLength(1);
    }
  });

  it("não monta sessão sem palavra vencida", () => {
    const empty: AppState = { ...state, vocabulary: {} };
    const session = buildSession(empty, 1, 1000);
    expect(session.questions).toHaveLength(0);
    expect(session.dueCount).toBe(0);
  });
});
