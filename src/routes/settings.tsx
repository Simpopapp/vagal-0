import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { ProviderSettings } from "../components/provider-settings";
import { LEVEL_LABELS } from "../lib/level";
import { resetData, saveSettings, useAppState, useStoreHydration } from "../lib/store";
import type { CefrLevel } from "../lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes · Verso" },
      {
        name: "description",
        content:
          "Nível declarado, modo de toque, provedor de IA com catálogo de modelos e dados locais.",
      },
      { property: "og:title", content: "Ajustes · Verso" },
      {
        property: "og:description",
        content: "Escolha o provedor de IA, liste os modelos e teste a conexão em Ajustes.",
      },
    ],
  }),
  component: SettingsPage,
});

const LEVELS: CefrLevel[] = ["a1", "a2", "b1", "b2", "c1"];

function SettingsPage() {
  useStoreHydration();
  const state = useAppState();
  const settings = state.settings;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Ajustes
        </h1>
        <p className="text-sm text-muted-foreground">
          Tudo aqui é salvo neste dispositivo. Não há conta, nem sincronização.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          nível declarado
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          É a régua da pré-marcação: palavras abaixo do seu nível deixam de ser sugeridas na letra.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => saveSettings({ level })}
              aria-pressed={settings.level === level}
              className={`rounded-md border px-3 py-1.5 font-sans text-[12px] transition-colors ${
                settings.level === level
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          modo de toque padrão
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => saveSettings({ tapMode: "collect" })}
            aria-pressed={settings.tapMode === "collect"}
            className={`rounded-md border px-3 py-1.5 font-sans text-[12px] transition-colors ${
              settings.tapMode === "collect"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            coleta — marca e segue
          </button>
          <button
            type="button"
            onClick={() => saveSettings({ tapMode: "card" })}
            aria-pressed={settings.tapMode === "card"}
            className={`rounded-md border px-3 py-1.5 font-sans text-[12px] transition-colors ${
              settings.tapMode === "card"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            card — abre na hora
          </button>
        </div>
      </section>

      <ProviderSettings />

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          dados
        </h2>
        <p className="text-sm text-muted-foreground">
          {Object.keys(state.songs).length} música{Object.keys(state.songs).length === 1 ? "" : "s"}{" "}
          · {Object.keys(state.vocabulary).length} palavra
          {Object.keys(state.vocabulary).length === 1 ? "" : "s"} salvas neste dispositivo.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            resetData();
            toast.success("Dados deste dispositivo apagados");
          }}
        >
          apagar tudo deste dispositivo
        </Button>
      </section>
    </div>
  );
}
