import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { booleano, inteiro, objeto, texto, textoOpcional, uuid } from "../comum/validacao.js";
import { type NovoComponente, ReceitasService } from "./receitas.service.js";

const PRECO_MAXIMO = 1_000_000_000;

function componentes(v: unknown): NovoComponente[] {
  if (!Array.isArray(v)) throw new BadRequestException("componentes deve ser uma lista.");
  if (v.length > 30) throw new BadRequestException("No máximo 30 componentes.");
  return v.map((c, i) => {
    const b = objeto(c);
    return {
      itemId: uuid(b["itemId"], `componentes[${i}].itemId`),
      quantidade: inteiro(b["quantidade"], `componentes[${i}].quantidade`, 1, 1_000_000),
      pecaBase: b["pecaBase"] === undefined ? false : booleano(b["pecaBase"], `componentes[${i}].pecaBase`),
    };
  });
}

const receitaPeca = (v: unknown) => (v === undefined || v === null ? null : uuid(v, "receitaPecaId"));

/** D35: os dois nulos (sem limite) ou os dois positivos. */
function limite(b: Record<string, unknown>) {
  const qtd = b["limitePorMembro"];
  const dias = b["limitePeriodoDias"];
  if (qtd === undefined && dias === undefined) return {};
  if (qtd === null && dias === null) return { limitePorMembro: null, limitePeriodoDias: null };
  if (qtd === null || dias === null || qtd === undefined || dias === undefined) {
    throw new BadRequestException(
      "Informe o limite e o período juntos, ou os dois nulos para tirar o limite.",
    );
  }
  return {
    limitePorMembro: inteiro(qtd, "Limite por membro", 1, 1_000),
    limitePeriodoDias: inteiro(dias, "Período do limite (dias)", 1, 3_650),
  };
}

/** US-16 (T-40): receitas, componentes, preços e disponibilidade. Só admins. */
@Controller("receitas")
@Papeis("GESTOR")
export class ReceitasController {
  constructor(private readonly receitas: ReceitasService) {}

  @Get()
  listar() {
    return this.receitas.listar();
  }

  @Get(":id")
  detalhe(@Param("id") id: string) {
    return this.receitas.detalhe(uuid(id, "id"));
  }

  @Post()
  criar(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    return this.receitas.criar(
      {
        nome: texto(b["nome"], "Nome", 2, 80),
        itemProduzidoId: uuid(b["itemProduzidoId"], "itemProduzidoId"),
        solicitavel: b["solicitavel"] === undefined ? false : booleano(b["solicitavel"], "solicitavel"),
        fonte: textoOpcional(b["fonte"], "Fonte", 2, 200) ?? null,
        componentes: componentes(b["componentes"]),
        receitaPecaId: receitaPeca(b["receitaPecaId"]),
      },
      admin,
    );
  }

  @Patch(":id")
  alterar(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    return this.receitas.alterar(
      uuid(id, "id"),
      {
        ...(b["nome"] === undefined ? {} : { nome: texto(b["nome"], "Nome", 2, 80) }),
        ...(b["ativa"] === undefined ? {} : { ativa: booleano(b["ativa"], "ativa") }),
        ...(b["solicitavel"] === undefined ? {} : { solicitavel: booleano(b["solicitavel"], "solicitavel") }),
        ...limite(b),
      },
      admin,
    );
  }

  /** Corpo: { componentes: [{ itemId, quantidade, pecaBase? }], receitaPecaId? }. */
  @Put(":id/componentes")
  substituirComponentes(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    return this.receitas.substituirComponentes(
      uuid(id, "id"),
      componentes(b["componentes"]),
      receitaPeca(b["receitaPecaId"]),
      admin,
    );
  }

  @Post(":id/precos")
  definirPreco(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    return this.receitas.definirPreco(
      uuid(id, "id"),
      inteiro(b["precoComPeca"], "Preço com a peça do estoque", 1, PRECO_MAXIMO),
      inteiro(b["precoTrazendoPeca"], "Preço trazendo a peça", 1, PRECO_MAXIMO),
      admin,
    );
  }

  @Get(":id/precos")
  historicoPrecos(@Param("id") id: string) {
    return this.receitas.historicoPrecos(uuid(id, "id"));
  }
}
