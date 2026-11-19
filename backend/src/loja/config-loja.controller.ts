import { Body, ConflictException, Controller, Get, Post } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { ehViolacaoUnicidade } from "../comum/filtro-prisma.js";
import { inteiro, objeto } from "../comum/validacao.js";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * D22: parâmetros da loja versionados e imutáveis (mesmo padrão de config_pontuacao).
 * A taxa de consignação começa em 0% (v1) e cada compra grava a versão usada.
 */
@Controller("config-loja")
@Papeis("ADMIN")
export class ConfigLojaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  historico() {
    return this.prisma.configLoja.findMany({ orderBy: { versao: "desc" } });
  }

  @Post()
  async criar(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const taxaConsignacaoBp = inteiro(objeto(corpo)["taxaConsignacaoBp"], "taxaConsignacaoBp", 0, 10_000);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ultima = await tx.configLoja.findFirst({ orderBy: { versao: "desc" } });
        const nova = await tx.configLoja.create({
          data: { versao: (ultima?.versao ?? 0) + 1, taxaConsignacaoBp, criadaPorId: admin.id },
        });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "CONFIG_LOJA_NOVA_VERSAO",
            entidade: "config_loja",
            entidadeId: nova.id,
            antes:
              ultima === null
                ? undefined
                : { taxaConsignacaoBp: ultima.taxaConsignacaoBp, versao: ultima.versao },
            depois: { taxaConsignacaoBp, versao: nova.versao },
          },
          tx,
        );
        return nova;
      });
    } catch (erro) {
      if (ehViolacaoUnicidade(erro))
        throw new ConflictException("Outra versão foi criada agora. Recarregue e tente de novo.");
      throw erro;
    }
  }
}
