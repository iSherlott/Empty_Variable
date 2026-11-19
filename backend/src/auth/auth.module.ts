import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { DiscordClienteHttp } from "@emptyvariable/discord";
import { CONFIGURACAO, type Configuracao } from "../configuracao.js";
import { DISCORD_CLIENTE } from "./discord.cliente.js";
import { GuardaAutenticacao, GuardaOrigem, GuardaPapeis } from "./guardas.js";
import { SessaoService } from "./sessao.service.js";
import { UsuariosController } from "./usuarios.controller.js";

@Global()
@Module({
  controllers: [AuthController, UsuariosController],
  providers: [
    AuthService,
    SessaoService,
    {
      provide: DISCORD_CLIENTE,
      inject: [CONFIGURACAO],
      useFactory: (config: Configuracao) => new DiscordClienteHttp(config.discord),
    },
    // A ordem importa: origem → sessão → papel.
    { provide: APP_GUARD, useClass: GuardaOrigem },
    { provide: APP_GUARD, useClass: GuardaAutenticacao },
    { provide: APP_GUARD, useClass: GuardaPapeis },
  ],
  exports: [SessaoService],
})
export class AuthModule {}
