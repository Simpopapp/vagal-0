import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { CATALOG, type CatalogSong } from "../lib/catalog";
import { searchLyrics, type LyricsSearchResult } from "../lib/lyrics.functions";
import { normalizeQuery, songFromCandidate } from "../lib/search";
import { addSong, useAppState, useStoreHydration } from "../lib/store";
import type { SongCandidate } from "../lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verso — a letra é a fonte, a palavra é o estudo" },
      {
        name: "description",
        content:
          "Digite a música como vier: o Verso entende qual é, traz a letra inteira e transforma cada palavra desconhecida em um card de estudo.",
      },
      { property: "og:title", content: "Verso — a letra é a fonte, a palavra é o estudo" },
      {
        property: "og:description",
        content: "Leia a letra, marque o que não sabe, estude a palavra por inteiro.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  useStoreHydration();
  const state = useAppState();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LyricsSearchResult | null>(null);

  const recent = Object.values(state.songs)
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, 4);

  function openCandidate(candidate: SongCandidate) {
    addSong(songFromCandidate(candidate));
    void navigate({ to: "/song/$songId", params: { songId: candidate.id } });
  }

  function openCatalog(song: CatalogSong) {
    openCandidate({
      id: song.id,
      title: song.title,
      artist: song.artist,
      source: "catalog",
      lines: song.lines,
      score: 1,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const response = await searchLyrics({ data: { query: value } });
      setResult(response);

      const only = response.matches[0];
      const single = response.matches.length === 1 && response.remote.length === 0;
      const exact =
        Boolean(only) && single && normalizeQuery(only!.title) === normalizeQuery(value);
      if (response.confidence === "high" && exact && only) {
        openCandidate(only);
      }
    } catch (error) {
      console.error("[verso] busca falhou", error);
      setResult({
        query: value,
        confidence: "low",
        matches: [],
        remote: [],
        note: "a busca falhou — tente de novo",
      });
    } finally {
      setBusy(false);
    }
  }

  const candidates = result ? [...result.matches, ...result.remote] : [];

  return (
    <div className="space-y-12">
      <section className="max-w-2xl">
        <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-primary">
          busca interpretada
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          Que música você está ouvindo?
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Escreva do jeito que vier — <span className="text-foreground">“paper boot”</span>,{" "}
          <span className="text-foreground">“neon statc”</span>, artista incompleto. O Verso
          interpreta, mostra o que entendeu e traz a letra inteira.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="artista e música, como você lembrar"
              aria-label="Artista e música"
              className="h-11 bg-card pl-9 font-display text-[17px]"
            />
          </div>
          <Button type="submit" size="lg" className="h-11" disabled={busy || !query.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? "procurando" : "procurar"}
          </Button>
        </form>
      </section>

      {result ? (
        <section aria-live="polite" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              li como
            </span>
            <span className="font-display text-lg text-foreground">“{result.query}”</span>
            <span className="rounded-full border border-border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              confiança{" "}
              {result.confidence === "high"
                ? "alta"
                : result.confidence === "medium"
                  ? "média"
                  : "baixa"}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {candidates.length} candidata{candidates.length === 1 ? "" : "s"}
            </span>
          </div>

          {candidates.length > 1 ? (
            <p className="text-sm text-muted-foreground">
              Era alguma dessas? Escolha a certa em vez de deixar o app chutar.
            </p>
          ) : null}

          {result.note ? (
            <p className="rounded-md border border-caution/50 bg-caution/10 px-3 py-2 text-sm text-caution-foreground">
              {result.note}
            </p>
          ) : null}

          <ul className="grid gap-3 sm:grid-cols-2">
            {candidates.map((candidate) => (
              <li
                key={`${candidate.source}-${candidate.id}`}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-medium text-foreground">
                      {candidate.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{candidate.artist}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {candidate.source === "vagalume" ? "Vagalume" : "demonstração"}
                  </span>
                </div>
                <p className="line-clamp-2 font-display text-sm leading-relaxed text-muted-foreground">
                  {candidate.lines.find((line) => line.trim()) ?? "—"}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-1 self-start"
                  onClick={() => openCandidate(candidate)}
                >
                  abrir a letra
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada encontrado. Tente o artista e um trecho da letra, ou abra uma música de
              demonstração abaixo.
            </p>
          ) : null}
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            continuar de onde parou
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {recent.map((song) => (
              <li key={song.id}>
                <Link
                  to="/song/$songId"
                  params={{ songId: song.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
                >
                  <span>
                    <span className="font-display text-lg text-foreground">{song.title}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{song.artist}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            músicas de demonstração
          </h2>
          <span className="text-xs text-muted-foreground">
            letras originais, disponíveis offline
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {CATALOG.map((song) => (
            <li key={song.id}>
              <button
                type="button"
                onClick={() => openCatalog(song)}
                className="flex h-full w-full flex-col gap-2 rounded-md border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-primary">
                  nível {song.level}
                </span>
                <span className="font-display text-xl font-medium leading-snug text-foreground">
                  {song.title}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{song.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
