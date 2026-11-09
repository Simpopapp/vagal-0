import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { providerStatus } from "../lib/ai.functions";
import { LEVEL_LABELS } from "../lib/level";
import { resetData, saveSettings, useAppState, useStoreHydration } from "../lib/store";
import type { CefrLevel, ProviderKind } from "../lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes · Verso" },
      {
        name: "description",
        content: "Nível declarado, modo de toque padrão, provedor de cards e dados locais.",
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
  const [status, setStatus] = useState<{ remoteConfigured: boolean; model: string | null } | null>(
    null,
  );
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    providerStatus()
      .then((result) => {
        if (alive) setStatus(result);
      })
      .catch((error) => {
        console.error("[verso] status do provedor falhou", error);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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

      <section className="space-y-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          provedor de cards
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          O app sempre tenta primeiro a curadoria local. Palavra fora dessa curadoria precisa de um
          provedor compatível com OpenAI no servidor.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {(["local", "remote"] as ProviderKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => saveSettings({ provider: { ...settings.provider, kind } })}
              aria-pressed={settings.provider.kind === kind}
              className={`rounded-md border px-3 py-1.5 font-sans text-[12px] transition-colors ${
                settings.provider.kind === kind
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {kind === "local" ? "curadoria local" : "minha API (remota)"}
            </button>
          ))}
        </div>

        {settings.provider.kind === "remote" ? (
          <div className="space-y-2 rounded-md border border-border bg-card p-4">
            <label className="block">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                base url
              </span>
              <Input
                value={settings.provider.baseUrl}
                onChange={(event) =>
                  saveSettings({
                    provider: { ...settings.provider, baseUrl: event.target.value },
                  })
                }
                placeholder="https://…/v1 (vazio usa o padrão do servidor)"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                modelo
              </span>
              <Input
                value={settings.provider.model}
                onChange={(event) =>
                  saveSettings({ provider: { ...settings.provider, model: event.target.value } })
                }
                placeholder="modelo do provedor"
                className="mt-1"
              />
            </label>
          </div>
        ) : null}

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {checking ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              verificando o servidor…
            </>
          ) : status?.remoteConfigured ? (
            <>
              chave presente no servidor
              {status.model ? ` · modelo padrão ${status.model}` : ""}
            </>
          ) : (
            <>sem chave no servidor — usando curadoria local</>
          )}
        </p>
      </section>

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
