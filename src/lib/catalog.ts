/**
 * Catálogo de demonstração: três letras **originais** escritas para o Verso
 * (nenhum direito de terceiros envolvido), com vocabulário progressivo.
 *
 * A letra real de músicas de terceiros chega por busca (Vagalume) e fica salva
 * no dispositivo — nunca é semeada aqui.
 */
export type CatalogSong = {
  id: string;
  title: string;
  artist: string;
  level: "A2" | "B1" | "B2";
  note: string;
  lines: string[];
};

const PAPER_BOATS: string[] = [
  "We fold the paper into boats",
  "and let them sail across the floor",
  "the rain is loud against the glass",
  "but we don't listen anymore",
  "",
  "paper boats, paper boats",
  "carry all the words we never say",
  "paper boats, paper boats",
  "sink before they reach the bay",
  "",
  "my brother draws a crooked sail",
  "and laughs because it leans to one side",
  "the kitchen table is an ocean",
  "and the evening is a tide",
  "",
  "paper boats, paper boats",
  "carry all the words we never say",
  "paper boats, paper boats",
  "sink before they reach the bay",
  "",
  "tomorrow they will turn to pulp",
  "and we will build another fleet",
  "the floor is wet, the clock is slow",
  "and every boat is incomplete",
];

const NEON_STATIC: string[] = [
  "the city hums in neon static",
  "I walk home without a plan",
  "the shops are shut, the streets are hollow",
  "and every window holds a man",
  "",
  "turn it down, turn it down",
  "I can't hear myself above the noise",
  "turn it down, turn it down",
  "I am learning how to use my voice",
  "",
  "I borrowed courage from a stranger",
  "he said the static never lasts",
  "so I collect the little sparks",
  "and drown the doubts out with the past",
  "",
  "turn it down, turn it down",
  "I can't hear myself above the noise",
  "turn it down, turn it down",
  "I am learning how to use my voice",
  "",
  "some nights the quiet feels like danger",
  "some nights it feels like coming home",
  "I keep the static in my pocket",
  "and make a sentence of my own",
];

const SLOW_TIDE: string[] = [
  "you said you would show up when the weather turned",
  "but the weather turned on me",
  "I waited by the harbour wall",
  "counting what was left of the sea",
  "",
  "and the tide comes in so slowly",
  "that you hardly notice the rise",
  "till the water is at your shoulders",
  "and the shoreline is out of sight",
  "",
  "let go, let it go",
  "what you carry is not yours to hold",
  "let go, let it go",
  "the slow tide takes it all",
  "",
  "I kept the letters in a drawer",
  "I kept the reasons in my chest",
  "I told myself it didn't matter",
  "I put my patience to the test",
  "",
  "let go, let it go",
  "what you carry is not yours to hold",
  "let go, let it go",
  "the slow tide takes it all",
  "",
  "now the harbour lights are fading",
  "and the boats have all come in",
  "I am learning how to leave things",
  "without calling it the end",
];

export const CATALOG: CatalogSong[] = [
  {
    id: "paper-boats",
    title: "Paper Boats",
    artist: "Verso · demonstração",
    level: "A2",
    note: "Narrativa simples, presente e futuro — boa para começar a colecionar.",
    lines: PAPER_BOATS,
  },
  {
    id: "neon-static",
    title: "Neon Static",
    artist: "Verso · demonstração",
    level: "B1",
    note: "Gíria e expressão: static, hollow, drown it out.",
    lines: NEON_STATIC,
  },
  {
    id: "slow-tide",
    title: "Slow Tide",
    artist: "Verso · demonstração",
    level: "B2",
    note: "Verbos frasais e sentido figurado — let go, show up, come in.",
    lines: SLOW_TIDE,
  },
];

export function catalogSong(id: string): CatalogSong | undefined {
  return CATALOG.find((song) => song.id === id);
}
