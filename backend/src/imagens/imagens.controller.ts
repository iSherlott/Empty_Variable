import {
  BadRequestException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import type { TipoImagem } from "@prisma/client";
import type { Response } from "express";
import { BUSCADOR_IMAGEM, type BuscadorImagem, ImagensService } from "./imagens.service.js";

/** Map, e não objeto: "constructor" e afins não existem como chave. */
const TIPOS = new Map<string, TipoImagem>([
  ["icone", "ICONE"],
  ["ilustracao", "ILUSTRACAO"],
]);

/**
 * T-55 (D41): `GET /api/imagens/item/:idJogo?tipo=icone|ilustracao`.
 * Exige sessão, como o resto do sistema: as imagens só aparecem para quem está logado.
 */
@Controller("imagens")
export class ImagensController {
  constructor(private readonly imagens: ImagensService) {}

  @Get("item/:idJogo")
  async item(
    @Param("idJogo") idBruto: string,
    @Query("tipo") tipoBruto: string | undefined,
    @Res() res: Response,
  ) {
    // CT-141: só IDs inteiros positivos e os dois tipos conhecidos, sem chamada externa.
    if (!/^\d{1,9}$/.test(idBruto) || Number(idBruto) < 1)
      throw new BadRequestException("ID do jogo inválido.");
    const tipo = TIPOS.get(tipoBruto ?? "icone");
    if (tipo === undefined) throw new BadRequestException("Tipo de imagem inválido (icone ou ilustracao).");

    const imagem = await this.imagens.obter(Number(idBruto), tipo);
    if (imagem === null) throw new NotFoundException("Imagem não encontrada.");
    res.setHeader("Content-Type", imagem.mime);
    res.setHeader("Cache-Control", "private, max-age=604800");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(imagem.conteudo);
  }
}

@Module({
  controllers: [ImagensController],
  providers: [
    ImagensService,
    { provide: BUSCADOR_IMAGEM, useValue: ((url, init) => fetch(url, init)) satisfies BuscadorImagem },
  ],
})
export class ImagensModule {}
