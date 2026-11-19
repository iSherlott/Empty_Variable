import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { NebulaAdminController, NebulaController } from "./nebula.controller.js";
import { NebulaService } from "./nebula.service.js";
import { ReceitasController } from "./receitas.controller.js";
import { ReceitasService } from "./receitas.service.js";

/** Épico III: receitas e disponibilidade (M10) e solicitação de Nebula (M11). */
@Module({
  imports: [LedgerModule],
  controllers: [ReceitasController, NebulaController, NebulaAdminController],
  providers: [ReceitasService, NebulaService],
  exports: [ReceitasService],
})
export class NebulaModule {}
