import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CONFIG_V1, type ConfigPontuacao as ConfigMotor, ErroDominio, validarConfig } from "@betel/scoring";
import type { ConfigPontuacao, Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { ehViolacaoUnicidade } from "../comum/filtro-prisma.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Campos editáveis de uma versão, nas unidades do banco (centésimos e pontos-base). */
export type ParametrosPontuacao = Omit<ConfigPontuacao, "id" | "versao" | "vigenteDesde" | "criadaPorId">;

export const CAMPOS_PARAMETROS = [
  "base",
  "alphaCentesimos",
  "sConcluidaCentesimos",
  "sFalhaCentesimos",
  "sAbortadaCentesimos",
  "pctEssencialBp",
  "pctImportanteBp",
  "pctComplementarBp",
  "tetoCredoresBp",
] as const satisfies readonly (keyof ParametrosPontuacao)[];

/** Linha do banco → configuração do motor de cálculo. O multiplicador do encontro vem da instância (D44). */
export function paraConfigMotor(p: ParametrosPontuacao): ConfigMotor {
  return {
    base: p.base,
    alphaCentesimos: p.alphaCentesimos,
    multiplicadorStatus: {
      CONCLUIDA: p.sConcluidaCentesimos,
      FALHA_CHEFE: p.sFalhaCentesimos,
      ABORTADA: p.sAbortadaCentesimos,
    },
    percentualCategoriaBp: {
      ESSENCIAL: p.pctEssencialBp,
      IMPORTANTE: p.pctImportanteBp,
      COMPLEMENTAR: p.pctComplementarBp,
    },
    tetoCredoresBp: p.tetoCredoresBp,
  };
}

/** Configuração do motor → colunas do banco. */
export function deConfigMotor(c: ConfigMotor): ParametrosPontuacao {
  return {
    base: c.base,
    alphaCentesimos: c.alphaCentesimos,
    sConcluidaCentesimos: c.multiplicadorStatus.CONCLUIDA,
    sFalhaCentesimos: c.multiplicadorStatus.FALHA_CHEFE,
    sAbortadaCentesimos: c.multiplicadorStatus.ABORTADA,
    pctEssencialBp: c.percentualCategoriaBp.ESSENCIAL,
    pctImportanteBp: c.percentualCategoriaBp.IMPORTANTE,
    pctComplementarBp: c.percentualCategoriaBp.COMPLEMENTAR,
    tetoCredoresBp: c.tetoCredoresBp,
  };
}

/** Parâmetros aprovados em D2, D3 e D9 (fonte única: o motor). */
export const PARAMETROS_V1: ParametrosPontuacao = deConfigMotor(CONFIG_V1);

/**
 * US-02 / T-11: parâmetros versionados. Uma versão nunca é editada (trigger no banco);
 * mudar qualquer valor cria a próxima versão, que vale para as runs registradas a partir daí.
 */
@Injectable()
export class ConfigPontuacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** A vigente é a de maior número de versão. */
  async vigente(): Promise<ConfigPontuacao> {
    const c = await this.prisma.configPontuacao.findFirst({ orderBy: { versao: "desc" } });
    if (c === null) throw new NotFoundException("Nenhuma versão de parâmetros cadastrada.");
    return c;
  }

  historico(): Promise<ConfigPontuacao[]> {
    return this.prisma.configPontuacao.findMany({ orderBy: { versao: "desc" } });
  }

  async criarVersao(parametros: ParametrosPontuacao, admin: Usuario): Promise<ConfigPontuacao> {
    try {
      validarConfig(paraConfigMotor(parametros));
    } catch (erro) {
      if (erro instanceof ErroDominio) throw new BadRequestException(erro.message);
      throw erro;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ultima = await tx.configPontuacao.findFirst({ orderBy: { versao: "desc" } });
        const nova = await tx.configPontuacao.create({
          data: { ...parametros, versao: (ultima?.versao ?? 0) + 1, criadaPorId: admin.id },
        });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "PARAMETROS_NOVA_VERSAO",
            entidade: "config_pontuacao",
            entidadeId: nova.id,
            antes: ultima ?? undefined,
            depois: nova,
          },
          tx,
        );
        return nova;
      });
    } catch (erro) {
      // Dois admins salvando ao mesmo tempo: a unicidade de `versao` barra o segundo.
      if (ehViolacaoUnicidade(erro))
        throw new ConflictException("Outra versão foi criada agora. Recarregue e tente de novo.");
      throw erro;
    }
  }
}
