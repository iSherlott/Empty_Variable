import { Inject, Injectable } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { AuditoriaService } from "../auditoria/auditoria.service.js";
import { CONFIGURACAO, type Configuracao } from "../configuracao.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DISCORD_CLIENTE, type DiscordCliente, type PerfilDiscord } from "./discord.cliente.js";

export class ErroNaoMembro extends Error {}
export class ErroUsuarioInativo extends Error {}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(DISCORD_CLIENTE) private readonly discord: DiscordCliente,
  ) {}

  /** Callback do OAuth: troca o código, confere que é membro do servidor (D13) e cria/atualiza o usuário. */
  async concluirLoginDiscord(code: string): Promise<Usuario> {
    const token = await this.discord.trocarCodigo(code);
    try {
      const perfil = await this.discord.obterPerfil(token);
      if (!(await this.discord.ehMembroDoServidor(token))) throw new ErroNaoMembro();
      return await this.registrarEntrada(perfil);
    } finally {
      // O token do Discord só serve para o login (arquitetura §5).
      await this.discord.revogar(token);
    }
  }

  /** Cria ou atualiza o usuário a partir do perfil. Promove a ADMIN quem está em ADMIN_DISCORD_IDS. */
  async registrarEntrada(perfil: PerfilDiscord): Promise<Usuario> {
    const deveSerAdmin = this.config.adminDiscordIds.has(perfil.id);
    const existente = await this.prisma.usuario.findUnique({ where: { discordId: perfil.id } });
    if (existente !== null && !existente.ativo) throw new ErroUsuarioInativo();

    const dados = {
      discordUsername: perfil.username,
      globalName: perfil.globalName,
      avatar: perfil.avatar,
      ultimoLogin: new Date(),
    };
    const usuario = await this.prisma.usuario.upsert({
      where: { discordId: perfil.id },
      create: { discordId: perfil.id, ...dados, papel: deveSerAdmin ? "ADMIN" : "MEMBRO" },
      update: { ...dados, ...(deveSerAdmin ? { papel: "ADMIN" as const } : {}) },
    });
    if (existente === null || existente.papel !== usuario.papel) {
      await this.auditoria.registrar({
        usuarioId: usuario.id,
        acao: existente === null ? "USUARIO_CRIADO" : "PAPEL_ALTERADO_BOOTSTRAP",
        entidade: "usuario",
        entidadeId: usuario.id,
        antes: existente === null ? undefined : { papel: existente.papel },
        depois: { papel: usuario.papel, discordId: usuario.discordId },
      });
    }
    return usuario;
  }
}
