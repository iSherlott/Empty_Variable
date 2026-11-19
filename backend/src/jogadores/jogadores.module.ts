import { Module } from "@nestjs/common";
import { JogadoresController } from "./jogadores.controller.js";
import { VinculoController } from "./vinculo.controller.js";
import { VinculoService } from "./vinculo.service.js";

@Module({ controllers: [JogadoresController, VinculoController], providers: [VinculoService] })
export class JogadoresModule {}
