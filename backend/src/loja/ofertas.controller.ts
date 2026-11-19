import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import type { StatusOferta, Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { inteiro, objeto, texto, uuid } from "../comum/validacao.js";
import { OfertasService } from "./ofertas.service.js";

const STATUS: readonly StatusOferta[] = [
  "PENDENTE",
  "APROVADA",
  "REJEITADA",
  "RETIRADA_SOLICITADA",
  "RETIRADA",
  "ESGOTADA",
];

/** US-14: o membro oferece itens em consignação e pede a retirada (D22, D25). */
@Controller("loja/ofertas")
export class OfertasMembroController {
  constructor(private readonly ofertas: OfertasService) {}

  @Get("itens")
  itens(@UsuarioAtual() usuario: Usuario) {
    return this.ofertas.itensOfertaveis(usuario);
  }

  @Get()
  minhas(@UsuarioAtual() usuario: Usuario) {
    return this.ofertas.minhas(usuario);
  }

  @Post()
  criar(@Body() corpo: unknown, @UsuarioAtual() usuario: Usuario) {
    const b = objeto(corpo);
    return this.ofertas.criar(
      usuario,
      uuid(b["itemId"], "itemId"),
      inteiro(b["quantidade"], "Quantidade", 1, 10_000),
    );
  }

  @Post(":id/retirar")
  @HttpCode(200)
  retirar(@Param("id") id: string, @UsuarioAtual() usuario: Usuario) {
    return this.ofertas.retirar(uuid(id, "id"), usuario);
  }
}

/** Admin: fila de ofertas — aprovar ao receber o item, rejeitar com motivo, concluir a retirada. */
@Controller("ofertas")
@Papeis("ADMIN")
export class OfertasAdminController {
  constructor(private readonly ofertas: OfertasService) {}

  @Get()
  listar(@Query("status") status: unknown) {
    if (status !== undefined && status !== "" && !STATUS.includes(status as StatusOferta)) {
      throw new BadRequestException("status inválido.");
    }
    return this.ofertas.listar(status === undefined || status === "" ? undefined : (status as StatusOferta));
  }

  @Post(":id/aprovar")
  @HttpCode(200)
  aprovar(@Param("id") id: string, @UsuarioAtual() admin: Usuario) {
    return this.ofertas.aprovar(uuid(id, "id"), admin);
  }

  @Post(":id/rejeitar")
  @HttpCode(200)
  rejeitar(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    return this.ofertas.rejeitar(uuid(id, "id"), texto(objeto(corpo)["motivo"], "Motivo", 3, 300), admin);
  }

  @Post(":id/concluir-retirada")
  @HttpCode(200)
  concluirRetirada(@Param("id") id: string, @UsuarioAtual() admin: Usuario) {
    return this.ofertas.concluirRetirada(uuid(id, "id"), admin);
  }
}
