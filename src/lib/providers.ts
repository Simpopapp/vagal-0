import type { ProviderAdapter, ProviderConfig, ProviderKind, ProviderRequest } from "./types";

/**
 * Catálogo de provedores — dado, não condicional.
 *
 * Toda diferença entre provedores mora aqui e nos três adaptadores de
 * `provider-http.ts`. A UI só lê este catálogo.
 */

export type ProviderGroup = "free" | "local" | "main" | "custom";

export type ProviderDefinition = {
  id: string;
  name: string;
  group: ProviderGroup;
  adapter: ProviderAdapter;
  /** Vazio apenas no provedor personalizado. */
  baseUrl: string;
  keyRequired: boolean;
  keyUrl?: string;
  note: string;
  /** Sugestões usadas só quando a listagem remota falha. */
  curatedModels: string[];
};

export const GROUP_LABELS: Record<ProviderGroup, string> = {
  free: "grátis agora",
  local: "locais",
  main: "principais",
  custom: "personalizado",
};

export const GROUP_ORDER: ProviderGroup[] = ["free", "local", "main", "custom"];

export const PROVIDERS: ProviderDefinition[] = [
  // ——— grátis ———
  {
    id: "google-ai-studio",
    name: "Google AI Studio (Gemini)",
    group: "free",
    adapter: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyRequired: true,
    keyUrl: "https://aistudio.google.com/apikey",
    note: "faixa gratuita com limites por minuto",
    curatedModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  {
    id: "groq",
    name: "Groq",
    group: "free",
    adapter: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keyRequired: true,
    keyUrl: "https://console.groq.com/keys",
    note: "faixa gratuita, geração muito rápida",
    curatedModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    group: "free",
    adapter: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    keyRequired: true,
    keyUrl: "https://cloud.cerebras.ai",
    note: "faixa gratuita para modelos abertos",
    curatedModels: ["llama3.1-8b"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    group: "free",
    adapter: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyRequired: true,
    keyUrl: "https://openrouter.ai/keys",
    note: "centenas de modelos; os com :free saem de graça",
    curatedModels: [
      "deepseek/deepseek-chat-v3-0324:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
  },
  {
    id: "github-models",
    name: "GitHub Models",
    group: "free",
    adapter: "openai",
    baseUrl: "https://models.github.ai/inference",
    keyRequired: true,
    keyUrl: "https://github.com/settings/tokens",
    note: "uso gratuito com limite, usando um token do GitHub",
    curatedModels: ["openai/gpt-4o-mini", "meta/Llama-3.3-70B-Instruct"],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    group: "free",
    adapter: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    keyRequired: true,
    keyUrl: "https://console.mistral.ai",
    note: "plano experimental gratuito com limites",
    curatedModels: ["mistral-small-latest", "open-mistral-nemo"],
  },

  // ——— locais ———
  {
    id: "ollama",
    name: "Ollama",
    group: "local",
    adapter: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyRequired: false,
    note: "rode `ollama serve` na mesma máquina",
    curatedModels: [],
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    group: "local",
    adapter: "openai",
    baseUrl: "http://localhost:1234/v1",
    keyRequired: false,
    note: "ative o servidor local no LM Studio",
    curatedModels: [],
  },
  {
    id: "llamacpp",
    name: "llama.cpp",
    group: "local",
    adapter: "openai",
    baseUrl: "http://localhost:8080/v1",
    keyRequired: false,
    note: "servidor llama-server compatível com OpenAI",
    curatedModels: [],
  },
  {
    id: "vllm",
    name: "vLLM",
    group: "local",
    adapter: "openai",
    baseUrl: "http://localhost:8000/v1",
    keyRequired: false,
    note: "para quem já serve modelo em vLLM",
    curatedModels: [],
  },

  // ——— principais ———
  {
    id: "openai",
    name: "OpenAI",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyRequired: true,
    keyUrl: "https://platform.openai.com/api-keys",
    note: "modelos GPT",
    curatedModels: ["gpt-4o-mini", "gpt-4.1-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    group: "main",
    adapter: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keyRequired: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "modelos Claude",
    curatedModels: ["claude-3-5-haiku-latest", "claude-sonnet-4-5"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    keyRequired: true,
    keyUrl: "https://platform.deepseek.com",
    note: "barato para texto",
    curatedModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "xai",
    name: "xAI",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.x.ai/v1",
    keyRequired: true,
    keyUrl: "https://console.x.ai",
    note: "modelos Grok",
    curatedModels: ["grok-3-mini"],
  },
  {
    id: "together",
    name: "Together AI",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.together.xyz/v1",
    keyRequired: true,
    keyUrl: "https://api.together.ai/settings/api-keys",
    note: "modelos abertos hospedados",
    curatedModels: [],
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keyRequired: true,
    keyUrl: "https://fireworks.ai/account/api-keys",
    note: "inferência rápida de modelos abertos",
    curatedModels: [],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    group: "main",
    adapter: "openai",
    baseUrl: "https://router.huggingface.co/v1",
    keyRequired: true,
    keyUrl: "https://huggingface.co/settings/tokens",
    note: "roteador de modelos com créditos iniciais",
    curatedModels: [],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.moonshot.ai/v1",
    keyRequired: true,
    keyUrl: "https://platform.moonshot.ai",
    note: "modelos Kimi",
    curatedModels: ["kimi-k2-0905-preview"],
  },
  {
    id: "sambanova",
    name: "SambaNova",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.sambanova.ai/v1",
    keyRequired: true,
    keyUrl: "https://cloud.sambanova.ai",
    note: "modelos abertos com faixa gratuita",
    curatedModels: [],
  },
  {
    id: "cohere",
    name: "Cohere",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    keyRequired: true,
    keyUrl: "https://dashboard.cohere.com/api-keys",
    note: "camada compatível com OpenAI",
    curatedModels: ["command-r-plus"],
  },
  {
    id: "hyperbolic",
    name: "Hyperbolic",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    keyRequired: true,
    keyUrl: "https://app.hyperbolic.xyz",
    note: "modelos abertos",
    curatedModels: [],
  },
  {
    id: "nebius",
    name: "Nebius AI Studio",
    group: "main",
    adapter: "openai",
    baseUrl: "https://api.studio.nebius.ai/v1",
    keyRequired: true,
    keyUrl: "https://studio.nebius.ai",
    note: "modelos abertos",
    curatedModels: [],
  },

  // ——— personalizado ———
  {
    id: "custom",
    name: "Provedor próprio",
    group: "custom",
    adapter: "openai",
    baseUrl: "",
    keyRequired: false,
    note: "cole a URL base de qualquer serviço compatível",
    curatedModels: [],
  },
];

export const CUSTOM_PROVIDER_ID = "custom";

export function providerById(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function providersInGroup(group: ProviderGroup): ProviderDefinition[] {
  return PROVIDERS.filter((provider) => provider.group === group);
}

export function defaultProviderConfig(): ProviderConfig {
  const openai = providerById("openai");
  return {
    kind: "local",
    providerId: "openai",
    label: openai?.name ?? "OpenAI",
    adapter: "openai",
    baseUrl: openai?.baseUrl ?? "",
    model: "",
    apiKey: "",
    free: false,
    verifiedAt: null,
  };
}

/** Config nova a partir de uma entrada do catálogo, preservando o que já existe do mesmo provedor. */
export function configFromDefinition(
  definition: ProviderDefinition,
  previous?: ProviderConfig,
): ProviderConfig {
  const same = previous?.providerId === definition.id;
  return {
    kind: "remote",
    providerId: definition.id,
    label:
      definition.id === CUSTOM_PROVIDER_ID
        ? same
          ? (previous?.label ?? "")
          : ""
        : definition.name,
    adapter: same ? previous.adapter : definition.adapter,
    baseUrl: same ? previous.baseUrl : definition.baseUrl,
    model: same ? previous.model : "",
    apiKey: same ? previous.apiKey : "",
    free: same ? previous.free : false,
    verifiedAt: same ? previous.verifiedAt : null,
  };
}

const TRAILING_NOISE = ["/chat/completions", "/completions", "/models"];

export type BaseUrlResult =
  { ok: true; value: string; note?: string } | { ok: false; error: string };

/**
 * Normaliza a URL base colada pela pessoa: apara espaços, remove `/` final e
 * sufixos de endpoint colados por engano, e recusa o que não é http(s).
 */
export function sanitizeBaseUrl(raw: string): BaseUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "informe a URL base do provedor" };
  if (/\s/.test(trimmed)) return { ok: false, error: "o endereço tem um espaço no meio" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "esse endereço não parece uma URL (ex.: https://api.exemplo.com/v1)",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "use http:// ou https://" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "não coloque usuário e senha na URL — use o campo de chave" };
  }

  let path = url.pathname.replace(/\/+$/, "");
  let note: string | undefined;
  for (const noise of TRAILING_NOISE) {
    if (path.endsWith(noise)) {
      path = path.slice(0, -noise.length);
      note = `removi o "${noise}" do fim do endereço`;
      break;
    }
  }

  url.pathname = path;
  url.search = "";
  url.hash = "";
  const value = url.toString().replace(/\/$/, "");
  return note ? { ok: true, value, note } : { ok: true, value };
}

/** Modelo gratuito: sufixo `:free` (OpenRouter) ou `-free`. */
export function isFreeModel(id: string): boolean {
  return /:free$/i.test(id) || /-free$/i.test(id);
}

/** A configuração tem o mínimo para uma chamada remota? */
export function isUsableProvider(config: ProviderConfig | undefined | null): boolean {
  if (!config || config.kind !== "remote") return false;
  if (!config.model.trim()) return false;
  return sanitizeBaseUrl(config.baseUrl).ok;
}

/** Payload que o servidor recebe — ou `undefined` quando não há provedor usável. */
export function providerRequest(config: ProviderConfig): ProviderRequest | undefined {
  if (!isUsableProvider(config)) return undefined;
  const base = sanitizeBaseUrl(config.baseUrl);
  if (!base.ok) return undefined;
  return {
    providerId: config.providerId,
    adapter: config.adapter,
    baseUrl: base.value,
    model: config.model.trim(),
    apiKey: config.apiKey.trim(),
  };
}

type LegacyProvider = {
  kind?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  providerId?: unknown;
  label?: unknown;
  adapter?: unknown;
  apiKey?: unknown;
  free?: unknown;
  verifiedAt?: unknown;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Migra o shape antigo (`{kind, baseUrl, model}`) para o novo sem perder o que a
 * pessoa já tinha configurado. Entrada inválida cai no padrão.
 */
export function migrateProviderConfig(raw: unknown): ProviderConfig {
  const base = defaultProviderConfig();
  if (!raw || typeof raw !== "object") return base;
  const previous = raw as LegacyProvider;

  const kind: ProviderKind = previous.kind === "remote" ? "remote" : "local";
  const baseUrl = asString(previous.baseUrl);
  const model = asString(previous.model);
  const adapter: ProviderAdapter =
    previous.adapter === "anthropic" || previous.adapter === "google" ? previous.adapter : "openai";

  const providerId =
    asString(previous.providerId) || (baseUrl.trim() ? CUSTOM_PROVIDER_ID : "openai");
  const definition = providerById(providerId);
  const label =
    asString(previous.label) ||
    definition?.name ||
    (providerId === CUSTOM_PROVIDER_ID ? "" : providerId);

  return {
    kind,
    providerId,
    label,
    adapter,
    baseUrl: baseUrl.trim() ? baseUrl : (definition?.baseUrl ?? ""),
    model,
    apiKey: asString(previous.apiKey),
    free: previous.free === true,
    verifiedAt: typeof previous.verifiedAt === "number" ? previous.verifiedAt : null,
  };
}

/** Resumo curto do provedor para a interface. */
export function describeProvider(config: ProviderConfig): string {
  if (config.kind !== "remote") return "curadoria local";
  const model = config.model.trim() || "sem modelo";
  const cost = config.free ? "grátis" : "pago";
  return `${config.label || config.providerId} · ${model} · ${cost}`;
}
