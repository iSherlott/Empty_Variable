import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { Papeis, UsuarioAtual } from "../auth/decoradores.js";
import { ehViolacaoUnicidade } from "../comum/filtro-prisma.js";
import { booleano, objeto, texto, textoOpcional, uuid } from "../comum/validacao.js";
import { InstanciasService } from "../instancias/instancias.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const SELECAO_CLASSE = { id: true, nomeOficial: true, apelidoGrupo: true, ativa: true };

/**
 * US-01 / T-10: classes do jogo (globais). Desde o Épico IV (D45), as funções e os ranks são de cada
 * instância e versionados: ficam em /instancias/:id/versoes. A listagem continua trazendo as funções
 * da versão vigente de uma instância (por padrão, a Torre), para o registro de runs.
 */
@Controller()
@Papeis("GESTOR")
export class ClassesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly instancias: InstanciasService,
  ) {}

  private async comConflito<T>(op: () => Promise<T>, mensagem: string): Promise<T> {
    try {
      return await op();
    } catch (erro) {
      if (ehViolacaoUnicidade(erro)) throw new ConflictException(mensagem);
      throw erro;
    }
  }

  /** Classes com as funções da versão vigente da instância (`?instanciaId=`; sem ele, a Torre). */
  @Get("classes")
  async listar(@Query("instanciaId") instanciaBruta?: string) {
    const instanciaId =
      instanciaBruta === undefined ? (await this.instancias.torre()).id : uuid(instanciaBruta, "instanciaId");
    const [classes, versao] = await Promise.all([
      this.prisma.classe.findMany({ orderBy: { nomeOficial: "asc" }, select: SELECAO_CLASSE }),
      this.instancias.vigente(this.prisma, instanciaId),
    ]);
    if (versao === null) throw new NotFoundException("Instância não encontrada.");
    return classes.map((c) => ({
      ...c,
      funcoes: versao.funcoes
        .filter((f) => f.classeId === c.id)
        .map((f) => ({ id: f.id, nome: f.nome, rank: f.rank, padrao: f.padrao })),
    }));
  }

  @Post("classes")
  async criar(@Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const b = objeto(corpo);
    const nomeOficial = texto(b["nomeOficial"], "Nome oficial", 2, 60);
    const apelidoGrupo = textoOpcional(b["apelidoGrupo"], "Apelido no grupo", 1, 40) ?? null;
    return this.comConflito(
      () =>
        this.prisma.$transaction(async (tx) => {
          const classe = await tx.classe.create({
            data: { nomeOficial, apelidoGrupo },
            select: SELECAO_CLASSE,
          });
          await this.auditoria.registrar(
            {
              usuarioId: admin.id,
              acao: "CLASSE_CRIADA",
              entidade: "classe",
              entidadeId: classe.id,
              depois: classe,
            },
            tx,
          );
          return { ...classe, funcoes: [] };
        }),
      "Já existe classe com esse nome.",
    );
  }

  @Patch("classes/:id")
  async alterar(@Param("id") idBruto: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const id = uuid(idBruto, "id");
    const b = objeto(corpo);
    const dados = {
      ...(b["nomeOficial"] === undefined
        ? {}
        : { nomeOficial: texto(b["nomeOficial"], "Nome oficial", 2, 60) }),
      ...(b["apelidoGrupo"] === undefined
        ? {}
        : { apelidoGrupo: textoOpcional(b["apelidoGrupo"], "Apelido no grupo", 1, 40) ?? null }),
      ...(b["ativa"] === undefined ? {} : { ativa: booleano(b["ativa"], "ativa") }),
    };
    return this.comConflito(
      () =>
        this.prisma.$transaction(async (tx) => {
          const antes = await tx.classe.findUnique({ where: { id } });
          if (antes === null) throw new NotFoundException("Classe não encontrada.");
          const classe = await tx.classe.update({ where: { id }, data: dados, select: SELECAO_CLASSE });
          await this.auditoria.registrar(
            {
              usuarioId: admin.id,
              acao: "CLASSE_ALTERADA",
              entidade: "classe",
              entidadeId: id,
              antes,
              depois: dados,
            },
            tx,
          );
          return classe;
        }),
      "Já existe classe com esse nome.",
    );
  }
}
