import { Module } from "@nestjs/common";
import { ExtratoController } from "./extrato.controller.js";
import { TransferenciasController } from "./transferencias.controller.js";
import { LedgerService } from "./ledger.service.js";

@Module({
  controllers: [ExtratoController, TransferenciasController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
