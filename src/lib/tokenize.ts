/**
 * Tokenização da letra. O texto exibido é exatamente o da fonte: só as palavras
 * viram alvos de toque; espaço e pontuação continuam sendo renderizados como são.
 */

export type TokenKind = "word" | "space" | "punct";

export type Token = {
  raw: string;
  norm: string;
  kind: TokenKind;
  start: number;
  end: number;
};

/** Minúsculo, sem acentos, sem apóstrofos/hífens de borda — chave de vocabulário. */
export function normalizeWord(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^['’-]+|['’-]+$/g, "");
}

/**
 * Palavras: letras (com acento) e apóstrofo/hífen internos.
 * `don't`, `hold on`, `long-term` e `café` contam como uma palavra só.
 */
const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;

export function tokenizeLine(text: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of text.matchAll(WORD_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      pushGap(tokens, text.slice(cursor, start), cursor);
    }
    const raw = match[0];
    tokens.push({
      raw,
      norm: normalizeWord(raw),
      kind: "word",
      start,
      end: start + raw.length,
    });
    cursor = start + raw.length;
  }

  if (cursor < text.length) {
    pushGap(tokens, text.slice(cursor), cursor);
  }

  return tokens;
}

function pushGap(tokens: Token[], gap: string, offset: number) {
  gap.split(/(\s+)/).forEach((chunk) => {
    if (!chunk) return;
    tokens.push({
      raw: chunk,
      norm: chunk,
      kind: chunk.trim() === "" ? "space" : "punct",
      start: offset,
      end: offset + chunk.length,
    });
    offset += chunk.length;
  });
}

/** A linha com a palavra trocada por lacuna — usada na prática (ângulo da lacuna). */
export function blankWord(text: string, word: string, fill = "______"): string {
  const target = normalizeWord(word);
  let out = "";
  let cursor = 0;
  for (const token of tokenizeLine(text)) {
    out += text.slice(cursor, token.start);
    out += token.kind === "word" && token.norm === target ? fill : token.raw;
    cursor = token.end;
  }
  return out + text.slice(cursor);
}

/** Recorte curto da frase para guardar no vocabulário. */
export function phraseOf(line: string, max = 160): string {
  const clean = line.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
