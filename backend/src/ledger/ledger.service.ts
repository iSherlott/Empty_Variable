import { Injectable } from "@nestjs/common";
import type { TipoLancamento } from "@prisma/client";
import { PrismaService, type Tx } from "../prisma/prisma.service.js";

export interface NovoLancamento {
  jogadorId: string;
  valor: number;
  tipo: TipoLancamento;
  criadoPorId: string;
  runId?: string;
  participacaoId?: string;
  emprestimoId?: string;
  /** Épico II: compra de origem (COMPRA do comprador, VENDA do vendedor) e linha da compra. */
  compraId?: string;
  compraLoteId?: string;
  /** Épico III: solicitação de Nebula de origem (débito NEBULA). */
  solicitacaoNebulaId?: string;
  transferenciaId?: string;
  observacao?: string;
}

/**
 * T-13: ledger de pontos, só inclusão (A2). O banco bloqueia UPDATE/DELETE/TRUNCATE.
 * O ledger não conhece runs: só recebe "lançar X para o jogador Y com origem Z" (arquitetura §2).
 * Saldo = soma dos lançamentos (view saldo_jogador).
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Não cria lançamento de valor zero (C5). Devolve null nesse caso. */
  async lancar(tx: Tx, l: NovoLancamento): Promise<{ id: string } | null> {
    if (l.valor === 0) return null;
    return tx.lancamentoPontos.create({
      data: {
        jogadorId: l.jogadorId,
        valor: l.valor,
        tipo: l.tipo,
        criadoPorId: l.criadoPorId,
        runId: l.runId ?? null,
        participacaoId: l.participacaoId ?? null,
        emprestimoId: l.emprestimoId ?? null,
        compraId: l.compraId ?? null,
        compraLoteId: l.compraLoteId ?? null,
        solicitacaoNebulaId: l.solicitacaoNebulaId ?? null,
        transferenciaId: l.transferenciaId ?? null,
        observacao: l.observacao ?? null,
      },
      select: { id: true },
    });
  }

  /**
   * Estorna todos os lançamentos ainda não estornados de uma run: para cada um, um lançamento
   * ESTORNO de valor oposto que aponta para o original (US-07). Nada é apagado nem editado.
   */
  async estornarRun(tx: Tx, runId: string, criadoPorId: string, observacao: string): Promise<number> {
    return this.estornar(tx, { runId }, criadoPorId, observacao);
  }

  /** Épico II (D25): cancelamento de compra antes da entrega estorna os lançamentos dela. */
  async estornarCompra(tx: Tx, compraId: string, criadoPorId: string, observacao: string): Promise<number> {
    return this.estornar(tx, { compraId }, criadoPorId, observacao);
  }

  /** Épico III (D36): cancelamento ou rejeição da solicitação de Nebula estorna o débito. */
  async estornarSolicitacaoNebula(
    tx: Tx,
    solicitacaoNebulaId: string,
    criadoPorId: string,
    observacao: string,
  ): Promise<number> {
    return this.estornar(tx, { solicitacaoNebulaId }, criadoPorId, observacao);
  }

  private async estornar(
    tx: Tx,
    origem: { runId: string } | { compraId: string } | { solicitacaoNebulaId: string },
    criadoPorId: string,
    observacao: string,
  ): Promise<number> {
    const pendentes = await tx.lancamentoPontos.findMany({
      where: { ...origem, tipo: { not: "ESTORNO" }, estornadoPor: null },
      orderBy: { criadoEm: "asc" },
    });
    for (const l of pendentes) {
      await tx.lancamentoPontos.create({
        data: {
          jogadorId: l.jogadorId,
          valor: -l.valor,
          tipo: "ESTORNO",
          criadoPorId,
          runId: l.runId,
          participacaoId: l.participacaoId,
          emprestimoId: l.emprestimoId,
          compraId: l.compraId,
          compraLoteId: l.compraLoteId,
          solicitacaoNebulaId: l.solicitacaoNebulaId,
          estornaLancamentoId: l.id,
          observacao,
        },
      });
    }
    return pendentes.length;
  }

  /** Saldo dentro de uma transação (a compra trava o jogador antes de chamar). */
  async saldoTx(tx: Tx, jogadorId: string): Promise<number> {
    const r = await tx.lancamentoPontos.aggregate({ where: { jogadorId }, _sum: { valor: true } });
    return r._sum.valor ?? 0;
  }

  async saldo(jogadorId: string): Promise<number> {
    const r = await this.prisma.$queryRaw<{ saldo: bigint }[]>`
      SELECT saldo FROM saldo_jogador WHERE jogador_id = ${jogadorId}::uuid`;
    return Number(r[0]?.saldo ?? 0n);
  }

  async saldos(): Promise<{ jogadorId: string; apelido: string; saldo: number }[]> {
    const r = await this.prisma.$queryRaw<{ jogador_id: string; apelido: string; saldo: bigint }[]>`
      SELECT s.jogador_id, j.apelido, s.saldo
      FROM saldo_jogador s JOIN jogador j ON j.id = s.jogador_id
      ORDER BY s.saldo DESC, j.apelido ASC`;
    return r.map((x) => ({ jogadorId: x.jogador_id, apelido: x.apelido, saldo: Number(x.saldo) }));
  }

  /** Histórico com a origem detalhada de cada lançamento (US-06, CT-64, CT-67). */
  async extrato(jogadorId: string) {
    const lancamentos = await this.prisma.lancamentoPontos.findMany({
      where: { jogadorId },
      orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
      select: {
        id: true,
        valor: true,
        tipo: true,
        criadoEm: true,
        observacao: true,
        estornaLancamentoId: true,
        transferencia: {
          select: {
            id: true,
            remetente: { select: { apelido: true } },
            destinatario: { select: { apelido: true } },
          },
        },
        run: {
          select: {
            id: true,
            data: true,
            status: true,
            corrigeRunId: true,
            encontro: { select: { nome: true, codigo: true } },
            versaoInstancia: { select: { instancia: { select: { id: true, nome: true } } } },
          },
        },
        participacao: {
          select: {
            id: true,
            personagem: { select: { nome: true } },
            jogador: { select: { id: true, apelido: true } },
            funcao: { select: { nome: true, classe: { select: { nomeOficial: true, apelidoGrupo: true } } } },
            rank: true,
            base: true,
            alphaCentesimos: true,
            pesoCentesimos: true,
            multiplicadorChefeCentesimos: true,
            multiplicadorStatusCentesimos: true,
            fracaoCentesimos: true,
            pontosGerados: true,
          },
        },
        compra: {
          select: {
            id: true,
            quantidade: true,
            precoUnitario: true,
            status: true,
            item: { select: { nome: true } },
            comprador: { select: { apelido: true } },
          },
        },
        compraLote: { select: { quantidade: true, valorVendedor: true } },
        solicitacaoNebula: {
          select: { id: true, trazPeca: true, status: true, receita: { select: { nome: true } } },
        },
        emprestimo: {
          select: {
            id: true,
            categoria: true,
            pctSugeridoBp: true,
            pctInformadoBp: true,
            pctEfetivo: true,
            pontos: true,
            itemDescricao: true,
            item: { select: { nome: true } },
            credor: { select: { id: true, apelido: true } },
          },
        },
      },
    });
    return lancamentos.map((l) => ({
      ...l,
      emprestimo:
        l.emprestimo === null ? null : { ...l.emprestimo, pctEfetivo: l.emprestimo.pctEfetivo.toString() },
    }));
  }
}
