import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { RunsController } from "./runs.controller.js";
import { RunsService } from "./runs.service.js";
import { InstanciasModule } from "../instancias/instancias.controller.js";

@Module({
  imports: [LedgerModule, InstanciasModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
