import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildLocalCard, buildLocalDossier } from "./card-engine";
import { cefrLevelSchema, dossierSchema, wordCardSchema } from "./types";
import type { Dossier, WordCard } from "./types";

const cardInput = z.object({
  term: z.string().min(1),
  norm: z.string().min(1),
  phrase: z.string().default(""),
  level: cefrLevelSchema,
});

const dossierInput = z.object({
  term: z.string().min(1),
  norm: z.string().min(1),
  level: cefrLevelSchema,
});

export type CardResponse =
  { ok: true; card: WordCard } | { ok: false; reason: string; remoteConfigured: boolean };

export type DossierResponse =
  { ok: true; dossier: Dossier } | { ok: false; reason: string; remoteConfigured: boolean };

/**
 * Card da palavra.
 *
 * 1. Curadoria local quando existe — é melhor e não custa nada.
 * 2. Provedor compatível com OpenAI quando `AI_API_KEY` existir no servidor.
 * 3. Sem nenhum dos dois: devolve o motivo, para o app mostrar `pending` honesto.
 *
 * A chave é lida **dentro** do handler: em module scope o Worker não a vê.
 */
export const generateCard = createServerFn({ method: "POST" })
  .inputValidator((data) => cardInput.parse(data))
  .handler(async ({ data }): Promise<CardResponse> => {
    const local = buildLocalCard(data.term, data.norm, data.level);
    if (local.ok) return { ok: true, card: local.card };

    const config = remoteConfig();
    if (!config) return { ok: false, reason: local.reason, remoteConfigured: false };

    const prompt = [
      `Palavra: "${data.term}" (lemma: ${data.norm})`,
      `Frase da letra onde ela aparece: "${data.phrase}"`,
      `Nível do estudante: ${data.level.toUpperCase()} (idioma alvo: português do Brasil)`,
      "Responda SOMENTE um JSON com as chaves: lemma, pos, register, literal, inPhrase, whyNot { synonym, verdict, reason }.",
      "literal = significado da palavra isolada, curto. inPhrase = o que ela significa NESTA frase e por que foi usada assim.",
      "verdict ∈ { wrong, right, mcbc } — mcbc = certo, mas menos cabível neste contexto. reason = uma linha de motivo.",
    ].join("\n");

    try {
      const payload = await callChat(config, prompt);
      const parsed = wordCardSchema.safeParse({
        term: data.term,
        ...payload,
        engine: "remote",
        generatedAt: Date.now(),
      });
      if (!parsed.success) {
        return {
          ok: false,
          reason: "o provedor devolveu um card incompleto",
          remoteConfigured: true,
        };
      }
      return { ok: true, card: parsed.data };
    } catch (error) {
      console.error("[verso] provedor de cards falhou", error);
      return {
        ok: false,
        reason: "o provedor de IA não respondeu — o card fica na fila",
        remoteConfigured: true,
      };
    }
  });

export const generateDossier = createServerFn({ method: "POST" })
  .inputValidator((data) => dossierInput.parse(data))
  .handler(async ({ data }): Promise<DossierResponse> => {
    const local = buildLocalDossier(data.norm);
    if (local) return { ok: true, dossier: local };

    const config = remoteConfig();
    if (!config) {
      return {
        ok: false,
        reason: "esta palavra não tem dossiê curado — conecte um provedor de IA em Ajustes",
        remoteConfigured: false,
      };
    }

    const prompt = [
      `Palavra: "${data.term}" (lemma: ${data.norm}), nível ${data.level.toUpperCase()}, português do Brasil.`,
      "Responda SOMENTE um JSON: commonUses[], collocations[], register, confusables[{term,note}], avoid[].",
      "confusables inclui falsos cognatos com português quando existirem. avoid = o que um aprendiz erra ao usar.",
    ].join("\n");

    try {
      const payload = await callChat(config, prompt);
      const parsed = dossierSchema.safeParse({
        ...payload,
        engine: "remote",
        generatedAt: Date.now(),
      });
      if (!parsed.success) {
        return { ok: false, reason: "o dossiê veio incompleto", remoteConfigured: true };
      }
      return { ok: true, dossier: parsed.data };
    } catch (error) {
      console.error("[verso] provedor de dossiê falhou", error);
      return { ok: false, reason: "o provedor de IA não respondeu", remoteConfigured: true };
    }
  });

/** Ajustes mostra isto: sem chave no servidor, o app usa a curadoria local. */
export const providerStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ remoteConfigured: boolean; model: string | null }> => {
    const config = remoteConfig();
    return { remoteConfigured: Boolean(config), model: config?.model ?? null };
  },
);

type RemoteConfig = { apiKey: string; baseUrl: string; model: string };

function remoteConfig(): RemoteConfig | null {
  const apiKey = process.env["AI_API_KEY"];
  if (!apiKey) return null;
  const baseUrl = (process.env["AI_BASE_URL"] ?? "https://ai.gateway.lovable.dev/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env["AI_MODEL"] ?? "google/gemini-2.5-flash";
  return { apiKey, baseUrl, model };
}

async function callChat(config: RemoteConfig, prompt: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você é lexicógrafo de inglês para brasileiros. Responde apenas JSON válido, sem comentários.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`provider ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty completion");
  return JSON.parse(content) as Record<string, unknown>;
}
