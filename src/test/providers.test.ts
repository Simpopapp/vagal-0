import { describe, expect, it } from "vitest";

import {
  chatRequest,
  extractJson,
  mapHttpError,
  modelsRequest,
  parseChat,
  parseModels,
} from "../lib/provider-http";
import {
  CUSTOM_PROVIDER_ID,
  PROVIDERS,
  configFromDefinition,
  defaultProviderConfig,
  isFreeModel,
  isUsableProvider,
  migrateProviderConfig,
  providerById,
  providerRequest,
  providersInGroup,
  sanitizeBaseUrl,
} from "../lib/providers";
import type { ProviderRequest } from "../lib/types";

const openai: ProviderRequest = {
  providerId: "openai",
  adapter: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "sk-test-123",
};

describe("catálogo de provedores", () => {
  it("não tem ids duplicados e toda URL é http(s) absoluta", () => {
    const ids = PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const provider of PROVIDERS) {
      if (!provider.baseUrl) {
        expect(provider.id).toBe(CUSTOM_PROVIDER_ID);
        continue;
      }
      expect(provider.baseUrl).toMatch(/^https?:\/\//);
      expect(() => new URL(provider.baseUrl)).not.toThrow();
    }
  });

  it("oferece pelo menos 6 gratuitos e 4 locais", () => {
    expect(providersInGroup("free").length).toBeGreaterThanOrEqual(6);
    expect(providersInGroup("local").length).toBeGreaterThanOrEqual(4);
  });

  it("todo provedor aponta um adaptador conhecido", () => {
    for (const provider of PROVIDERS) {
      expect(["openai", "anthropic", "google"]).toContain(provider.adapter);
    }
  });
});

describe("saneamento da URL base", () => {
  it("remove barra final e espaços", () => {
    const result = sanitizeBaseUrl("  https://api.exemplo.com/v1/  ");
    expect(result).toEqual({ ok: true, value: "https://api.exemplo.com/v1" });
  });

  it("remove sufixo de endpoint colado e avisa", () => {
    const result = sanitizeBaseUrl("https://api.exemplo.com/v1/chat/completions");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("https://api.exemplo.com/v1");
      expect(result.note).toContain("/chat/completions");
    }
  });

  it("aceita caminho mais profundo sem inventar prefixo", () => {
    const result = sanitizeBaseUrl("http://localhost:11434/v1/");
    expect(result).toEqual({ ok: true, value: "http://localhost:11434/v1" });
  });

  it("recusa esquema que não é http(s)", () => {
    expect(sanitizeBaseUrl("ftp://arquivo.local/v1").ok).toBe(false);
    expect(sanitizeBaseUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("recusa espaço no meio e credenciais embutidas", () => {
    expect(sanitizeBaseUrl("https://api exemplo.com/v1").ok).toBe(false);
    expect(sanitizeBaseUrl("https://user:senha@api.exemplo.com/v1").ok).toBe(false);
  });

  it("recusa vazio e texto que não é URL", () => {
    expect(sanitizeBaseUrl("   ").ok).toBe(false);
    expect(sanitizeBaseUrl("api.exemplo.com").ok).toBe(false);
  });
});

describe("listagem de modelos por adaptador", () => {
  it("lê o formato OpenAI e marca gratuitos", () => {
    const models = parseModels("openai", {
      data: [
        { id: "z-model" },
        { id: "a-model" },
        { id: "deepseek/deepseek-chat:free" },
        { id: "a-model" },
      ],
    });
    expect(models.map((model) => model.id)).toEqual([
      "a-model",
      "deepseek/deepseek-chat:free",
      "z-model",
    ]);
    expect(models.find((model) => model.id.endsWith(":free"))?.free).toBe(true);
  });

  it("lê o formato Anthropic com display_name", () => {
    const models = parseModels("anthropic", {
      data: [{ id: "claude-3-5-haiku-latest", display_name: "Claude Haiku 3.5" }],
    });
    expect(models).toEqual([
      { id: "claude-3-5-haiku-latest", label: "Claude Haiku 3.5", free: false },
    ]);
  });

  it("lê o formato Google, filtra generateContent e tira o prefixo models/", () => {
    const models = parseModels("google", {
      models: [
        {
          name: "models/gemini-2.5-flash",
          displayName: "Gemini 2.5 Flash",
          supportedGenerationMethods: ["generateContent"],
        },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
        {
          name: "models/gemini-2.5-pro",
          supportedGenerationMethods: ["generateContent", "countTokens"],
        },
      ],
    });
    expect(models.map((model) => model.id)).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
  });

  it("devolve lista vazia quando a resposta não tem modelos", () => {
    expect(parseModels("openai", { data: [] })).toEqual([]);
    expect(parseModels("openai", { nada: true })).toEqual([]);
  });
});

describe("requisição de modelos", () => {
  it("usa Bearer no adaptador OpenAI", () => {
    const request = modelsRequest(openai);
    expect(request.url).toBe("https://api.openai.com/v1/models");
    expect(request.headers["Authorization"]).toBe("Bearer sk-test-123");
  });

  it("usa x-goog-api-key no Google, nunca a chave na URL", () => {
    const request = modelsRequest({
      ...openai,
      adapter: "google",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "g-key",
    });
    expect(request.url).not.toContain("g-key");
    expect(request.headers["x-goog-api-key"]).toBe("g-key");
  });

  it("usa x-api-key e versão no Anthropic", () => {
    const request = modelsRequest({
      ...openai,
      adapter: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
    });
    expect(request.headers["x-api-key"]).toBe("sk-test-123");
    expect(request.headers["anthropic-version"]).toBeTruthy();
  });
});

describe("requisição de chat", () => {
  const messages = [
    { role: "system" as const, content: "sistema" },
    { role: "user" as const, content: "olá" },
  ];

  it("monta chat/completions com JSON quando pedido", () => {
    const request = chatRequest(openai, messages, { json: true, maxTokens: 50 });
    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.body["response_format"]).toEqual({ type: "json_object" });
    expect(request.body["max_tokens"]).toBe(50);
    expect(JSON.stringify(request.body)).not.toContain("sk-test-123");
  });

  it("separa system e envia max_tokens explícito no Anthropic", () => {
    const request = chatRequest(
      { ...openai, adapter: "anthropic", baseUrl: "https://api.anthropic.com/v1" },
      messages,
      { json: true },
    );
    expect(request.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request.body["system"]).toBe("sistema");
    expect(request.body["max_tokens"]).toBeGreaterThan(0);
    expect((request.body["messages"] as unknown[]).length).toBe(1);
  });

  it("codifica o modelo no caminho do Google e pede JSON", () => {
    const request = chatRequest(
      {
        ...openai,
        adapter: "google",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-2.5-flash",
      },
      messages,
      { json: true },
    );
    expect(request.url).toContain("/models/gemini-2.5-flash:generateContent");
    const config = request.body["generationConfig"] as Record<string, unknown>;
    expect(config["responseMimeType"]).toBe("application/json");
  });
});

describe("leitura da resposta", () => {
  it("lê texto dos três formatos", () => {
    expect(parseChat("openai", { choices: [{ message: { content: "ok" } }] })).toBe("ok");
    expect(parseChat("anthropic", { content: [{ type: "text", text: "ok" }] })).toBe("ok");
    expect(parseChat("google", { candidates: [{ content: { parts: [{ text: "ok" }] } }] })).toBe(
      "ok",
    );
  });

  it("devolve vazio quando a resposta não tem texto", () => {
    expect(parseChat("openai", {})).toBe("");
    expect(parseChat("google", { candidates: [] })).toBe("");
  });

  it("extrai JSON mesmo com cerca de código", () => {
    expect(extractJson('```json\n{"lemma":"go"}\n```')).toEqual({ lemma: "go" });
    expect(() => extractJson("sem json aqui")).toThrow();
  });
});

describe("erros de provedor", () => {
  it("traduz status em código e frase", () => {
    expect(mapHttpError(401).code).toBe("auth");
    expect(mapHttpError(403).code).toBe("auth");
    expect(mapHttpError(402).code).toBe("quota");
    expect(mapHttpError(404).code).toBe("not_found");
    expect(mapHttpError(429).code).toBe("rate_limit");
    expect(mapHttpError(400).code).toBe("bad_response");
    expect(mapHttpError(503).code).toBe("network");
    expect(mapHttpError(401).message).toContain("chave");
  });
});

describe("custo do modelo", () => {
  it("reconhece sufixos gratuitos", () => {
    expect(isFreeModel("deepseek/deepseek-chat:free")).toBe(true);
    expect(isFreeModel("llama-3-free")).toBe(true);
    expect(isFreeModel("gpt-4o-mini")).toBe(false);
  });
});

describe("configuração e migração", () => {
  it("parte da curadoria local com o provedor OpenAI pré-preenchido", () => {
    const config = defaultProviderConfig();
    expect(config.kind).toBe("local");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
    expect(isUsableProvider(config)).toBe(false);
  });

  it("escolher um provedor preenche URL e adaptador", () => {
    const groq = providerById("groq");
    expect(groq).toBeTruthy();
    if (!groq) return;
    const config = configFromDefinition(groq);
    expect(config.kind).toBe("remote");
    expect(config.adapter).toBe("openai");
    expect(config.baseUrl).toContain("api.groq.com");
    expect(isUsableProvider(config)).toBe(false);
  });

  it("preserva chave e modelo ao reescolher o mesmo provedor", () => {
    const custom = providerById(CUSTOM_PROVIDER_ID);
    if (!custom) throw new Error("custom ausente");
    const first = {
      ...configFromDefinition(custom),
      baseUrl: "https://x.dev/v1",
      model: "m1",
      apiKey: "k",
    };
    const again = configFromDefinition(custom, first);
    expect(again.model).toBe("m1");
    expect(again.apiKey).toBe("k");
  });

  it("monta o payload do servidor só com config usável", () => {
    const config = {
      ...defaultProviderConfig(),
      kind: "remote" as const,
      baseUrl: "https://api.exemplo.com/v1/",
      model: " m1 ",
      apiKey: "chave",
    };
    const request = providerRequest(config);
    expect(request?.baseUrl).toBe("https://api.exemplo.com/v1");
    expect(request?.model).toBe("m1");
    expect(providerRequest({ ...config, model: "" })).toBeUndefined();
  });

  it("migra o shape antigo preservando URL e modelo", () => {
    const migrated = migrateProviderConfig({
      kind: "remote",
      baseUrl: "https://meu.dev/v1",
      model: "m1",
    });
    expect(migrated.kind).toBe("remote");
    expect(migrated.providerId).toBe(CUSTOM_PROVIDER_ID);
    expect(migrated.baseUrl).toBe("https://meu.dev/v1");
    expect(migrated.model).toBe("m1");
    expect(migrated.apiKey).toBe("");
    expect(migrated.verifiedAt).toBeNull();
  });

  it("migra estado ausente ou inválido para o padrão", () => {
    expect(migrateProviderConfig(undefined).kind).toBe("local");
    expect(migrateProviderConfig("lixo").kind).toBe("local");
    expect(migrateProviderConfig({ adapter: "desconhecido" }).adapter).toBe("openai");
  });

  it("mantém o shape novo intacto", () => {
    const current = {
      ...defaultProviderConfig(),
      kind: "remote" as const,
      providerId: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "x:free",
      apiKey: "sk",
      free: true,
      verifiedAt: 123,
    };
    expect(migrateProviderConfig(current)).toEqual(current);
  });
});
