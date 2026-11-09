import { ArrowUpRight, CircleHelp, TriangleAlert, Check } from "lucide-react";

import { VERDICT_LABEL } from "../lib/card-engine";
import type { Dossier, Verdict, WordCard } from "../lib/types";

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const tone =
    verdict === "right"
      ? "border-success/50 bg-success/10 text-success"
      : verdict === "mcbc"
        ? "border-caution/60 bg-caution/10 text-caution-foreground"
        : "border-destructive/50 bg-destructive/10 text-destructive";

  const Icon = verdict === "right" ? Check : verdict === "mcbc" ? CircleHelp : TriangleAlert;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[11px] uppercase tracking-[0.12em] ${tone}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function WordCardView({ card }: { card: WordCard }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">
          {card.term}
        </h2>
        <span className="font-sans text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {card.pos} · {card.register} ·{" "}
          {card.engine === "local" ? "curadoria local" : "gerado por IA"}
        </span>
      </div>

      <section aria-label="Significado literal" className="border-l-2 border-border pl-3">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          literal
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{card.literal}</p>
      </section>

      <section
        aria-label="Significado na frase"
        className="rounded-md border border-border bg-secondary px-4 py-3"
      >
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          na frase
        </p>
        <p className="mt-1 font-display text-[17px] leading-relaxed text-secondary-foreground">
          {card.inPhrase}
        </p>
      </section>

      <section aria-label="Por que não o sinônimo" className="space-y-2">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          por que não “{card.whyNot.synonym}”
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={card.whyNot.verdict} />
          <span className="text-sm leading-relaxed text-foreground">{card.whyNot.reason}</span>
        </div>
      </section>
    </div>
  );
}

export function PendingCard({ note }: { note: string | null }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-4">
      <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        card pendente
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        {note ?? "esta palavra ainda está na fila de geração."}
      </p>
    </div>
  );
}

export function DossierView({ dossier }: { dossier: Dossier }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <DossierBlock title="usos mais comuns" items={dossier.commonUses} />
      <DossierBlock title="combinações frequentes" items={dossier.collocations} itemsAreMono />
      <div className="sm:col-span-2">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          registro
        </p>
        <p className="mt-1 text-sm text-foreground">{dossier.register}</p>
      </div>
      <div className="sm:col-span-2">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          parecidas que confundem
        </p>
        <ul className="mt-1 space-y-1.5">
          {dossier.confusables.map((item) => (
            <li key={item.term} className="flex gap-2 text-sm leading-relaxed text-foreground">
              <ArrowUpRight className="mt-1 h-3 w-3 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">{item.term}</span> — {item.note}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <DossierBlock title="o que evitar" items={dossier.avoid} className="sm:col-span-2" />
    </div>
  );
}

function DossierBlock({
  title,
  items,
  itemsAreMono,
  className,
}: {
  title: string;
  items: string[];
  itemsAreMono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className={`text-sm leading-relaxed text-foreground ${itemsAreMono ? "font-mono text-[13px]" : ""}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
