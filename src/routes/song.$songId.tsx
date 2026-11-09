import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { PendingCard, WordCardView } from "../components/word-card-view";
import { enqueueCard } from "../lib/card-queue";
import { buildLocalCard } from "../lib/card-engine";
import { isSuggestedWord } from "../lib/level";
import { lemmaOf } from "../lib/lexicon";
import { entriesOfSong, markWord, setTapMode, useAppState, useStoreHydration } from "../lib/store";
import { tokenizeLine, type Token } from "../lib/tokenize";

export const Route = createFileRoute("/song/$songId")({
  head: () => ({
    meta: [
      { title: "Letra · Verso" },
      {
        name: "description",
        content:
          "Leia a letra inteira e toque nas palavras que não conhece: card na hora ou coleta silenciosa.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
  component: SongPage,
});

type Preview = {
  term: string;
  raw: string;
  lineIndex: number;
  phrase: string;
  entryId: string | null;
};

function SongPage() {
  useStoreHydration();
  const { songId } = Route.useParams();
  const state = useAppState();
  const song = state.songs[songId];
  const [preview, setPreview] = useState<Preview | null>(null);

  const songEntries = useMemo(() => entriesOfSong(state, songId), [state, songId]);
  const readyCount = songEntries.filter((entry) => entry.cardState === "ready").length;
  const mode = state.settings.tapMode;

  if (!song) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-2xl text-foreground">Letra não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta música não está salva neste dispositivo. Busque de novo para abrir a letra.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary underline">
          voltar à busca
        </Link>
      </div>
    );
  }

  function handleTap(token: Token, lineIndex: number) {
    const norm = token.norm;
    const existingId = lemmaOf(norm);
    const existing = state.vocabulary[existingId] ?? null;
    const lineText = song?.lines[lineIndex] ?? "";

    if (!existing && mode === "collect") {
      const result = markWord({
        songId,
        lineIndex,
        term: norm,
        termRaw: token.raw,
        phrase: lineText,
      });
      const local = buildLocalCard(token.raw, norm, state.settings.level);
      if (!local.ok) enqueueCard(result.entryId);
      return;
    }

    setPreview({
      term: norm,
      raw: token.raw,
      lineIndex,
      phrase: lineText,
      entryId: existing?.id ?? null,
    });
  }

  const previewEntry = preview?.entryId ? (state.vocabulary[preview.entryId] ?? null) : null;
  const previewLocal =
    preview && !previewEntry
      ? buildLocalCard(preview.raw, preview.term, state.settings.level)
      : null;

  function sendToVocabulary() {
    if (!preview) return;
    const result = markWord({
      songId,
      lineIndex: preview.lineIndex,
      term: preview.term,
      termRaw: preview.raw,
      phrase: preview.phrase,
    });
    const local = buildLocalCard(preview.raw, preview.term, state.settings.level);
    if (!local.ok) enqueueCard(result.entryId);
    setPreview({ ...preview, entryId: result.entryId });
    toast.success("Palavra enviada ao vocabulário");
  }

  return (
    <article className="space-y-8">
      <header className="space-y-3 border-b border-border pb-6">
        <Link
          to="/"
          className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          ← busca
        </Link>
        <h1 className="font-display text-4xl font-medium leading-tight tracking-tight text-foreground">
          {song.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{song.artist}</span>
          <span aria-hidden>·</span>
          <span className="rounded-full border border-border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em]">
            {song.source === "vagalume" ? "letra do Vagalume" : "demonstração"}
          </span>
          <span aria-hidden>·</span>
          <span>
            {readyCount} de {songEntries.length} pronta{songEntries.length === 1 ? "" : "s"}
          </span>
        </div>

        <div
          role="group"
          aria-label="Modo de toque"
          className="mt-3 inline-flex rounded-md border border-border bg-card p-1"
        >
          <button
            type="button"
            onClick={() => setTapMode("card")}
            className={`rounded px-3 py-1.5 font-sans text-[12px] transition-colors ${
              mode === "card"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={mode === "card"}
          >
            modo card
          </button>
          <button
            type="button"
            onClick={() => setTapMode("collect")}
            className={`rounded px-3 py-1.5 font-sans text-[12px] transition-colors ${
              mode === "collect"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={mode === "collect"}
          >
            modo coleta
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {mode === "collect"
            ? "Coleta: cada toque só marca a palavra e segue — os cards são gerados na fila."
            : "Card: o toque abre a palavra na hora; no painel você decide mandar ao vocabulário."}
        </p>
      </header>

      <div className="max-w-[68ch] space-y-1.5">
        {song.lines.map((line, lineIndex) => {
          if (!line.trim()) {
            return <div key={`gap-${lineIndex}`} className="h-5" aria-hidden />;
          }

          return (
            <p
              key={`line-${lineIndex}`}
              className="font-display text-[19px] leading-[1.9] text-foreground"
            >
              {tokenizeLine(line).map((token, tokenIndex) => {
                if (token.kind !== "word") {
                  return <span key={`t-${tokenIndex}`}>{token.raw}</span>;
                }

                const entryId = lemmaOf(token.norm);
                const isMarked = Boolean(state.vocabulary[entryId]);
                const suggested =
                  !isMarked && isSuggestedWord(token.norm, state.settings.level, state.known);

                return (
                  <button
                    key={`t-${tokenIndex}`}
                    type="button"
                    onClick={() => handleTap(token, lineIndex)}
                    className={
                      isMarked
                        ? "rounded-sm bg-accent px-0.5 text-foreground underline decoration-primary decoration-2 underline-offset-4 transition-colors hover:bg-accent/70"
                        : suggested
                          ? "rounded-sm px-0.5 underline decoration-muted-foreground decoration-dotted decoration-1 underline-offset-4 transition-colors hover:bg-accent/60"
                          : "rounded-sm px-0.5 transition-colors hover:bg-accent/60"
                    }
                  >
                    {token.raw}
                  </button>
                );
              })}
            </p>
          );
        })}
      </div>

      {songEntries.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
            <p className="text-sm text-foreground">
              você coletou <strong className="font-medium">{songEntries.length}</strong> palavra
              {songEntries.length === 1 ? "" : "s"} ·{" "}
              <span className="text-muted-foreground">
                {readyCount} pronta{readyCount === 1 ? "" : "s"}
              </span>
            </p>
            <Link
              to="/vocabulary"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              ver vocabulário
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}

      <Sheet open={Boolean(preview)} onOpenChange={(open) => (open ? null : setPreview(null))}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {previewEntry ? "no seu vocabulário" : "palavra"}
            </SheetTitle>
          </SheetHeader>

          {preview ? (
            <div className="mt-4 space-y-5 pb-6">
              <p className="rounded-md border-l-2 border-primary bg-secondary px-3 py-2 font-display text-[17px] leading-relaxed text-secondary-foreground">
                {preview.phrase}
              </p>

              {previewEntry?.card ? <WordCardView card={previewEntry.card} /> : null}

              {previewEntry && !previewEntry.card ? (
                <div className="space-y-3">
                  <PendingCard note={previewEntry.cardNote} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      enqueueCard(previewEntry.id, { front: true });
                      toast("Card na frente da fila");
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    gerar este card agora
                  </Button>
                </div>
              ) : null}

              {!previewEntry && previewLocal?.ok ? (
                <div className="space-y-4">
                  <WordCardView card={previewLocal.card} />
                  <Button onClick={sendToVocabulary}>enviar ao vocabulário</Button>
                </div>
              ) : null}

              {!previewEntry && previewLocal && !previewLocal.ok ? (
                <div className="space-y-3">
                  <PendingCard note={previewLocal.reason} />
                  <Button onClick={sendToVocabulary}>enviar ao vocabulário</Button>
                </div>
              ) : null}

              {previewEntry ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <Link
                    to="/vocabulary/$wordId"
                    params={{ wordId: previewEntry.id }}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    abrir o dossiê
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                  <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {previewEntry.cardState === "ready" ? "card pronto" : "card pendente"}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> carregando…
            </div>
          )}
        </SheetContent>
      </Sheet>
    </article>
  );
}
