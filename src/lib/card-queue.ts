import { generateCard } from "./ai.functions";
import { buildLocalCard } from "./card-engine";
import { failCard, getSnapshot, patchEntry, setCard } from "./store";

/**
 * Fila de cards do modo coleta: concorrência 1, uma palavra por vez.
 * Abrir o card de uma palavra pendente fura a fila.
 */
const queue: string[] = [];
let running = false;

export function enqueueCard(entryId: string, options: { front?: boolean } = {}): void {
  if (queue.includes(entryId)) return;
  if (options.front) queue.unshift(entryId);
  else queue.push(entryId);
  void drain();
}

export function queuedEntries(): string[] {
  return [...queue];
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;

      const snapshot = getSnapshot();
      const entry = snapshot.vocabulary[id];
      if (!entry || entry.cardState === "ready") continue;

      const local = buildLocalCard(entry.term, entry.lemma, snapshot.settings.level);
      if (local.ok) {
        setCard(id, local.card);
        continue;
      }

      if (snapshot.settings.provider.kind !== "remote") {
        // Sem provedor remoto: continua pendente, com o motivo declarado.
        patchEntry(id, { cardState: "pending", cardNote: local.reason });
        continue;
      }

      try {
        const response = await generateCard({
          data: {
            term: entry.term,
            norm: entry.lemma,
            phrase: entry.phrase,
            level: snapshot.settings.level,
          },
        });
        if (response.ok) setCard(id, response.card);
        else failCard(id, response.reason);
      } catch (error) {
        console.error("[verso] fila de cards falhou", error);
        failCard(id, "a fila foi interrompida — tente gerar este card de novo");
      }
    }
  } finally {
    running = false;
  }
}
