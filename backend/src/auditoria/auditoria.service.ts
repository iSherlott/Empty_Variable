import { Global, Injectable, Module } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService, type Tx } from "../prisma/prisma.service.js";

export interface EventoAuditoria {
  usuarioId: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string;
  antes?: unknown;
  depois?: unknown;
}

/** Registro de quem fez o quê. O interceptor genérico (T-16) virá depois; por ora as ações sensíveis chamam este serviço. */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(evento: EventoAuditoria, tx?: Tx): Promise<void> {
    const json = (v: unknown) => (v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));
    await (tx ?? this.prisma).auditoria.create({
      data: {
        usuarioId: evento.usuarioId,
        acao: evento.acao,
        entidade: evento.entidade,
        entidadeId: evento.entidadeId ?? null,
        antes: json(evento.antes),
        depois: json(evento.depois),
      },
    });
  }
}

@Global()
@Module({ providers: [AuditoriaService], exports: [AuditoriaService] })
export class AuditoriaModule {}
