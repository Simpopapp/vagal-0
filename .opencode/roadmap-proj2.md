# Roadmap — project2 (Verso · provedores de IA)

Ordem de dependência do PRD (`prd-project2.md`) §15. `[x]` só com o gate da fase
executado e o número real registrado na linha de Gates.

## Fase 1 — Contratos e catálogo
- [x] `src/lib/providers.ts`: catálogo agrupado (6 grátis · 4 locais · 12 principais · personalizado), sugestões curadas, `sanitizeBaseUrl`, `isFreeModel`, `migrateProviderConfig`
- [x] `src/lib/provider-http.ts`: `modelsRequest`, `parseModels`, `chatRequest`, `parseChat`, `extractJson`, `mapHttpError` para `openai`/`anthropic`/`google`
- [x] Tipos em `src/lib/types.ts` (`ProviderConfig`, `ProviderRequest`, `DiscoveredModel`, `ProviderError`) com migração do shape antigo
- **Gates:** `tsc --noEmit` exit 0 ✅ · `vitest run` 56 testes verdes (31 novos em `providers.test.ts`) ✅

## Fase 2 — Servidor: descoberta, teste e precedência
- [x] `listProviderModels` (8 s, limite 512 KB, taxonomia de erro) e `testProvider` (12 s, latência medida)
- [x] `generateCard`/`generateDossier` aceitam `provider` do dispositivo; precedência curadoria → dispositivo → ambiente → `pending`
- [x] `providerStatus` reporta as duas camadas; nenhuma chave em log/mensagem/URL
- **Gates:** `listProviderModels` respondeu 200 com 3 modelos do mock ✅ · `testProvider` respondeu "verificado há instantes · 4 ms" ✅ · chamada sem `provider` cai no ambiente (código + teste de contrato) ✅

## Fase 3 — UI de configuração
- [x] `src/components/provider-settings.tsx`: catálogo com busca e grupos, card do provedor, chave mascarada, URL editável com normalização, adaptador no personalizado
- [x] Listagem de modelos com busca, contagem e selo `grátis`; fallback curado + campo livre
- [x] Teste de conexão com latência, resumo do ativo, `verifiedAt`, remover provedor
- [x] `settings.tsx` usa o componente; sem cor hardcoded; rótulos acessíveis; 375 px sem overflow
- **Gates:** `tsc` 0 ✅ · `eslint .` 0 erros (6 avisos herdados dos componentes shadcn) ✅ · `vite build` exit 0 ✅ · preview: grupos "grátis agora · 6 / locais · 4 / principais · 12" renderizados, modelo `mock-tutor:free` com selo grátis, nota de normalização "removi o /chat/completions…" ✅

## Fase 4 — Migração e integração
- [x] `hydrate()` migra `settings.provider` antigo sem perder vocabulário/músicas
- [x] `card-queue.ts` e `vocabulary.$wordId.tsx` transportam a configuração
- **Gates:** `vitest run` cobre migração (ausente/legado/novo) ✅ · provider configurado persistiu em `verso.state.v1` com modelo e `verifiedAt` ✅ · card/dossiê remoto pelo dispositivo: **não verificado automaticamente** (orçamento de navegação do preview esgotado)

## Fase 5 — Testes e gates globais
- [x] `src/test/providers.test.ts`: catálogo, saneamento, 3 adaptadores, erro, `isFreeModel`, migração, chave fora do corpo
- [x] `AGENTS.md` atualiza contagem (56) e descreve provedores/precedência
- **Gates:** `tsc` 0 ✅ · `eslint .` 0 erros ✅ · `vitest run` 56/56 ✅ · `vite build` exit 0 ✅

## Fase 6 — Verificação no preview
- [x] Provedor compatível com OpenAI servido em contêiner local (só na verificação, em `/tmp`)
- [x] `/settings`: personalizado → "listar modelos" devolveu 3 modelos → escolher `mock-mini` → "testar conexão" com latência → configuração gravada no estado
- [x] Console sem erro novo; chave ausente do texto da página (input `password`)
- [ ] Recarregar o documento e conferir a configuração hidratada — **não verificado automaticamente** (o navegador de verificação zera o `localStorage` entre chamadas; o iframe de re-hidratação não concluiu dentro do orçamento)
- [ ] Marcar palavra na leitura → card remoto → dossiê remoto — **não verificado automaticamente** (navegação do preview a ~9 s por rota esgotou as 8 chamadas do turno)
- **Gates:** 4 capturas da seção de provedor (catálogo, formulário, modelos, conexão) ✅ · persistência lida do `localStorage` ✅ · F5/F6 verdes acima

## Próximo remix
- [ ] Repetir F6 num turno com orçamento de preview livre: uma sessão, provedor mock, palavra marcada → card → dossiê → recarregar
- [ ] PWA/service worker (offline de shell), dossiê remoto com checagem extra do veredito ✗/✓/◐, `project3`
