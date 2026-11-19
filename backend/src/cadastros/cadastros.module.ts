import { Module } from "@nestjs/common";
import { ClassesController } from "./classes.controller.js";
import { ConfigPontuacaoController } from "./config-pontuacao.controller.js";
import { ConfigPontuacaoService } from "./config-pontuacao.service.js";
import { ItensController } from "./itens.controller.js";
import { SeedService } from "./seed.service.js";
import { InstanciasModule } from "../instancias/instancias.controller.js";

/** M3: classes e funções (T-10), parâmetros versionados (T-11) e catálogo de itens (T-12). */
@Module({
  imports: [InstanciasModule],
  controllers: [ClassesController, ConfigPontuacaoController, ItensController],
  providers: [ConfigPontuacaoService, SeedService],
  exports: [ConfigPontuacaoService, SeedService],
})
export class CadastrosModule {}
