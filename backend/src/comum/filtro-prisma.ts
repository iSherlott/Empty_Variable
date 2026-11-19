import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

/** Traduz violações de unicidade/integridade do banco em respostas HTTP (em vez de 500). */
@Catch(Prisma.PrismaClientKnownRequestError)
export class FiltroErrosPrisma implements ExceptionFilter {
  catch(erro: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    switch (erro.code) {
      case "P2002":
        res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: "Registro já existe." });
        return;
      case "P2003":
      case "P2025":
        res
          .status(HttpStatus.NOT_FOUND)
          .json({ statusCode: 404, message: "Registro relacionado não encontrado." });
        return;
      default:
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: "Erro interno." });
    }
  }
}

/** Índices únicos sem diferenciar maiúsculas (criados em SQL) chegam como erro bruto do Postgres. */
export function ehViolacaoUnicidade(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    return erro.code === "P2002" || (erro.code === "P2010" && String(erro.meta?.["code"]) === "23505");
  }
  return erro instanceof Prisma.PrismaClientUnknownRequestError && erro.message.includes("23505");
}
