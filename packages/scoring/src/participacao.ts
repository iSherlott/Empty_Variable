import {
  type ConfigPontuacao,
  ErroDominio,
  FRACOES_PERMITIDAS,
  type FracaoCentesimos,
  RANK_MAX,
  RANK_MIN,
  STATUS_RUN,
  type StatusRun,
} from "./tipos.js";

export interface EntradaParticipacao {
  /** Rank da função exercida (1–5). */
  readonly rank: number;
  /** M_encontro em centésimos, vindo do encontro da instância (D44). Inteiro > 0. */
  readonly multiplicadorEncontroCentesimos: number;
  readonly status: StatusRun;
  /** Fração de participação em centésimos: 100, 50 ou 0 (D4). */
  readonly fracaoCentesimos: number;
}

/** Snapshot completo do cálculo — gravado na participação para que o histórico nunca mude (D2/A1). */
export interface ResultadoParticipacao {
  readonly rank: number;
  readonly base: number;
  readonly alphaCentesimos: number;
  readonly pesoCentesimos: number;
  readonly multiplicadorEncontroCentesimos: number;
  readonly multiplicadorStatusCentesimos: number;
  readonly fracaoCentesimos: FracaoCentesimos;
  readonly pontos: number;
}

const ESCALA_4 = 100n ** 4n; // quatro fatores em centésimos: W, M, S, f

function ehInteiroNaoNegativo(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

export function validarConfig(config: ConfigPontuacao): void {
  const valores = [
    config.base,
    config.alphaCentesimos,
    config.tetoCredoresBp,
    ...Object.values(config.multiplicadorStatus),
    ...Object.values(config.percentualCategoriaBp),
  ];
  if (!valores.every(ehInteiroNaoNegativo) || config.tetoCredoresBp > 10_000) {
    throw new ErroDominio("CONFIG_INVALIDA", "Configuração de pontuação com valores inválidos.");
  }
}

/** W(r) = 1 + α(r − 1), em centésimos. */
export function pesoDoRank(rank: number, alphaCentesimos: number): number {
  if (!Number.isInteger(rank) || rank < RANK_MIN || rank > RANK_MAX) {
    throw new ErroDominio("RANK_INVALIDO", `Rank deve ser inteiro entre ${RANK_MIN} e ${RANK_MAX}.`);
  }
  return 100 + alphaCentesimos * (rank - 1);
}

/** Divisão inteira com arredondamento "meio para cima" (numerador e denominador ≥ 0). */
function dividirArredondandoMeioParaCima(numerador: bigint, denominador: bigint): bigint {
  return (2n * numerador + denominador) / (2n * denominador);
}

/**
 * P = arred( B × W(rank) × M_encontro × S_status × f ) — D1, D2, D3, D4.
 * Arredondamento por participante, meio para cima.
 */
export function calcularParticipacao(
  entrada: EntradaParticipacao,
  config: ConfigPontuacao,
): ResultadoParticipacao {
  validarConfig(config);
  const mEncontro = entrada.multiplicadorEncontroCentesimos;
  if (!Number.isSafeInteger(mEncontro) || mEncontro <= 0) {
    throw new ErroDominio("ENCONTRO_INVALIDO", "Multiplicador do encontro deve ser um inteiro positivo.");
  }
  if (!(STATUS_RUN as readonly string[]).includes(entrada.status)) {
    throw new ErroDominio("STATUS_INVALIDO", `Status de run desconhecido: ${String(entrada.status)}.`);
  }
  if (!(FRACOES_PERMITIDAS as readonly number[]).includes(entrada.fracaoCentesimos)) {
    throw new ErroDominio("FRACAO_INVALIDA", "Fração de participação deve ser 1, 0,5 ou 0.");
  }

  const peso = pesoDoRank(entrada.rank, config.alphaCentesimos);
  const sStatus = config.multiplicadorStatus[entrada.status];
  const fracao = entrada.fracaoCentesimos as FracaoCentesimos;

  const numerador = BigInt(config.base) * BigInt(peso) * BigInt(mEncontro) * BigInt(sStatus) * BigInt(fracao);
  const pontos = Number(dividirArredondandoMeioParaCima(numerador, ESCALA_4));

  return {
    rank: entrada.rank,
    base: config.base,
    alphaCentesimos: config.alphaCentesimos,
    pesoCentesimos: peso,
    multiplicadorEncontroCentesimos: mEncontro,
    multiplicadorStatusCentesimos: sStatus,
    fracaoCentesimos: fracao,
    pontos,
  };
}
