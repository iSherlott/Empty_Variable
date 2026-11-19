import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import type { Papel, Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { CONFIGURACAO, type Configuracao } from "../configuracao.js";
import { objeto, uuid } from "../comum/validacao.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { Papeis, UsuarioAtual } from "./decoradores.js";

const PAPEIS: readonly Papel[] = ["ADMIN", "GESTOR", "MEMBRO"];

/**
 * Gestão de papéis: admins promovem e rebaixam outros usuários, com auditoria (arquitetura §5).
 * D38: o admin define quem é gestor. Quem está em ADMIN_DISCORD_IDS tem o papel fixo (o login
 * reaplica ADMIN), e nenhum admin rebaixa a si mesmo.
 */
@Controller("usuarios")
@Papeis("ADMIN")
export class UsuariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  @Get()
  async listar() {
    const usuarios = await this.prisma.usuario.findMany({
      orderBy: { discordUsername: "asc" },
      select: {
        id: true,
        discordUsername: true,
        globalName: true,
        papel: true,
        ativo: true,
        ultimoLogin: true,
        discordId: true,
        jogador: { select: { id: true, apelido: true } },
      },
    });
    // "papelFixo": admin definido no .env, que a tela não altera.
    return usuarios.map(({ discordId, ...u }) => ({
      ...u,
      papelFixo: this.config.adminDiscordIds.has(discordId),
    }));
  }

  @Patch(":id")
  async alterar(@Param("id") idBruto: string, @Body() corpo: unknown, @UsuarioAtual() admin: Usuario) {
    const id = uuid(idBruto, "id");
    const b = objeto(corpo);
    const papel = b["papel"];
    const ativo = b["ativo"];
    if (papel !== undefined && !PAPEIS.includes(papel as Papel)) {
      throw new BadRequestException("Papel deve ser ADMIN, GESTOR ou MEMBRO.");
    }
    if (ativo !== undefined && typeof ativo !== "boolean") throw new BadRequestException("ativo inválido.");

    return this.prisma.$transaction(async (tx) => {
      const alvo = await tx.usuario.findUnique({ where: { id } });
      if (alvo === null) throw new NotFoundException("Usuário não encontrado.");
      const novoPapel = (papel as Papel | undefined) ?? alvo.papel;
      const novoAtivo = (ativo as boolean | undefined) ?? alvo.ativo;
      if (novoPapel !== alvo.papel && this.config.adminDiscordIds.has(alvo.discordId)) {
        throw new ConflictException(
          "Este admin é definido em ADMIN_DISCORD_IDS: o papel dele não muda pela tela.",
        );
      }
      if (alvo.id === admin.id && (novoPapel !== "ADMIN" || !novoAtivo)) {
        throw new ConflictException("Você não pode rebaixar nem desativar a si mesmo.");
      }
      const deixaDeSerAdminAtivo =
        alvo.papel === "ADMIN" && alvo.ativo && (novoPapel !== "ADMIN" || !novoAtivo);
      if (deixaDeSerAdminAtivo) {
        const admins = await tx.usuario.count({ where: { papel: "ADMIN", ativo: true } });
        if (admins <= 1) throw new ConflictException("Não é possível remover o último administrador ativo.");
      }
      const atualizado = await tx.usuario.update({
        where: { id },
        data: { papel: novoPapel, ativo: novoAtivo },
        select: { id: true, discordUsername: true, papel: true, ativo: true },
      });
      await this.auditoria.registrar(
        {
          usuarioId: admin.id,
          acao: "USUARIO_ALTERADO",
          entidade: "usuario",
          entidadeId: id,
          antes: { papel: alvo.papel, ativo: alvo.ativo },
          depois: { papel: novoPapel, ativo: novoAtivo },
        },
        tx,
      );
      if (!novoAtivo) await tx.sessao.deleteMany({ where: { usuarioId: id } });
      return atualizado;
    });
  }
}
