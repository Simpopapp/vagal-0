import { describe, expect, it } from "vitest";

import { blankWord, normalizeWord, phraseOf, tokenizeLine } from "../lib/tokenize";

describe("tokenização da letra", () => {
  it("mantém apóstrofo interno como parte da palavra", () => {
    const tokens = tokenizeLine("we don't listen anymore");
    const words = tokens.filter((token) => token.kind === "word").map((token) => token.raw);
    expect(words).toEqual(["we", "don't", "listen", "anymore"]);
    expect(words.map(normalizeWord)).toContain("don't");
  });

  it("trata hífen interno como uma palavra só", () => {
    const words = tokenizeLine("a long-term plan")
      .filter((token) => token.kind === "word")
      .map((token) => token.raw);
    expect(words).toEqual(["a", "long-term", "plan"]);
  });

  it("separa pontuação sem perder o texto original", () => {
    const tokens = tokenizeLine("paper boats, paper boats");
    expect(tokens.map((token) => token.raw).join("")).toBe("paper boats, paper boats");
    expect(tokens.some((token) => token.kind === "punct" && token.raw === ",")).toBe(true);
  });

  it("normaliza acentos e caixa", () => {
    expect(normalizeWord("Café")).toBe("cafe");
    expect(normalizeWord("'round")).toBe("round");
  });

  it("recorta a palavra para a lacuna respeitando a caixa do texto", () => {
    expect(blankWord("We fold the paper into boats", "paper")).toBe(
      "We fold the ______ into boats",
    );
  });

  it("guarda a frase inteira e encurta só quando passa do limite", () => {
    expect(phraseOf("  short   line ")).toBe("short line");
    expect(phraseOf("x".repeat(200)).endsWith("…")).toBe(true);
  });
});
