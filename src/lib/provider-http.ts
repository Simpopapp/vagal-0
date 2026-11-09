import type {
  DiscoveredModel,
  ProviderAdapter,
  ProviderError,
  ProviderErrorCode,
  ProviderRequest,
} from "./types";
import { isFreeModel } from "./providers";

/**
 * Montagem e leitura de requisições dos três adaptadores. Tudo aqui é função
 * pura (sem `fetch`) para poder ser testado sem rede.
 */

export const MODELS_TIMEOUT_MS = 8_000;
export const TEST_TIMEOUT_MS = 12_000;
export const CHAT_TIMEOUT_MS = 30_000;
export const MAX_PAYLOAD_BYTES = 512 * 1024;

const ANTHROPIC_VERSION = "2023-06-01";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = { json?: boolean; maxTokens?: number; temperature?: number };

export type ProviderHttpRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export function providerError(
  code: ProviderErrorCode,
  message: string,
  status?: number,
): ProviderError {
  return status === undefined ? { code, message } : { code, message, status };
}

function authHeaders(adapter: ProviderAdapter, apiKey: string): Record<string, string> {
  const key = apiKey.trim();
  switch (adapter) {
    case "anthropic":
      return {
        "Content-Type": "application/json",
        "anthropic-version": ANTHROPIC_VERSION,
        ...(key ? { "x-api-key": key } : {}),
      };
    case "google":
      // Chave em header, nunca em query string (URL vaza em log/histórico).
      return {
        "Content-Type": "application/json",
        ...(key ? { "x-goog-api-key": key } : {}),
      };
    default:
      return {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      };
  }
}

export function modelsRequest(config: ProviderRequest): {
  url: string;
  headers: Record<string, string>;
} {
  return {
    url: `${config.baseUrl.replace(/\/$/, "")}/models`,
    headers: { Accept: "application/json", ...authHeaders(config.adapter, config.apiKey) },
  };
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function listFrom(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const body = record(payload);
  if (!body) return [];
  for (const key of ["data", "models", "results"]) {
    const value = body[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Converte a listagem de cada provedor em `DiscoveredModel[]`, filtrando o que
 * não serve para chat, removendo prefixos e duplicatas.
 */
export function parseModels(adapter: ProviderAdapter, payload: unknown): DiscoveredModel[] {
  const items = listFrom(payload);
  const byId = new Map<string, DiscoveredModel>();

  for (const item of items) {
    const entry = record(item);
    if (!entry) continue;

    if (adapter === "google") {
      const methods = Array.isArray(entry["supportedGenerationMethods"])
        ? (entry["supportedGenerationMethods"] as unknown[]).map(textOf)
        : [];
      if (methods.length > 0 && !methods.includes("generateContent")) continue;
      const rawName = textOf(entry["name"]).replace(/^models\//, "");
      if (!rawName) continue;
      byId.set(rawName, {
        id: rawName,
        label: textOf(entry["displayName"]) || rawName,
        free: isFreeModel(rawName),
      });
      continue;
    }

    const id = textOf(entry["id"]);
    if (!id) continue;
    const label = textOf(entry["display_name"]) || textOf(entry["name"]) || id;
    byId.set(id, { id, label, free: isFreeModel(id) });
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Monta o pedido de chat conforme o adaptador. A chave nunca vai no corpo. */
export function chatRequest(
  config: ProviderRequest,
  messages: ChatMessage[],
  options: ChatOptions = {},
): ProviderHttpRequest {
  const base = config.baseUrl.replace(/\/$/, "");
  const temperature = options.temperature ?? 0.2;
  const headers = authHeaders(config.adapter, config.apiKey);

  if (config.adapter === "anthropic") {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const turns = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    return {
      url: `${base}/messages`,
      headers,
      body: {
        model: config.model,
        max_tokens: options.maxTokens ?? 1024,
        temperature,
        ...(system ? { system } : {}),
        messages: turns,
      },
    };
  }

  if (config.adapter === "google") {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    return {
      url: `${base}/models/${encodeURIComponent(config.model)}:generateContent`,
      headers,
      body: {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: options.maxTokens ?? 1024,
          ...(options.json ? { responseMimeType: "application/json" } : {}),
        },
      },
    };
  }

  return {
    url: `${base}/chat/completions`,
    headers,
    body: {
      model: config.model,
      temperature,
      messages,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    },
  };
}

function joinParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      const entry = record(part);
      if (!entry) return "";
      return typeof entry["text"] === "string" ? entry["text"] : "";
    })
    .join("")
    .trim();
}

/** Extrai o texto da resposta de cada adaptador. */
export function parseChat(adapter: ProviderAdapter, payload: unknown): string {
  const body = record(payload);
  if (!body) return "";

  if (adapter === "anthropic") {
    return joinParts(body["content"]);
  }

  if (adapter === "google") {
    const candidates = body["candidates"];
    if (!Array.isArray(candidates) || candidates.length === 0) return "";
    const content = record(record(candidates[0])?.["content"]);
    return joinParts(content?.["parts"]);
  }

  const choices = body["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = record(record(choices[0])?.["message"]);
  const content = message?.["content"];
  if (typeof content === "string") return content.trim();
  return joinParts(content);
}

/** Remove cercas de código e devolve o primeiro objeto JSON do texto. */
export function extractJson(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^\s*```[a-zA-Z]*\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("resposta sem JSON");
  }
  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  const body = record(parsed);
  if (!body) throw new Error("resposta sem JSON");
  return body;
}

const BASE_URL_HINT: Record<ProviderAdapter, string> = {
  openai: "ela costuma terminar em /v1",
  anthropic: "ela costuma terminar em /v1",
  google: "ela costuma terminar em /v1beta",
};

/** Traduz o status HTTP em um erro com frase acionável. */
export function mapHttpError(status: number, adapter: ProviderAdapter = "openai"): ProviderError {
  if (status === 401 || status === 403) {
    return providerError(
      "auth",
      `a chave foi recusada (${status}). Confira se copiou inteira e se ela vale para este provedor.`,
      status,
    );
  }
  if (status === 402) {
    return providerError(
      "quota",
      "o provedor pediu créditos (402). Escolha um modelo gratuito ou adicione saldo.",
      status,
    );
  }
  if (status === 404) {
    return providerError(
      "not_found",
      `este endereço não respondeu (404). Confira a URL base — ${BASE_URL_HINT[adapter]}.`,
      status,
    );
  }
  if (status === 429) {
    return providerError(
      "rate_limit",
      "o provedor pediu para esperar (429). Tente de novo em alguns segundos.",
      status,
    );
  }
  if (status === 400 || status === 422) {
    return providerError(
      "bad_response",
      `o provedor recusou o pedido (${status}). Confira se o modelo escolhido existe nesse provedor.`,
      status,
    );
  }
  if (status >= 500) {
    return providerError(
      "network",
      `o provedor teve uma falha interna (${status}). Tente de novo em instantes.`,
      status,
    );
  }
  return providerError("bad_response", `o provedor respondeu ${status}.`, status);
}

export function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}
