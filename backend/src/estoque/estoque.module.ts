import { Module } from "@nestjs/common";
import { ConfigLojaController } from "../loja/config-loja.controller.js";
import { PrecosController } from "../loja/precos.controller.js";
import { EstoqueController } from "./estoque.controller.js";
import { EstoqueService } from "./estoque.service.js";

/**
 * Épico II, M7: estoque (T-27), preços por item e parâmetros da loja (T-28).
 * A compra (M8) e as ofertas (M9) usam o EstoqueService exportado.
 */
@Module({
  controllers: [EstoqueController, PrecosController, ConfigLojaController],
  providers: [EstoqueService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
