// Casos CT-29 a CT-51, CT-74 e CT-75 de docs/planejamento/plano-de-testes.md
import { describe, expect, it } from "vitest";
import {
  type CategoriaEmprestimo,
  CONFIG_V1,
  dividirEmprestimos,
  type EntradaEmprestimo,
  type ResultadoDivisao,
} from "../src/index.js";

const CAT: Record<string, CategoriaEmprestimo> = { E: "ESSENCIAL", I: "IMPORTANTE", C: "COMPLEMENTAR" };
const TOMADOR = "tomador";

/** "X:E" = sugestão da categoria; "X:E@25" = override de 25%; "X:@15" = override com categoria Importante. */
function emp(spec: string): EntradaEmprestimo {
  const [credor, resto] = spec.split(":") as [string, string];
  const [cat, pct] = resto.split("@") as [string, string | undefined];
  const base = { credorJogadorId: credor, categoria: CAT[cat || "I"]! };
  return pct === undefined ? base : { ...base, percentualInformadoBp: Number(pct) * 100 };
}

function dividir(P: number, specs: string[]): ResultadoDivisao {
  return dividirEmprestimos(P, TOMADOR, specs.map(emp), CONFIG_V1);
}

const parcelas = (r: ResultadoDivisao) => r.parcelas.map((p) => p.pontos);

const CASOS_VALIDOS: [string, number, string[], number[], number, boolean][] = [
  ["CT-29", 200, ["X:E", "Y:C"], [40, 10], 150, false],
  ["CT-30", 200, ["X:E", "Y:I"], [40, 20], 140, false],
  ["CT-31", 300, ["X:E@25", "Y:I"], [75, 30], 195, false],
  ["CT-32", 125, ["X:@15", "Y:@15"], [18, 18], 89, false],
  ["CT-33", 300, ["X:E", "Y:E", "Z:I"], [60, 60, 30], 150, false],
  ["CT-34", 125, ["X:E", "Y:E", "Z:I"], [25, 25, 12], 63, false],
  ["CT-35", 600, ["X:E", "Y:E", "Z:E"], [100, 100, 100], 300, true],
  ["CT-36", 250, ["X:E", "Y:E", "Z:E"], [41, 41, 41], 127, true],
  ["CT-37", 300, ["X:E", "Y:E", "Z:E", "W:I"], [42, 42, 42, 21], 153, true],
  ["CT-38", 100, ["X:I", "Y:I", "Z:I", "W:I", "V:I", "U:C"], [9, 9, 9, 9, 9, 4], 51, true],
  ["CT-39", 450, ["X:E@50"], [225], 225, false],
  ["CT-44", 100, ["X:@29"], [29], 71, false],
  ["CT-45", 94, ["X:@33"], [31], 63, false],
  ["CT-46", 94, ["X:E", "Y:C"], [18, 4], 72, false],
  ["CT-47", 0, ["X:E", "Y:I"], [0, 0], 0, false],
  ["CT-48", 200, ["X:E", "X:C"], [40, 10], 150, false],
  ["CT-49", 125, ["X:I", "X:I"], [12, 12], 101, false],
  ["CT-74", 300, ["X:E@30", "Y:E"], [90, 60], 150, false],
];

describe("2.4 Empréstimos e divisão de pontos", () => {
  it.each(CASOS_VALIDOS)(
    "%s: P=%i %j → credores %j, tomador %i, redução=%s",
    (_id, P, specs, cred, T, aviso) => {
      const r = dividir(P, specs);
      expect(parcelas(r)).toEqual(cred);
      expect(r.pontosTomador).toBe(T);
      expect(r.reducaoProporcionalAplicada).toBe(aviso);
    },
  );

  it("CT-51: invariantes em todos os casos válidos (soma = P, tomador ≥ metade, sem negativos)", () => {
    for (const [, P, specs] of CASOS_VALIDOS) {
      const r = dividir(P, specs);
      const soma = parcelas(r).reduce((a, b) => a + b, 0) + r.pontosTomador;
      expect(soma).toBe(P);
      expect(r.pontosTomador).toBeGreaterThanOrEqual(Math.ceil(P / 2));
      expect(parcelas(r).every((p) => p >= 0 && Number.isInteger(p))).toBe(true);
    }
  });

  it.each([
    ["CT-40", 300, ["X:@30", "Y:@25"]],
    ["CT-41", 300, ["X:@51"]],
    ["CT-50", 300, ["X:@30", "Y:E", "Z:C"]],
    ["CT-75", 300, ["X:E@35", "Y:E"]],
  ])("%s: override com soma acima do teto é rejeitado (D15)", (_id, P, specs) => {
    expect(() => dividir(P, specs)).toThrow(
      expect.objectContaining({ codigo: "TETO_EXCEDIDO_COM_OVERRIDE" }),
    );
  });

  it("CT-42: credor igual ao tomador é rejeitado (comparação por jogador — C3)", () => {
    expect(() => dividir(200, [`${TOMADOR}:E`])).toThrow(
      expect.objectContaining({ codigo: "CREDOR_IGUAL_TOMADOR" }),
    );
  });

  it("CT-43: credor que também participou da run recebe a parcela além dos próprios pontos", () => {
    const gus = dividirEmprestimos(
      150,
      "gus",
      [{ credorJogadorId: "ana", categoria: "ESSENCIAL" }],
      CONFIG_V1,
    );
    expect(gus.parcelas[0]?.pontos).toBe(30);
    expect(gus.pontosTomador).toBe(120);
    const totalAna = 300 + (gus.parcelas[0]?.pontos ?? 0);
    expect(totalAna).toBe(330);
    expect(300 + gus.pontosTomador + 30).toBe(450);
  });

  it("CT-64: o resultado expõe P original, % sugerido, % informado e parcela", () => {
    const r = dividir(300, ["X:E@25", "Y:I"]);
    expect(r.pontosOriginais).toBe(300);
    expect(r.parcelas).toEqual([
      expect.objectContaining({
        credorJogadorId: "X",
        percentualSugeridoBp: 2000,
        percentualInformadoBp: 2500,
        pontos: 75,
      }),
      expect.objectContaining({
        credorJogadorId: "Y",
        percentualSugeridoBp: 1000,
        percentualInformadoBp: null,
        pontos: 30,
      }),
    ]);
  });

  it("sem empréstimos o tomador fica com tudo", () => {
    expect(dividir(300, [])).toMatchObject({
      pontosTomador: 300,
      parcelas: [],
      reducaoProporcionalAplicada: false,
    });
  });

  it.each([-1, 1.5, Number.NaN])("pontos inválidos (%s) são rejeitados", (P) => {
    expect(() => dividir(P, [])).toThrow(expect.objectContaining({ codigo: "PONTOS_INVALIDOS" }));
  });

  it.each([-100, 10_001, 12.5])("percentual informado inválido (%s bp) é rejeitado", (bp) => {
    expect(() =>
      dividirEmprestimos(
        100,
        TOMADOR,
        [{ credorJogadorId: "X", categoria: "ESSENCIAL", percentualInformadoBp: bp }],
        CONFIG_V1,
      ),
    ).toThrow(expect.objectContaining({ codigo: "PERCENTUAL_INVALIDO" }));
  });

  it("categoria desconhecida é rejeitada", () => {
    expect(() =>
      dividirEmprestimos(
        100,
        TOMADOR,
        [{ credorJogadorId: "X", categoria: "LENDARIO" as CategoriaEmprestimo }],
        CONFIG_V1,
      ),
    ).toThrow(expect.objectContaining({ codigo: "CATEGORIA_INVALIDA" }));
  });
});
