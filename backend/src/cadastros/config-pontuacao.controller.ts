import { Body, Controller, Get, Post } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { inteiro, objeto } from "../comum/validacao.js";
import {
  CAMPOS_PARAMETROS,
  ConfigPontuacaoService,
  type ParametrosPontuacao,
} from "./config-pontuacao.service.js";

/** Limites de sanidade das entradas (unidades: centésimos e pontos-base). O teto de 100% vem do motor. */
const MAXIMOS: Record<(typeof CAMPOS_PARAMETROS)[number], number> = {
  base: 1_000_000,
  alphaCentesimos: 10_000,
  sConcluidaCentesimos: 10_000,
  sFalhaCentesimos: 10_000,
  sAbortadaCentesimos: 10_000,
  pctEssencialBp: 10_000,
  pctImportanteBp: 10_000,
  pctComplementarBp: 10_000,
  tetoCredoresBp: 10_000,
};

@Controller("config-pontuacao")
export class ConfigPontuacaoController {
  constructor(private readonly config: ConfigPontuacaoService) {}

  /** Lida também pelo assistente de run (prévia dos pontos). */
  @Get("vigente")
  @Papeis("GESTOR")
  vigente() {
    return this.config.vigente();
  }

  @Get()
  @Papeis("GESTOR")
  historico() {
    return this.config.historico();
  }

  /** Todos os campos são obrigatórios: uma versão é sempre completa. */
  @Post()
  @Papeis("GESTOR")
  criar(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    const parametros = Object.fromEntries(
      CAMPOS_PARAMETROS.map((campo) => [campo, inteiro(b[campo], campo, 0, MAXIMOS[campo])]),
    ) as ParametrosPontuacao;
    return this.config.criarVersao(parametros, admin);
  }
}
