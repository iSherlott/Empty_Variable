import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from "@nestjs/common";
import { ErroDominio } from "@betel/scoring";
import type { Response } from "express";

/**
 * Regras de negócio violadas no motor de cálculo (D15, C3, rank, fração...) viram 422 com o código,
 * para o frontend mostrar a mensagem e destacar o campo.
 */
@Catch(ErroDominio)
export class FiltroErroDominio implements ExceptionFilter {
  catch(erro: ErroDominio, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.UNPROCESSABLE_ENTITY)
      .json({ statusCode: 422, codigo: erro.codigo, message: erro.message });
  }
}
