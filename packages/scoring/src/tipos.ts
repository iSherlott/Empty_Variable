/**
 * Tipos e configuração do motor de pontuação.
 *
 * Convenções de unidade (aritmética 100% inteira, sem ponto flutuante):
 * - "centésimos": 1,0 = 100; 0,5 = 50 (peso, α, multiplicadores, fração de participação).
 * - "pontos-base" (bp): 100% = 10_000; 20% = 2_000 (percentuais de empréstimo e teto).
 */

/**
 * Encontros da Torre da Constelação (códigos estáveis). Desde o Épico IV (D44), o multiplicador de
 * cada encontro vem da instância; estes códigos só identificam os três encontros da Torre.
 */
export const CHEFES = ["NAGHT_25", "BETELGEUSE_50", "BETELGEUSE_75"] as const;
export type Chefe = (typeof CHEFES)[number];

/** Multiplicadores dos encontros da Torre na versão 1 (D2/D3), em centésimos. */
export const MULTIPLICADORES_TORRE_V1: Readonly<Record<Chefe, number>> = Object.freeze({
  NAGHT_25: 100,
  BETELGEUSE_50: 150,
  BETELGEUSE_75: 200,
});

export const STATUS_RUN = ["CONCLUIDA", "FALHA_CHEFE", "ABORTADA"] as const;
export type StatusRun = (typeof STATUS_RUN)[number];

export const CATEGORIAS_EMPRESTIMO = ["ESSENCIAL", "IMPORTANTE", "COMPLEMENTAR"] as const;
export type CategoriaEmprestimo = (typeof CATEGORIAS_EMPRESTIMO)[number];

/** Frações de participação permitidas (D4): completa, parcial, nenhuma — em centésimos. */
export const FRACOES_PERMITIDAS = [100, 50, 0] as const;
export type FracaoCentesimos = (typeof FRACOES_PERMITIDAS)[number];

export const RANK_MIN = 1;
export const RANK_MAX = 5;
export const BP_100_PORCENTO = 10_000;

export interface ConfigPontuacao {
  /** B — pontos base por run completa. */
  readonly base: number;
  /** α em centésimos (0,5 → 50). W(r) = 1 + α(r − 1). */
  readonly alphaCentesimos: number;
  /** S_status em centésimos. */
  readonly multiplicadorStatus: Readonly<Record<StatusRun, number>>;
  /** % sugerido por categoria de item emprestado, em pontos-base. */
  readonly percentualCategoriaBp: Readonly<Record<CategoriaEmprestimo, number>>;
  /** Teto da soma das parcelas dos credores, em pontos-base (D9: 50%). */
  readonly tetoCredoresBp: number;
}

/** Parâmetros aprovados em 2026-11-14 (D2, D3, D9). Versão 1. */
export const CONFIG_V1: ConfigPontuacao = Object.freeze({
  base: 100,
  alphaCentesimos: 50,
  multiplicadorStatus: Object.freeze({ CONCLUIDA: 100, FALHA_CHEFE: 50, ABORTADA: 0 }),
  percentualCategoriaBp: Object.freeze({ ESSENCIAL: 2_000, IMPORTANTE: 1_000, COMPLEMENTAR: 500 }),
  tetoCredoresBp: 5_000,
});

export type CodigoErroDominio =
  | "RANK_INVALIDO"
  | "FRACAO_INVALIDA"
  | "ENCONTRO_INVALIDO"
  | "STATUS_INVALIDO"
  | "PONTOS_INVALIDOS"
  | "PERCENTUAL_INVALIDO"
  | "CATEGORIA_INVALIDA"
  | "CREDOR_IGUAL_TOMADOR"
  | "TETO_EXCEDIDO_COM_OVERRIDE"
  | "CONFIG_INVALIDA";

/** Violação de regra de negócio. O `codigo` é estável e pode ser mapeado para mensagens na API/UI. */
export class ErroDominio extends Error {
  constructor(
    public readonly codigo: CodigoErroDominio,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDominio";
  }
}
