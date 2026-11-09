import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildLocalCard, buildLocalDossier } from "./card-engine";
import {
  CHAT_TIMEOUT_MS,
  MAX_PAYLOAD_BYTES,
  MODELS_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  chatRequest,
  extractJson,
  isTimeoutError,
  mapHttpError,
  modelsRequest,
  parseChat,
  parseModels,
  providerError,
} from "./provider-http";
import { sanitizeBaseUrl } from "./providers";
import { cefrLevelSchema, dossierSchema, providerAdapterSchema, wordCardSchema } from "./types";
import type {
  DiscoveredModel,
  Dossier,
  ProviderError,
  ProviderErrorCode,
  ProviderRequest,
  WordCard,
} from "./types";

const cardInput = z.object({
  term: z.string().min(1),
  norm: z.string().min(1),
  phrase: z.string().default(""),
  level: cefrLevelSchema,
  provider: z.unknown().optional(),
});

const dossierInput = z.object({
  term: z.string().min(1),
  norm: z.string().min(1),
  level: cefrLevelSchema,
  provider: z.unknown().optional(),
});

/** Configuração que veio do dispositivo — validada, nunca persistida no servidor. */
const providerPayload = z.object({
  providerId: z.string().min(1).max(60),
  adapter: providerAdapterSchema,
  baseUrl: z.string().min(1).max(300),
  model: z.string().max(120).default(""),
  apiKey: z.string().max(512).default(""),
});

type ProviderPayload = z.infer<typeof providerPayload>;

export type CardResponse =
  | { ok: true; card: WordCard; via: "local" | "device" | "server" }
  | { ok: false; reason: string; code: ProviderErrorCode; remoteConfigured: boolean };

export type DossierResponse =
  | { ok: true; dossier: Dossier; via: "local" | "device" | "server" }
  | { ok: false; reason: string; code: ProviderErrorCode; remoteConfigured: boolean };

export type ModelsResponse =
  { ok: true; models: DiscoveredModel[]; fetchedAt: number } | { ok: false; error: ProviderError };

export type TestResponse =
  | { ok: true; latencyMs: number; model: string; adapter: ProviderRequest["adapter"] }
  | { ok: false; error: ProviderError };

/**
 * Card da palavra.
 *
 * Precedência: curadoria local → provedor do dispositivo → ambiente do servidor.
 * A chave de ambiente é lida **dentro** do handler: em module scope o Worker não
 * a vê.
 */
export const generateCard = createServerFn({ method: "POST" })
  .inputValidator((data) => cardInput.parse(data))
  .handler(async ({ data }): Promise<CardResponse> => {
    const local = buildLocalCard(data.term, data.norm, data.level);
    if (local.ok) return { ok: true, card: local.card, via: "local" };

    const remote = resolveRemote(data.provider);
    if (!remote) {
      return {
        ok: false,
        reason: `${local.reason} — configure um provedor em Ajustes`,
        code: "invalid_input",
        remoteConfigured: false,
      };
    }

    const prompt = [
      `Palavra: "${data.term}" (lemma: ${data.norm})`,
      `Frase da letra onde ela aparece: "${data.phrase}"`,
      `Nível do estudante: ${data.level.toUpperCase()} (idioma alvo: português do Brasil)`,
      "Responda SOMENTE um JSON com as chaves: lemma, pos, register, literal, inPhrase, whyNot { synonym, verdict, reason }.",
      "literal = significado da palavra isolada, curto. inPhrase = o que ela significa NESTA frase e por que foi usada assim.",
      "verdict ∈ { wrong, right, mcbc } — mcbc = certo, mas menos cabível neste contexto. reason = uma linha de motivo.",
    ].join("\n");

    try {
      const payload = await callChat(remote.config, prompt, { maxTokens: 900 });
      const parsed = wordCardSchema.safeParse({
        term: data.term,
        ...payload,
        engine: "remote",
        generatedAt: Date.now(),
      });
      if (!parsed.success) {
        return {
          ok: false,
          reason: "o provedor devolveu um card incompleto — tente outra vez ou troque de modelo",
          code: "bad_response",
          remoteConfigured: true,
        };
      }
      return { ok: true, card: parsed.data, via: remote.via };
    } catch (error) {
      const failure = asProviderError(error);
      console.error("[verso] provedor de cards falhou", failure.code, failure.status ?? "");
      return {
        ok: false,
        reason: failure.message,
        code: failure.code,
        remoteConfigured: true,
      };
    }
  });

export const generateDossier = createServerFn({ method: "POST" })
  .inputValidator((data) => dossierInput.parse(data))
  .handler(async ({ data }): Promise<DossierResponse> => {
    const local = buildLocalDossier(data.norm);
    if (local) return { ok: true, dossier: local, via: "local" };

    const remote = resolveRemote(data.provider);
    if (!remote) {
      return {
        ok: false,
        reason: "esta palavra não tem dossiê curado — conecte um provedor em Ajustes",
        code: "invalid_input",
        remoteConfigured: false,
      };
    }

    const prompt = [
      `Palavra: "${data.term}" (lemma: ${data.norm}), nível ${data.level.toUpperCase()}, português do Brasil.`,
      "Responda SOMENTE um JSON: commonUses[], collocations[], register, confusables[{term,note}], avoid[].",
      "confusables inclui falsos cognatos com português quando existirem. avoid = o que um aprendiz erra ao usar.",
    ].join("\n");

    try {
      const payload = await callChat(remote.config, prompt, { maxTokens: 900 });
      const parsed = dossierSchema.safeParse({
        ...payload,
        engine: "remote",
        generatedAt: Date.now(),
      });
      if (!parsed.success) {
        return {
          ok: false,
          reason: "o dossiê veio incompleto — tente outra vez ou troque de modelo",
          code: "bad_response",
          remoteConfigured: true,
        };
      }
      return { ok: true, dossier: parsed.data, via: remote.via };
    } catch (error) {
      const failure = asProviderError(error);
      console.error("[verso] provedor de dossiê falhou", failure.code, failure.status ?? "");
      return {
        ok: false,
        reason: failure.message,
        code: failure.code,
        remoteConfigured: true,
      };
    }
  });

/** Lista os modelos reais do provedor. Falha tem código e frase própria. */
export const listProviderModels = createServerFn({ method: "POST" })
  .inputValidator((data) => providerPayload.parse(data))
  .handler(async ({ data }): Promise<ModelsResponse> => {
    const config = toRequest(data);
    if (!config.ok) return { ok: false, error: config.error };

    const { url, headers } = modelsRequest(config.config);
    const result = await requestJson(
      url,
      { method: "GET", headers },
      MODELS_TIMEOUT_MS,
      config.config.adapter,
    );
    if (!result.ok) return { ok: false, error: result.error };

    const models = parseModels(config.config.adapter, result.data);
    return { ok: true, models, fetchedAt: Date.now() };
  });

/** Requisição mínima de chat: prova que chave + modelo respondem. */
export const testProvider = createServerFn({ method: "POST" })
  .inputValidator((data) => providerPayload.parse(data))
  .handler(async ({ data }): Promise<TestResponse> => {
    const config = toRequest(data);
    if (!config.ok) return { ok: false, error: config.error };
    if (!config.config.model) {
      return {
        ok: false,
        error: providerError("invalid_input", "escolha um modelo antes de testar"),
      };
    }

    const request = chatRequest(
      config.config,
      [
        { role: "system", content: "Responda somente JSON válido." },
        { role: "user", content: 'Responda somente {"ok":true}.' },
      ],
      { json: true, temperature: 0, maxTokens: 24 },
    );

    const startedAt = Date.now();
    const result = await requestJson(
      request.url,
      {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
      },
      TEST_TIMEOUT_MS,
      config.config.adapter,
    );
    if (!result.ok) return { ok: false, error: result.error };

    const text = parseChat(config.config.adapter, result.data);
    if (!text) {
      return {
        ok: false,
        error: providerError("bad_response", "o modelo respondeu vazio — troque de modelo"),
      };
    }

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      model: config.config.model,
      adapter: config.config.adapter,
    };
  });

/** Ajustes mostra as duas camadas: provedor do dispositivo e padrão do servidor. */
export const providerStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ remoteConfigured: boolean; model: string | null }> => {
    const env = envConfig();
    return { remoteConfigured: Boolean(env), model: env?.model ?? null };
  },
);

/* ——— infraestrutura ——— */

type RemoteResolution = { config: ProviderRequest; via: "device" | "server" };

class ProviderFailure extends Error {
  readonly error: ProviderError;
  constructor(error: ProviderError) {
    super(error.message);
    this.error = error;
  }
}

function asProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderFailure) return error.error;
  return providerError("bad_response", "o provedor devolveu uma resposta inesperada");
}

function toRequest(
  data: ProviderPayload,
): { ok: true; config: ProviderRequest } | { ok: false; error: ProviderError } {
  const base = sanitizeBaseUrl(data.baseUrl);
  if (!base.ok) {
    return { ok: false, error: providerError("invalid_input", base.error) };
  }
  return {
    ok: true,
    config: {
      providerId: data.providerId,
      adapter: data.adapter,
      baseUrl: base.value,
      model: data.model.trim(),
      apiKey: data.apiKey.trim(),
    },
  };
}

function envConfig(): ProviderRequest | null {
  const apiKey = process.env["AI_API_KEY"];
  if (!apiKey) return null;
  const baseUrl = (process.env["AI_BASE_URL"] ?? "https://ai.gateway.lovable.dev/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env["AI_MODEL"] ?? "google/gemini-2.5-flash";
  return { providerId: "servidor", adapter: "openai", baseUrl, model, apiKey };
}

function resolveRemote(raw: unknown): RemoteResolution | null {
  if (raw !== undefined && raw !== null) {
    const parsed = providerPayload.safeParse(raw);
    if (!parsed.success) return null;
    const config = toRequest(parsed.data);
    if (!config.ok) return null;
    return { config: config.config, via: "device" };
  }
  const env = envConfig();
  return env ? { config: env, via: "server" } : null;
}

type FetchResult = { ok: true; data: unknown } | { ok: false; error: ProviderError };

async function requestJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  adapter: ProviderRequest["adapter"],
): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        ok: false,
        error: providerError(
          "timeout",
          `o provedor não respondeu em ${Math.round(timeoutMs / 1000)} s.`,
        ),
      };
    }
    return {
      ok: false,
      error: providerError(
        "network",
        "não foi possível alcançar esse endereço. Se for um servidor local, confira se ele está rodando e acessível a partir do app.",
      ),
    };
  }

  if (!response.ok) {
    return { ok: false, error: mapHttpError(response.status, adapter) };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return {
      ok: false,
      error: providerError("bad_response", "a resposta do provedor foi interrompida"),
    };
  }

  if (text.length > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      error: providerError("bad_response", "o provedor devolveu uma resposta grande demais"),
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      error: providerError("bad_response", "o provedor não devolveu JSON — confira a URL base"),
    };
  }
}

async function callChat(
  config: ProviderRequest,
  prompt: string,
  options: { maxTokens?: number } = {},
): Promise<Record<string, unknown>> {
  const request = chatRequest(
    config,
    [
      {
        role: "system",
        content:
          "Você é lexicógrafo de inglês para brasileiros. Responde apenas JSON válido, sem comentários.",
      },
      { role: "user", content: prompt },
    ],
    { json: true, temperature: 0.2, maxTokens: options.maxTokens ?? 900 },
  );

  const result = await requestJson(
    request.url,
    {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
    },
    CHAT_TIMEOUT_MS,
    config.adapter,
  );
  if (!result.ok) throw new ProviderFailure(result.error);

  const text = parseChat(config.adapter, result.data);
  if (!text) throw new ProviderFailure(providerError("bad_response", "o modelo respondeu vazio"));

  try {
    return extractJson(text);
  } catch {
    throw new ProviderFailure(
      providerError("bad_response", "o modelo não devolveu JSON — troque de modelo"),
    );
  }
}
