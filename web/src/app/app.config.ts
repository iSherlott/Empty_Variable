import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { type ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import localePt from "@angular/common/locales/pt";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { routes } from "./app.routes";
import { caminhoBaseInterceptor, sessaoExpiradaInterceptor } from "./core/guardas";

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([sessaoExpiradaInterceptor, caminhoBaseInterceptor])),
    provideAnimationsAsync(),
    { provide: LOCALE_ID, useValue: "pt-BR" },
  ],
};
