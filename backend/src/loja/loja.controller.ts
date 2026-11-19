import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import type { StatusCompra, Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { inteiro, objeto, textoOpcional, uuid } from "../comum/validacao.js";
import { LojaService } from "./loja.service.js";

const STATUS: readonly StatusCompra[] = ["PENDENTE_ENTREGA", "ENTREGUE", "CANCELADA"];

const motivoOpcional = (corpo: unknown) =>
  textoOpcional(
    corpo === undefined || corpo === null ? undefined : objeto(corpo)["motivo"],
    "Motivo",
    3,
    300,
  ) ?? null;

/** Membro vinculado: vitrine, comprar, minhas compras e cancelar antes da entrega. */
@Controller("loja")
export class LojaController {
  constructor(private readonly loja: LojaService) {}

  @Get()
  vitrine(@UsuarioAtual() usuario: Usuario) {
    return this.loja.vitrine(usuario);
  }

  @Get("catalogo")
  catalogo() {
    return this.loja.catalogo();
  }

  @Post("compras")
  comprar(@Body() corpo: unknown, @UsuarioAtual() usuario: Usuario) {
    const b = objeto(corpo);
    return this.loja.comprar(
      usuario,
      uuid(b["itemId"], "itemId"),
      inteiro(b["quantidade"], "Quantidade", 1, 10_000),
      b["precoEsperado"] === undefined ? undefined : inteiro(b["precoEsperado"], "Preço", 1, 1_000_000_000),
    );
  }

  @Get("compras")
  minhas(@UsuarioAtual() usuario: Usuario) {
    return this.loja.minhas(usuario);
  }

  @Post("compras/:id/cancelar")
  @HttpCode(200)
  cancelar(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() usuario: Usuario) {
    return this.loja.cancelar(uuid(id, "id"), usuario, motivoOpcional(corpo), false);
  }
}

/** Admin: fila de compras, entrega (D19, D28) e cancelamento com motivo (D25). */
@Controller("compras")
@Papeis("ADMIN")
export class ComprasAdminController {
  constructor(private readonly loja: LojaService) {}

  @Get()
  listar(@Query("status") status: unknown) {
    if (status !== undefined && status !== "" && !STATUS.includes(status as StatusCompra)) {
      throw new BadRequestException("status inválido.");
    }
    return this.loja.listar(status === undefined || status === "" ? undefined : (status as StatusCompra));
  }

  @Post(":id/entregar")
  @HttpCode(200)
  entregar(@Param("id") id: string, @UsuarioAtual() admin: Usuario) {
    return this.loja.entregar(uuid(id, "id"), admin);
  }

  @Post(":id/cancelar")
  @HttpCode(200)
  cancelar(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    return this.loja.cancelar(uuid(id, "id"), admin, motivoOpcional(corpo), true);
  }
}
