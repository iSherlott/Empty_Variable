// Propriedades da seção 4 de docs/planejamento/plano-de-testes.md aplicáveis ao motor puro.
// (Propriedade 12 — ledger — é coberta nos testes de integração da API.)
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_EMPRESTIMO,
  CONFIG_V1,
  type ConfigPontuacao,
  calcularParticipacao,
  dividirEmprestimos,
  ErroDominio,
  FRACOES_PERMITIDAS,
  STATUS_RUN,
} from "../src/index.js";

const arbEntrada = fc.record({
  rank: fc.integer({ min: 1, max: 5 }),
  // Qualquer encontro (D44): de 0,01 a 5,00 — inclui os da Torre (1, 1,5 e 2).
  multiplicadorEncontroCentesimos: fc.integer({ min: 1, max: 500 }),
  status: fc.constantFrom(...STATUS_RUN),
  fracaoCentesimos: fc.constantFrom(...FRACOES_PERMITIDAS),
});

const arbConfig: fc.Arbitrary<ConfigPontuacao> = fc
  .record({ base: fc.integer({ min: 1, max: 10_000 }), alphaCentesimos: fc.integer({ min: 0, max: 400 }) })
  .map((p) => ({ ...CONFIG_V1, ...p }));

const arbEmprestimo = fc.record(
  {
    credorJogadorId: fc.constantFrom("A", "B", "C", "D"),
    categoria: fc.constantFrom(...CATEGORIAS_EMPRESTIMO),
    percentualInformadoBp: fc.integer({ min: 0, max: 10_000 }),
  },
  { requiredKeys: ["credorJogadorId", "categoria"] },
);
const arbSoSugestoes = fc.array(
  fc.record({
    credorJogadorId: fc.constantFrom("A", "B", "C", "D"),
    categoria: fc.constantFrom(...CATEGORIAS_EMPRESTIMO),
  }),
  { maxLength: 10 },
);
const arbPontos = fc.integer({ min: 0, max: 100_000 });

function exatoComoRacional(
  e: {
    rank: number;
    multiplicadorEncontroCentesimos: number;
    status: (typeof STATUS_RUN)[number];
    fracaoCentesimos: number;
  },
  c: ConfigPontuacao,
): [bigint, bigint] {
  const w = 100 + c.alphaCentesimos * (e.rank - 1);
  const num =
    BigInt(c.base) *
    BigInt(w) *
    BigInt(e.multiplicadorEncontroCentesimos) *
    BigInt(c.multiplicadorStatus[e.status]) *
    BigInt(e.fracaoCentesimos);
  return [num, 100n ** 4n];
}

/** Executa a divisão; retorna null quando a regra D15 rejeita. */
function tentarDividir(P: number, emps: Parameters<typeof dividirEmprestimos>[2]) {
  try {
    return dividirEmprestimos(P, "tomador", emps, CONFIG_V1);
  } catch (e) {
    if (e instanceof ErroDominio && e.codigo === "TETO_EXCEDIDO_COM_OVERRIDE") return null;
    throw e;
  }
}

describe("Propriedades do motor", () => {
  it("P1/P2/P3/P9: conservação, tomador ≥ metade, inteiros ≥ 0, parcela ≤ P × p", () => {
    fc.assert(
      fc.property(arbPontos, fc.array(arbEmprestimo, { maxLength: 10 }), (P, emps) => {
        const r = tentarDividir(P, emps);
        if (r === null) return;
        const soma = r.parcelas.reduce((a, p) => a + p.pontos, 0);
        expect(soma + r.pontosTomador).toBe(P);
        expect(r.pontosTomador).toBeGreaterThanOrEqual(P - Math.floor(P / 2));
        for (const p of r.parcelas) {
          expect(Number.isInteger(p.pontos) && p.pontos >= 0).toBe(true);
          expect(p.pontos * 10_000).toBeLessThanOrEqual(P * p.percentualAplicadoBp);
        }
      }),
    );
  });

  it("P4: arredondamento — |P − exato| ≤ 0,5 e meio arredonda para cima", () => {
    fc.assert(
      fc.property(arbEntrada, arbConfig, (e, c) => {
        const P = BigInt(calcularParticipacao(e, c).pontos);
        const [num, den] = exatoComoRacional(e, c);
        const dif = P * den - num; // (P − exato) × den
        expect(-den < 2n * dif && 2n * dif <= den).toBe(true);
      }),
    );
  });

  it("P5: monotonicidade em rank, encontro, status e fração", () => {
    const ordemStatus = ["ABORTADA", "FALHA_CHEFE", "CONCLUIDA"] as const;
    const ordemFracao = [0, 50, 100] as const;
    fc.assert(
      fc.property(arbEntrada, arbConfig, (e, c) => {
        const P = calcularParticipacao(e, c).pontos;
        if (e.rank < 5)
          expect(calcularParticipacao({ ...e, rank: e.rank + 1 }, c).pontos).toBeGreaterThanOrEqual(P);
        expect(
          calcularParticipacao(
            { ...e, multiplicadorEncontroCentesimos: e.multiplicadorEncontroCentesimos + 1 },
            c,
          ).pontos,
        ).toBeGreaterThanOrEqual(P);
        const is = ordemStatus.indexOf(e.status);
        if (is < 2)
          expect(
            calcularParticipacao({ ...e, status: ordemStatus[is + 1]! }, c).pontos,
          ).toBeGreaterThanOrEqual(P);
        const iff = ordemFracao.indexOf(e.fracaoCentesimos);
        if (iff < 2)
          expect(
            calcularParticipacao({ ...e, fracaoCentesimos: ordemFracao[iff + 1]! }, c).pontos,
          ).toBeGreaterThanOrEqual(P);
      }),
    );
  });

  it("P6: zero absorvente — S = 0 ou f = 0 ⇒ P = 0 e parcelas = 0", () => {
    fc.assert(
      fc.property(arbEntrada, arbConfig, arbSoSugestoes, (e, c, emps) => {
        const zerado = calcularParticipacao({ ...e, status: "ABORTADA" }, c).pontos;
        expect(zerado).toBe(0);
        expect(calcularParticipacao({ ...e, fracaoCentesimos: 0 }, c).pontos).toBe(0);
        const r = dividirEmprestimos(zerado, "tomador", emps, CONFIG_V1);
        expect(r.parcelas.every((p) => p.pontos === 0) && r.pontosTomador === 0).toBe(true);
      }),
    );
  });

  it("P7: independência do grupo — o cálculo só depende da própria participação", () => {
    fc.assert(
      fc.property(fc.array(arbEntrada, { minLength: 1, maxLength: 12 }), (grupo) => {
        const sozinho = grupo.map((e) => calcularParticipacao(e, CONFIG_V1).pontos);
        const reordenado = [...grupo]
          .reverse()
          .map((e) => calcularParticipacao(e, CONFIG_V1).pontos)
          .reverse();
        expect(reordenado).toEqual(sozinho);
      }),
    );
  });

  it("P8: só sugestões — acima do teto reduz (parcelas ≤ 50% de P); até o teto não reduz", () => {
    fc.assert(
      fc.property(arbPontos, arbSoSugestoes, (P, emps) => {
        const r = dividirEmprestimos(P, "tomador", emps, CONFIG_V1);
        const soma = emps.reduce((a, e) => a + CONFIG_V1.percentualCategoriaBp[e.categoria], 0);
        expect(r.reducaoProporcionalAplicada).toBe(soma > CONFIG_V1.tetoCredoresBp);
        if (!r.reducaoProporcionalAplicada) {
          r.parcelas.forEach((p) => expect(p.pontos).toBe(Math.floor((P * p.percentualAplicadoBp) / 10_000)));
        }
        expect(r.parcelas.reduce((a, p) => a + p.pontos, 0)).toBeLessThanOrEqual(Math.floor(P / 2));
      }),
    );
  });

  it("P10: só overrides com soma > 50% é sempre rejeitado, nunca reduzido", () => {
    fc.assert(
      fc.property(
        arbPontos,
        fc
          .array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 6 })
          .filter((l) => l.reduce((a, b) => a + b, 0) > 5_000),
        (P, pcts) => {
          const emps = pcts.map((bp) => ({
            credorJogadorId: "A",
            categoria: "ESSENCIAL" as const,
            percentualInformadoBp: bp,
          }));
          expect(tentarDividir(P, emps)).toBeNull();
        },
      ),
    );
  });

  it("P11: recalcular a partir do snapshot reproduz os pontos, independentemente da config atual", () => {
    fc.assert(
      fc.property(arbEntrada, arbConfig, arbConfig, (e, original, atual) => {
        const snap = calcularParticipacao(e, original);
        const configDoSnapshot: ConfigPontuacao = {
          ...atual,
          base: snap.base,
          alphaCentesimos: snap.alphaCentesimos,
          multiplicadorStatus: {
            ...atual.multiplicadorStatus,
            [e.status]: snap.multiplicadorStatusCentesimos,
          },
        };
        const entradaDoSnapshot = {
          ...e,
          multiplicadorEncontroCentesimos: snap.multiplicadorEncontroCentesimos,
        };
        expect(calcularParticipacao(entradaDoSnapshot, configDoSnapshot).pontos).toBe(snap.pontos);
      }),
    );
  });

  it("P13: permutar a lista de empréstimos não altera parcelas nem tomador", () => {
    fc.assert(
      fc.property(arbPontos, fc.array(arbEmprestimo, { maxLength: 8 }), fc.integer(), (P, emps, semente) => {
        const r1 = tentarDividir(P, emps);
        const permutado = emps
          .map((e, i) => ({ e, i, k: (i * 7919 + semente) % 101 }))
          .sort((a, b) => a.k - b.k || a.i - b.i);
        const r2 = tentarDividir(
          P,
          permutado.map((x) => x.e),
        );
        if (r1 === null || r2 === null) {
          expect(r1).toBe(r2);
          return;
        }
        expect(r2.pontosTomador).toBe(r1.pontosTomador);
        permutado.forEach((x, novo) => expect(r2.parcelas[novo]?.pontos).toBe(r1.parcelas[x.i]?.pontos));
      }),
    );
  });
});
