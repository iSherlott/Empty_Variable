import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Papel } from "@prisma/client";
import { CONFIGURACAO, type Configuracao } from "../configuracao.js";
import { CHAVE_PAPEIS, CHAVE_PUBLICO, type RequisicaoAutenticada } from "./decoradores.js";
import { SessaoService } from "./sessao.service.js";

export const COOKIE_SESSAO = "betel_sessao";

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Proteção contra CSRF: requisições que alteram dados precisam vir da origem do próprio sistema.
 * Roda antes da autenticação, inclusive em rotas públicas.
 */
@Injectable()
export class GuardaOrigem implements CanActivate {
  constructor(@Inject(CONFIGURACAO) private readonly config: Configuracao) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (METODOS_SEGUROS.has(req.method)) return true;
    if (req.headers.origin !== this.config.appOrigin) {
      throw new ForbiddenException("Origem da requisição não permitida.");
    }
    return true;
  }
}

/** Exige sessão válida em todas as rotas, exceto as marcadas com @Publico(). */
@Injectable()
export class GuardaAutenticacao implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessoes: SessaoService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean | undefined>(CHAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico === true) return true;
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token: unknown = req.cookies?.[COOKIE_SESSAO];
    const usuario = typeof token === "string" ? await this.sessoes.validar(token) : null;
    if (usuario === null) throw new UnauthorizedException("Sessão inválida ou expirada.");
    req.usuario = usuario;
    return true;
  }
}

/**
 * Aplica @Papeis(...). Sem o decorator, qualquer usuário autenticado passa.
 * D37: o ADMIN acessa tudo; GESTOR e MEMBRO só o que está listado.
 */
@Injectable()
export class GuardaPapeis implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const papeis = this.reflector.getAllAndOverride<Papel[] | undefined>(CHAVE_PAPEIS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (papeis === undefined || papeis.length === 0) return true;
    const usuario = ctx.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
    if (usuario === undefined || (usuario.papel !== "ADMIN" && !papeis.includes(usuario.papel))) {
      throw new ForbiddenException("Acesso restrito.");
    }
    return true;
  }
}
