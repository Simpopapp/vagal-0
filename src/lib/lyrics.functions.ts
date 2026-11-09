import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { interpretQuery, normalizeQuery, songIdFor } from "./search";
import type { SongCandidate } from "./types";

const input = z.object({ query: z.string().min(1).max(160) });

export type LyricsSearchResult = {
  query: string;
  confidence: "high" | "medium" | "low";
  matches: SongCandidate[];
  remote: SongCandidate[];
  note: string | null;
};

/**
 * Busca de letra: interpretação local (catálogo) + tentativa no Vagalume.
 *
 * O Vagalume é a fonte da letra real de terceiros e pode falhar — o contrato
 * devolve `note` em vez de estourar a tela.
 */
export const searchLyrics = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }): Promise<LyricsSearchResult> => {
    const interpretation = interpretQuery(data.query);
    const result: LyricsSearchResult = {
      query: data.query,
      confidence: interpretation.confidence,
      matches: interpretation.matches,
      remote: [],
      note: null,
    };

    try {
      result.remote = await fetchVagalume(data.query);
      if (!result.remote.length && !result.matches.length) {
        result.note = "nenhuma letra encontrada para essa busca";
      }
    } catch (error) {
      console.error("[verso] vagalume indisponível", error);
      result.note = result.matches.length
        ? "não consegui falar com o Vagalume agora — as músicas de demonstração continuam disponíveis"
        : "não consegui falar com o Vagalume agora — tente de novo ou use uma música de demonstração";
    }

    return result;
  });

async function fetchVagalume(rawQuery: string): Promise<SongCandidate[]> {
  const apiKey = process.env["VAGALUME_API_KEY"];
  const normalized = normalizeQuery(rawQuery);
  const [first, ...rest] = normalized.split(" ").filter(Boolean);
  if (!first) return [];

  const params = new URLSearchParams({ art: first, mus: rest.join(" ") });
  if (apiKey) params.set("apikey", apiKey);

  const response = await fetch(`https://api.vagalume.com.br/search.php?${params.toString()}`, {
    signal: AbortSignal.timeout(5000),
    headers: {
      Accept: "application/json",
      "User-Agent": "Verso/1.0 (estudo de idiomas por letra)",
    },
  });

  if (!response.ok) throw new Error(`vagalume ${response.status}`);

  const body = (await response.json()) as {
    type?: string;
    mus?: { id?: string; name?: string; band?: string; text?: string }[];
  };

  if (!body.mus?.length) return [];

  return body.mus.slice(0, 3).flatMap((item) => {
    const lines = cleanLyrics(item.text ?? "");
    if (lines.length < 2) return [];
    const title = item.name ?? rawQuery;
    const artist = item.band ?? "Vagalume";
    return [
      {
        id: songIdFor(title, artist),
        title,
        artist,
        source: "vagalume" as const,
        lines,
        score: 0.9,
      },
    ];
  });
}

/** Limpa a resposta: sem blocos de tradução, estrofes preservadas, lixo de site fora. */
export function cleanLyrics(text: string): string[] {
  const withoutTranslation = text.split(/^\s*Tradu[çc][ãa]o\s*$/im)[0] ?? text;
  return withoutTranslation
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""))
    .map((line) => line.replace(/^\[\d+\]$/, "").trim());
}
