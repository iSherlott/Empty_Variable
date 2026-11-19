// T-41: cálculo de disponibilidade das receitas (função pura).
import { describe, expect, it } from "vitest";
import { calcularDisponibilidade, faltas } from "../src/nebula/disponibilidade.js";

const FRAG = "fragmento";
const PO = "po-poder";
const ALMA_B = "alma-betelgeuse";
const ALMA_N = "alma-naght";
const ASTRAL = "armadura-astral";

/** Armadura Nebulosa POD (fonte: browiki) e a Armadura Astral. */
const nebulosa = [
  { itemId: FRAG, quantidade: 50 },
  { itemId: PO, quantidade: 30 },
  { itemId: ALMA_B, quantidade: 10 },
];
const astral = [
  { itemId: FRAG, quantidade: 50 },
  { itemId: ALMA_N, quantidade: 5 },
];

const disp = (estoque: Record<string, number>) =>
  calcularDisponibilidade({
    materiais: nebulosa,
    pecaItemId: ASTRAL,
    materiaisDaPeca: astral,
    estoque: new Map(Object.entries(estoque)),
  });

describe("Disponibilidade das receitas", () => {
  it("CT-109: com material para uma, trazendo a peça e com a peça pronta do estoque", () => {
    expect(disp({ [FRAG]: 120, [PO]: 30, [ALMA_B]: 10, [ASTRAL]: 1 })).toEqual({
      trazendoPeca: 1,
      comPecaDoEstoque: 1,
    });
  });

  it("CT-109: falta um componente → nenhuma", () => {
    expect(disp({ [FRAG]: 500, [PO]: 29, [ALMA_B]: 50, [ASTRAL]: 5 })).toEqual({
      trazendoPeca: 0,
      comPecaDoEstoque: 0,
    });
  });

  it("CT-123: os Fragmentos são disputados com a peça fabricada", () => {
    // 120 Fragmentos: trazendo a peça cabem 2; sem Astral pronta, cada uma consome 50 + 50.
    expect(disp({ [FRAG]: 120, [PO]: 300, [ALMA_B]: 100, [ALMA_N]: 50 })).toEqual({
      trazendoPeca: 2,
      comPecaDoEstoque: 1,
    });
  });

  it("CT-121/122: usa primeiro as peças prontas, depois fabrica o que faltar", () => {
    // 3 de cada: 1 Astral pronta + 2 fabricadas = 150 + 100 Fragmentos = 250
    expect(disp({ [FRAG]: 250, [PO]: 90, [ALMA_B]: 30, [ALMA_N]: 10, [ASTRAL]: 1 })).toEqual({
      trazendoPeca: 3,
      comPecaDoEstoque: 3,
    });
    // Sem Almas de Naght, só as peças prontas contam
    expect(disp({ [FRAG]: 250, [PO]: 90, [ALMA_B]: 30, [ASTRAL]: 1 })).toEqual({
      trazendoPeca: 3,
      comPecaDoEstoque: 1,
    });
  });

  it("receita sem peça-base: as duas modalidades são iguais", () => {
    const r = calcularDisponibilidade({
      materiais: astral,
      pecaItemId: null,
      materiaisDaPeca: [],
      estoque: new Map([
        [FRAG, 100],
        [ALMA_N, 7],
      ]),
    });
    expect(r).toEqual({ trazendoPeca: 1, comPecaDoEstoque: 1 });
  });

  it("estoque negativo ou ausente conta como zero", () => {
    expect(disp({ [FRAG]: -10 })).toEqual({ trazendoPeca: 0, comPecaDoEstoque: 0 });
  });

  it("faltas: tenho / preciso / falta por item, somando itens repetidos", () => {
    const f = faltas([...nebulosa, ...astral], new Map([[FRAG, 60]]));
    expect(f.find((x) => x.itemId === FRAG)).toEqual({ itemId: FRAG, tenho: 60, preciso: 100, falta: 40 });
    expect(f.find((x) => x.itemId === ALMA_N)).toEqual({ itemId: ALMA_N, tenho: 0, preciso: 5, falta: 5 });
  });
});
