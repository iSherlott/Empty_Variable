import { createHmac, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Usuario } from "@prisma/client";
import { CONFIGURACAO, type Configuracao } from "../configuracao.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Expira após 7 dias sem uso (arquitetura §5). */
export const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
/** Renova a validade no máximo uma vez por minuto, para não escrever no banco a cada requisição. */
const INTERVALO_RENOVACAO_MS = 60 * 1000;

@Injectable()
export class SessaoService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  /** O banco guarda só o HMAC do token: um vazamento da tabela não permite assumir sessões. */
  private idDoToken(token: string): string {
    return createHmac("sha256", this.config.sessionSecret).update(token).digest("hex");
  }

  async criar(usuarioId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.sessao.create({
      data: { id: this.idDoToken(token), usuarioId, expiraEm: new Date(Date.now() + DURACAO_SESSAO_MS) },
    });
    return token;
  }

  async validar(token: string): Promise<Usuario | null> {
    if (token.length === 0 || token.length > 100) return null;
    const id = this.idDoToken(token);
    const sessao = await this.prisma.sessao.findUnique({ where: { id }, include: { usuario: true } });
    const agora = Date.now();
    if (sessao === null) return null;
    if (sessao.expiraEm.getTime() <= agora || !sessao.usuario.ativo) {
      await this.prisma.sessao.deleteMany({ where: { id } });
      return null;
    }
    if (agora - sessao.ultimoUso.getTime() > INTERVALO_RENOVACAO_MS) {
      await this.prisma.sessao.update({
        where: { id },
        data: { ultimoUso: new Date(agora), expiraEm: new Date(agora + DURACAO_SESSAO_MS) },
      });
    }
    return sessao.usuario;
  }

  async encerrar(token: string): Promise<void> {
    await this.prisma.sessao.deleteMany({ where: { id: this.idDoToken(token) } });
  }

  async encerrarTodasDoUsuario(usuarioId: string): Promise<void> {
    await this.prisma.sessao.deleteMany({ where: { usuarioId } });
  }
}
