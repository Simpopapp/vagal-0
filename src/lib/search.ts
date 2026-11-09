import { CATALOG, type CatalogSong } from "./catalog";
import type { Song, SongCandidate } from "./types";

/** Palavras que não distinguem uma música de outra. */
const NOISE = new Set([
  "the",
  "a",
  "an",
  "of",
  "by",
  "and",
  "song",
  "musica",
  "música",
  "lyrics",
  "letra",
  "ao",
  "vivo",
]);

export function normalizeQuery(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Interpretation = {
  query: string;
  confidence: "high" | "medium" | "low";
  matches: SongCandidate[];
};

/**
 * Interpretação determinística: "paper boot", "neon statc" e "slow tide letra"
 * chegam na mesma música. Sem rede, sem token, instantânea.
 */
export function interpretQuery(raw: string, catalog: CatalogSong[] = CATALOG): Interpretation {
  const query = normalizeQuery(raw);
  const tokens = query.split(" ").filter((token) => token && !NOISE.has(token));

  if (!tokens.length) {
    return { query, confidence: "low", matches: [] };
  }

  const scored = catalog
    .map((song) => ({ song, score: scoreSong(song, query, tokens) }))
    .filter((item) => item.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const matches: SongCandidate[] = scored.map(({ song, score }) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    source: "catalog",
    lines: song.lines,
    score: Math.round(score * 100) / 100,
  }));

  const top = matches[0]?.score ?? 0;
  const confidence: Interpretation["confidence"] =
    top >= 0.8 ? "high" : top >= 0.5 ? "medium" : "low";

  return { query, confidence, matches };
}

function scoreSong(song: CatalogSong, query: string, tokens: string[]): number {
  const title = normalizeQuery(song.title);
  const artist = normalizeQuery(song.artist);
  const lyrics = normalizeQuery(song.lines.join(" "));

  if (title === query) return 1;

  let best = 0;
  if (title.includes(query) && query.length >= 3) best = Math.max(best, 0.92);

  const titleTokens = title.split(" ");
  const titleHits = tokens.filter((token) =>
    titleTokens.some((candidate) => candidate === token || isClose(candidate, token)),
  ).length;
  best = Math.max(best, 0.88 * (titleHits / tokens.length));

  const artistHits = tokens.filter((token) => artist.includes(token)).length;
  if (artistHits) best = Math.max(best, 0.6 * (artistHits / tokens.length));

  const lyricHits = tokens.filter((token) => lyrics.includes(token)).length;
  if (lyricHits) best = Math.max(best, 0.42 * (lyricHits / tokens.length));

  return Math.min(1, best);
}

function isClose(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  return editDistance(a, b) <= 2;
}

export function editDistance(a: string, b: string): number {
  let previous: number[] = [];
  let current: number[] = [];

  for (let col = 0; col <= b.length; col += 1) previous[col] = col;

  for (let row = 1; row <= a.length; row += 1) {
    current = new Array<number>(b.length + 1).fill(0);
    current[0] = row;
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      const remove = (previous[col] ?? 0) + 1;
      const insert = (current[col - 1] ?? 0) + 1;
      const substitute = (previous[col - 1] ?? 0) + cost;
      current[col] = Math.min(remove, insert, substitute);
    }
    previous = current;
  }

  return previous[b.length] ?? a.length;
}

export function songFromCandidate(candidate: SongCandidate, now = Date.now()): Song {
  return {
    id: candidate.id,
    title: candidate.title,
    artist: candidate.artist,
    lines: candidate.lines,
    source: candidate.source,
    addedAt: now,
    language: "en",
  };
}

export function songIdFor(title: string, artist: string): string {
  const base = normalizeQuery(`${artist} ${title}`).replace(/\s+/g, "-");
  return base || `song-${Math.abs(hashCode(title))}`;
}

function hashCode(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}
