import { BadRequestException, Body, Controller, Get, Module, Param, Patch, Post } from "@nestjs/common";
import { RANK_MAX, RANK_MIN } from "@betel/scoring";
import type { DificuldadeInstancia, ModoInstancia, RetornoInstancia, Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { booleano, inteiro, objeto, texto, textoOpcional, uuid } from "../comum/validacao.js";
import {
  type DadosInstancia,
  InstanciasService,
  type NovaFuncao,
  type NovoEncontro,
} from "./instancias.service.js";
import { REFERENCIA_BROWIKI } from "./referencia-browiki.js";

const RETORNOS: readonly RetornoInstancia[] = ["DIARIO", "TRES_DIAS", "HORAS", "SEMANAL", "OUTRO"];
const MODOS: readonly ModoInstancia[] = ["SOLO", "GRUPO"];
const DIFICULDADES: readonly DificuldadeInstancia[] = ["FACIL", "MEDIA", "DIFICIL"];
/** Multiplicador do encontro em centésimos: de 0,01 a 100,00. */
const MULTIPLICADOR_MAXIMO = 10_000;

function lista(v: unknown, campo: string, max: number): unknown[] {
  if (!Array.isArray(v)) throw new BadRequestException(`${campo} deve ser uma lista.`);
  if (v.length > max) throw new BadRequestException(`${campo}: no máximo ${max} itens.`);
  return v;
}

function opcional<T extends string>(v: unknown, opcoes: readonly T[], campo: string): T | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (!opcoes.includes(v as T))
    throw new BadRequestException(`${campo} deve ser um de: ${opcoes.join(", ")}.`);
  return v as T;
}

function dados(b: Record<string, unknown>): DadosInstancia {
  const r: DadosInstancia = {};
  if (b["nome"] !== undefined) r.nome = texto(b["nome"], "Nome", 2, 60);
  if (b["ativa"] !== undefined) r.ativa = booleano(b["ativa"], "ativa");
  if (b["nivelMinimo"] !== undefined)
    r.nivelMinimo = b["nivelMinimo"] === null ? null : inteiro(b["nivelMinimo"], "Nível mínimo", 1, 300);
  const retorno = opcional(b["retorno"], RETORNOS, "retorno");
  if (retorno !== undefined) r.retorno = retorno;
  const modo = opcional(b["modo"], MODOS, "modo");
  if (modo !== undefined) r.modo = modo;
  const dificuldade = opcional(b["dificuldade"], DIFICULDADES, "dificuldade");
  if (dificuldade !== undefined) r.dificuldade = dificuldade;
  if (b["requisito"] !== undefined)
    r.requisito =
      b["requisito"] === null ? null : (textoOpcional(b["requisito"], "Requisito", 2, 80) ?? null);
  if (b["premiacao"] !== undefined)
    r.premiacao =
      b["premiacao"] === null ? null : (textoOpcional(b["premiacao"], "Premiação", 2, 80) ?? null);
  return r;
}

function encontros(v: unknown): NovoEncontro[] {
  return lista(v, "encontros", 10).map((e, i) => {
    const b = objeto(e);
    return {
      nome: texto(b["nome"], `encontros[${i}].nome`, 1, 40),
      multiplicadorCentesimos: inteiro(
        b["multiplicadorCentesimos"],
        `encontros[${i}].multiplicadorCentesimos`,
        1,
        MULTIPLICADOR_MAXIMO,
      ),
    };
  });
}

function funcoes(v: unknown): NovaFuncao[] {
  return lista(v, "funcoes", 300).map((f, i) => {
    const b = objeto(f);
    return {
      classeId: uuid(b["classeId"], `funcoes[${i}].classeId`),
      nome: texto(b["nome"], `funcoes[${i}].nome`, 1, 40),
      rank: inteiro(b["rank"], `funcoes[${i}].rank`, RANK_MIN, RANK_MAX),
      padrao: b["padrao"] === undefined ? false : booleano(b["padrao"], `funcoes[${i}].padrao`),
    };
  });
}

/** T-59 (D43 a D46): instâncias, versões e a referência da browiki. Gestor e admin. */
@Controller("instancias")
@Papeis("GESTOR")
export class InstanciasController {
  constructor(private readonly instancias: InstanciasService) {}

  @Get()
  listar() {
    return this.instancias.listar();
  }

  /** Dados de apoio para o cadastro (nome, nível, retorno…), sem multiplicadores. */
  @Get("referencia")
  referencia() {
    return REFERENCIA_BROWIKI;
  }

  @Get(":id")
  detalhe(@Param("id") id: string) {
    return this.instancias.detalhe(uuid(id, "id"));
  }

  @Get(":id/versoes")
  historico(@Param("id") id: string) {
    return this.instancias.historico(uuid(id, "id"));
  }

  /** Corpo: { nome, …referência, encontros: [{ nome, multiplicadorCentesimos }] }. Nasce inativa. */
  @Post()
  criar(@Body() corpo: unknown, @UsuarioAtual() usuario: Usuario) {
    const b = objeto(corpo);
    const d = dados(b);
    if (d.nome === undefined) throw new BadRequestException("Informe o nome da instância.");
    delete d.ativa;
    return this.instancias.criar({ ...d, nome: d.nome }, encontros(b["encontros"]), usuario);
  }

  @Patch(":id")
  alterar(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() usuario: Usuario) {
    return this.instancias.alterar(uuid(id, "id"), dados(objeto(corpo)), usuario);
  }

  /** Corpo: { encontros: [...], funcoes: [{ classeId, nome, rank, padrao }] } — a tabela inteira (D46). */
  @Post(":id/versoes")
  novaVersao(@Param("id") id: string, @Body() corpo: unknown, @UsuarioAtual() usuario: Usuario) {
    const b = objeto(corpo);
    return this.instancias.novaVersao(
      uuid(id, "id"),
      encontros(b["encontros"]),
      funcoes(b["funcoes"] ?? []),
      usuario,
    );
  }
}

@Module({ controllers: [InstanciasController], providers: [InstanciasService], exports: [InstanciasService] })
export class InstanciasModule {}
