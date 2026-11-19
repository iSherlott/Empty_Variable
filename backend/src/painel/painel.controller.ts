import { Controller, Get, Module } from "@nestjs/common";
import { Papeis } from "../auth/decoradores.js";
import { LedgerModule } from "../ledger/ledger.module.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DIA_MS = 86_400_000;

/** Pendência com a quantidade e, quando há fila, desde quando a mais antiga espera. */
interface Pendencia {
  quantidade: number;
  maisAntiga: Date | null;
}

/**
 * T-50: telas iniciais dos painéis (paineis §4). Só contagens, para os cartões de pendência:
 * os detalhes ficam nas telas de cada fila.
 */
@Controller("painel")
export class PainelController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Gestão (gestor e admin): vínculos, receitas a validar, runs recentes e os maiores saldos. */
  @Get("gestao")
  @Papeis("GESTOR")
  async gestao() {
    const semana = new Date(Date.now() - 7 * DIA_MS);
    const [vinculos, vinculoMaisAntigo, receitasAValidar, runsSemana, saldos] = await Promise.all([
      this.prisma.solicitacaoVinculo.count({ where: { status: "PENDENTE" } }),
      this.prisma.solicitacaoVinculo.findFirst({
        where: { status: "PENDENTE" },
        orderBy: { criadaEm: "asc" },
        select: { criadaEm: true },
      }),
      this.prisma.receita.count({ where: { ativa: false, solicitavel: true } }),
      this.prisma.run.count({ where: { criadaEm: { gte: semana }, status: { not: "ESTORNADA" } } }),
      this.ledger.saldos(),
    ]);
    return {
      vinculosPendentes: {
        quantidade: vinculos,
        maisAntiga: vinculoMaisAntigo?.criadaEm ?? null,
      } satisfies Pendencia,
      receitasAValidar,
      runsNaSemana: runsSemana,
      maioresSaldos: saldos.slice(0, 5),
    };
  }

  /** Administração (admin): entregas da loja e da Nebula, ofertas a analisar e itens sem conferência. */
  @Get("admin")
  @Papeis("ADMIN")
  async admin() {
    const fila = async (
      contar: () => Promise<number>,
      primeira: () => Promise<{ criadaEm: Date } | null>,
    ): Promise<Pendencia> => {
      const [quantidade, p] = await Promise.all([contar(), primeira()]);
      return { quantidade, maisAntiga: p?.criadaEm ?? null };
    };
    const asc = { orderBy: { criadaEm: "asc" as const }, select: { criadaEm: true } };
    const [compras, ofertas, nebula, itensSemConferencia] = await Promise.all([
      fila(
        () => this.prisma.compra.count({ where: { status: "PENDENTE_ENTREGA" } }),
        () => this.prisma.compra.findFirst({ where: { status: "PENDENTE_ENTREGA" }, ...asc }),
      ),
      fila(
        () =>
          this.prisma.ofertaVenda.count({ where: { status: { in: ["PENDENTE", "RETIRADA_SOLICITADA"] } } }),
        () =>
          this.prisma.ofertaVenda.findFirst({
            where: { status: { in: ["PENDENTE", "RETIRADA_SOLICITADA"] } },
            ...asc,
          }),
      ),
      fila(
        () => this.prisma.solicitacaoNebula.count({ where: { status: "PENDENTE" } }),
        () => this.prisma.solicitacaoNebula.findFirst({ where: { status: "PENDENTE" }, ...asc }),
      ),
      this.prisma.itemCatalogo.count({
        where: { ativo: true, OR: [{ negociavel: null }, { vinculadoConta: null }] },
      }),
    ]);
    return {
      comprasAEntregar: compras,
      ofertasAAnalisar: ofertas,
      nebulasAEntregar: nebula,
      itensSemConferencia,
    };
  }
}

@Module({ imports: [LedgerModule], controllers: [PainelController] })
export class PainelModule {}
