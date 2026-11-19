import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TipoMovimentoEstoque, Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { ITENS_INICIAIS } from "../cadastros/dados-iniciais.js";
import { CODIGO_TORRE } from "../instancias/instancias.service.js";
import { ehViolacaoUnicidade } from "../comum/filtro-prisma.js";
import { PrismaService, type Tx } from "../prisma/prisma.service.js";
import { gravarPreco } from "../loja/preco-item.js";
import { motivoInelegivel } from "./elegibilidade.js";

const NOMES_ITENS_TORRE = [...ITENS_INICIAIS.map((item) => item.nome), "Carta Naght Sieger"];

export interface ResumoItemEstoque {
  itemId: string;
  nome: string;
  precoVigente: number | null;
  ultimoValorUnitarioPontos: number | null;
  motivoInelegivel: string | null;
  reservaMinima: number;
  /** Soma dos lotes ativos do grupo. */
  grupo: number;
  /** Soma dos lotes ativos consignados (D22). */
  consignado: number;
  /** max(0, grupo − reserva) + consignado (D26). */
  disponivel: number;
}

export interface ResultadoDropsRun {
  lancados: { dropId: string; item: string; quantidade: number }[];
  naoLancados: { dropId: string; item: string; quantidade: number; motivo: string }[];
}

/** Erro do trigger "lote nunca negativo" (CT-104) vindo do banco. */
function ehLoteNegativo(erro: unknown): boolean {
  return erro instanceof Error && erro.message.includes("ficaria com quantidade negativa");
}

/**
 * T-27: estoque como um segundo ledger. A quantidade de cada lote é a soma dos seus movimentos,
 * que nunca são editados nem apagados. O banco também recusa lote negativo (trigger).
 */
@Injectable()
export class EstoqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async itemElegivel(tx: Tx, itemId: string) {
    const item = await tx.itemCatalogo.findUnique({ where: { id: itemId } });
    if (item === null) throw new NotFoundException("Item não encontrado.");
    const motivo = motivoInelegivel(item);
    // D20 (CT-87): sem negociabilidade confirmada, o item não entra no estoque da loja.
    if (motivo !== null) throw new BadRequestException(`${item.nome} não pode entrar no estoque: ${motivo}`);
    return item;
  }

  async origens() {
    const torre = await this.prisma.instancia.findUnique({
      where: { codigo: CODIGO_TORRE },
      select: { id: true, nome: true },
    });
    if (torre === null) return [];
    const itens = await this.prisma.itemCatalogo.findMany({
      where: { nome: { in: NOMES_ITENS_TORRE, mode: "insensitive" } },
      select: { id: true },
    });
    return [{ ...torre, itensIds: itens.map((item) => item.id) }];
  }

  /** Entrada manual no estoque do grupo. Cada entrada é um lote novo, para a ordem de chegada (D27). */
  async entradaManual(
    itemId: string,
    quantidade: number,
    motivo: string | null,
    admin: Usuario,
    origem?: string,
    valorUnitarioPontos: number | null = null,
    precoPontos?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM item_catalogo WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await this.itemElegivel(tx, itemId);
      if (await tx.loteEstoque.count({ where: { itemId, ativo: true } })) {
        throw new ConflictException("O item já tem lote ativo. Use Ajuste para alterar a quantidade.");
      }
      let origemEntrada = null;
      if (origem === "DROP_SOLTO") {
        origemEntrada = "Drop Solto";
      } else if (origem !== undefined) {
        const instancia = await tx.instancia.findUnique({
          where: { id: origem },
          select: { nome: true, codigo: true },
        });
        if (instancia === null) throw new NotFoundException("Instância não encontrada.");
        if (instancia.codigo !== CODIGO_TORRE) {
          throw new BadRequestException(
            "A entrada por instância está disponível para a Torre da Constelação.",
          );
        }
        if (!NOMES_ITENS_TORRE.some((nome) => nome.toLowerCase() === item.nome.toLowerCase())) {
          throw new BadRequestException("Este item não está no catálogo de drops da Torre da Constelação.");
        }
        origemEntrada = instancia.nome;
      }
      const lote = await tx.loteEstoque.create({ data: { itemId, origem: "MANUAL", criadoPorId: admin.id } });
      await tx.movimentoEstoque.create({
        data: {
          loteId: lote.id,
          quantidade,
          tipo: "ENTRADA",
          motivo,
          origemEntrada,
          valorUnitarioPontos,
          criadoPorId: admin.id,
        },
      });
      await this.auditoria.registrar(
        {
          usuarioId: admin.id,
          acao: "ESTOQUE_ENTRADA",
          entidade: "lote_estoque",
          entidadeId: lote.id,
          depois: { item: item.nome, quantidade, motivo, origemEntrada, valorUnitarioPontos },
        },
        tx,
      );
      if (precoPontos !== undefined) {
        await gravarPreco(tx, this.auditoria, itemId, precoPontos, admin.id);
      }
      return { loteId: lote.id, item: item.nome, quantidade };
    });
  }

  /**
   * D18: lança no estoque do grupo os drops da run ainda não lançados, de itens elegíveis.
   * Cada drop entra uma única vez (índice único no banco, CT-88). Run estornada não lança:
   * vale a run que a corrigiu.
   */
  async lancarDropsRun(runId: string, admin: Usuario): Promise<ResultadoDropsRun> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM run WHERE id = ${runId}::uuid FOR UPDATE`;
        const run = await tx.run.findUnique({
          where: { id: runId },
          include: {
            drops: {
              include: { item: true, movimentos: { where: { tipo: "ENTRADA" }, select: { id: true } } },
              orderBy: { id: "asc" },
            },
          },
        });
        if (run === null) throw new NotFoundException("Run não encontrada.");
        if (run.status === "ESTORNADA") {
          throw new ConflictException("Esta run foi corrigida: lance os drops da run que a corrigiu.");
        }
        const r: ResultadoDropsRun = { lancados: [], naoLancados: [] };
        for (const d of run.drops) {
          const base = { dropId: d.id, item: d.item.nome, quantidade: d.quantidade };
          if (d.movimentos.length > 0) {
            r.naoLancados.push({ ...base, motivo: "Já lançado no estoque." });
            continue;
          }
          const motivo = motivoInelegivel(d.item);
          if (motivo !== null) {
            r.naoLancados.push({ ...base, motivo });
            continue;
          }
          const lote = await tx.loteEstoque.create({
            data: { itemId: d.itemId, origem: "DROP_RUN", criadoPorId: admin.id },
          });
          await tx.movimentoEstoque.create({
            data: {
              loteId: lote.id,
              quantidade: d.quantidade,
              tipo: "ENTRADA",
              dropRunId: d.id,
              criadoPorId: admin.id,
            },
          });
          r.lancados.push(base);
        }
        if (r.lancados.length > 0) {
          await this.auditoria.registrar(
            { usuarioId: admin.id, acao: "ESTOQUE_DROPS_RUN", entidade: "run", entidadeId: runId, depois: r },
            tx,
          );
        }
        return r;
      });
    } catch (erro) {
      // Dois admins lançando ao mesmo tempo: o índice único garante uma entrada por drop.
      if (ehViolacaoUnicidade(erro))
        throw new ConflictException("Estes drops acabaram de ser lançados. Recarregue.");
      throw erro;
    }
  }

  /** Ajuste com motivo obrigatório. Nunca deixa o lote negativo (serviço e trigger, CT-104). */
  async ajustar(loteId: string, quantidade: number, motivo: string, admin: Usuario) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM lote_estoque WHERE id = ${loteId}::uuid FOR UPDATE`;
        const lote = await tx.loteEstoque.findUnique({ where: { id: loteId }, include: { item: true } });
        if (lote === null) throw new NotFoundException("Lote não encontrado.");
        const atual = await this.quantidadeLote(tx, loteId);
        if (atual + quantidade < 0) {
          throw new BadRequestException(`O lote tem ${atual}; o ajuste deixaria ${atual + quantidade}.`);
        }
        await tx.movimentoEstoque.create({
          data: { loteId, quantidade, tipo: "AJUSTE", motivo, criadoPorId: admin.id },
        });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "ESTOQUE_AJUSTE",
            entidade: "lote_estoque",
            entidadeId: loteId,
            antes: { quantidade: atual },
            depois: { quantidade: atual + quantidade, motivo },
          },
          tx,
        );
        return { loteId, item: lote.item.nome, quantidade: atual + quantidade };
      });
    } catch (erro) {
      if (ehLoteNegativo(erro))
        throw new BadRequestException("O ajuste deixaria o lote com quantidade negativa.");
      throw erro;
    }
  }

  async quantidadeLote(tx: Tx | PrismaService, loteId: string): Promise<number> {
    const r = await tx.movimentoEstoque.aggregate({ where: { loteId }, _sum: { quantidade: true } });
    return r._sum.quantidade ?? 0;
  }

  /** Por item: grupo, reserva, consignado e disponível na loja (D26). Itens com algum lote (mesmo inativo) ou preço. */
  async resumo(): Promise<ResumoItemEstoque[]> {
    const [itens, saldos, ultimosValores] = await Promise.all([
      this.prisma.itemCatalogo.findMany({
        orderBy: { nome: "asc" },
        include: { precos: { orderBy: { versao: "desc" }, take: 1, select: { precoPontos: true } } },
      }),
      this.prisma.$queryRaw<{ item_id: string; grupo: bigint; consignado: bigint }[]>`
        SELECT item_id,
               COALESCE(SUM(quantidade) FILTER (WHERE ativo AND dono_jogador_id IS NULL), 0)::bigint AS grupo,
               COALESCE(SUM(quantidade) FILTER (WHERE ativo AND dono_jogador_id IS NOT NULL), 0)::bigint AS consignado
        FROM saldo_lote GROUP BY item_id`,
      this.prisma.$queryRaw<{ item_id: string; valor_unitario_pontos: number }[]>`
        SELECT DISTINCT ON (l.item_id) l.item_id, m.valor_unitario_pontos
        FROM movimento_estoque m JOIN lote_estoque l ON l.id = m.lote_id
        WHERE m.valor_unitario_pontos IS NOT NULL
        ORDER BY l.item_id, m.criado_em DESC, l.ordem DESC`,
    ]);
    const valorPorItem = new Map(ultimosValores.map((x) => [x.item_id, x.valor_unitario_pontos]));
    const porItem = new Map(saldos.map((x) => [x.item_id, x]));
    return itens
      .filter((i) => porItem.has(i.id) || i.precos.length > 0)
      .map((i) => {
        const s = porItem.get(i.id);
        const grupo = Number(s?.grupo ?? 0n);
        const consignado = Number(s?.consignado ?? 0n);
        return {
          itemId: i.id,
          nome: i.nome,
          idJogo: i.idJogo,
          ultimoValorUnitarioPontos: valorPorItem.get(i.id) ?? null,
          precoVigente: i.precos[0]?.precoPontos ?? null,
          motivoInelegivel: motivoInelegivel(i),
          reservaMinima: i.reservaMinima,
          grupo,
          consignado,
          disponivel: Math.max(0, grupo - i.reservaMinima) + consignado,
        };
      });
  }

  /** Lotes com quantidade atual, na ordem de chegada (D27). */
  async lotes(itemId?: string) {
    const lotes = await this.prisma.loteEstoque.findMany({
      where: itemId === undefined ? {} : { itemId },
      orderBy: { ordem: "asc" },
      select: {
        id: true,
        ordem: true,
        origem: true,
        ativo: true,
        criadoEm: true,
        item: { select: { id: true, nome: true, idJogo: true } },
        dono: { select: { id: true, apelido: true } },
      },
    });
    const saldos = await this.prisma.$queryRaw<{ lote_id: string; quantidade: bigint }[]>`
      SELECT lote_id, quantidade FROM saldo_lote`;
    const q = new Map(saldos.map((s) => [s.lote_id, Number(s.quantidade)]));
    return lotes.map((l) => ({ ...l, quantidade: q.get(l.id) ?? 0 }));
  }

  movimentos(f: {
    itemId?: string;
    loteId?: string;
    tipo?: TipoMovimentoEstoque;
    dataDe?: Date;
    dataAte?: Date;
  }) {
    const where: Prisma.MovimentoEstoqueWhereInput = {
      ...(f.loteId === undefined ? {} : { loteId: f.loteId }),
      ...(f.itemId === undefined ? {} : { lote: { itemId: f.itemId } }),
      ...(f.tipo === undefined ? {} : { tipo: f.tipo }),
      ...(f.dataDe === undefined && f.dataAte === undefined
        ? {}
        : {
            criadoEm: {
              ...(f.dataDe === undefined ? {} : { gte: f.dataDe }),
              ...(f.dataAte === undefined ? {} : { lt: new Date(f.dataAte.getTime() + 86_400_000) }),
            },
          }),
    };
    return this.prisma.movimentoEstoque.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
      take: 500,
      select: {
        id: true,
        quantidade: true,
        tipo: true,
        motivo: true,
        origemEntrada: true,
        valorUnitarioPontos: true,
        criadoEm: true,
        compraId: true,
        criadoPor: { select: { discordUsername: true } },
        dropRun: { select: { run: { select: { id: true, data: true } } } },
        lote: {
          select: {
            id: true,
            ordem: true,
            origem: true,
            item: { select: { nome: true } },
            dono: { select: { apelido: true } },
          },
        },
      },
    });
  }
}
