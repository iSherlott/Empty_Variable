import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { ehViolacaoUnicidade } from "../comum/filtro-prisma.js";
import { booleano, booleanoOuNulo, inteiro, objeto, texto, uuid } from "../comum/validacao.js";
import { motivoInelegivel } from "../estoque/elegibilidade.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TIPOS_ITEM, type TipoItem } from "./dados-iniciais.js";

function tipo(v: unknown): TipoItem {
  if (!TIPOS_ITEM.includes(v as TipoItem)) {
    throw new BadRequestException(`Tipo deve ser um de: ${TIPOS_ITEM.join(", ")}.`);
  }
  return v as TipoItem;
}

const idJogo = (v: unknown) => (v === null ? null : inteiro(v, "ID no jogo", 1, 99_999_999));

/** D24: limite por membro num período. Os dois nulos (sem limite) ou os dois positivos. */
function limite(b: Record<string, unknown>): {
  limitePorMembro: number | null;
  limitePeriodoDias: number | null;
} {
  const qtd = b["limitePorMembro"];
  const dias = b["limitePeriodoDias"];
  if (qtd === null && dias === null) return { limitePorMembro: null, limitePeriodoDias: null };
  if (qtd === null || dias === null || qtd === undefined || dias === undefined) {
    throw new BadRequestException(
      "Informe o limite e o período juntos, ou os dois nulos para tirar o limite.",
    );
  }
  return {
    limitePorMembro: inteiro(qtd, "Limite por membro", 1, 1_000_000),
    limitePeriodoDias: inteiro(dias, "Período do limite (dias)", 1, 3_650),
  };
}

/**
 * US-04 / T-12: catálogo de itens da Torre. Itens nunca são apagados (desativar).
 * `negociavel` e `vinculadoConta` aceitam null = ainda não verificado no jogo.
 */
@Controller("itens")
@Papeis("ADMIN")
export class ItensController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async comConflito<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (erro) {
      if (ehViolacaoUnicidade(erro))
        throw new ConflictException("Já existe item com esse nome ou ID no jogo.");
      throw erro;
    }
  }

  /**
   * Inclui o preço vigente (D21) e, quando o item não pode ir para a loja, o motivo (D20).
   * O gestor também lê o catálogo: empréstimos e drops das runs e componentes das receitas.
   */
  @Get()
  @Papeis("GESTOR")
  async listar() {
    const itens = await this.prisma.itemCatalogo.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: { precos: { orderBy: { versao: "desc" }, take: 1, select: { precoPontos: true } } },
    });
    return itens.map(({ precos, ...item }) => ({
      ...item,
      precoVigente: precos[0]?.precoPontos ?? null,
      motivoInelegivel: motivoInelegivel(item),
    }));
  }

  @Post()
  async criar(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    const dados = {
      nome: texto(b["nome"], "Nome", 2, 80),
      tipo: tipo(b["tipo"]),
      idJogo: b["idJogo"] === undefined ? null : idJogo(b["idJogo"]),
      negociavel: b["negociavel"] === undefined ? null : booleanoOuNulo(b["negociavel"], "negociavel"),
      vinculadoConta:
        b["vinculadoConta"] === undefined ? null : booleanoOuNulo(b["vinculadoConta"], "vinculadoConta"),
    };
    return this.comConflito(() =>
      this.prisma.$transaction(async (tx) => {
        const item = await tx.itemCatalogo.create({ data: dados });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "ITEM_CRIADO",
            entidade: "item_catalogo",
            entidadeId: item.id,
            depois: item,
          },
          tx,
        );
        return item;
      }),
    );
  }

  @Patch(":id")
  async alterar(@Param("id") idBruto: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const id = uuid(idBruto, "id");
    const b = objeto(corpo);
    const dados = {
      ...(b["nome"] === undefined ? {} : { nome: texto(b["nome"], "Nome", 2, 80) }),
      ...(b["tipo"] === undefined ? {} : { tipo: tipo(b["tipo"]) }),
      ...(b["idJogo"] === undefined ? {} : { idJogo: idJogo(b["idJogo"]) }),
      ...(b["negociavel"] === undefined ? {} : { negociavel: booleanoOuNulo(b["negociavel"], "negociavel") }),
      ...(b["vinculadoConta"] === undefined
        ? {}
        : { vinculadoConta: booleanoOuNulo(b["vinculadoConta"], "vinculadoConta") }),
      ...(b["ativo"] === undefined ? {} : { ativo: booleano(b["ativo"], "ativo") }),
      ...(b["reservaMinima"] === undefined
        ? {}
        : { reservaMinima: inteiro(b["reservaMinima"], "Reserva mínima", 0, 1_000_000) }),
      ...(b["limitePorMembro"] === undefined && b["limitePeriodoDias"] === undefined ? {} : limite(b)),
    };
    return this.comConflito(() =>
      this.prisma.$transaction(async (tx) => {
        const antes = await tx.itemCatalogo.findUnique({ where: { id } });
        if (antes === null) throw new NotFoundException("Item não encontrado.");
        const item = await tx.itemCatalogo.update({ where: { id }, data: dados });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "ITEM_ALTERADO",
            entidade: "item_catalogo",
            entidadeId: id,
            antes,
            depois: item,
          },
          tx,
        );
        return item;
      }),
    );
  }
}
