# PRD — project1: **Verso** (estudo de idiomas pela letra da música)

> Documento derivado de `.opencode/project1.md` (fonte de verdade do escopo).
> Precedência: no escopo, planejamento > PRD; no "como", o PRD manda. Cada
> decisão técnica abaixo foi confirmada contra o código real deste repositório,
> não presumida.

---

## 0. Sumário executivo

**Verso** é um app de estudo de inglês em que a letra completa de uma música é a
fonte, e a **palavra** é o objeto de estudo. O fluxo tem três partes em sequência:

1. **Achar a música** — a busca é interpretada ("bohemian rapsody quen" → Queen /
   Bohemian Rhapsody), com grau de confiança, alternativas e cards "era essa?".
2. **Ler e marcar** — a letra inteira em estrofes, com dois modos de toque
   alternáveis (card imediato vs. coleta silenciosa) e pré-marcação sutil das
   palavras provavelmente novas para o nível declarado.
3. **Estudar no vocabulário** — cada palavra ganha card (literal / na frase /
   "por que não [sinônimo]" com veredito ✗ ✓ ◐), dossiê que se aprofunda, e
   prática por ângulos diferentes com revisão espaçada.

O produto definido aqui é **utilizável de ponta a ponta sem credencial nenhuma**
(motor local curado) e **melhor com um provedor de IA conectado** (cartões para
qualquer palavra). O que falta nunca é fingido: a palavra sem card fica em fila,
com estado visível e motivo declarado.

---

## 1. Diagnóstico real do ambiente (o que existe, e o que não existe)

Confirmado lendo `package.json`, `vite.config.ts`, `src/server.ts`, `src/start.ts`,
`src/routes/__root.tsx`, `src/styles.css` e `.opencode/AGENTS.md`:

| Fato | Consequência para o PRD |
|---|---|
| TanStack **Start v1** + TanStack Router **file-based**, React 19, Vite 8 | rotas são arquivos em `src/routes/`; `routeTree.gen.ts` é gerado — nunca editar |
| `@lovable.dev/vite-tanstack-config` injeta plugins (tailwind, tsconfig paths, nitro, error logger) | não adicionar plugins duplicados; `@/...` já resolve |
| Tailwind **v4** com `@theme inline` em `src/styles.css` e cores em **oklch** | cores são tokens semânticos; proibido `bg-black`/`text-white`/`bg-[#...]` |
| shadcn/Radix completo em `src/components/ui/` | reutilizar `button`, `sheet`, `input`, `select`, `progress`, `sonner`, `tabs`, `badge`, `skeleton` |
| `zod@3` já instalado | todo retorno de motor de cartão/catálogo passa por schema antes de renderizar |
| **Não há banco de dados**, nem Drizzle, nem Supabase, nem auth | persistência é **local ao dispositivo** (§3.5) |
| Runtime do servidor é **Worker** (`.opencode/AGENTS.md` §9.5) | proibido `child_process`, `fs.watch`, binários nativos; `fetch` é seguro |
| Não existem credenciais de IA no ambiente do app | o app **não pode depender** de IA para funcionar (§5) |
| `src/routes/index.tsx` é placeholder ("Your app will live here") | a primeira entrega real substitui o placeholder |

Riscos herdados e como o PRD os trata:

- **R1 — Dependência de IA no caminho crítico.** Se o card só existe com IA, o
  app é uma casca sem chave. → motor local curado + fila honesta (§5).
- **R2 — Vagalume como fonte única.** API pública, rate-limited, sem SLA e com
  CORS fechado para o browser. → catálogo local + server function com timeout e
  degradação declarada (§4).
- **R3 — Direito autoral.** Não se armazena nem se semeia letra de terceiros no
  código. → o catálogo de demonstração é composto de **letras originais deste
  projeto**; a letra real de terceiros chega por busca sob demanda (§4.3).
- **R4 — SSR + `localStorage`.** Ler storage no topo do módulo quebra o SSR. →
  store hidratada em efeito, com *server snapshot* constante (§3.5).
- **R5 — Porta do preview.** O harness documenta `:8080`; o ambiente desta
  sandbox publica a app na porta **3000**. O app não fixa porta: usa
  `process.env.PORT` quando existir e o `vite dev` recebe `--port` do ambiente.

---

## 2. Arquitetura de informação e rotas

| Rota | Arquivo | Papel |
|---|---|---|
| `/` | `src/routes/index.tsx` | Busca interpretada, candidatas, músicas recentes |
| `/song/$songId` | `src/routes/song.$songId.tsx` | Leitura da letra: modos de toque, pré-marcação, fila de cards |
| `/vocabulary` | `src/routes/vocabulary.index.tsx` | Vocabulário: filtros por música, categoria, estágio, frequência |
| `/vocabulary/$wordId` | `src/routes/vocabulary.$wordId.tsx` | Dossiê da palavra |
| `/practice` | `src/routes/practice.tsx` | Sessão de revisão espaçada por ângulos |
| `/settings` | `src/routes/settings.tsx` | Nível, modo padrão, provedor de cards, dados locais |

Regra do harness (§8.2 do `.opencode/AGENTS.md`): **todo `Link`/`navigate` tem
arquivo de rota no mesmo lote**. Nenhum link morto.

Navegação global no `__root.tsx` (shell): marca **Verso**, links Buscar ·
Vocabulário · Prática · Ajustes, e um indicador de fila (palavras pendentes) que
aparece só quando há trabalho pendente. `<Toaster />` (sonner) montado uma vez
no shell.

---

## 3. Modelo de dados

### 3.1 Tipos de domínio (`src/lib/types.ts`)

- `CefrLevel = "a1" | "a2" | "b1" | "b2" | "c1"` — régua de base.
- `TapMode = "card" | "collect"` — os dois modos de toque do planejamento.
- `WordStatus = "new" | "studying" | "mastered"` — estágio de aprendizado.
- `Verdict = "wrong" | "right" | "mcbc"` — ✗ / ✓ / ◐ (certo, mas menos cabível).
- `Song { id, title, artist, lines[], source: "catalog" | "vagalume", addedAt }`
- `WordCard { term, lemma, pos, literal, inPhrase, whyNot{synonym,verdict,reason}, register, engine, generatedAt }`
- `Dossier { commonUses[], collocations[], register, confusables[{term,note}], avoid[], engine, generatedAt }`
- `VocabularyEntry { id, term, lemma, songId, lineIndex, phrase, status, starred, card|null, cardState, dossier|null, occurrences[], srs{due,interval,ease,reps,lapses}, reviewLog[] }`
- `Settings { level, tapMode, provider { kind: "local" | "remote", model, baseUrl } }`

Todos os schemas vivem junto dos tipos e são a única porta de entrada de dado
externo (`zod`).

### 3.2 Identidade e a mesma palavra em outra música

`entryKey = lemma` (fallback `term`) **por idioma**. Ao marcar uma palavra que já
existe no vocabulário:

- não se cria duplicata: a entrada existente ganha um **uso novo**
  (`occurrences[]`: música + linha + frase);
- o app sinaliza "já está no seu vocabulário — novo uso em <música>";
- abrir o uso novo conta como **reaparição** e entra como revisão neutra (§7.4).

Isso cumpre "a mesma palavra com outro sentido em outra música é reconhecida e
ligada à que já existe" sem inventar sincronização entre dispositivos.

### 3.3 Card e dossiê são separados de propósito

O card responde à leitura (rápido, cabe no painel). O dossiê é material de estudo
profundo (usos comuns, combinações, registro, parecidas que confundem, o que
evitar) e é gerado **sob demanda**, quando o usuário abre a palavra — decisão de
custo (§13, D6).

### 3.4 Validação obrigatória

Todo dado que vem do motor local, do provedor remoto ou do Vagalume passa por
`zod` antes de tocar a UI. Payload inválido = `cardState: "failed"` com motivo
legível, nunca card pela metade.

### 3.5 Persistência local (decisão fundadora)

Não há banco. O estado vive em `localStorage` sob a chave `verso.state.v1`:

- store minúscula com `useSyncExternalStore` (sem Redux, sem dependência nova);
- `getServerSnapshot` devolve um estado inicial **constante** (evita hydration
  mismatch e leitura de `window` no SSR);
- hidratação e gravações acontecem em efeitos/eventos, nunca no topo do módulo
  (regra §9.5/§49.4 do harness);
- escrita com debounce de 250 ms, tolerante a `QuotaExceededError` (descarta o
  histórico de revisão mais antigo e avisa via toast — nunca perde o vocabulário).

Consequência honesta: os dados são **do dispositivo**, não há conta nem sync. O
PRD não promete nuvem; a UI diz "salvo neste dispositivo" em Ajustes.

---

## 4. Camada de letras

### 4.1 Interpretação da busca (determinística, sem IA)

`interpretQuery(raw)` em `src/lib/search.ts`:

1. normaliza (minúsculas, sem acentos, sem pontuação);
2. separa em tokens e remove *stopwords* de busca (`the`, `a`, `song`, `música`);
3. pontua cada candidata do catálogo por: título exato (1.0) > título parcial por
   token (0.7) > artista (0.55) > trecho de letra (0.4), com tolerância a
   distância de edição ≤ 2 (conta como provável);
4. devolve `{ confidence: "high" | "medium" | "low", matches: Candidate[] }`.

`confidence: "low"` com 2+ candidatas ⇒ a UI mostra **cards "era essa?"** em vez
de escolher. Uma candidata só com confiança `high` abre direto.

A interpretação é **local** de propósito: é instantânea, funciona offline e não
gasta token. O planejamento pede que a IA *interprete*; a interpretação
determinística cobre o caso real ("artista + música, digitado torto") sem
dependência de rede. Com provedor remoto, a IA **pode** refinar a interpretação —
nunca é o único caminho (§5.6).

### 4.2 Catálogo local de demonstração (`src/lib/catalog.ts`)

Três músicas **originais** (letra escrita para este projeto, sem direito de
terceiros), com vocabulário progressivo, cada uma servindo um caso didático:

| Música | Nível | Serve para |
|---|---|---|
| **Paper Boats** | A2 | narrativa simples, presente/passado, imagem concreta |
| **Neon Static** | B1 | gíria e expressão ("static", "hollow", "drown it out") |
| **Slow Tide** | B2 | verbos frasais, sentido figurado, ambiguidade |

Cada letra tem 14–20 linhas com refrão repetido — o suficiente para exercitar
"letra completa, estrofes, confortável de ler" e para o resumo de coleta.

O catálogo é rotulado na UI como "demonstração" e não se mistura visualmente com
letras vindas do Vagalume (badge de fonte na tela de leitura).

### 4.3 Vagalume (`src/lib/lyrics.functions.ts`)

Server function `searchLyrics({ query })`:

- tenta `https://api.vagalume.com.br/search.php?art=…&mus=…` com `AbortSignal`
  de **5 s** e `User-Agent` identificando o app;
- usa `VAGALUME_API_KEY` do ambiente quando existir (opcional, nunca obrigatório);
- limpa a resposta (remove blocos de tradução, normaliza quebras, preserva
  estrofes em branco) e devolve `{ candidates, source: "vagalume" }`;
- **falha de rede não é erro de tela**: devolve `{ candidates: [], note }` e a UI
  mostra "não consegui falar com o Vagalume agora — tente de novo ou use uma das
  músicas de demonstração";
- letras já buscadas ficam salvas no dispositivo e abrem offline (§8).

Sem `dangerouslySetInnerHTML` em nenhum ponto: a letra é dado, não markup.

---

## 5. Motor de cartões (o coração do recurso)

### 5.1 Dois motores, um contrato

```
generateCard({ term, phrase, lemma, level, targetLang }) -> WordCard
generateDossier({ term, lemma, level }) -> Dossier
```

- **`local`** (`src/lib/card-engine.ts`): léxico curado EN→PT com ≥ 100 entradas
  escritas à mão, que produz card completo (literal, na frase, por que não
  sinônimo com veredito e motivo), classe gramatical, registro e material de
  dossiê. É o que faz o app funcionar **hoje**, sem credencial.
- **`remote`** (`src/lib/ai.functions.ts`): provedor compatível com OpenAI
  (`POST {baseUrl}/chat/completions`), saída em JSON validada por `zod`, chave
  lida de `AI_API_KEY` **no servidor, dentro do handler** — nunca no bundle.

Seleção: se `settings.provider.kind === "remote"` **e** a chave existir no
servidor, usa remoto; senão, local. O retorno carrega `engine`, e a UI diz de onde
veio o conteúdo ("curado" / "gerado por <modelo>"). Nunca se apresenta conteúdo
local como se fosse gerado por IA.

### 5.2 Por que o motor local não "inventa" palavra desconhecida

Palavra fora do léxico curado **não** recebe card genérico. Recebe
`cardState: "pending"` com o motivo: "esta palavra ainda não tem curadoria local
— conecte um provedor de IA para gerar o card". É a diferença entre um app
honesto e um app que alucina tradução.

### 5.3 Fila de geração (modo coleta)

`src/lib/card-queue.ts`:

- marcação em série enfileira `entryKey`s; o worker roda **concorrência 1**;
- cada item atualiza a store ao terminar (`ready` | `failed` | `pending`);
- indicador discreto na tela de leitura e no shell: "7 de 12 prontas";
- abrir o card de uma palavra pendente **fura a fila** (prioridade);
- a fila é retomada ao reabrir o app (pendências persistem no estado).

### 5.4 Pré-marcação do que o usuário provavelmente não sabe

`src/lib/level.ts`:

- lista de palavras comuns por nível (artigos, auxiliares, básicos) — abaixo do
  nível declarado nunca é sugerida;
- entrada do léxico com `level` ≤ nível do usuário ⇒ não sugerida (a menos que
  ele mesmo a marque);
- palavra fora do léxico, com ≥ 4 letras e não-dominada ⇒ **sugerida** com
  sublinhado sutil (não é marcação: é convite);
- `known` (descartadas + dominadas) remove a sugestão para sempre.

A sugestão é sempre confirmável: toque normal marca, "ignorar" descarta.

### 5.5 Card — estrutura visual e conteúdo

Painel deslizante (`Sheet`) por baixo, que **não cobre a letra**: a linha de
origem fica visível acima do painel.

- **Literal** — camada secundária, tipografia menor, cor `muted-foreground`.
- **Na frase** — destaque do card: fundo `secondary`, borda esquerda `primary`,
  corpo legível.
- **Por que não *[sinônimo]*** — três vereditos com ícone e cor próprios:
  ✗ `destructive`, ✓ `success`, ◐ `caution`, sempre com uma linha de motivo.

Esqueleto durante geração (`Skeleton`), nunca spinner solto.

### 5.6 O provedor remoto é opcional, e a UI diz isso

Ajustes → "Provedor de cartões": `local (curado)` ou `remote (sua API)`, com
`baseUrl` e `modelo`. Se `remote` estiver selecionado mas o servidor não tiver
`AI_API_KEY`, Ajustes mostra "sem chave no servidor — usando curadoria local" e o
app continua funcionando. Não se pede chave em campo de UI nesta fase (D7);
configuração de provedores pelo usuário é o escopo do project2.

---

## 6. Tela de leitura — o núcleo da experiência

### 6.1 Tokenização (`src/lib/tokenize.ts`)

`tokenizeLine(text)` devolve `Token { raw, norm, start, end, kind }`:

- `kind: "word"` para `[A-Za-zÀ-ÿ'’-]+`, `"space"` e `"punct"` para o resto;
- preserva pontuação original (apóstrofos, hífens) para o texto não mentir;
- `norm` é minúsculo/sem acento e é a chave de busca no léxico e no vocabulário.

O componente renderiza cada linha como corpo serifado, com tokens `button`
(somente palavras) para acessibilidade por teclado.

### 6.2 Dois modos, alternáveis no próprio cabeçalho da letra

- **Modo card** (padrão): toque abre o painel já com esqueleto e preenchimento;
  no painel há "enviar ao vocabulário".
- **Modo coleta**: toque só marca (animação curta, sem painel, sem espera); tocar
  em palavra já marcada abre o card dela.

O modo é do app (`settings.tapMode`), não da música; alternar é instantâneo.

### 6.3 Resumo ao final

Barra fixa no rodapé da leitura, quando há marcações: "você coletou 14 palavras ·
9 prontas" e ação "ir para o vocabulário". Quando a fila termina, o texto deixa de
mostrar progresso (estado final, sem polling).

### 6.4 Acessibilidade e leitura longa

- alvo de toque ≥ 40 px de altura de linha, `text-lg`/`leading-relaxed`;
- foco visível (`ring`) em todo token;
- palavras marcadas: sublinhado `primary` + fundo `accent` leve (não só cor);
- sugestões: sublinhado pontilhado `muted-foreground`;
- contraste AA no corpo da letra em claro e escuro.

---

## 7. Vocabulário (a área principal)

### 7.1 Filtros e organização

Uma barra de filtros (não uma árvore de menus): **música** · **categoria** ·
**estágio** · **frequência**.

- **categoria** vem do léxico (`pos`, `tag`: verbo, substantivo, gíria/expressão,
  favorita, difícil) — nunca inventada na UI;
- **estágio**: nova / em estudo / dominada, com transição explícita (botão) e
  automática ao acertar 3 revisões seguidas;
- **frequência**: quantas músicas salvas usam a palavra (contagem real sobre as
  letras no dispositivo).

### 7.2 Cartão da grade

Palavra (serif, grande), tradução literal (uma linha, truncada), origem
(música · artista), chip de estágio, chip de categoria, e — quando pendente — o
motivo em uma linha. Ordenação padrão: recém-coletadas primeiro.

### 7.3 Dossiê (`/vocabulary/$wordId`)

Seções: **na frase** (última ocorrência), **usos mais comuns**, **combinações
frequentes**, **registro**, **parecidas que confundem** (inclui falso cognato com
português quando o léxico traz), **o que evitar**, **histórico** (revisões,
acertos, última vez).

Sem dossiê ainda ⇒ botão "aprofundar agora" que chama `generateDossier`. É o
único ponto que pode custar token, e é disparado por gesto do usuário.

### 7.4 Reaparição

Quando a palavra aparece em outra música e o usuário a marca (ou quando ele reabre
o uso salvo), registra-se `occurrence` e a UI mostra o par antigo/novo. Isso conta
como revisão no SRS com grau neutro (1).

---

## 8. Sem internet

| Capacidade | Offline |
|---|---|
| Abrir música já buscada, ler a letra | ✅ (estado local) |
| Marcar palavras, vocabulário, filtros, dossiê já gerado | ✅ |
| Card de palavra com curadoria local | ✅ |
| Card/dossiê via provedor remoto | ❌ → fica `pending` com motivo e retenta quando volta |
| Buscar música nova no Vagalume | ❌ → mensagem clara + catálogo local |

`navigator.onLine` alimenta um chip discreto ("offline — trabalhando local") e a
retomada da fila ao reconectar (`online` event). Não se promete offline do *shell*
(service worker) nesta fase: D8.

---

## 9. Prática com revisão espaçada

### 9.1 Agendamento (`src/lib/srs.ts`)

SM-2 simplificado, intervalos `[0,1,3,7,16,35,75]` dias:

- `grade 0` (errou): `lapses++`, intervalo volta a 1 dia, ease `-0.2` (mín. 1.3);
- `grade 1` (certo com esforço): mantém intervalo, ease `-0.05`;
- `grade 2` (certo): avança no array, ease `+0.1` (máx. 2.8).

Função pura, determinística, testável — sem datas mágicas na UI.

### 9.2 Ângulos (cada revisão cobra um diferente)

1. **contexto** — a frase da música com lacuna; 4 opções de significado literal;
2. **sinônimo** — "esse sinônimo cabe aqui?" com ✗ / ✓ / ◐ (o veredito do card);
3. **lacuna na letra** — a linha original com a palavra faltando; 4 palavras.

`pickAngle(entry, reps)` roda em ciclo embaralhado por `id` (hash estável) para
não repetir o mesmo ângulo duas vezes seguidas.

### 9.3 Sessão

Até 10 cartões devidos, ordenados por `due`; feedback imediato (correto/errado +
motivo), barra de progresso, resultado final com acertos e próximos vencimentos.
Distratores saem do próprio vocabulário (nunca inventados); com < 4 entradas
disponíveis, cai para alternativas do léxico e avisa que a sessão está curta.

### 9.4 Palavras que erram mais voltam mais

`weight = 1 + lapses` alimenta a prioridade da fila de sessão; ângulos diferentes
por repetição (ciclo), nunca o mesmo duas vezes.

---

## 10. Direção visual (distinta, intencional)

**Conceito:** caderno de canções editorial — papel quente, tinta densa, tipografia
serifada de livro e réguas finas. Nada de gradiente roxo, nada de hero genérico.

Tokens novos em `src/styles.css` (oklch, claro e escuro):

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--paper` (background) | `oklch(0.972 0.013 85)` | `oklch(0.185 0.012 85)` | fundo do app |
| `--ink` (foreground) | `oklch(0.255 0.018 60)` | `oklch(0.935 0.014 85)` | texto principal |
| `--vermilion` (primary) | `oklch(0.552 0.168 32)` | `oklch(0.702 0.148 36)` | marcação, ação |
| `--caution` | `oklch(0.702 0.132 78)` | `oklch(0.782 0.128 82)` | veredito ◐ |
| `--success` | `oklch(0.552 0.104 155)` | `oklch(0.702 0.108 158)` | veredito ✓ |

Tipografia: **Newsreader** (display/letra, serif) + **Inter Tight** (UI) via
`<link>` no head do `__root.tsx` (nunca `@import` remoto no CSS).

Layout: coluna de leitura medindo ~68ch; navegação em barra superior com fio
inferior; cartões com borda 1px e raio pequeno; sombras quase ausentes; o destaque
vem de cor de tinta e espaço, não de brilho.

---

## 11. SEO e metadados

`head()` único por rota (título e descrição específicos, `og:type`, `twitter:card`).
`__root.tsx` deixa de dizer "Lovable App". Rotas dinâmicas (`/song/$id`,
`/vocabulary/$id`) montam título a partir do dado real quando ele existe, com
fallback estável quando não existe.

---

## 12. Fases (escopo e critérios de aceite)

### Fase 1 — Fundação de domínio
`types.ts`, `tokenize.ts`, `lexicon.ts` (≥ 100 entradas), `catalog.ts` (3 letras),
`store.ts`, `srs.ts`, `level.ts`.
**Aceite:** `tsc --noEmit` limpo; testes de tokenização (apóstrofo, hífen, acento,
pontuação), de SRS (0/1/2, limites de ease/intervalo) e de store (marcar, não
duplicar lemma, descartar) verdes; `routeTree.gen.ts` intocado.

### Fase 2 — Busca interpretada
`search.ts` + `lyrics.functions.ts` + `/`.
**Aceite:** "paper boats", "paper boot", "neon statc" resolvem a música certa com
confiança declarada; query sem correspondência mostra estado vazio explicativo;
Vagalume falhando não quebra a tela; abrir candidata cria a música na store.

### Fase 3 — Leitura e marcação
`song.$songId.tsx`, painel de card, modos, pré-marcação, fila.
**Aceite:** em modo coleta, 5 toques marcam 5 palavras sem abrir painel; em modo
card, o toque abre o painel com conteúdo curado; indicador "n de m prontas" chega
ao total e para; palavra pendente mostra motivo; resumo aparece ao final.

### Fase 4 — Vocabulário e dossiê
`/vocabulary`, `/vocabulary/$wordId`, filtros, estágios, dossiê sob demanda.
**Aceite:** filtros combinam (música × estágio); estágio muda e persiste após
recarregar; dossiê local preenche todas as seções; entrada pendente não inventa
conteúdo.

### Fase 5 — Prática
`/practice`, geração de questões, sessão, agendamento aplicado.
**Aceite:** sessão com ≥ 3 entradas gera 3 ângulos distintos; responder errado
reagenda para 1 dia; acertar avança intervalo; estado final com próximos
vencimentos; sessão vazia explica como coletar palavras.

### Fase 6 — Ajustes, offline e polimento
`/settings`, chips de fonte/offline, temas, acessibilidade, metadados.
**Aceite:** nível e modo persistem; provedor remoto sem chave cai para local com
aviso; chip offline aparece ao simular `offline`; navegação por teclado alcança
tokens e painéis; contraste AA medido nos dois temas.

---

## 13. Registro de decisões

| # | Decisão | Motivo |
|---|---|---|
| D1 | Persistência em `localStorage` com store própria | não há banco nem auth; mantém o app offline-first e o escopo honesto |
| D2 | Interpretação de busca determinística, IA opcional | funciona offline, sem custo, sem chave; o caso real é "artista + música torto" |
| D3 | Catálogo local de letras **originais** | evita direito autoral e garante demonstração offline |
| D4 | Card local curado + `pending` honesto | nunca alucinar tradução; o app funciona sem IA |
| D5 | Contrato único para os dois motores, `zod` na borda | troca de motor sem tocar na UI |
| D6 | Dossiê sob demanda | controla custo de IA (decisão aberta do planejamento) |
| D7 | Chave remota só no servidor (`AI_API_KEY`), nunca na UI | segurança; configuração de provedores pelo usuário é do project2 |
| D8 | Sem service worker nesta fase | offline de **dados** é o requisito; offline de shell exige PWA e fica registrado como próximo passo |
| D9 | SM-2 simplificado | previsível, testável, suficiente para 3 ângulos |
| D10 | `entryKey = lemma` por idioma | evita duplicata e permite reaparição |
| D11 | `useSyncExternalStore` + snapshot constante no servidor | SSR seguro sem `window` no módulo |
| D12 | Fila de cards com concorrência 1 | progresso legível e sem rajada de chamadas |

---

## 14. Fora de escopo (explícito)

- Conta, login, sincronização entre dispositivos, compartilhamento.
- Player de áudio/streaming e sincronização com o tempo da música.
- Idiomas além de EN→PT (o modelo já carrega `language`; a UI assume en/pt).
- Configuração de provedores pelo usuário (lista de provedores, base URL livre,
  listagem de modelos) — escopo do **project2**, não deste.
- OpenCode/monitor (`/oc`) — conforme AGENTS.md, só depois dos projetos existentes.
- Geração de letra por IA em qualquer hipótese.

---

## 15. Gates deste PRD

1. `tsc --noEmit` limpo; lint sem erro novo; `vite build` conclui.
2. Testes de domínio (tokenize, srs, search, store) verdes.
3. Fluxo real exercitado no preview: buscar → abrir → marcar em coleta → card →
   vocabulário → filtro → dossiê → prática → acerto/erro → reagendamento.
4. Nenhum placeholder do template restante; nenhuma rota morta no `routeTree`.
5. Cores só por token; sem `any` gratuito; sem segredo em arquivo.
