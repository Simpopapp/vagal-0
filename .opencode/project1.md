# Planejamento: app de estudo de idiomas por letras de música

## A ideia

Você digita o nome de uma música e o cantor do jeito que vier (errado, abreviado, com a ordem trocada) e o app entende qual música é, traz a letra original completa e deixa você estudar em cima dela. Toca numa palavra, entende o que ela significa ali. Toca numa frase, entende o que ela quer dizer de verdade. Tudo que você traduz vai se acumulando num vocabulário pessoal, organizado por música e por outras categorias, com formas de praticar essas palavras depois.

O app tem três partes que se alimentam em sequência: **achar a música, ler e traduzir a letra, fixar o vocabulário**.

## Achar a música

O ponto central é que a busca não é mecânica. A IA faz o papel de quem interpreta o que a pessoa quis dizer. "bohemian rapsody quen" vira Queen / Bohemian Rhapsody sem o usuário precisar acertar nada. O caminho é este:

- A IA lê o texto bruto e deduz artista e música, com um grau de confiança e algumas alternativas prováveis.
- Com isso, ela vai ao Vagalume (a grande biblioteca de letras) e encontra a música sozinha.
- Se a busca direta falha, ela tenta variações do nome ou busca por trecho.
- Quando há mais de uma candidata plausível (versão ao vivo, cover, artistas diferentes com a mesma música), a IA escolhe a mais provável olhando os resultados reais.
- Se mesmo assim a dúvida for grande, o app não chuta: mostra 2 ou 3 opções em cards ("era essa?") e o usuário confirma com um toque.
- A letra é devolvida limpa e bem formatada (estrofes separadas, refrão identificado, sem lixo de site).

Uma regra que vale como princípio: **a IA nunca escreve nem completa a letra**. Ela só interpreta, procura e escolhe. O texto exibido é sempre o que a fonte devolveu, porque letra gerada por IA inventa versos. Como letra é conteúdo com direitos autorais, vale dar crédito e link para a fonte na tela.

Músicas já buscadas ficam salvas, então a segunda abertura é instantânea.

## Ler a letra

A tela principal é a letra completa, organizada por estrofes, pensada para leitura confortável. Dois gestos fazem o app funcionar:

- **Tocar numa palavra** abre o card de palavra.
- **Tocar numa frase (linha)** abre o card de frase.

As traduções são geradas no momento do toque, não antes. O card abre rápido, com esqueleto visual, e vai se preenchendo.

### Card de palavra

Tem 3 tipos de tradução, cada um com identidade visual própria (cor e ícone):

1. **Tipo na frase** — o que a palavra significa naquele contexto específico da letra.
2. **Tipo geral** — os significados mais comuns da palavra fora dali.
3. **Tipo "por que ao invés de"** — por que o compositor usou aquela palavra e não um sinônimo mais óbvio (nuance, registro, sonoridade).

### Card de frase

- Tradução da frase inteira, com o sentido real (não palavra por palavra).
- **Termos e expressões**: gírias, phrasal verbs, expressões idiomáticas e construções em que o sentido literal não se aplica. Cada item aparece em negrito, seguido da sua explicação (por que a tradução não é literal e o que ele realmente quer dizer). Só entram termos que realmente merecem explicação. Se a frase não tem nada assim, a lista simplesmente não aparece, em vez de forçar conteúdo.

### Visual e experiência dos cards

- Os cards abrem como painel deslizante por baixo (bottom sheet), sem cobrir a letra inteira, para o usuário não perder onde estava.
- A hierarquia é: o que mais importa primeiro, detalhes depois.
- Termos e expressões dentro do card podem ser tocados para irem direto ao vocabulário.
- Tudo que a IA devolve passa por um formato estruturado e validado antes de aparecer, então a interface nunca mostra texto solto ou quebrado.

## Vocabulário

Toda palavra traduzida entra no vocabulário guardando o card completo, a frase da letra e a música de origem. A organização tem várias portas de entrada:

- **Por música de origem** (a mais natural: "palavras que aprendi em X").
- **Por categoria**: classe gramatical, gírias e expressões, favoritas, difíceis, recém-adicionadas.
- **Por frequência**: palavras que aparecem repetidamente nas músicas que você estuda.

## Prática

A prática usa o material que o usuário já gerou, sem conteúdo genérico:

- **Revisão espaçada**, com a frase original da letra como contexto, não a palavra solta.
- **Lacunas na própria letra**: a música de onde a palavra veio, com a palavra removida.
- **"Qual o significado nessa frase?"**, reaproveitando o tipo na frase.
- **"Por que não usar esse sinônimo?"**, reaproveitando o tipo por que ao invés de.
- Destaque para as palavras que o usuário mais erra.

## Sem internet

As letras já abertas e todo o vocabulário continuam acessíveis offline, assim como os cards que já foram gerados antes. Traduções novas dependem de conexão; quando não há, o app avisa de forma discreta em vez de falhar.

## Decisões em aberto

- A palavra vai automática para o vocabulário ou por botão "salvar"? (Inclinação: automática, com remoção fácil, para reduzir atrito.)
- Idioma de origem e destino inicial (inglês → português?) e se o app já nasce multi-idioma.
- O nível do usuário deve influenciar a profundidade dos cards?
- Controle de custo da IA: como limitar chamadas sem prejudicar a fluidez (o cache ajuda bastante).
