import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Papel, Usuario } from "@prisma/client";
import type { Request } from "express";

export const CHAVE_PUBLICO = "betel:publico";
export const CHAVE_PAPEIS = "betel:papeis";

/** Rota acessível sem sessão. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);

/** Restringe a rota aos papéis informados (403 para os demais). */
export const Papeis = (...papeis: Papel[]) => SetMetadata(CHAVE_PAPEIS, papeis);

export type RequisicaoAutenticada = Request & { usuario?: Usuario };

/** Usuário da sessão atual (definido pelo GuardaAutenticacao). */
export const UsuarioAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): Usuario => {
  const usuario = ctx.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
  if (usuario === undefined) throw new Error("UsuarioAtual usado em rota sem autenticação.");
  return usuario;
});
