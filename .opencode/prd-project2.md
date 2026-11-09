# PRD — project2: configuração de provedores de IA no Verso

**Versão:** 2.0 (reconstrução do project2)
**Data:** 2026-11-09
**Fonte de escopo:** `.opencode/project2.md` (planejamento)
**Precedência:** no QUÊ, o planejamento manda; no COMO, este PRD manda.

> Este PRD existe porque o project2 anterior foi entregue sem pilar de PRD e sem
> roadmap: virou um par de campos de texto na tela de Ajustes, sem catálogo, sem
> listagem de modelos, sem teste de conexão e sem custódia da chave. Este
> documento reconstrói o escopo a partir do planejamento, audita o que existe
> hoje e define, fase a fase, o que conta como entregue.

---

## 1. Sumário executivo

O Verso é um app de estudo de inglês pela letra da música. A curadoria local
cobre 122 palavras; tudo o resto (card de uma palavra desconhecida, dossiê,
veredito ✗/✓/◐) depende de um provedor de IA. Até hoje esse provedor só podia
ser configurado por variável de ambiente no servidor — invisível para quem usa o
app — e a tela de Ajustes oferecia dois campos livres (`base url`, `modelo`) que
não listavam nada, não validavam nada e não diziam se funcionavam.

O project2 é a peça que transforma isso em produto: um **catálogo de provedores**
com os principais serviços do mercado e alternativas gratuitas, inclusão de
**provedor próprio por URL base**, **listagem real de modelos** de cada provedor
para escolha em lista (com busca), **teste de conexão** que prova que a chave e o
modelo respondem, e **estado honesto** em toda a interface — inclusive quando
não há chave nenhuma, caso em que a curadoria local continua no comando.

O resultado precisa funcionar no navegador da pessoa, neste dispositivo, sem
conta e sem banco: a chave fica no `localStorage` e é enviada apenas nas chamadas
que o app faz ao seu próprio servidor para falar com o provedor escolhido.

---

## 2. Contexto: de onde vem este projeto

1. `project1` entregou o app: busca interpretada (Vagalume), leitura com marcação,
   vocabulário com dossiê e prática com SM-2. Domínio em `src/lib/`, estado no
   dispositivo (`verso.state.v1`), servidor sem banco.
2. O card remoto já existia, mas amarrado ao ambiente:
   `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, lidos dentro do handler de
   `src/lib/ai.functions.ts`. Sem chave no servidor, o app marca o card como
   `pending` e segue com a curadoria local.
3. O planejamento do `project2` (`.opencode/project2.md`) pediu: configuração de
   provedores na aba de Ajustes, escolha entre os principais provedores incluindo
   alternativas grátis, campo de URL base para provedor próprio e listagem de
   modelos de cada provedor para seleção.
4. O que foi entregue foi só o terceiro item pela metade: um seletor
   local/remoto e dois `Input` de texto. Não há catálogo, não há descoberta de
   modelos, não há chave por dispositivo, não há teste, não há migração de estado
   e o card remoto continua sem receber a configuração da pessoa.

Este PRD parte do planejamento, confirma no código o que ele afirma e fecha as
lacunas de decisão que o planejamento deixou em aberto.

---

## 3. Auditoria do estado atual (evidência no código)

| # | Fato verificado | Arquivo | Consequência |
|---|---|---|---|
| A1 | `settings.provider` tem apenas `{kind, baseUrl, model}` | `src/lib/types.ts` | não há identidade de provedor, chave, adaptador nem data de verificação |
| A2 | Ajustes mostra dois `Input` livres e um badge de status do servidor | `src/routes/settings.tsx` | a pessoa digita às cegas; nada lista modelos; nada prova que funciona |
| A3 | `generateCard`/`generateDossier` ignoram `settings.provider` e leem só `process.env` | `src/lib/ai.functions.ts` | a configuração local é decorativa: não altera o comportamento real |
| A4 | `providerStatus` informa apenas se há chave de ambiente | `src/lib/ai.functions.ts` | não distingue "servidor configurado" de "meu provedor ativo" |
| A5 | A fila de cards já respeita `provider.kind !== "remote"` | `src/lib/card-queue.ts` | o portão existe, mas não transporta a configuração |
| A6 | `hydrate()` faz merge raso de `settings` | `src/lib/store.ts` | qualquer mudança de shape em `provider` quebra estados já salvos |
| A7 | Não existe teste de provedores | `src/test/` | nada protege o contrato dos adaptadores |
| A8 | Não existe `prd-project2.md` nem `roadmap-proj2.md` | `.opencode/` | a entrega anterior não teve critério de aceite — por isso foi meia boca |

**Diagnóstico:** o recurso foi tratado como "dois campos a mais" quando, na
verdade, é uma camada de integração com N provedores, três formatos de API, uma
economia de custo (grátis primeiro) e uma superfície de erro que precisa ser
legível. A entrega anterior não é base; é rascunho descartável. O que se aproveita
dela: o toggle `kind` (local/remoto), a ideia de `baseUrl` editável e o badge de
status — todos reimplementados aqui com contrato.

---

## 4. Objetivo e não-objetivos

### 4.1 Objetivo

Uma pessoa sem conhecimento técnico consegue, em Ajustes:

1. Ver os provedores principais e as alternativas gratuitas, agrupados e
   explicados em uma linha cada.
2. Escolher um provedor, colar a chave (quando houver) e obter **a lista real de
   modelos** daquele provedor, escolhendo um modelo por busca.
3. Usar um provedor que não está na lista: digitar a URL base (e, se o serviço
   for compatível com OpenAI, o adaptador já vem certo) e listar os modelos dele.
4. **Testar a conexão** e ver, sem ambiguidade, que a chave e o modelo respondem —
   com a latência medida e o erro exato quando não respondem.
5. Ver, a qualquer momento, qual provedor e modelo estão ativos, se o modelo é
   gratuito e quando foi a última verificação.
6. Voltar para a curadoria local com um clique, sem perder vocabulário nem
   músicas.

### 4.2 Não-objetivos (nesta versão)

- Conta, login, sincronização entre dispositivos ou armazenamento de chave em
  servidor. **A chave é do dispositivo.**
- Roteamento automático entre provedores, fallback em cascata por custo, limites
  de gasto ou contabilidade de tokens.
- Streaming de resposta, chat livre, múltiplos modelos por palavra.
- Suporte a provedores sem API compatível, sem endpoint de modelos e sem
  adaptador implementado (áudio, imagem, embeddings ficam fora).
- Proxy de terceiros que exija OAuth interativo (login em navegador) — fora
  porque o servidor do app não hospeda callback.

---

## 5. Princípios de produto

1. **Grátis primeiro.** A lista abre com as opções gratuitas e locais. Quem não
   paga nada precisa conseguir usar o app inteiro; quem paga é uma escolha
   consciente, não o caminho padrão.
2. **A curadoria local ganha sempre.** Provedor remoto não substitui o card
   curado: quando existe curadoria, ela é usada, e isso é dito na interface.
3. **Estado honesto.** Nenhum "configurado" sem prova. Toda promessa de conexão
   tem um botão que a verifica e um resultado legível.
4. **Erro é conteúdo.** `401`, `404`, `429`, DNS e timeout têm mensagens
   próprias, com o próximo passo ("a chave foi recusada — confira se copiou
   inteira"), nunca um "algo deu errado".
5. **A chave nunca aparece.** `type=password` por padrão, nunca em log, nunca
   ecoada em mensagem de erro, nunca em URL.
6. **Nada quebra offline.** Configurar exige rede; ler, revisar e praticar não.
   Sem provedor, o app degrada para a curadoria local — nunca para uma tela
   morta.

---

## 6. Decisões de arquitetura

### D1 — Catálogo como dado, não como `if`

Os provedores vivem em uma estrutura de dados (`PROVIDERS`) e as três famílias de
API em três adaptadores (`openai`, `anthropic`, `google`). Nenhum componente de
UI contém condicional por nome de provedor; toda diferença é dado + adaptador.
Isso torna "adicionar um provedor" uma linha de catálogo, e é o que impede a
repetição que caracterizou a entrega anterior.

### D2 — Três adaptadores cobrem o mercado real

| Adaptador | Formato do chat | Listagem de modelos |
|---|---|---|
| `openai` | `POST {base}/chat/completions`, `Authorization: Bearer` | `GET {base}/models` → `data[].id` |
| `anthropic` | `POST {base}/messages`, `x-api-key` + `anthropic-version` | `GET {base}/models` → `data[].id` |
| `google` | `POST {base}/models/{model}:generateContent`, `x-goog-api-key` | `GET {base}/models` → `models[].name` (filtrar `generateContent`, remover prefixo `models/`) |

A chave do Google vai em **header**, nunca em query string: URL aparece em log,
histórico e referrer; header não.

### D3 — A chamada sai do servidor do app, não do navegador

Os provedores não liberam CORS para origem arbitrária, e a chave em
`Authorization` no navegador vazaria para qualquer extensão. Portanto: server
function recebe a configuração por chamada, faz o `fetch` com timeout e devolve
resultado estruturado. O servidor **não persiste** nada: a configuração viaja do
dispositivo para o processo, é usada e morre com a requisição.

### D4 — Chave por dispositivo, no mesmo lugar que o resto do estado

`settings.provider` (dentro de `verso.state.v1`) passa a carregar
`{providerId, label, adapter, baseUrl, model, apiKey, free, verifiedAt}`.
A alternativa (cofre do servidor) foi rejeitada: não há auth, não há banco, e
guarda de chave sem identidade é pior do que a custódia local explícita.

### D5 — Fallback de ambiente continua existindo, mas como secundário

`AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL` seguem válidos para quem opera o servidor.
Precedência: **curadoria local → provedor do dispositivo → ambiente do servidor →
`pending`**. A tela mostra as duas camadas separadas ("seu provedor" e "padrão do
servidor"), porque confundi-las foi exatamente o A3.

### D6 — Descoberta de modelos com degradação dupla

`GET /models` é a fonte da verdade. Quando falha (rede, 404, provedor que só
publica catálogo em página), a UI cai para (a) lista curada de sugestões do
provedor, marcada como sugestão, e (b) campo livre de modelo. Nunca se inventa um
modelo nem se bloqueia a configuração: quem sabe o nome do modelo pode digitá-lo.

### D7 — Teste de conexão obrigatório antes de "ativo"

Escolher modelo não ativa nada. O estado passa a `active` quando
`testProvider` devolve sucesso (uma requisição mínima de chat, `max_tokens`
baixo, medindo latência). `verifiedAt` é gravado e exibido. Configuração salva e
não verificada aparece como **"não verificada"**, nunca como pronta.

### D8 — Migração de estado, não reset

`hydrate()` normaliza `settings.provider` de versões anteriores: `{kind, baseUrl,
model}` vira `{providerId: baseUrl ? "custom" : "openai", adapter: "openai",
apiKey: "", verifiedAt: null}` preservando `baseUrl`/`model`. Vocabulário, músicas
e `known` são intocados. Sem migração, o primeiro clique em Ajustes apagaria o
provedor de quem já usava o app.

### D9 — Zero dependências novas

Tudo cabe em `fetch`, `AbortSignal.timeout`, `zod` (já instalado) e nos
componentes shadcn já presentes. Nenhum SDK de provedor entra no bundle.

### D10 — Tempo limite e tamanho limitados

Descoberta: 8 s. Teste de conexão: 12 s. Geração de card/dossiê: 30 s (já era o
comportamento prático). Resposta de listagem acima de 512 KB é rejeitada. Chave e
URL passam por limites de tamanho no schema (URL ≤ 300, chave ≤ 512, modelo ≤
120).

### D11 — O catálogo é honesto sobre custo

O selo `grátis` só aparece quando a condição é verificável: modelo com sufixo
`:free` (OpenRouter), provedor executado localmente, ou provedor cujo plano
gratuito é público e citado na nota. "Grátis" nunca significa "ilimitado": a nota
diz o limite conhecido ("limite de requisições por minuto" quando é o caso).

### D12 — Uma superfície de erro, três níveis

Cada falha tem `code` (`auth`, `quota`, `not_found`, `rate_limit`, `network`,
`timeout`, `bad_response`, `unsupported`, `invalid_input`) e uma frase em
português. A UI mostra a frase; o
detalhe técnico vai para `console` sem chave. Isso substitui o `{ reason: string }`
genérico atual por algo que a pessoa consegue resolver sozinha.

---

## 7. Catálogo de provedores

Agrupamento na UI, nesta ordem: **Grátis agora → Locais → Principais → Personalizado**.

### 7.1 Grátis agora

| id | Provedor | Adaptador | Base URL | Chave | Como obtê-la | Nota exibida |
|---|---|---|---|---|---|---|
| `google-ai-studio` | Google AI Studio (Gemini) | google | `https://generativelanguage.googleapis.com/v1beta` | obrigatória | aistudio.google.com/apikey | "faixa gratuita com limites por minuto" |
| `groq` | Groq | openai | `https://api.groq.com/openai/v1` | obrigatória | console.groq.com/keys | "faixa gratuita, geração muito rápida" |
| `cerebras` | Cerebras | openai | `https://api.cerebras.ai/v1` | obrigatória | cloud.cerebras.ai | "faixa gratuita para modelos abertos" |
| `openrouter` | OpenRouter | openai | `https://openrouter.ai/api/v1` | obrigatória | openrouter.ai/keys | "centenas de modelos; os com `:free` saem de graça" |
| `github-models` | GitHub Models | openai | `https://models.github.ai/inference` | PAT | github.com/settings/tokens | "catálogo pequeno, uso gratuito com limite" |
| `mistral` | Mistral AI | openai | `https://api.mistral.ai/v1` | obrigatória | console.mistral.ai | "plano experimental gratuito com limites" |

### 7.2 Locais (sem chave, sem custo, dados não saem da máquina)

| id | Provedor | Adaptador | Base URL | Nota exibida |
|---|---|---|---|---|
| `ollama` | Ollama | openai | `http://localhost:11434/v1` | "rode `ollama serve` na mesma máquina" |
| `lmstudio` | LM Studio | openai | `http://localhost:1234/v1` | "ative o servidor local no LM Studio" |
| `llamacpp` | llama.cpp | openai | `http://localhost:8080/v1` | "servidor `llama-server` compatível com OpenAI" |
| `vllm` | vLLM | openai | `http://localhost:8000/v1` | "para quem já serve modelo em vLLM" |

> Provedor local só é alcançável quando o processo está no mesmo host do app; se
> o app roda em contêiner, a URL precisa apontar para o host acessível
> (ex.: `host.docker.internal`). A nota de erro de rede lembra isso.

### 7.3 Principais

| id | Provedor | Adaptador | Base URL | Chave |
|---|---|---|---|---|
| `openai` | OpenAI | openai | `https://api.openai.com/v1` | platform.openai.com/api-keys |
| `anthropic` | Anthropic | anthropic | `https://api.anthropic.com/v1` | console.anthropic.com/settings/keys |
| `deepseek` | DeepSeek | openai | `https://api.deepseek.com/v1` | platform.deepseek.com |
| `xai` | xAI | openai | `https://api.x.ai/v1` | console.x.ai |
| `together` | Together AI | openai | `https://api.together.xyz/v1` | api.together.ai/settings/api-keys |
| `fireworks` | Fireworks AI | openai | `https://api.fireworks.ai/inference/v1` | fireworks.ai/account/api-keys |
| `huggingface` | Hugging Face | openai | `https://router.huggingface.co/v1` | huggingface.co/settings/tokens |
| `moonshot` | Moonshot (Kimi) | openai | `https://api.moonshot.ai/v1` | platform.moonshot.ai |
| `sambanova` | SambaNova | openai | `https://api.sambanova.ai/v1` | cloud.sambanova.ai |
| `cohere` | Cohere | openai | `https://api.cohere.ai/compatibility/v1` | dashboard.cohere.com/api-keys |
| `hyperbolic` | Hyperbolic | openai | `https://api.hyperbolic.xyz/v1` | app.hyperbolic.xyz |
| `nebius` | Nebius AI Studio | openai | `https://api.studio.nebius.ai/v1` | studio.nebius.ai |

### 7.4 Personalizado

- `id: "custom"`, nome livre (opcional; padrão "Meu provedor").
- URL base obrigatória (`http://` ou `https://`).
- Adaptador escolhível: OpenAI-compatível (padrão), Anthropic, Google.
- Chave opcional (servidores locais sem auth).
- Listagem de modelos **opcional** (se o endpoint não existir, campo livre).
- Regras de saneamento da URL: aparar espaços, remover `/` final, remover sufixos
  colados por engano (`/chat/completions`, `/models`, `/v1/chat/completions`),
  recusar esquema diferente de `http/https`, recusar credenciais embutidas
  (`user:pass@`). Documentado que a URL é do dono do dispositivo.

### 7.5 Sugestões curadas (usadas só quando a descoberta falha)

Listas curtas e declaradas como sugestão — não como verdade absoluta:

- `openai`: `gpt-4o-mini`, `gpt-4.1-mini`
- `anthropic`: `claude-3-5-haiku-latest`, `claude-sonnet-4-5`
- `google-ai-studio`: `gemini-2.5-flash`, `gemini-2.5-pro`
- `groq`: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`
- `deepseek`: `deepseek-chat`, `deepseek-reasoner`
- `openrouter`: modelos `:free` conhecidos, com selo
- `mistral`: `mistral-small-latest`
- `ollama`: o app tenta `/models`; sem ele, texto livre

---

## 8. Camada de adaptadores — contrato

Arquivo: `src/lib/providers.ts` (dados + funções puras, sem `fetch`).
Arquivo: `src/lib/provider-http.ts` (montagem de requisição/resposta; também puro,
para ser testável sem rede).

```ts
type Adapter = "openai" | "anthropic" | "google";

type ProviderConfig = {
  providerId: string;
  label: string;
  adapter: Adapter;
  baseUrl: string;
  model: string;
  apiKey: string;
  free: boolean;
  verifiedAt: number | null;
};

type DiscoveredModel = { id: string; label: string; free: boolean };
type ProviderError = {
  code: "auth" | "quota" | "not_found" | "rate_limit" | "network" | "timeout"
      | "bad_response" | "unsupported" | "invalid_input";
  message: string;      // pt-BR, acionável
  status?: number;
};
```

Funções puras obrigatórias:

| Função | Responsabilidade |
|---|---|
| `sanitizeBaseUrl(raw)` | normaliza e valida a URL; devolve `{ ok, value, note? }` |
| `modelsRequest(config)` | URL + headers para `GET /models` |
| `parseModels(adapter, payload)` | `DiscoveredModel[]` ordenado, sem duplicatas |
| `chatRequest(config, messages, options)` | URL + headers + corpo conforme adaptador |
| `parseChat(adapter, payload)` | texto da resposta (JSON quando pedido) |
| `extractJson(text)` | remove cercas de código e acha o primeiro objeto |
| `mapHttpError(status, adapter)` | `ProviderError` com mensagem própria |
| `migrateProviderConfig(previous)` | shape antigo → shape novo |
| `isFreeModel(id)` | `:free` / sufixo `-free` |

Regras transversais:

- `Content-Type: application/json` sempre; `Accept: application/json` na
  descoberta.
- `anthropic` envia `anthropic-version: 2023-06-01` e `max_tokens` explícito.
- `google` codifica o modelo no caminho (`/models/{model}:generateContent`) com
  `encodeURIComponent` e usa `generationConfig.responseMimeType =
  "application/json"` para pedir JSON.
- Nenhum adaptador inclui a chave no corpo; erro nunca inclui a chave.
- `parseChat` valida que existe exatamente um texto não vazio; caso contrário
  `bad_response`.

---

## 9. Descoberta de modelos

### 9.1 Fluxo

1. Pessoa escolhe o provedor → `baseUrl` e `adapter` são preenchidos (editáveis).
2. Digita a chave (ou nenhuma, nos locais).
3. Botão **"listar modelos"** → server function `listProviderModels`.
4. Lista aparece com busca, contagem e selo de grátis por item.
5. Escolhe um modelo → card de resumo atualiza → botão **"testar conexão"**.

### 9.2 Estados da descoberta

| Estado | UI |
|---|---|
| inicial | explicação de uma linha + botão habilitado só com URL/chave válidas |
| carregando | botão em `aria-busy`, "falando com o provedor…" |
| sucesso | `N modelos · atualizado agora`, busca, primeiro item focado |
| sucesso vazio | "o provedor respondeu, mas não listou modelos" + campo livre |
| `auth` | "a chave foi recusada (401). Confira se copiou inteira." |
| `not_found` | "este endereço não tem listagem de modelos. Digite o nome do modelo." |
| `rate_limit` | "o provedor pediu para esperar (429). Tente em alguns segundos." |
| `timeout` | "o provedor não respondeu em 8 s." |
| `network` | "não foi possível alcançar esse endereço." + dica para servidor local |

### 9.3 Cache e repetição

A lista vive em memória da página (não em `localStorage`): trocar de provedor e
voltar refaz a busca. Isso evita exibir catálogo velho como se fosse atual.

---

## 10. Teste de conexão

`testProvider({config})` envia uma requisição mínima:

- prompt: `Responda somente {"ok":true}.`
- `max_tokens` 24, temperatura 0.
- sucesso = resposta HTTP 2xx **e** texto parseável (JSON com `ok`) e ≥ 1
  caractere.
- mede `latencyMs` e devolve `{ ok: true, latencyMs, model, adapter }`.
- falha = `ProviderError` com a mesma taxonomia da descoberta.

Sucesso grava `verifiedAt = Date.now()` **no estado do dispositivo** e a UI passa
a mostrar "verificado há instantes · 640 ms". Falhar mantém `verifiedAt` anterior
(se havia) e mostra o erro; nunca apaga a configuração.

---

## 11. UX detalhada

### 11.1 Estrutura da seção "provedor de IA" em Ajustes

```
provedor de IA
[ curadoria local ]  [ meu provedor ]        ← toggle (kind)
explicação de uma linha: "a curadoria local cobre 122 palavras; fora dela, o
card vem do provedor que você configurar."

── quando "meu provedor" ──
[ buscar provedor… ]                        ← filtro do catálogo
GRÁTIS AGORA    6 opções
  Google AI Studio (Gemini)   grátis        faixa gratuita com limites por minuto
  Groq                        grátis        geração muito rápida
  …
LOCAIS          4 opções
PRINCIPAIS      12 opções
PERSONALIZADO   URL base própria

── provedor escolhido (card) ──
OpenRouter                          [trocar]
chave   [••••••••••••]  [mostrar]   obter chave ↗
url base [https://openrouter.ai/api/v1]
[ listar modelos ]
modelo   [ buscar entre 312 modelos… ]
  ✓ deepseek/deepseek-chat-v3-0324:free   grátis
    meta-llama/llama-3.3-70b-instruct     pago
[ testar conexão ]   verificado há instantes · 640 ms
resumo: OpenRouter · deepseek/…:free · grátis · verificado 09/11 14:22
[ remover provedor ]
```

### 11.2 Microcopy obrigatória

- Chave: "fica só neste dispositivo. O app não tem conta e não envia sua chave
  para lugar nenhum além do provedor que você escolher."
- Curadoria local ativa: "usando a curadoria local — nenhum card sai do
  dispositivo."
- Fallback de servidor: "o servidor deste app também tem uma chave configurada;
  ela é usada quando você não escolhe um provedor."
- Sem modelo escolhido: "escolha um modelo para ativar este provedor."

### 11.3 Acessibilidade e teclado

- Todo controle tem rótulo (`<label>` ou `aria-label`); o seletor de provedor é
  uma lista de botões com `aria-pressed`.
- Resultado de listagem/teste em região `aria-live="polite"`.
- Chave em `type=password` com botão de mostrar/ocultar (`aria-label`
  correspondente).
- Foco visível herdado do design system; nenhuma cor hardcoded — só tokens.
- Funciona em 375 px: catálogo em coluna única, controles empilhados.

### 11.4 Design

Mantém a direção existente (serifa `font-display`, rótulos em caixa alta com
tracking largo, bordas de 1 px, `bg-card`). Selos usam tokens semânticos
(`primary`, `caution`, `muted-foreground`); **nenhum** `bg-[#…]`, `text-white` ou
`bg-black`.

---

## 12. Persistência e migração

Estado (dispositivo, `verso.state.v1`):

```jsonc
"provider": {
  "kind": "remote",
  "providerId": "openrouter",
  "label": "OpenRouter",
  "adapter": "openai",
  "baseUrl": "https://openrouter.ai/api/v1",
  "model": "deepseek/deepseek-chat-v3-0324:free",
  "apiKey": "sk-or-…",
  "free": true,
  "verifiedAt": 1762700000000
}
```

Migração (executada em `hydrate`, uma vez por leitura):

1. `provider` ausente → padrão `{kind:"local", providerId:"openai",
   adapter:"openai", baseUrl: PROVIDERS.openai.baseUrl, model:"", apiKey:"",
   free:false, verifiedAt:null}`.
2. `provider` no shape antigo (`baseUrl`/`model`, sem `adapter`) → `providerId =
   baseUrl ? "custom" : "openai"`, `adapter:"openai"`, chave vazia,
   `verifiedAt: null`, mantendo `baseUrl` e `model`.
3. `kind:"remote"` sem `apiKey` e sem chave de ambiente → UI mostra "não
   verificada" e a fila continua caindo na curadoria local.
4. Campos desconhecidos são descartados; tipos errados caem para o padrão.

Nada além de `settings.provider` muda. `resetData()` continua apagando só os
dados do dispositivo e volta ao padrão.

---

## 13. Segurança e privacidade

| Ameaça | Mitigação |
|---|---|
| Chave em log do servidor | nunca `console.log` da configuração; erros expõem `code`/`status`, não headers |
| Chave em URL (histórico/referrer) | Google usa `x-goog-api-key`; nenhum adaptador põe chave em query |
| Chave em mensagem de erro | `mapHttpError` não inclui corpo cru do provedor na UI; corpo vai ao console truncado e sem headers |
| Chave em SSR/hidratação | chave só existe após `hydrate()` no cliente; o snapshot do servidor é o estado vazio |
| SSRF por URL personalizada | apenas `http/https`; recusa credenciais embutidas; documentado que a URL é do dono do dispositivo (não há multi-tenant nem auth) |
| Resposta gigante | limite de 512 KB na leitura |
| Provedor que não responde | `AbortSignal.timeout` em toda chamada |
| Compartilhar dispositivo | "remover provedor" apaga a chave do estado; `apagar tudo` apaga o app inteiro |

O que **não** fazemos: criptografia da chave no `localStorage` (sem segredo de
dispositivo, seria teatro), proxy de terceiros, retenção server-side.

---

## 14. Integração com o resto do app

| Ponto | Mudança |
|---|---|
| `card-queue.ts` | injeta `settings.provider` em `generateCard`; se `kind === "local"`, não chama nada (comportamento atual preservado) |
| `vocabulary.$wordId.tsx` | injeta a configuração em `generateDossier` |
| `ai.functions.ts` | precedência local → dispositivo → ambiente; `providerStatus` informa as duas camadas |
| `settings.tsx` | seção nova, isolada em componente próprio |
| Fila/badge | motivo de `pending` passa a citar o provedor ("sem provedor ativo") |
| Testes | `src/test/providers.test.ts` cobre catálogo, saneamento, três adaptadores, erro e migração |

---

## 15. Escopo por fase e critérios de aceite

### F1 — Contratos e catálogo

Entregue: `src/lib/providers.ts` (tipos do catálogo, ≥ 20 provedores, grupos,
sugestões curadas, `sanitizeBaseUrl`, `isFreeModel`, `migrateProviderConfig`);
`src/lib/provider-http.ts` (três adaptadores puros).

Aceite:
- catálogo sem `id` duplicado; todo `baseUrl` é `http(s)` absoluta;
- `sanitizeBaseUrl` normaliza `/` final, espaço e sufixos colados, e recusa
  esquema inválido e credenciais embutidas;
- `migrateProviderConfig` cobre os casos 1–3 da §12;
- ≥ 6 provedores gratuitos e ≥ 4 locais no catálogo.

### F2 — Descoberta e teste no servidor

Entregue: `listProviderModels` e `testProvider` em `ai.functions.ts`, com
timeouts, limite de tamanho e `mapHttpError`; `generateCard`/`generateDossier`
aceitando `provider` opcional e com precedência definida em D5.

Aceite:
- 401 → `auth`; 404 → `not_found`; 429 → `rate_limit`; abort → `timeout`;
  `fetch` rejeitado → `network`; JSON inesperado → `bad_response`;
- nenhuma função registra a chave;
- chamada sem `provider` mantém o comportamento do project1 (ambiente).

### F3 — UI de configuração

Entregue: `src/components/provider-settings.tsx` usado em `settings.tsx`:
catálogo com busca e grupos, card do provedor, chave com mostrar/ocultar, URL
editável, adaptador (só em personalizado), listagem com busca e selos, sugestões
curadas como fallback, campo livre de modelo, teste de conexão com latência,
resumo do ativo, remover.

Aceite:
- todos os estados da §9.2 alcançáveis e legíveis;
- nenhuma cor hardcoded; rótulos acessíveis; funciona em 375 px;
- configuração sobrevive a recarregar a página;
- `kind:"local"` esconde tudo e volta a curadoria.

### F4 — Migração e integração

Entregue: migração em `hydrate`; `card-queue` e dossiê passando a configuração;
`providerStatus` com as duas camadas.

Aceite:
- estado antigo com `{kind:"remote", baseUrl, model}` é preservado e exibido;
- card remoto funciona com a configuração do dispositivo (provado com provedor de
  teste local);
- sem provedor e sem ambiente, card continua `pending` com motivo claro.

### F5 — Testes e gates

Entregue: `src/test/providers.test.ts` (~15 casos).

Aceite: `tsc --noEmit`, `eslint .`, `vitest run` e `vite build` verdes; suíte
anterior intacta.

### F6 — Verificação no navegador

Aceite (uma sessão de script):
1. `/settings` abre e mostra o catálogo agrupado;
2. escolher provedor personalizado + URL do provedor de teste + chave →
   "listar modelos" devolve 3 modelos;
3. escolher um modelo → "testar conexão" devolve sucesso com latência;
4. recarregar → configuração e `verifiedAt` continuam lá;
5. "remover provedor" limpa a chave;
6. console sem erro e sem vazamento de chave.

---

## 16. Casos de borda

| Caso | Comportamento |
|---|---|
| URL com espaço no meio | recusa com "o endereço tem um espaço" |
| URL `ftp://` | recusa com "use http:// ou https://" |
| URL colada já com `/chat/completions` | remove o sufixo e avisa que normalizou |
| Chave com espaço/quebra de linha | apara; se sobrar espaço interno, mantém (algumas chaves têm) |
| Provedor responde 200 com `{data:[]}` | "respondeu, mas não listou modelos" |
| Listagem com 4 mil modelos | ordena, mostra contagem e busca; renderiza só os 60 primeiros |
| Dois modelos com o mesmo `id` | deduplica |
| Modelo gratuito em provedor pago | selo só quando `isFreeModel` |
| Trocar de provedor com teste pendente | resultado antigo descartado (id de requisição) |
| Aba em `kind:"local"` com provedor salvo | configuração preservada, não apagada |
| Estado antigo corrompido | migra para o padrão e loga aviso sem derrubar a tela |
| Servidor sem ambiente e sem dispositivo | card `pending` com "configure um provedor em Ajustes" |
| Provedor local com app em contêiner | mensagem sugere `host.docker.internal` |

---

## 17. Testes e gates

Automatizados (vitest):

1. catálogo: ids únicos, URL válida, grupos, ≥ 6 grátis, ≥ 4 locais;
2. `sanitizeBaseUrl`: 6 casos válidos e 5 inválidos;
3. `parseModels` openai/anthropic/google com fixtures reais de shape;
4. filtro `generateContent` e remoção do prefixo `models/` (google);
5. dedupe e ordenação;
6. `chatRequest` por adaptador (URL, headers, corpo, `max_tokens` explícito no
   anthropic);
7. `parseChat` dos três adaptadores e `extractJson` com cerca de código;
8. `mapHttpError` 401/403/404/429/500/abort;
9. `isFreeModel`;
10. `migrateProviderConfig` (ausente, antigo com URL, antigo sem URL, já novo);
11. nenhuma chave em corpo de requisição.

Gates de entrega (todos dentro do contêiner do compose):

```
npx tsc --noEmit
npx eslint .
npx vitest run
npx vite build
```

Verificação de produto: roteiro da §15 F6 no preview, em uma única sessão de
script, com provedor de teste local servido por um mock OpenAI-compatible.

---

## 18. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Endpoints de catálogo mudarem | descoberta falha | fallback curado + campo livre (D6) |
| CORS bloqueado | irrelevante | chamada no servidor (D3) |
| Chave vazada por extensão de navegador | alto, mas fora do escopo | custódia local explícita, aviso na UI, remoção fácil |
| Lista de modelos enorme | UI lenta | busca + limite de renderização |
| Provedor sem `/models` | configuração travada | campo livre sempre disponível |
| Usuário escolhe modelo pago sem saber | custo inesperado | selo de grátis/pago e nota de custo por item |
| Migração apagar dados | perda de vocabulário | migração só adiciona campos; testes cobrem |

---

## 19. Registro de decisões

| # | Decisão | Motivo |
|---|---|---|
| R1 | Reconstruir a seção de provedores em vez de remendar os dois inputs | A3/A4: a configuração atual não afeta o comportamento real |
| R2 | Catálogo como dado + 3 adaptadores | D1/D2; evita condicional por provedor |
| R3 | Chave no dispositivo | não há auth nem banco; cofre sem identidade é pior |
| R4 | Teste de conexão obrigatório para "ativo" | D7; acaba com "configurado" sem prova |
| R5 | Fallback de ambiente mantido como camada secundária | operadores do servidor não perdem o fluxo atual |
| R6 | Zero dependências novas | D9; Workers + bundle |
| R7 | Google com chave em header | D2; evita vazamento por URL |
| R8 | Descoberta em memória, não persistida | evita catálogo velho como verdade |
| R9 | 20+ provedores, não 50 | curadoria: cada linha precisa de nota e endpoint corretos |
| R10 | Mock OpenAI servido em contêiner para o teste de ponta a ponta | prova real do caminho servidor→provedor sem chave de terceiro |

---

## 20. Definição de pronto

- [ ] Ajustes permite escolher provedor em catálogo agrupado, com busca.
- [ ] Chave do dispositivo, com mostrar/ocultar e aviso de custódia local.
- [ ] URL base editável para qualquer provedor e modo personalizado completo.
- [ ] Listagem real de modelos por provedor, com busca, contagem e selo de grátis.
- [ ] Fallback curado + campo livre quando a listagem não existe ou falha.
- [ ] Teste de conexão com latência e taxonomia de erro em português.
- [ ] Resumo do provedor ativo com `verifiedAt`.
- [ ] Card e dossiê usam a configuração do dispositivo; ambiente como fallback.
- [ ] Migração preserva estado antigo; vocabulário intocado.
- [ ] Testes de provedores verdes; suíte anterior intacta.
- [ ] `tsc`, `eslint`, `vitest`, `vite build` verdes.
- [ ] Roteiro F6 executado no preview em uma sessão, sem erro de console.
- [ ] Nenhuma cor hardcoded, nenhum token de chave em log, nenhum arquivo gerado
      editado.
