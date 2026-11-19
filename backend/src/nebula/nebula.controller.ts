import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import type { StatusSolicitacaoNebula, Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { booleano, objeto, texto, uuid } from "../comum/validacao.js";
import { NebulaService } from "./nebula.service.js";

const STATUS: readonly StatusSolicitacaoNebula[] = ["PENDENTE", "ENTREGUE", "CANCELADA", "REJEITADA"];

/** US-17, US-18, US-20 (T-43, T-44): membro vinculado vê, solicita e cancela as próprias. */
@Controller("nebula")
export class NebulaController {
  constructor(private readonly nebula: NebulaService) {}

  @Get()
  vitrine(@UsuarioAtual() usuario: Usuario) {
    return this.nebula.vitrine(usuario);
  }

  /** Corpo: { receitaId, trazPeca }. */
  @Post("solicitacoes")
  solicitar(@Body() corpo: unknown, @UsuarioAtual() usuario: Usuario) {
    const b = objeto(corpo);
    return this.nebula.solicitar(
      usuario,
      uuid(b["receitaId"], "receitaId"),
      booleano(b["trazPeca"], "trazPeca"),
    );
  }

  @Get("solicitacoes")
  minhas(@UsuarioAtual() usuario: Usuario) {
    return this.nebula.minhas(usuario);
  }

  @Post("solicitacoes/:id/cancelar")
  @HttpCode(200)
  cancelar(@Param("id") id: string, @UsuarioAtual() usuario: Usuario) {
    return this.nebula.encerrar(uuid(id, "id"), usuario, null, false);
  }
}

/** US-19 (T-44): fila do admin, entrega e rejeição com motivo. */
@Controller("nebula")
@Papeis("ADMIN")
export class NebulaAdminController {
  constructor(private readonly nebula: NebulaService) {}

  @Get("fila")
  fila(@Query("status") status?: string) {
    if (status === "TODAS") return this.nebula.fila(null);
    const s = (status ?? "PENDENTE") as StatusSolicitacaoNebula;
    if (!STATUS.includes(s)) throw new BadRequestException("Status inválido.");
    return this.nebula.fila(s);
  }

  @Post("solicitacoes/:id/entregar")
  @HttpCode(200)
  entregar(@Param("id") id: string, @UsuarioAtual() admin: Usuario) {
    return this.nebula.entregar(uuid(id, "id"), admin);
  }

  /** Corpo: { motivo }. */
  @Post("solicitacoes/:id/rejeitar")
  @HttpCode(200)
  rejeitar(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const motivo = texto(objeto(corpo)["motivo"], "Motivo", 3, 300);
    return this.nebula.encerrar(uuid(id, "id"), admin, motivo, true);
  }
}
