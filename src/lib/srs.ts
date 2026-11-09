import type { ReviewAngle, SrsState } from "./types";

/** Dias de intervalo. `0` = aprender hoje mesmo. */
export const INTERVALS = [0, 1, 3, 7, 16, 35, 75] as const;

const DAY = 86_400_000;

export function initialSrs(now = Date.now()): SrsState {
  return { due: now, interval: 0, ease: 2.3, reps: 0, lapses: 0, streak: 0 };
}

/**
 * SM-2 simplificado.
 * grade 0 = errou · 1 = certo com esforço · 2 = certo.
 * Função pura: o mesmo estado + grade + instante sempre devolve o mesmo resultado.
 */
export function schedule(srs: SrsState, grade: 0 | 1 | 2, now = Date.now()): SrsState {
  const ease = clamp(srs.ease + (grade === 0 ? -0.2 : grade === 1 ? -0.05 : 0.1), 1.3, 2.8);
  const streak = grade === 0 ? 0 : srs.streak + 1;
  const reps = srs.reps + 1;

  let interval: number;
  if (grade === 0) {
    interval = 1;
  } else if (srs.reps === 0) {
    interval = 1;
  } else if (grade === 1) {
    interval = Math.max(1, srs.interval);
  } else {
    const nextStep = nearestStepIndex(srs.interval) + 1;
    interval = INTERVALS[Math.min(nextStep, INTERVALS.length - 1)] ?? srs.interval;
  }

  if (grade === 2 && streak > 0 && streak % 3 === 0) {
    interval = Math.max(interval, Math.round(interval * 1.2));
  }

  return {
    due: now + interval * DAY,
    interval,
    ease,
    reps,
    lapses: srs.lapses + (grade === 0 ? 1 : 0),
    streak,
  };
}

function nearestStepIndex(interval: number): number {
  let best = 0;
  for (let i = 0; i < INTERVALS.length; i += 1) {
    if ((INTERVALS[i] ?? 0) <= interval) best = i;
  }
  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Prioridade de estudo: quem erra mais volta mais. */
export function priority(srs: SrsState): number {
  return 1 + srs.lapses;
}

export function isDue(srs: SrsState, now = Date.now()): boolean {
  return srs.due <= now;
}

/** Ciclo de ângulos embaralhado por id, para não repetir o mesmo ângulo em seguida. */
const ANGLES: ReviewAngle[] = ["context", "synonym", "gap"];

export function pickAngle(entryId: string, reps: number): ReviewAngle {
  const offset = hash(entryId) % ANGLES.length;
  return ANGLES[(offset + reps) % ANGLES.length] ?? "context";
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) % 100_000;
  }
  return h;
}

export function formatDue(ts: number, now = Date.now()): string {
  const diff = ts - now;
  if (diff <= 0) return "agora";
  const days = Math.round(diff / DAY);
  if (days <= 1) return "amanhã";
  return `em ${days} dias`;
}
