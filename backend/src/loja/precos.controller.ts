import { gravarPreco, PRECO_MAXIMO } from "./preco-item.js";
import { Body, ConflictException, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { ehViolacaoUnicidade } from "../comum/filtro-prisma.js";
import { inteiro, objeto, uuid } from "../comum/validacao.js";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * D21: preço único por item, definido pelo admin. Cada mudança é uma nova versão (só inclusão);
 * a vigente é a de maior versão. Preço nulo tira o item da loja. Compras gravam o preço que pagaram.
 */
@Controller("loja/precos")
@Papeis("ADMIN")
export class PrecosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post()
  async definir(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    const itemId = uuid(b["itemId"], "itemId");
    const precoPontos =
      b["precoPontos"] === null ? null : inteiro(b["precoPontos"], "Preço", 1, PRECO_MAXIMO);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if ((await tx.itemCatalogo.count({ where: { id: itemId } })) === 0) {
          throw new NotFoundException("Item não encontrado.");
        }
        return gravarPreco(tx, this.auditoria, itemId, precoPontos, admin.id);
      });
    } catch (erro) {
      if (ehViolacaoUnicidade(erro))
        throw new ConflictException("O preço foi alterado agora por outro admin. Recarregue.");
      throw erro;
    }
  }

  @Get(":itemId")
  historico(@Param("itemId") itemId: string) {
    return this.prisma.precoItem.findMany({
      where: { itemId: uuid(itemId, "itemId") },
      orderBy: { versao: "desc" },
      select: {
        id: true,
        versao: true,
        precoPontos: true,
        vigenteDesde: true,
        criadoPor: { select: { discordUsername: true } },
      },
    });
  }
}
