import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { diagnosticarConfiguracao } from "./auth/diagnostico-sso.js";
import { configurarApp } from "./configurar-app.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);
  app.enableShutdownHooks();
  const porta = Number(process.env["PORT"] ?? 3000);
  await app.listen(porta);
  // SSO: avisa no log o que falta, em vez de só responder 503 no login.
  const problemas = diagnosticarConfiguracao(process.env).filter((i) => i.nivel !== "ok");
  for (const p of problemas) new Logger("SSO").warn(p.texto);
}

void bootstrap();
