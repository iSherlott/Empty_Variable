import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import type { CookieOptions, Request, Response } from "express";
import { objeto, texto } from "../comum/validacao.js";
import { CONFIGURACAO, type Configuracao } from "../configuracao.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService, ErroNaoMembro, ErroUsuarioInativo } from "./auth.service.js";
import { Publico, UsuarioAtual } from "./decoradores.js";
import { DISCORD_CLIENTE, type DiscordCliente } from "./discord.cliente.js";
import { COOKIE_SESSAO } from "./guardas.js";
import { DURACAO_SESSAO_MS, SessaoService } from "./sessao.service.js";

const COOKIE_STATE = "betel_oauth_state";
const DURACAO_STATE_MS = 10 * 60 * 1000;

export interface UsuarioMe {
  id: string;
  discordUsername: string;
  globalName: string | null;
  avatarUrl: string | null;
  papel: Usuario["papel"];
  jogador: { id: string; apelido: string } | null;
  vinculoPendente: boolean;
}

@Controller("auth")
export class AuthController {
  private readonly log = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly sessoes: SessaoService,
    private readonly prisma: PrismaService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(DISCORD_CLIENTE) private readonly discord: DiscordCliente,
  ) {}

  private cookie(maxAge: number, path = "/"): CookieOptions {
    return { httpOnly: true, secure: this.config.cookieSecure, sameSite: "lax", path, maxAge };
  }

  /** Inicia o OAuth2 (authorization code) com `state` contra CSRF. */
  @Publico()
  @Get("discord")
  iniciar(@Res() res: Response): void {
    if (this.config.discord === null)
      throw new ServiceUnavailableException("Login com Discord não configurado.");
    const state = randomBytes(24).toString("base64url");
    res.cookie(COOKIE_STATE, state, this.cookie(DURACAO_STATE_MS, "/api/auth"));
    res.redirect(302, this.discord.urlAutorizacao(state));
  }

  @Publico()
  @Get("discord/callback")
  async callback(
    @Query("code") code: unknown,
    @Query("state") state: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const esperado: unknown = req.cookies?.[COOKIE_STATE];
    res.clearCookie(COOKIE_STATE, { path: "/api/auth" });
    const voltar = (erro?: string) =>
      res.redirect(302, `${this.config.appOrigin}/${erro === undefined ? "" : `login?erro=${erro}`}`);

    if (typeof code !== "string" || typeof state !== "string" || typeof esperado !== "string") {
      voltar("falha");
      return;
    }
    const a = Buffer.from(state);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      voltar("falha");
      return;
    }
    try {
      const usuario = await this.auth.concluirLoginDiscord(code);
      const token = await this.sessoes.criar(usuario.id);
      res.cookie(COOKIE_SESSAO, token, this.cookie(DURACAO_SESSAO_MS));
      voltar();
    } catch (erro) {
      if (erro instanceof ErroNaoMembro) voltar("nao-membro");
      else if (erro instanceof ErroUsuarioInativo) voltar("inativo");
      else {
        this.log.error(`Falha no login com Discord: ${String(erro)}`);
        voltar("falha");
      }
    }
  }

  /**
   * Login simulado para desenvolvimento e testes e2e (T-23).
   * Só existe com AUTH_DEV_LOGIN=true e NODE_ENV diferente de production.
   */
  @Publico()
  @Post("dev-login")
  @HttpCode(204)
  async devLogin(@Body() corpo: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    if (!this.config.devLogin) throw new NotFoundException();
    const b = objeto(corpo);
    const discordId = texto(b["discordId"], "discordId", 1, 32);
    const username = texto(b["username"], "username", 1, 32);
    const usuario = await this.auth.registrarEntrada({
      id: discordId,
      username,
      globalName: null,
      avatar: null,
    });
    const token = await this.sessoes.criar(usuario.id);
    res.cookie(COOKIE_SESSAO, token, this.cookie(DURACAO_SESSAO_MS));
  }

  @Get("me")
  async me(@UsuarioAtual() usuario: Usuario): Promise<UsuarioMe> {
    const [jogador, pendente] = await Promise.all([
      this.prisma.jogador.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true, apelido: true },
      }),
      this.prisma.solicitacaoVinculo.count({ where: { usuarioId: usuario.id, status: "PENDENTE" } }),
    ]);
    return {
      id: usuario.id,
      discordUsername: usuario.discordUsername,
      globalName: usuario.globalName,
      avatarUrl:
        usuario.avatar === null
          ? null
          : `https://cdn.discordapp.com/avatars/${usuario.discordId}/${usuario.avatar}.png`,
      papel: usuario.papel,
      jogador,
      vinculoPendente: pendente > 0,
    };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token: unknown = req.cookies?.[COOKIE_SESSAO];
    if (typeof token === "string") await this.sessoes.encerrar(token);
    res.clearCookie(COOKIE_SESSAO, { path: "/" });
  }
}
