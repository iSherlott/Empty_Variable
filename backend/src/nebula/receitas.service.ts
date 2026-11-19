import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { ehViolacaoUnicidade } from "../comum/filtro-prisma.js";
import { PrismaService, type Tx } from "../prisma/prisma.service.js";
import { calcularDisponibilidade, type Componente, type Disponibilidade, faltas } from "./disponibilidade.js";

export interface NovoComponente {
  itemId: string;
  quantidade: number;
  pecaBase: boolean;
}

const INCLUIR = {
  itemProduzido: { select: { id: true, nome: true, idJogo: true } },
  componentes: {
    include: { item: { select: { id: true, nome: true, idJogo: true } } },
    orderBy: { quantidade: "desc" as const },
  },
  precos: { orderBy: { versao: "desc" as const }, take: 1 },
  pecaDe: { include: { receitaPeca: { include: { componentes: true } } } },
  _count: { select: { solicitacoes: { where: { status: "PENDENTE" as const } } } },
};

/**
 * T-40/T-41: receitas como dados (briefing §7: nada de quantidades assumidas no código).
 * As da fonte entram inativas; o admin valida, precifica (D32, dois valores) e ativa.
 */
@Injectable()
export class ReceitasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Estoque do grupo por item (D33): lotes ativos do grupo, incluindo a reserva mínima. */
  async estoqueDoGrupo(tx: Tx | PrismaService = this.prisma): Promise<Map<string, number>> {
    const linhas = await tx.$queryRaw<{ item_id: string; quantidade: bigint }[]>`
      SELECT item_id, COALESCE(SUM(quantidade), 0)::bigint AS quantidade
      FROM saldo_lote WHERE ativo AND dono_jogador_id IS NULL GROUP BY item_id`;
    return new Map(linhas.map((l) => [l.item_id, Number(l.quantidade)]));
  }

  /** Disponibilidade e o que falta de cada item, nas duas modalidades da D31. */
  avaliar(
    r: Awaited<ReturnType<ReceitasService["carregar"]>>,
    estoque: ReadonlyMap<string, number>,
  ): Disponibilidade & {
    faltasTrazendo: ReturnType<typeof faltas>;
    faltasComPeca: ReturnType<typeof faltas>;
  } {
    const peca = r.componentes.find((c) => c.pecaBase) ?? null;
    const materiais: Componente[] = r.componentes
      .filter((c) => !c.pecaBase)
      .map((c) => ({ itemId: c.itemId, quantidade: c.quantidade }));
    const materiaisDaPeca: Componente[] =
      r.pecaDe?.receitaPeca.componentes.map((c) => ({ itemId: c.itemId, quantidade: c.quantidade })) ?? [];
    const d = calcularDisponibilidade({
      materiais,
      pecaItemId: peca?.itemId ?? null,
      materiaisDaPeca,
      estoque,
    });
    // "Com a peça do estoque": se há peça pronta, mostra a peça; senão, os materiais dela.
    const prontas = peca === null ? 0 : (estoque.get(peca.itemId) ?? 0);
    const comPeca =
      peca === null
        ? materiais
        : prontas > 0 || materiaisDaPeca.length === 0
          ? [...materiais, { itemId: peca.itemId, quantidade: peca.quantidade }]
          : [...materiais, ...materiaisDaPeca];
    return { ...d, faltasTrazendo: faltas(materiais, estoque), faltasComPeca: faltas(comPeca, estoque) };
  }

  private carregar(tx: Tx | PrismaService, id: string) {
    return tx.receita.findUniqueOrThrow({ where: { id }, include: INCLUIR });
  }

  /** Formato de resposta: receita, preço vigente, situação e disponibilidade. */
  private formatar(
    r: Awaited<ReturnType<ReceitasService["carregar"]>>,
    estoque: ReadonlyMap<string, number>,
    nomes: Map<string, string>,
  ) {
    const a = this.avaliar(r, estoque);
    const nome = (id: string) => nomes.get(id) ?? "?";
    return {
      id: r.id,
      nome: r.nome,
      itemProduzido: r.itemProduzido,
      solicitavel: r.solicitavel,
      ativa: r.ativa,
      fonte: r.fonte,
      limitePorMembro: r.limitePorMembro,
      limitePeriodoDias: r.limitePeriodoDias,
      componentes: r.componentes.map((c) => ({
        id: c.id,
        item: c.item,
        quantidade: c.quantidade,
        pecaBase: c.pecaBase,
      })),
      receitaPeca:
        r.pecaDe === null ? null : { id: r.pecaDe.receitaPeca.id, nome: r.pecaDe.receitaPeca.nome },
      precoVigente:
        r.precos[0] === undefined
          ? null
          : {
              versao: r.precos[0].versao,
              precoComPeca: r.precos[0].precoComPeca,
              precoTrazendoPeca: r.precos[0].precoTrazendoPeca,
            },
      solicitacoesPendentes: r._count.solicitacoes,
      disponibilidade: {
        trazendoPeca: a.trazendoPeca,
        comPecaDoEstoque: a.comPecaDoEstoque,
        faltasTrazendo: a.faltasTrazendo.map((f) => ({ ...f, item: nome(f.itemId) })),
        faltasComPeca: a.faltasComPeca.map((f) => ({ ...f, item: nome(f.itemId) })),
      },
    };
  }

  private async nomesDosItens(): Promise<Map<string, string>> {
    const itens = await this.prisma.itemCatalogo.findMany({ select: { id: true, nome: true } });
    return new Map(itens.map((i) => [i.id, i.nome]));
  }

  async listar() {
    const [receitas, estoque, nomes] = await Promise.all([
      this.prisma.receita.findMany({ orderBy: [{ solicitavel: "desc" }, { nome: "asc" }], include: INCLUIR }),
      this.estoqueDoGrupo(),
      this.nomesDosItens(),
    ]);
    return receitas.map((r) => this.formatar(r, estoque, nomes));
  }

  /** US-17: só as receitas que o membro pode solicitar (ativas, solicitáveis e com preço). */
  async abertas() {
    const [receitas, estoque, nomes] = await Promise.all([
      this.prisma.receita.findMany({
        where: { ativa: true, solicitavel: true, precos: { some: {} } },
        orderBy: { nome: "asc" },
        include: INCLUIR,
      }),
      this.estoqueDoGrupo(),
      this.nomesDosItens(),
    ]);
    return receitas.map((r) => this.formatar(r, estoque, nomes));
  }

  async detalhe(id: string) {
    const r = await this.prisma.receita.findUnique({ where: { id }, include: INCLUIR });
    if (r === null) throw new NotFoundException("Receita não encontrada.");
    return this.formatar(r, await this.estoqueDoGrupo(), await this.nomesDosItens());
  }

  private validarComponentes(componentes: NovoComponente[]): void {
    if (componentes.length === 0) throw new BadRequestException("Informe ao menos um componente.");
    if (new Set(componentes.map((c) => c.itemId)).size !== componentes.length) {
      throw new BadRequestException("Um item não pode se repetir na mesma receita.");
    }
    if (componentes.filter((c) => c.pecaBase).length > 1) {
      throw new BadRequestException("Só pode haver uma peça-base por receita.");
    }
  }

  /** A peça ligada precisa ser uma receita que produz exatamente o item da peça-base. */
  private async validarPeca(
    tx: Tx,
    componentes: NovoComponente[],
    receitaPecaId: string | null,
    proprioId?: string,
  ) {
    const peca = componentes.find((c) => c.pecaBase) ?? null;
    if (receitaPecaId === null) return;
    if (peca === null)
      throw new BadRequestException("Só receitas com peça-base podem ter a receita da peça.");
    if (receitaPecaId === proprioId)
      throw new BadRequestException("Uma receita não pode ser a peça dela mesma.");
    const rp = await tx.receita.findUnique({ where: { id: receitaPecaId } });
    if (rp === null) throw new NotFoundException("Receita da peça não encontrada.");
    if (rp.itemProduzidoId !== peca.itemId) {
      throw new BadRequestException("A receita da peça precisa produzir o item marcado como peça-base.");
    }
  }

  async criar(
    dados: {
      nome: string;
      itemProduzidoId: string;
      solicitavel: boolean;
      fonte: string | null;
      componentes: NovoComponente[];
      receitaPecaId: string | null;
    },
    admin: Usuario,
  ) {
    this.validarComponentes(dados.componentes);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        await this.validarPeca(tx, dados.componentes, dados.receitaPecaId);
        const r = await tx.receita.create({
          data: {
            nome: dados.nome,
            itemProduzidoId: dados.itemProduzidoId,
            solicitavel: dados.solicitavel,
            fonte: dados.fonte,
            componentes: { create: dados.componentes },
          },
        });
        if (dados.receitaPecaId !== null)
          await tx.receitaPeca.create({ data: { receitaId: r.id, receitaPecaId: dados.receitaPecaId } });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "RECEITA_CRIADA",
            entidade: "receita",
            entidadeId: r.id,
            depois: dados,
          },
          tx,
        );
        return r.id;
      });
      return this.detalhe(id);
    } catch (erro) {
      if (ehViolacaoUnicidade(erro)) throw new ConflictException("Já existe receita com esse nome.");
      throw erro;
    }
  }

  async alterar(
    id: string,
    dados: {
      nome?: string;
      ativa?: boolean;
      solicitavel?: boolean;
      limitePorMembro?: number | null;
      limitePeriodoDias?: number | null;
    },
    admin: Usuario,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const antes = await tx.receita.findUnique({ where: { id }, include: { precos: { take: 1 } } });
        if (antes === null) throw new NotFoundException("Receita não encontrada.");
        // Ativar uma receita solicitável sem preço não a deixaria solicitar; avisamos já.
        if (dados.ativa === true && (dados.solicitavel ?? antes.solicitavel) && antes.precos.length === 0) {
          throw new ConflictException("Defina os preços antes de ativar uma receita solicitável.");
        }
        await tx.receita.update({ where: { id }, data: dados });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "RECEITA_ALTERADA",
            entidade: "receita",
            entidadeId: id,
            antes,
            depois: dados,
          },
          tx,
        );
      });
    } catch (erro) {
      if (ehViolacaoUnicidade(erro)) throw new ConflictException("Já existe receita com esse nome.");
      throw erro;
    }
    return this.detalhe(id);
  }

  /** Substitui os componentes. Bloqueado com solicitação pendente (CT-125): ela já reservou os materiais. */
  async substituirComponentes(
    id: string,
    componentes: NovoComponente[],
    receitaPecaId: string | null,
    admin: Usuario,
  ) {
    this.validarComponentes(componentes);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM receita WHERE id = ${id}::uuid FOR UPDATE`;
      const antes = await tx.receita.findUnique({
        where: { id },
        include: { componentes: true, pecaDe: true },
      });
      if (antes === null) throw new NotFoundException("Receita não encontrada.");
      const pendentes = await tx.solicitacaoNebula.count({ where: { receitaId: id, status: "PENDENTE" } });
      if (pendentes > 0) {
        throw new ConflictException(
          `Há ${pendentes} solicitação(ões) pendente(s) desta receita: entregue ou rejeite antes de mudar os componentes.`,
        );
      }
      await this.validarPeca(tx, componentes, receitaPecaId, id);
      await tx.receitaComponente.deleteMany({ where: { receitaId: id } });
      await tx.receitaComponente.createMany({ data: componentes.map((c) => ({ ...c, receitaId: id })) });
      await tx.receitaPeca.deleteMany({ where: { receitaId: id } });
      if (receitaPecaId !== null) await tx.receitaPeca.create({ data: { receitaId: id, receitaPecaId } });
      await this.auditoria.registrar(
        {
          usuarioId: admin.id,
          acao: "RECEITA_COMPONENTES",
          entidade: "receita",
          entidadeId: id,
          antes: { componentes: antes.componentes, receitaPecaId: antes.pecaDe?.receitaPecaId ?? null },
          depois: { componentes, receitaPecaId },
        },
        tx,
      );
    });
    return this.detalhe(id);
  }

  /** D32: dois preços, versionados (só inclusão). A solicitação grava a versão usada. */
  async definirPreco(id: string, precoComPeca: number, precoTrazendoPeca: number, admin: Usuario) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if ((await tx.receita.count({ where: { id } })) === 0)
          throw new NotFoundException("Receita não encontrada.");
        const ultimo = await tx.precoReceita.findFirst({
          where: { receitaId: id },
          orderBy: { versao: "desc" },
        });
        const novo = await tx.precoReceita.create({
          data: {
            receitaId: id,
            versao: (ultimo?.versao ?? 0) + 1,
            precoComPeca,
            precoTrazendoPeca,
            criadoPorId: admin.id,
          },
        });
        await this.auditoria.registrar(
          {
            usuarioId: admin.id,
            acao: "RECEITA_PRECO",
            entidade: "receita",
            entidadeId: id,
            antes:
              ultimo === null
                ? undefined
                : { precoComPeca: ultimo.precoComPeca, precoTrazendoPeca: ultimo.precoTrazendoPeca },
            depois: { precoComPeca, precoTrazendoPeca, versao: novo.versao },
          },
          tx,
        );
        return novo;
      });
    } catch (erro) {
      if (ehViolacaoUnicidade(erro))
        throw new ConflictException("O preço foi alterado agora por outro admin. Recarregue.");
      throw erro;
    }
  }

  historicoPrecos(id: string) {
    return this.prisma.precoReceita.findMany({
      where: { receitaId: id },
      orderBy: { versao: "desc" },
      select: {
        id: true,
        versao: true,
        precoComPeca: true,
        precoTrazendoPeca: true,
        vigenteDesde: true,
        criadoPor: { select: { discordUsername: true } },
      },
    });
  }
}
