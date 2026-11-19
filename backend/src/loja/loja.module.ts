import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { ComprasAdminController, LojaController } from "./loja.controller.js";
import { LojaService } from "./loja.service.js";
import { OfertasAdminController, OfertasMembroController } from "./ofertas.controller.js";
import { OfertasService } from "./ofertas.service.js";

/** Épico II: vitrine, compra, entrega e cancelamento (M8) e ofertas em consignação (M9). */
@Module({
  imports: [LedgerModule],
  controllers: [LojaController, ComprasAdminController, OfertasMembroController, OfertasAdminController],
  providers: [LojaService, OfertasService],
  exports: [LojaService],
})
export class LojaModule {}
