import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import type { TipoMovimentoEstoque, Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { inteiro, objeto, texto, textoOpcional, uuid } from "../comum/validacao.js";
import { PRECO_MAXIMO } from "../loja/preco-item.js";
import { EstoqueService } from "./estoque.service.js";

const TIPOS: readonly TipoMovimentoEstoque[] = [
  "ENTRADA",
  "VENDA",
  "DEVOLUCAO",
  "RETIRADA",
  "AJUSTE",
  "NEBULA",
];

function dataFiltro(v: unknown, campo: string): Date | undefined {
  if (v === undefined || v === "") return undefined;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new BadRequestException(`${campo} inválida.`);
  return new Date(`${v}T00:00:00.000Z`);
}

const uuidOpcional = (v: unknown, campo: string) =>
  v === undefined || v === "" ? undefined : uuid(v, campo);

/** US-09 / T-27: estoque do grupo. Só admins. */
@Controller()
@Papeis("ADMIN")
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get("estoque")
  resumo() {
    return this.estoque.resumo();
  }

  @Get("estoque/origens")
  origens() {
    return this.estoque.origens();
  }

  @Get("estoque/lotes")
  lotes(@Query("itemId") itemId: unknown) {
    return this.estoque.lotes(uuidOpcional(itemId, "itemId"));
  }

  @Get("estoque/movimentos")
  movimentos(
    @Query("itemId") itemId: unknown,
    @Query("loteId") loteId: unknown,
    @Query("tipo") tipo: unknown,
    @Query("dataDe") dataDe: unknown,
    @Query("dataAte") dataAte: unknown,
  ) {
    if (tipo !== undefined && tipo !== "" && !TIPOS.includes(tipo as TipoMovimentoEstoque)) {
      throw new BadRequestException("tipo inválido.");
    }
    const f = {
      itemId: uuidOpcional(itemId, "itemId"),
      loteId: uuidOpcional(loteId, "loteId"),
      tipo: tipo === undefined || tipo === "" ? undefined : (tipo as TipoMovimentoEstoque),
      dataDe: dataFiltro(dataDe, "dataDe"),
      dataAte: dataFiltro(dataAte, "dataAte"),
    };
    return this.estoque.movimentos(
      Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as Parameters<
        EstoqueService["movimentos"]
      >[0],
    );
  }

  @Post("estoque/entradas")
  entrada(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    return this.estoque.entradaManual(
      uuid(b["itemId"], "itemId"),
      inteiro(b["quantidade"], "Quantidade", 1, 1_000_000),
      textoOpcional(b["motivo"], "Motivo", 1, 300) ?? null,
      admin,
      b["origem"] === "DROP_SOLTO" ? "DROP_SOLTO" : uuidOpcional(b["origem"], "Origem"),
      b["valorUnitarioPontos"] === undefined
        ? null
        : inteiro(b["valorUnitarioPontos"], "Valor unitário", 0, 2_147_483_647),
      b["precoPontos"] === undefined
        ? undefined
        : inteiro(b["precoPontos"], "Preço de venda", 1, PRECO_MAXIMO),
    );
  }

  /** Corpo: { loteId, quantidade (com sinal, ≠ 0), motivo }. */
  @Post("estoque/ajustes")
  ajuste(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    const quantidade = inteiro(b["quantidade"], "Quantidade", -1_000_000, 1_000_000);
    if (quantidade === 0) throw new BadRequestException("Quantidade do ajuste não pode ser zero.");
    return this.estoque.ajustar(
      uuid(b["loteId"], "loteId"),
      quantidade,
      texto(b["motivo"], "Motivo", 3, 300),
      admin,
    );
  }

  /** D18: lança no estoque do grupo os drops da run (cada drop uma única vez). */
  @Post("runs/:id/estoque")
  @HttpCode(200)
  lancarDrops(@Param("id") id: string, @UsuarioAtual() admin: Usuario) {
    return this.estoque.lancarDropsRun(uuid(id, "id"), admin);
  }
}
