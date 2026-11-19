import { Controller, Get } from "@nestjs/common";
import { CONFIG_V1 } from "@betel/scoring";
import { Publico } from "../auth/decoradores.js";

@Publico()
@Controller("saude")
export class SaudeController {
  /** Verificação de vida usada pelo Docker/Caddy. Também confirma que o motor de cálculo foi carregado. */
  @Get()
  verificar(): { status: "ok"; motorPontuacao: { base: number } } {
    return { status: "ok", motorPontuacao: { base: CONFIG_V1.base } };
  }
}
