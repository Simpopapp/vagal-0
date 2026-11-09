# Roadmap — project1 (Verso)

Ordem de dependência do PRD (`prd-project1.md`) §12. Uma fase por bloco, com
gates verificáveis. `[x]` = item entregue; o gate é registrado com o resultado
real logo abaixo.

## Fase 1 — Fundação de domínio
- [x] `src/lib/types.ts` + schemas zod
- [x] `src/lib/tokenize.ts` (palavra/espaço/pontuação, apóstrofo, hífen, acento)
- [x] `src/lib/lexicon.ts` (122 entradas EN→PT com literal, na frase, por-que-não)
- [x] `src/lib/catalog.ts` (3 letras originais: Paper Boats, Neon Static, Slow Tide)
- [x] `src/lib/srs.ts` + `src/lib/level.ts` (agendamento e régua de pré-marcação)
- [x] `src/lib/store.ts` (localStorage, `useSyncExternalStore`, server snapshot constante)
- **Gates:** `tsc --noEmit` limpo ✅ · `vitest run` 25 testes verdes ✅ · `routeTree.gen.ts` gerado pelo plugin, nunca editado ✅

## Fase 2 — Busca interpretada
- [x] `src/lib/search.ts` (normalização, stopwords, pontuação, confiança, candidatas)
- [x] `src/lib/lyrics.functions.ts` (Vagalume com timeout de 5s e degradação declarada)
- [x] `/` substitui o placeholder: busca, interpretação, cards "era essa?", recentes, demonstração
- **Gates:** testes "paper boot" / "neon statc" / "slow tide letra" ✅ · preview: home renderiza e busca "paper boot" devolve 1 candidata com confiança alta ✅ · falha de rede do Vagalume mostra aviso e mantém as demonstrações ✅

## Fase 3 — Leitura e marcação
- [x] `src/routes/song.$songId.tsx` com estrofes e tokens acessíveis
- [x] Modos card/coleta alternáveis, com preferência persistida
- [x] Painel de card (Sheet) com literal / na frase / por que não [sinônimo]
- [x] Pré-marcação por nível + "ignorar" que alimenta `known`
- [x] Fila de cards (concorrência 1) com indicador "n de m prontas" e furar fila
- [x] Resumo de coleta no rodapé
- **Gates:** ⚠ implementação completa, mas a marcação/card **não** foi exercitada automaticamente no preview (limite de chamadas de verificação do turno). Rota `/song/paper-boats` responde 200 e renderiza o estado "letra não encontrada" quando não há dado local ✅.

## Fase 4 — Vocabulário e dossiê
- [x] `/vocabulary` com filtros combináveis (música, categoria, estágio, frequência)
- [x] Mudança de estágio + favorita, persistidas
- [x] `/vocabulary/$wordId` com dossiê completo e "aprofundar agora"
- [x] Reaparição: mesmo lemma em outra música vira uso novo, sem duplicata
- **Gates:** SSR de `/vocabulary` renderiza estado vazio correto ✅ · filtros/estágio/dossiê ⚠ não exercitados automaticamente no preview.

## Fase 5 — Prática
- [x] `src/lib/practice.ts` (3 ângulos, distratores reais, sessão de até 10)
- [x] `/practice` com feedback, progresso e resultado final (próximos vencimentos)
- [x] Agendamento SM-2 aplicado na resposta
- **Gates:** testes de sessão (3 questões, ângulos distintos, uma resposta correta cada) ✅ · sessão vazia com explicação ✅ (SSR) · fluxo clicado ⚠ não exercitado automaticamente no preview.

## Fase 6 — Ajustes, offline e polimento
- [x] `/settings`: nível, modo de toque, provedor de cards, dados locais
- [x] Chips de fonte da letra e de offline; retomada da fila ao reconectar
- [x] Metadados por rota, `<Toaster />`, navegação por teclado, contraste
- [x] `vite build` + `tsc --noEmit` + `vitest run` + `eslint` verdes
- **Gates:** build ✅ · tipos ✅ · testes ✅ · lint sem erro (só os 6 avisos herdados dos componentes shadcn) ✅ · ajustes não clicados automaticamente ⚠

## Verificação do turno (registro)
- Automático: `tsc --noEmit`, `vite build`, `vitest run` (25), `eslint .`, HTTP 200 + conteúdo SSR em `/`, `/vocabulary`, `/practice`, `/settings`, `/song/$id`, 404 em rota inexistente.
- Preview: home e resultado de busca capturados; Vagalume sem rede degradou como previsto.
- Pendente de automação: marcar em coleta, painel de card, envio ao vocabulário, filtros do vocabulário, dossiê, sessão de prática.

## Próximo remix
- [ ] Exercitar os fluxos das fases 3–5 no preview em **uma única** sessão (o armazenamento do navegador de verificação é limpo entre chamadas)
- [ ] Provedor de IA real (`AI_API_KEY` no servidor) + card para palavra fora do léxico
- [ ] Dossiê remoto e checagem extra do veredito ✗/✓/◐ antes de salvar
- [ ] PWA/service worker (offline de shell) e `project2` (configuração de provedores)
