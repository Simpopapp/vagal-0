import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { DossierView, PendingCard, WordCardView } from "../components/word-card-view";
import { generateDossier } from "../lib/ai.functions";
import { enqueueCard } from "../lib/card-queue";
import { providerRequest } from "../lib/providers";
import { formatDue } from "../lib/srs";
import { setDossier, setStatus, toggleStar, useAppState, useStoreHydration } from "../lib/store";
import type { WordStatus } from "../lib/types";

export const Route = createFileRoute("/vocabulary/$wordId")({
  head: () => ({
    meta: [
      { title: "Dossiê da palavra · Verso" },
      {
        name: "description",
        content:
          "O dossiê da palavra: significado na frase, usos comuns, combinações, registro, parecidas que confundem e o que evitar.",
      },
    ],
  }),
  component: WordPage,
});

const STATUS_LABEL: Record<WordStatus, string> = {
  new: "nova",
  studying: "em estudo",
  mastered: "dominada",
};

function WordPage() {
  useStoreHydration();
  const { wordId } = Route.useParams();
  const state = useAppState();
  const [busy, setBusy] = useState(false);

  const entry = state.vocabulary[wordId];
  const song = entry ? state.songs[entry.songId] : undefined;

  if (!entry) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-2xl text-foreground">Palavra não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ela não está no vocabulário deste dispositivo.
        </p>
        <Link
          to="/vocabulary"
          className="mt-6 inline-block text-sm font-medium text-primary underline"
        >
          voltar ao vocabulário
        </Link>
      </div>
    );
  }

  async function deepen() {
    if (!entry) return;
    setBusy(true);
    try {
      const response = await generateDossier({
        data: {
          term: entry.term,
          norm: entry.lemma,
          level: state.settings.level,
          provider: providerRequest(state.settings.provider),
        },
      });
      if (response.ok) {
        setDossier(entry.id, response.dossier);
        toast.success("Dossiê pronto");
      } else {
        toast.error(response.reason);
      }
    } catch (error) {
      console.error(error);
      toast.error("não foi possível aprofundar agora");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border pb-6">
        <Link
          to="/vocabulary"
          className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          ← vocabulário
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
              {entry.term}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-sans text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{entry.card?.pos ?? entry.category}</span>
              <span aria-hidden>·</span>
              <span>{entry.card?.register ?? "registro não curado"}</span>
              <span aria-hidden>·</span>
              <span>{entry.card && entry.card.engine === "local" ? "curadoria local" : "IA"}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleStar(entry.id)}
            aria-pressed={entry.starred}
            aria-label={entry.starred ? "Remover dos favoritos" : "Marcar como favorita"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
              entry.starred
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star className="h-4 w-4" aria-hidden fill={entry.starred ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(STATUS_LABEL) as WordStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatus(entry.id, status)}
              aria-pressed={entry.status === status}
              className={`rounded-full border px-2.5 py-1 font-sans text-[11px] transition-colors ${
                entry.status === status
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
          <span className="ml-2 font-sans text-[11px] text-muted-foreground">
            próxima revisão: {formatDue(entry.srs.due)} · {entry.srs.reps} revisõe
            {entry.srs.reps === 1 ? "" : "s"} · {entry.srs.lapses} erro
            {entry.srs.lapses === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          card
        </h2>
        {entry.card ? (
          <WordCardView card={entry.card} />
        ) : (
          <div className="space-y-3">
            <PendingCard note={entry.cardNote} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                enqueueCard(entry.id, { front: true });
                toast("Card na frente da fila");
              }}
            >
              gerar este card agora
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          na letra
        </h2>
        <blockquote className="rounded-md border-l-2 border-primary bg-secondary px-4 py-3 font-display text-[17px] leading-relaxed text-secondary-foreground">
          {entry.occurrences[entry.occurrences.length - 1]?.phrase ?? entry.phrase}
        </blockquote>
        {song ? (
          <Link
            to="/song/$songId"
            params={{ songId: song.id }}
            className="text-sm font-medium text-primary hover:underline"
          >
            abrir {song.title}
          </Link>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            dossiê
          </h2>
          {!entry.dossier ? (
            <Button variant="secondary" size="sm" onClick={deepen} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              aprofundar agora
            </Button>
          ) : null}
        </div>
        {entry.dossier ? (
          <DossierView dossier={entry.dossier} />
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            O dossiê é gerado sob demanda: usos comuns, combinações, registro, parecidas que
            confundem e o que evitar.
          </p>
        )}
      </section>

      {entry.occurrences.length > 1 ? (
        <section className="space-y-2">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            reaparições
          </h2>
          <ul className="space-y-2">
            {entry.occurrences.slice(0, -1).map((occurrence) => (
              <li
                key={`${occurrence.songId}-${occurrence.lineIndex}`}
                className="rounded-md border border-border bg-card px-3 py-2"
              >
                <p className="font-display text-[15px] text-foreground">{occurrence.phrase}</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {state.songs[occurrence.songId]?.title ?? occurrence.songId}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
