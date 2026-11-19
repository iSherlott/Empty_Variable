import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";

/** Configuração comum à aplicação real e aos testes de integração. */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  // A API roda atrás do nginx/Caddy; confia no primeiro proxy para IP e protocolo.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
}
