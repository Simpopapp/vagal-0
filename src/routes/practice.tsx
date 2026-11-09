import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";

import { Button } from "../components/ui/button";
import { buildSession, dueEntries, type PracticeSession } from "../lib/practice";
import { formatDue } from "../lib/srs";
import { reviewWord, useAppState, useStoreHydration } from "../lib/store";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Prática · Verso" },
      {
        name: "description",
        content:
          "Revisão espaçada por ângulos diferentes: significado no contexto, sinônimo que não cabe e lacuna na letra.",
      },
    ],
  }),
  component: PracticePage,
});

function PracticePage() {
  useStoreHydration();
  const state = useAppState();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const due = dueEntries(state);
  const totalWords = Object.keys(state.vocabulary).length;

  function start() {
    setSession(buildSession(state));
    setIndex(0);
    setChoice(null);
    setCorrectCount(0);
  }

  function answer(optionId: string, correct: boolean) {
    if (choice || !session) return;
    setChoice(optionId);
    if (correct) setCorrectCount((value) => value + 1);
    const question = session.questions[index];
    if (question) reviewWord(question.entryId, question.angle, correct);
  }

  function next() {
    if (!session) return;
    setChoice(null);
    if (index + 1 >= session.questions.length) {
      setIndex(session.questions.length);
      return;
    }
    setIndex(index + 1);
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
            Prática
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cada revisão cobra um ângulo diferente da mesma palavra — significado no contexto,
            sinônimo que não cabe e lacuna na letra.
          </p>
        </header>

        {due.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card px-6 py-10 text-center">
            <h2 className="font-display text-2xl text-foreground">nenhuma palavra vencida agora</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {totalWords === 0
                ? "Colete palavras numa letra primeiro: cada marcação vira uma entrada do vocabulário pronta para revisar."
                : "A revisão espaçada volta sozinha — as próximas palavras aparecem aqui quando vencerem. Você pode antecipar abrindo o vocabulário."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                escolher uma música
              </Link>
              <Link
                to="/vocabulary"
                className="inline-flex items-center rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                abrir o vocabulário
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-md border border-border bg-card px-6 py-8 text-center">
            <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              sessão de hoje
            </p>
            <h2 className="font-display text-3xl font-medium text-foreground">
              {Math.min(due.length, 10)} cartõe{Math.min(due.length, 10) === 1 ? "" : "s"} para
              revisar
            </h2>
            {due.length < 3 ? (
              <p className="text-sm text-muted-foreground">
                Sessão curta: poucas palavras vencidas. Marque mais uma letra para ter mais ângulos.
              </p>
            ) : null}
            <Button size="lg" onClick={start}>
              começar revisão
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>
    );
  }

  const question = session.questions[index];

  if (!question || index >= session.questions.length) {
    const total = session.questions.length;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-primary">
            fim da sessão
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
            {correctCount} de {total} corretas
          </h1>
        </header>

        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {session.questions.map((item) => {
            const entry = state.vocabulary[item.entryId];
            return (
              <li
                key={`${item.entryId}-${item.angle}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="font-display text-lg text-foreground">
                  {entry?.term ?? item.entryId}
                </span>
                <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {entry ? `próxima ${formatDue(entry.srs.due)}` : "—"}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button onClick={start}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            nova sessão
          </Button>
          <Link
            to="/vocabulary"
            className="inline-flex items-center rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            abrir o vocabulário
          </Link>
        </div>
      </div>
    );
  }

  const answeredOption = question.options.find((option) => option.id === choice);
  const answered = choice !== null;
  const isRight = Boolean(answeredOption?.correct);
  const entry = state.vocabulary[question.entryId];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3 font-sans text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>
          {index + 1} de {session.questions.length}
        </span>
        <span>{entry?.category ?? "vocabulário"}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((index + (answered ? 1 : 0)) / session.questions.length) * 100}%` }}
        />
      </div>

      <section className="space-y-4 rounded-md border border-border bg-card px-5 py-6">
        <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-primary">
          {question.heading}
        </p>
        <h1 className="font-display text-2xl font-medium leading-snug text-foreground">
          {question.prompt}
        </h1>
        {question.context ? (
          <p className="rounded-md border-l-2 border-border bg-secondary px-3 py-2 font-display text-[17px] leading-relaxed text-secondary-foreground">
            {question.context}
          </p>
        ) : null}

        <ul className="space-y-2">
          {question.options.map((option) => {
            const state_ = answered
              ? option.correct
                ? "correct"
                : option.id === choice
                  ? "wrong"
                  : "idle"
              : "idle";
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => answer(option.id, option.correct)}
                  disabled={answered}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                    state_ === "correct"
                      ? "border-success/60 bg-success/10 text-foreground"
                      : state_ === "wrong"
                        ? "border-destructive/60 bg-destructive/10 text-foreground"
                        : "border-border bg-background hover:bg-accent/60"
                  }`}
                >
                  <span>{option.label}</span>
                  {state_ === "correct" ? (
                    <Check className="h-4 w-4 text-success" aria-hidden />
                  ) : state_ === "wrong" ? (
                    <X className="h-4 w-4 text-destructive" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {answered ? (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm leading-relaxed text-foreground">
              <span
                className={`mr-2 font-sans text-[10px] uppercase tracking-[0.18em] ${
                  isRight ? "text-success" : "text-destructive"
                }`}
              >
                {isRight ? "certo" : "errado"}
              </span>
              {question.explanation}
            </p>
            <Button onClick={next}>
              {index + 1 >= session.questions.length ? "ver resultado" : "próxima"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
