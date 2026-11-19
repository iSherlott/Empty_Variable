import { Controller, ForbiddenException, Get, NotFoundException, Param } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { uuid } from "../comum/validacao.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { LedgerService } from "./ledger.service.js";

/** US-06: saldo e histórico. D14: o membro vê só o próprio; gestores e admins veem todos (D37). */
@Controller()
export class ExtratoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private async montar(jogadorId: string) {
    const jogador = await this.prisma.jogador.findUnique({
      where: { id: jogadorId },
      select: { id: true, apelido: true },
    });
    if (jogador === null) throw new NotFoundException("Jogador não encontrado.");
    const [saldo, lancamentos] = await Promise.all([
      this.ledger.saldo(jogadorId),
      this.ledger.extrato(jogadorId),
    ]);
    return { jogador, saldo, lancamentos };
  }

  /** Extrato do próprio jogador. Sem vínculo aprovado não há saldo a mostrar (D12). */
  @Get("extrato/me")
  async meu(@UsuarioAtual() usuario: Usuario) {
    const jogador = await this.prisma.jogador.findUnique({
      where: { usuarioId: usuario.id },
      select: { id: true },
    });
    if (jogador === null) throw new ForbiddenException("Seu vínculo com um jogador ainda não foi aprovado.");
    return this.montar(jogador.id);
  }

  /** Saldo do próprio jogador, leve, para a barra superior. Sem vínculo: 403 (D12). */
  @Get("saldo/me")
  async meuSaldo(@UsuarioAtual() usuario: Usuario) {
    const jogador = await this.prisma.jogador.findUnique({
      where: { usuarioId: usuario.id },
      select: { id: true },
    });
    if (jogador === null) throw new ForbiddenException("Seu vínculo com um jogador ainda não foi aprovado.");
    return { saldo: await this.ledger.saldo(jogador.id) };
  }

  /** CT-80: membro consultando outro jogador recebe 403. */
  @Get("extrato/:jogadorId")
  async deJogador(@Param("jogadorId") idBruto: string, @UsuarioAtual() usuario: Usuario) {
    const jogadorId = uuid(idBruto, "jogadorId");
    if (usuario.papel === "MEMBRO") {
      const proprio = await this.prisma.jogador.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (proprio?.id !== jogadorId) throw new ForbiddenException("Você só pode ver o próprio saldo.");
    }
    return this.montar(jogadorId);
  }

  @Get("saldos")
  @Papeis("GESTOR")
  saldos() {
    return this.ledger.saldos();
  }
}
