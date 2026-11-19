/**
 * T-41: quantas unidades de uma receita o estoque do grupo cobre (D33), nas duas modalidades da D31.
 * Função pura (sem banco), para ser testada isoladamente.
 */

export interface Componente {
  itemId: string;
  quantidade: number;
}

export interface EntradaDisponibilidade {
  /** Componentes da receita, exceto a peça-base. */
  materiais: Componente[];
  /** Item da peça-base (nulo quando a receita não tem peça). */
  pecaItemId: string | null;
  /** Componentes da receita da peça-base (para fabricá-la quando não houver pronta). */
  materiaisDaPeca: Componente[];
  /** Estoque do grupo por item: lotes ativos do grupo, incluindo a reserva mínima. */
  estoque: ReadonlyMap<string, number>;
}

export interface Disponibilidade {
  /** O membro traz a própria peça (ou a receita não tem peça). */
  trazendoPeca: number;
  /** A peça vem do estoque: pronta se houver, senão os materiais dela. */
  comPecaDoEstoque: number;
}

const tem = (estoque: ReadonlyMap<string, number>, item: string) => Math.max(0, estoque.get(item) ?? 0);

/** Soma, por item, quantidade × fator de cada lista. */
function necessidade(partes: { lista: Componente[]; vezes: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const { lista, vezes } of partes) {
    if (vezes === 0) continue;
    for (const c of lista) m.set(c.itemId, (m.get(c.itemId) ?? 0) + c.quantidade * vezes);
  }
  return m;
}

function cabe(precisa: Map<string, number>, estoque: ReadonlyMap<string, number>): boolean {
  for (const [item, q] of precisa) if (q > tem(estoque, item)) return false;
  return true;
}

export function calcularDisponibilidade(e: EntradaDisponibilidade): Disponibilidade {
  // Trazendo a peça: o componente mais escasso limita.
  const trazendoPeca =
    e.materiais.length === 0
      ? 0
      : Math.min(...e.materiais.map((c) => Math.floor(tem(e.estoque, c.itemId) / c.quantidade)));
  if (e.pecaItemId === null) return { trazendoPeca, comPecaDoEstoque: trazendoPeca };

  // Peça do estoque: usar primeiro as peças prontas é sempre o melhor (não gasta material); o que
  // faltar é fabricado com os materiais da peça, que podem disputar itens com a própria receita
  // (os Fragmentos). Procura o maior n viável, de cima para baixo.
  const prontas = tem(e.estoque, e.pecaItemId);
  for (let n = trazendoPeca; n > 0; n--) {
    const usarProntas = Math.min(n, prontas);
    const fabricar = n - usarProntas;
    if (fabricar > 0 && e.materiaisDaPeca.length === 0) continue;
    const precisa = necessidade([
      { lista: e.materiais, vezes: n },
      { lista: e.materiaisDaPeca, vezes: fabricar },
    ]);
    if (cabe(precisa, e.estoque)) return { trazendoPeca, comPecaDoEstoque: n };
  }
  return { trazendoPeca, comPecaDoEstoque: 0 };
}

/** Para uma unidade: quanto o grupo tem, quanto precisa e quanto falta de cada item. */
export function faltas(
  precisa: Componente[],
  estoque: ReadonlyMap<string, number>,
): { itemId: string; tenho: number; preciso: number; falta: number }[] {
  return [...necessidade([{ lista: precisa, vezes: 1 }])].map(([itemId, preciso]) => {
    const tenho = tem(estoque, itemId);
    return { itemId, tenho, preciso, falta: Math.max(0, preciso - tenho) };
  });
}
