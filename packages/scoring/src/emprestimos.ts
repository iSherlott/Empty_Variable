import {
  BP_100_PORCENTO,
  CATEGORIAS_EMPRESTIMO,
  type CategoriaEmprestimo,
  type ConfigPontuacao,
  ErroDominio,
} from "./tipos.js";
import { validarConfig } from "./participacao.js";

export interface EntradaEmprestimo {
  /** Jogador que emprestou o item (comparação por jogador — C3). */
  readonly credorJogadorId: string;
  readonly categoria: CategoriaEmprestimo;
  /** % digitado pelo admin, em pontos-base. Ausente = usa a sugestão da categoria. */
  readonly percentualInformadoBp?: number;
}

export interface ParcelaEmprestimo {
  /** Posição do empréstimo na lista de entrada. */
  readonly indice: number;
  readonly credorJogadorId: string;
  readonly categoria: CategoriaEmprestimo;
  readonly percentualSugeridoBp: number;
  readonly percentualInformadoBp: number | null;
  /** % considerado antes de qualquer redução (informado ?? sugerido). */
  readonly percentualAplicadoBp: number;
  /** Parcela inteira do credor (truncada por empréstimo — C1). */
  readonly pontos: number;
}

export interface ResultadoDivisao {
  readonly pontosOriginais: number;
  readonly parcelas: readonly ParcelaEmprestimo[];
  /** Pontos que ficam com o tomador: P − Σ parcelas. */
  readonly pontosTomador: number;
  /** Soma dos percentuais aplicados (antes da redução), em pontos-base. */
  readonly somaPercentuaisBp: number;
  /** true quando as sugestões ultrapassaram o teto e foram reduzidas proporcionalmente (D9a). Aviso informativo (C11). */
  readonly reducaoProporcionalAplicada: boolean;
}

/**
 * Divide os pontos de uma participação entre o tomador e os credores — D9, D9a, D15.
 *
 * - Cada empréstimo usa o % informado pelo admin ou, na falta, a sugestão da categoria.
 * - Soma ≤ teto: credor recebe ⌊P × p⌋.
 * - Soma > teto e só há sugestões: redução proporcional, credor recebe ⌊P × p × teto / soma⌋.
 * - Soma > teto e há qualquer % informado: rejeita (D15).
 * - O tomador fica com o resto, então a soma distribuída é sempre exatamente P.
 */
export function dividirEmprestimos(
  pontos: number,
  tomadorJogadorId: string,
  emprestimos: readonly EntradaEmprestimo[],
  config: ConfigPontuacao,
): ResultadoDivisao {
  validarConfig(config);
  if (!Number.isSafeInteger(pontos) || pontos < 0) {
    throw new ErroDominio("PONTOS_INVALIDOS", "Pontos da participação devem ser inteiro ≥ 0.");
  }

  const preparados = emprestimos.map((e, indice) => {
    if (!(CATEGORIAS_EMPRESTIMO as readonly string[]).includes(e.categoria)) {
      throw new ErroDominio("CATEGORIA_INVALIDA", `Categoria desconhecida: ${String(e.categoria)}.`);
    }
    if (e.credorJogadorId === tomadorJogadorId) {
      throw new ErroDominio(
        "CREDOR_IGUAL_TOMADOR",
        "O credor não pode ser o próprio jogador que recebeu o empréstimo.",
      );
    }
    const informado = e.percentualInformadoBp;
    if (
      informado !== undefined &&
      (!Number.isSafeInteger(informado) || informado < 0 || informado > BP_100_PORCENTO)
    ) {
      throw new ErroDominio("PERCENTUAL_INVALIDO", "Percentual informado deve ser inteiro entre 0% e 100%.");
    }
    const sugerido = config.percentualCategoriaBp[e.categoria];
    return {
      indice,
      credorJogadorId: e.credorJogadorId,
      categoria: e.categoria,
      percentualSugeridoBp: sugerido,
      percentualInformadoBp: informado ?? null,
      percentualAplicadoBp: informado ?? sugerido,
    };
  });

  const soma = preparados.reduce((acc, p) => acc + p.percentualAplicadoBp, 0);
  const teto = config.tetoCredoresBp;
  const excedeu = soma > teto;
  const temOverride = preparados.some((p) => p.percentualInformadoBp !== null);

  if (excedeu && temOverride) {
    throw new ErroDominio(
      "TETO_EXCEDIDO_COM_OVERRIDE",
      `Os percentuais somam ${formatarBp(soma)}, acima do teto de ${formatarBp(teto)}. Ajuste os valores informados.`,
    );
  }

  const P = BigInt(pontos);
  const parcelas: ParcelaEmprestimo[] = preparados.map((p) => {
    const pct = BigInt(p.percentualAplicadoBp);
    const valor = excedeu
      ? (P * pct * BigInt(teto)) / (BigInt(soma) * BigInt(BP_100_PORCENTO))
      : (P * pct) / BigInt(BP_100_PORCENTO);
    return { ...p, pontos: Number(valor) };
  });

  const totalCredores = parcelas.reduce((acc, p) => acc + p.pontos, 0);
  return {
    pontosOriginais: pontos,
    parcelas,
    pontosTomador: pontos - totalCredores,
    somaPercentuaisBp: soma,
    reducaoProporcionalAplicada: excedeu,
  };
}

function formatarBp(bp: number): string {
  return `${(bp / 100).toLocaleString("pt-BR")}%`;
}
