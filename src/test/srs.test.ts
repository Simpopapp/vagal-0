import { describe, expect, it } from "vitest";

import { initialSrs, pickAngle, schedule } from "../lib/srs";

const NOW = 1_700_000_000_000;

describe("agendamento da revisão", () => {
  it("começa vencida, sem intervalo", () => {
    const srs = initialSrs(NOW);
    expect(srs.interval).toBe(0);
    expect(srs.due).toBe(NOW);
    expect(srs.reps).toBe(0);
  });

  it("errar volta para 1 dia e registra o lapso", () => {
    const studied = { ...initialSrs(NOW), reps: 3, interval: 7, ease: 2.3, streak: 3 };
    const after = schedule(studied, 0, NOW);
    expect(after.interval).toBe(1);
    expect(after.lapses).toBe(1);
    expect(after.streak).toBe(0);
    expect(after.due).toBe(NOW + 86_400_000);
    expect(after.ease).toBeLessThan(2.3);
  });

  it("acertar avança para o próximo intervalo", () => {
    const first = schedule(initialSrs(NOW), 2, NOW);
    expect(first.interval).toBe(1);
    const second = schedule(first, 2, NOW);
    expect(second.interval).toBe(3);
    expect(second.reps).toBe(2);
  });

  it("respeita os limites de facilidade", () => {
    const hard = schedule({ ...initialSrs(NOW), ease: 1.3 }, 0, NOW);
    expect(hard.ease).toBe(1.3);
    const easy = schedule({ ...initialSrs(NOW), ease: 2.8 }, 2, NOW);
    expect(easy.ease).toBe(2.8);
  });

  it("alterna o ângulo conforme as repetições", () => {
    const angles = [0, 1, 2, 3].map((reps) => pickAngle("hold", reps));
    expect(new Set(angles).size).toBe(3);
    expect(angles[0]).not.toBe(angles[1]);
  });
});
