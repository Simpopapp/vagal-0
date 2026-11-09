import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useAppState, useStoreHydration } from "../lib/store";
import type { VocabularyEntry, WordStatus } from "../lib/types";

export const Route = createFileRoute("/vocabulary/")({
  head: () => ({
    meta: [
      { title: "Vocabulário · Verso" },
      {
        name: "description",
        content:
          "Todas as palavras que você marcou nas letras: por música, por categoria, por estágio e por frequência.",
      },
    ],
  }),
  component: VocabularyPage,
});

const STAGES: { value: WordStatus | "all"; label: string }[] = [
  { value: "all", label: "todos os estágios" },
  { value: "new", label: "novas" },
  { value: "studying", label: "em estudo" },
  { value: "mastered", label: "dominadas" },
];

function VocabularyPage() {
  useStoreHydration();
  const state = useAppState();
  const [songId, setSongId] = useState("all");
  const [stage, setStage] = useState<WordStatus | "all">("all");
  const [category, setCategory] = useState("all");
  const [frequency, setFrequency] = useState("all");

  const entries = useMemo(() => Object.values(state.vocabulary), [state.vocabulary]);

  const songs = useMemo(() => {
    const ids = new Set(entries.map((entry) => entry.songId));
    return Object.values(state.songs)
      .filter((song) => ids.has(song.id))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [entries, state.songs]);

  const categories = useMemo(
    () => [...new Set(entries.map((entry) => entry.category))].sort(),
    [entries],
  );

  const visible = entries
    .filter((entry) => (songId === "all" ? true : entry.songId === songId))
    .filter((entry) => (stage === "all" ? true : entry.status === stage))
    .filter((entry) => (category === "all" ? true : entry.category === category))
    .filter((entry) => {
      if (frequency === "all") return true;
      const distinct = new Set(entry.occurrences.map((occurrence) => occurrence.songId)).size;
      return frequency === "2+" ? distinct >= 2 : distinct === 1;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Vocabulário
        </h1>
        <p className="text-sm text-muted-foreground">
          {entries.length} palavra{entries.length === 1 ? "" : "s"} coletada
          {entries.length === 1 ? "" : "s"} em {new Set(entries.map((e) => e.songId)).size} música
          {new Set(entries.map((e) => e.songId)).size === 1 ? "" : "s"}.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label="música"
          value={songId}
          onChange={setSongId}
          options={[
            { value: "all", label: "todas as músicas" },
            ...songs.map((song) => ({ value: song.id, label: song.title })),
          ]}
        />
        <FilterSelect
          label="estágio"
          value={stage}
          onChange={(value) => setStage(value as WordStatus | "all")}
          options={STAGES}
        />
        <FilterSelect
          label="categoria"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "todas as categorias" },
            ...categories.map((item) => ({ value: item, label: item })),
          ]}
        />
        <FilterSelect
          label="frequência"
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: "all", label: "qualquer frequência" },
            { value: "2+", label: "em 2+ músicas" },
            { value: "1", label: "em uma música" },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState hasEntries={entries.length > 0} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <li key={entry.id}>
              <Link
                to="/vocabulary/$wordId"
                params={{ wordId: entry.id }}
                className="flex h-full flex-col gap-2 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-2xl font-medium leading-tight text-foreground">
                    {entry.term}
                  </h2>
                  <StatusChip status={entry.status} />
                </div>
                <p className="text-sm text-foreground">
                  {entry.card ? entry.card.literal : (entry.cardNote ?? "card pendente")}
                </p>
                <p className="mt-auto flex flex-wrap items-center gap-2 pt-2 font-sans text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{state.songs[entry.songId]?.title ?? "música"}</span>
                  <span aria-hidden>·</span>
                  <span>{entry.category}</span>
                  {new Set(entry.occurrences.map((occurrence) => occurrence.songId)).size > 1 ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        {new Set(entry.occurrences.map((occurrence) => occurrence.songId)).size}{" "}
                        músicas
                      </span>
                    </>
                  ) : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: WordStatus }) {
  const label = status === "new" ? "nova" : status === "studying" ? "em estudo" : "dominada";
  const tone =
    status === "mastered"
      ? "border-success/50 text-success"
      : status === "studying"
        ? "border-caution/60 text-caution-foreground"
        : "border-border text-muted-foreground";

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] ${tone}`}
    >
      {label}
    </span>
  );
}

function EmptyState({ hasEntries }: { hasEntries: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card px-6 py-12 text-center">
      <h2 className="font-display text-2xl text-foreground">
        {hasEntries ? "nada com esses filtros" : "seu vocabulário está vazio"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {hasEntries
          ? "Ajuste os filtros — ou volte à letra para marcar mais palavras."
          : "Abra uma letra, toque nas palavras que você não conhece e elas aparecem aqui, com card e dossiê."}
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        escolher uma música
      </Link>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
      <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent font-sans text-[13px] text-foreground outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
