import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import type { StatusRun, Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { objeto, uuid } from "../comum/validacao.js";
import { lerEntradaRun, motivo } from "./entrada-run.js";
import { RunsService } from "./runs.service.js";

const STATUS_FILTRO: readonly StatusRun[] = ["CONCLUIDA", "FALHA_CHEFE", "ABORTADA", "ESTORNADA"];

function dataFiltro(v: unknown, campo: string): Date | undefined {
  if (v === undefined || v === "") return undefined;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new BadRequestException(`${campo} inválida.`);
  return new Date(`${v}T00:00:00.000Z`);
}

/** D11: só admins registram e corrigem runs (CT-69, CT-70). Os pontos são lançados na hora (CT-63). */
@Controller("runs")
@Papeis("GESTOR")
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post()
  registrar(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    return this.runs.registrar(lerEntradaRun(corpo), admin);
  }

  /** Corpo: { motivo, run: <mesmo formato do registro> }. */
  @Post(":id/corrigir")
  @HttpCode(201)
  corrigir(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    return this.runs.corrigir(uuid(id, "id"), lerEntradaRun(b["run"]), motivo(b["motivo"]), admin);
  }

  @Get()
  listar(
    @Query("dataDe") dataDe: unknown,
    @Query("dataAte") dataAte: unknown,
    @Query("instanciaId") instanciaId: unknown,
    @Query("status") status: unknown,
  ) {
    if (status !== undefined && !STATUS_FILTRO.includes(status as StatusRun)) {
      throw new BadRequestException("status inválido.");
    }
    const de = dataFiltro(dataDe, "dataDe");
    const ate = dataFiltro(dataAte, "dataAte");
    return this.runs.listar({
      ...(de === undefined ? {} : { dataDe: de }),
      ...(ate === undefined ? {} : { dataAte: ate }),
      ...(instanciaId === undefined ? {} : { instanciaId: uuid(instanciaId, "instanciaId") }),
      ...(status === undefined ? {} : { status: status as StatusRun }),
    });
  }

  @Get(":id")
  detalhe(@Param("id") id: string) {
    return this.runs.detalhe(uuid(id, "id"));
  }
}
