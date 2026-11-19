// Casos CT-01 a CT-28 de docs/planejamento/plano-de-testes.md
import { describe, expect, it } from "vitest";
import {
  calcularParticipacao,
  CONFIG_V1,
  ErroDominio,
  MULTIPLICADORES_TORRE_V1 as TORRE,
  type StatusRun,
} from "../src/index.js";

/** Multiplicadores dos encontros da Torre (Naght 25, Betelgeuse 50 e 75). */
const M: Record<string, number> = {
  "1,0": TORRE.NAGHT_25,
  "1,5": TORRE.BETELGEUSE_50,
  "2,0": TORRE.BETELGEUSE_75,
};
const S: Record<string, StatusRun> = { "1,0": "CONCLUIDA", "0,5": "FALHA_CHEFE", "0": "ABORTADA" };
const F: Record<string, number> = { "1": 100, "0,5": 50, "0": 0 };

function P(rank: number, m: string, s: string, f: string): number {
  return calcularParticipacao(
    { rank, multiplicadorEncontroCentesimos: M[m]!, status: S[s]!, fracaoCentesimos: F[f]! },
    CONFIG_V1,
  ).pontos;
}

describe("2.1 Ranks (N25, Conc, f=1)", () => {
  it.each([
    ["CT-01", 1, 100],
    ["CT-02", 2, 150],
    ["CT-03", 3, 200],
    ["CT-04", 4, 250],
    ["CT-05", 5, 300],
  ])("%s: rank %i → %i", (_id, rank, esperado) => {
    expect(P(rank, "1,0", "1,0", "1")).toBe(esperado);
  });
});

describe("2.2 Chefe × status (r5, r3, r1)", () => {
  it.each([
    ["CT-06", "1,0", "1,0", 300, 200, 100],
    ["CT-07", "1,0", "0,5", 150, 100, 50],
    ["CT-08", "1,0", "0", 0, 0, 0],
    ["CT-09", "1,5", "1,0", 450, 300, 150],
    ["CT-10", "1,5", "0,5", 225, 150, 75],
    ["CT-11", "1,5", "0", 0, 0, 0],
    ["CT-12", "2,0", "1,0", 600, 400, 200],
    ["CT-13", "2,0", "0,5", 300, 200, 100],
    ["CT-14", "2,0", "0", 0, 0, 0],
  ])("%s: M=%s S=%s → r5 %i / r3 %i / r1 %i", (_id, m, s, r5, r3, r1) => {
    expect([P(5, m, s, "1"), P(3, m, s, "1"), P(1, m, s, "1")]).toEqual([r5, r3, r1]);
  });
});

describe("2.3 Participação parcial e arredondamento meio-para-cima", () => {
  it.each([
    ["CT-15", 4, "1,0", "1,0", "0,5", 125],
    ["CT-16", 4, "1,0", "0,5", "0,5", 63],
    ["CT-17", 1, "1,5", "0,5", "1", 75],
    ["CT-18", 2, "1,5", "0,5", "1", 113],
    ["CT-19", 1, "1,5", "0,5", "0,5", 38],
    ["CT-20", 2, "1,5", "0,5", "0,5", 56],
    ["CT-21", 4, "1,5", "0,5", "0,5", 94],
    ["CT-22", 5, "1,5", "0,5", "0,5", 113],
    ["CT-23", 2, "1,5", "1,0", "0,5", 113],
    ["CT-24", 4, "1,5", "1,0", "0,5", 188],
    ["CT-25", 4, "2,0", "0,5", "0,5", 125],
    ["CT-26", 5, "2,0", "1,0", "0", 0],
  ])("%s: r%i M=%s S=%s f=%s → %i", (_id, rank, m, s, f, esperado) => {
    expect(P(rank, m, s, f)).toBe(esperado);
  });

  it("CT-27: composição 1 em B50 com falha — arredonda por participante (total 1314)", () => {
    const pontos = [5, 5, 4, 3, 3, 3, 2, 2].map((r) => P(r, "1,5", "0,5", "1"));
    expect(pontos).toEqual([225, 225, 188, 150, 150, 150, 113, 113]);
    expect(pontos.reduce((a, b) => a + b, 0)).toBe(1314);
  });

  it("CT-28: composição 2 (Sorcerer parcial) — total 925", () => {
    const pontos = [
      P(5, "1,0", "1,0", "1"),
      P(3, "1,0", "1,0", "1"),
      P(3, "1,0", "1,0", "1"),
      P(1, "1,0", "1,0", "1"),
      P(4, "1,0", "1,0", "0,5"),
    ];
    expect(pontos).toEqual([300, 200, 200, 100, 125]);
    expect(pontos.reduce((a, b) => a + b, 0)).toBe(925);
  });
});

describe("Snapshot e validações", () => {
  it("grava todos os fatores usados no cálculo", () => {
    expect(
      calcularParticipacao(
        {
          rank: 4,
          multiplicadorEncontroCentesimos: TORRE.BETELGEUSE_50,
          status: "FALHA_CHEFE",
          fracaoCentesimos: 50,
        },
        CONFIG_V1,
      ),
    ).toEqual({
      rank: 4,
      base: 100,
      alphaCentesimos: 50,
      pesoCentesimos: 250,
      multiplicadorEncontroCentesimos: 150,
      multiplicadorStatusCentesimos: 50,
      fracaoCentesimos: 50,
      pontos: 94,
    });
  });

  it.each([0, 6, -1, 2.5, Number.NaN])("rank %s é rejeitado (CT-56)", (rank) => {
    expect(() =>
      calcularParticipacao(
        { rank, multiplicadorEncontroCentesimos: TORRE.NAGHT_25, status: "CONCLUIDA", fracaoCentesimos: 100 },
        CONFIG_V1,
      ),
    ).toThrow(expect.objectContaining({ codigo: "RANK_INVALIDO" }));
  });

  it.each([25, 75, 101, -50])("fração %i rejeitada (C6)", (fracao) => {
    expect(() =>
      calcularParticipacao(
        {
          rank: 3,
          multiplicadorEncontroCentesimos: TORRE.NAGHT_25,
          status: "CONCLUIDA",
          fracaoCentesimos: fracao,
        },
        CONFIG_V1,
      ),
    ).toThrow(ErroDominio);
  });

  it("multiplicador do encontro inválido e status desconhecido são rejeitados", () => {
    for (const m of [0, -100, 150.5, Number.NaN]) {
      expect(() =>
        calcularParticipacao(
          { rank: 3, multiplicadorEncontroCentesimos: m, status: "CONCLUIDA", fracaoCentesimos: 100 },
          CONFIG_V1,
        ),
      ).toThrow(expect.objectContaining({ codigo: "ENCONTRO_INVALIDO" }));
    }
    expect(() =>
      calcularParticipacao(
        {
          rank: 3,
          multiplicadorEncontroCentesimos: TORRE.NAGHT_25,
          status: "PENDENTE" as StatusRun,
          fracaoCentesimos: 100,
        },
        CONFIG_V1,
      ),
    ).toThrow(expect.objectContaining({ codigo: "STATUS_INVALIDO" }));
  });

  it("CT-59/CT-60: nova versão de parâmetros só afeta cálculos feitos com ela", () => {
    const v2 = { ...CONFIG_V1, base: 120 };
    const v3 = { ...CONFIG_V1, alphaCentesimos: 100 };
    const entrada = {
      rank: 5,
      multiplicadorEncontroCentesimos: TORRE.NAGHT_25,
      status: "CONCLUIDA",
      fracaoCentesimos: 100,
    } as const;
    expect(calcularParticipacao(entrada, CONFIG_V1).pontos).toBe(300);
    expect(calcularParticipacao(entrada, v2).pontos).toBe(360);
    expect(calcularParticipacao({ ...entrada, rank: 3 }, v3).pontos).toBe(300);
  });

  it("configuração inválida é rejeitada", () => {
    const entrada = {
      rank: 1,
      multiplicadorEncontroCentesimos: TORRE.NAGHT_25,
      status: "CONCLUIDA",
      fracaoCentesimos: 100,
    } as const;
    expect(() => calcularParticipacao(entrada, { ...CONFIG_V1, base: -1 })).toThrow(
      expect.objectContaining({ codigo: "CONFIG_INVALIDA" }),
    );
    expect(() => calcularParticipacao(entrada, { ...CONFIG_V1, tetoCredoresBp: 10_001 })).toThrow(
      expect.objectContaining({ codigo: "CONFIG_INVALIDA" }),
    );
  });
});
