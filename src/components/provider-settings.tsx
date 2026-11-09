import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { listProviderModels, providerStatus, testProvider } from "../lib/ai.functions";
import {
  CUSTOM_PROVIDER_ID,
  GROUP_LABELS,
  GROUP_ORDER,
  configFromDefinition,
  defaultProviderConfig,
  describeProvider,
  isFreeModel,
  providerById,
  providersInGroup,
  sanitizeBaseUrl,
} from "../lib/providers";
import { saveSettings, useAppState } from "../lib/store";
import type { DiscoveredModel, ProviderAdapter, ProviderConfig, ProviderError } from "../lib/types";

type ModelsState = "idle" | "loading" | "ready" | "empty" | "error";
type TestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; latencyMs: number; at: number }
  | { kind: "error"; message: string };

const ADAPTER_LABELS: Record<ProviderAdapter, string> = {
  openai: "compatível com OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

/**
 * Configuração de provedor de IA do dispositivo.
 *
 * Catálogo → escolha → chave → listagem real de modelos → teste de conexão.
 * A chave fica no estado local do app e só viaja por chamada até o servidor.
 */
export function ProviderSettings() {
  const state = useAppState();
  const config = state.settings.provider;
  const definition = providerById(config.providerId);

  const [choosing, setChoosing] = useState(config.kind === "local");
  const [query, setQuery] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [modelsState, setModelsState] = useState<ModelsState>("idle");
  const [modelsError, setModelsError] = useState<ProviderError | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const [server, setServer] = useState<{ remoteConfigured: boolean; model: string | null } | null>(
    null,
  );

  // Status do fallback de ambiente — uma vez só, ao montar.
  useEffect(() => {
    let alive = true;
    providerStatus()
      .then((result) => {
        if (alive) setServer(result);
      })
      .catch(() => {
        if (alive) setServer({ remoteConfigured: false, model: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  const baseCheck = sanitizeBaseUrl(config.baseUrl);
  const isCustom = config.providerId === CUSTOM_PROVIDER_ID;

  const curated = useMemo<DiscoveredModel[]>(
    () => (definition?.curatedModels ?? []).map((id) => ({ id, label: id, free: isFreeModel(id) })),
    [definition],
  );

  const pool = models.length > 0 ? models : curated;
  const visibleModels = useMemo(() => {
    const needle = modelQuery.trim().toLowerCase();
    const filtered = needle
      ? pool.filter(
          (model) =>
            model.id.toLowerCase().includes(needle) || model.label.toLowerCase().includes(needle),
        )
      : pool;
    return filtered.slice(0, 60);
  }, [pool, modelQuery]);

  const filteredCatalog = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return GROUP_ORDER.map((group) => ({
      group,
      entries: providersInGroup(group).filter(
        (provider) =>
          !needle ||
          provider.name.toLowerCase().includes(needle) ||
          provider.note.toLowerCase().includes(needle),
      ),
    })).filter((section) => section.entries.length > 0);
  }, [query]);

  function save(next: ProviderConfig) {
    saveSettings({ provider: next });
    setTest({ kind: "idle" });
  }

  function update(patch: Partial<ProviderConfig>) {
    save({ ...config, ...patch });
  }

  function pick(providerId: string) {
    const picked = providerById(providerId);
    if (!picked) return;
    save(configFromDefinition(picked, config));
    setChoosing(false);
    setModels([]);
    setModelsState("idle");
    setModelsError(null);
    setModelQuery("");
    setQuery("");
  }

  function useLocal() {
    save({ ...defaultProviderConfig(), kind: "local" });
    setChoosing(true);
    setModels([]);
    setModelsState("idle");
    setModelsError(null);
  }

  async function loadModels() {
    const base = sanitizeBaseUrl(config.baseUrl);
    if (!base.ok) {
      setModelsState("error");
      setModelsError({ code: "invalid_input", message: base.error });
      return;
    }
    setModelsState("loading");
    setModelsError(null);
    try {
      const response = await listProviderModels({
        data: {
          providerId: config.providerId,
          adapter: config.adapter,
          baseUrl: base.value,
          model: config.model,
          apiKey: config.apiKey,
        },
      });
      if (response.ok) {
        setModels(response.models);
        setModelsState(response.models.length > 0 ? "ready" : "empty");
      } else {
        setModels([]);
        setModelsState("error");
        setModelsError(response.error);
      }
    } catch (error) {
      console.error("[verso] listagem de modelos falhou", error);
      setModelsState("error");
      setModelsError({ code: "network", message: "não foi possível falar com o servidor do app" });
    }
  }

  async function runTest() {
    if (!config.model.trim()) {
      toast.error("escolha um modelo antes de testar");
      return;
    }
    const base = sanitizeBaseUrl(config.baseUrl);
    if (!base.ok) {
      setTest({ kind: "error", message: base.error });
      return;
    }
    setTest({ kind: "loading" });
    try {
      const response = await testProvider({
        data: {
          providerId: config.providerId,
          adapter: config.adapter,
          baseUrl: base.value,
          model: config.model.trim(),
          apiKey: config.apiKey,
        },
      });
      if (response.ok) {
        const at = Date.now();
        save({ ...config, verifiedAt: at });
        setTest({ kind: "ok", latencyMs: response.latencyMs, at });
        toast.success("provedor respondendo");
      } else {
        setTest({ kind: "error", message: response.error.message });
      }
    } catch (error) {
      console.error("[verso] teste de conexão falhou", error);
      setTest({ kind: "error", message: "não foi possível falar com o servidor do app" });
    }
  }

  const remote = config.kind === "remote";

  return (
    <section className="space-y-3">
      <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        provedor de IA
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        A curadoria local cobre 122 palavras. Fora dela, o card e o dossiê vêm do provedor que você
        configurar aqui.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={useLocal}
          aria-pressed={!remote}
          className={`rounded-md border px-3 py-1.5 font-sans text-[12px] transition-colors ${
            !remote
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          curadoria local
        </button>
        <button
          type="button"
          onClick={() => {
            setChoosing(true);
            if (!remote) update({ kind: "remote" });
          }}
          aria-pressed={remote}
          className={`rounded-md border px-3 py-1.5 font-sans text-[12px] transition-colors ${
            remote
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          meu provedor
        </button>
      </div>

      {!remote ? (
        <p className="text-sm text-muted-foreground">
          usando a curadoria local — nenhum card sai deste dispositivo.
          {server?.remoteConfigured
            ? " o servidor deste app tem uma chave, mas ela só é usada se você escolher um provedor ou ficar sem o local."
            : ""}
        </p>
      ) : null}

      {remote && choosing ? (
        <div className="space-y-3 rounded-md border border-border bg-card p-4">
          <label className="block">
            <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              buscar provedor
            </span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="nome ou característica (ex.: grátis, local)"
              className="mt-1"
            />
          </label>

          {filteredCatalog.map((section) => (
            <div key={section.group} className="space-y-1">
              <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {GROUP_LABELS[section.group]} · {section.entries.length}
              </p>
              <ul className="space-y-1">
                {section.entries.map((provider) => {
                  const active = config.providerId === provider.id;
                  const free = provider.group === "free" || provider.group === "local";
                  return (
                    <li key={provider.id}>
                      <button
                        type="button"
                        onClick={() => pick(provider.id)}
                        aria-pressed={active}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {provider.name}
                          </span>
                          {free ? (
                            <span className="rounded-full border border-caution/60 bg-caution/10 px-1.5 py-0.5 font-sans text-[9px] uppercase tracking-[0.14em] text-caution-foreground">
                              grátis
                            </span>
                          ) : null}
                          {active ? (
                            <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                          {provider.note}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {remote && !choosing ? (
        <div className="space-y-4 rounded-md border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {config.label || config.providerId}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {definition?.note ?? "provedor próprio"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="rounded-md border border-border px-2.5 py-1 font-sans text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              trocar
            </button>
          </div>

          {isCustom ? (
            <label className="block">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                nome do provedor
              </span>
              <Input
                value={config.label}
                onChange={(event) => update({ label: event.target.value })}
                placeholder="meu gateway, minha VPS…"
                className="mt-1"
              />
            </label>
          ) : null}

          <div className="space-y-1">
            <label className="block">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                chave {definition?.group === "local" ? "(não precisa)" : ""}
              </span>
              <div className="mt-1 flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(event) => update({ apiKey: event.target.value, verifiedAt: null })}
                  placeholder={
                    definition?.group === "local" ? "sem chave" : "cole a chave do provedor"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="chave do provedor"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "ocultar chave" : "mostrar chave"}
                  aria-pressed={showKey}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </label>
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <KeyRound className="h-3 w-3" aria-hidden />
              fica só neste dispositivo; o app não tem conta.
              {definition?.keyUrl ? (
                <a
                  href={definition.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline"
                >
                  obter chave
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </p>
          </div>

          {isCustom ? (
            <div className="space-y-1">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                formato da API
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ADAPTER_LABELS) as ProviderAdapter[]).map((adapter) => (
                  <button
                    key={adapter}
                    type="button"
                    onClick={() => update({ adapter, verifiedAt: null })}
                    aria-pressed={config.adapter === adapter}
                    className={`rounded-md border px-2.5 py-1 font-sans text-[11px] transition-colors ${
                      config.adapter === adapter
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ADAPTER_LABELS[adapter]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              url base
            </span>
            <Input
              value={config.baseUrl}
              onChange={(event) => update({ baseUrl: event.target.value, verifiedAt: null })}
              placeholder="https://…/v1"
              spellCheck={false}
              className="mt-1"
            />
            {!baseCheck.ok && config.baseUrl.trim() ? (
              <span className="mt-1 block text-[11px] text-destructive">{baseCheck.error}</span>
            ) : null}
            {baseCheck.ok && baseCheck.note ? (
              <span className="mt-1 block text-[11px] text-muted-foreground">{baseCheck.note}</span>
            ) : null}
          </label>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void loadModels()}
                disabled={modelsState === "loading" || !baseCheck.ok}
                aria-busy={modelsState === "loading"}
              >
                {modelsState === "loading" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                listar modelos
              </Button>
              <span className="text-[11px] text-muted-foreground" aria-live="polite">
                {modelsState === "ready"
                  ? `${models.length} modelo${models.length === 1 ? "" : "s"} · atualizado agora`
                  : modelsState === "loading"
                    ? "falando com o provedor…"
                    : modelsState === "empty"
                      ? "o provedor respondeu, mas não listou modelos"
                      : null}
              </span>
            </div>

            {modelsState === "error" && modelsError ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
                role="alert"
              >
                <p className="text-[12px] leading-snug text-destructive">{modelsError.message}</p>
                {curated.length > 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    sugestões deste provedor continuam disponíveis abaixo.
                  </p>
                ) : null}
              </div>
            ) : null}

            {modelsState === "empty" ? (
              <p className="text-[12px] text-muted-foreground">
                digite o nome do modelo abaixo — nem todo serviço publica a lista.
              </p>
            ) : null}

            <label className="block">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                modelo
              </span>
              <div className="relative mt-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={modelQuery}
                  onChange={(event) => setModelQuery(event.target.value)}
                  placeholder={
                    pool.length > 0 ? `buscar entre ${pool.length} modelos` : "buscar modelo"
                  }
                  className="pl-8"
                />
              </div>
            </label>

            {visibleModels.length > 0 ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {visibleModels.map((model) => {
                  const active = config.model === model.id;
                  return (
                    <li key={model.id}>
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            model: model.id,
                            free: model.free,
                            verifiedAt: null,
                          })
                        }
                        aria-pressed={active}
                        className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                          active
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                          {model.label}
                          {model.label !== model.id ? (
                            <span className="ml-1 text-muted-foreground">({model.id})</span>
                          ) : null}
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-1.5 py-0.5 font-sans text-[9px] uppercase tracking-[0.14em] ${
                            model.free
                              ? "border-caution/60 bg-caution/10 text-caution-foreground"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {model.free ? "grátis" : "pago"}
                        </span>
                        {active ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {pool.length > visibleModels.length && visibleModels.length === 60 ? (
              <p className="text-[11px] text-muted-foreground">
                mostrando 60 de {pool.length} — refine a busca.
              </p>
            ) : null}

            <label className="block">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                ou digite o identificador
              </span>
              <Input
                value={config.model}
                onChange={(event) =>
                  update({
                    model: event.target.value,
                    free: isFreeModel(event.target.value),
                    verifiedAt: null,
                  })
                }
                placeholder="ex.: gpt-4o-mini"
                spellCheck={false}
                className="mt-1"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <Button
              onClick={() => void runTest()}
              disabled={test.kind === "loading" || !config.model.trim() || !baseCheck.ok}
              aria-busy={test.kind === "loading"}
            >
              {test.kind === "loading" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <PlugZap className="mr-2 h-4 w-4" aria-hidden />
              )}
              testar conexão
            </Button>
            <span className="text-[11px] text-muted-foreground" aria-live="polite">
              {test.kind === "ok"
                ? `verificado há instantes · ${test.latencyMs} ms`
                : test.kind === "error"
                  ? test.message
                  : config.verifiedAt
                    ? `última verificação em ${new Date(config.verifiedAt).toLocaleString("pt-BR")}`
                    : "ainda não verificado"}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground">{describeProvider(config)}</p>
            <Button
              variant="ghost"
              onClick={() => {
                save({ ...defaultProviderConfig(), kind: "local" });
                setChoosing(true);
                setModels([]);
                setModelsState("idle");
                setModelsError(null);
                setModelQuery("");
                setQuery("");
                toast.success("provedor removido deste dispositivo");
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
              remover provedor
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {server === null
          ? "verificando o servidor…"
          : server.remoteConfigured
            ? `o servidor deste app também tem uma chave${server.model ? ` (${server.model})` : ""}; ela é usada quando você não escolhe um provedor.`
            : "sem chave padrão no servidor — o app depende da curadoria local ou do seu provedor."}
      </p>
    </section>
  );
}
