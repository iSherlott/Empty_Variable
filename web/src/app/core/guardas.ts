import { DOCUMENT } from "@angular/common";
import { HttpErrorResponse, type HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthService } from "./auth.service";

/** Exige sessão; sem ela, vai para /login. */
export const autenticadoGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  return usuario !== null || router.parseUrl("/login");
};

/** Exige papel ADMIN. A API também recusa (403); isto só evita mostrar a tela. */
export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  if (usuario === null) return router.parseUrl("/login");
  return usuario.papel === "ADMIN" || router.parseUrl("/");
};

/** Exige GESTOR ou ADMIN (D37): runs, pontos, jogadores e receitas. */
export const gestorGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  if (usuario === null) return router.parseUrl("/login");
  return usuario.papel === "GESTOR" || usuario.papel === "ADMIN" || router.parseUrl("/");
};

/** Área do membro só faz sentido com vínculo aprovado (D12). */
export const vinculadoGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  if (usuario === null) return router.parseUrl("/login");
  return usuario.jogador !== null || router.parseUrl("/vinculo");
};

/** /login para quem já está logado volta para o início. */
export const anonimoGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  return usuario === null || router.parseUrl("/");
};

/** Rota "/": decide o destino conforme o papel e o vínculo. */
export const inicioGuard: CanActivateFn = async () => {
  // inject() só funciona antes do primeiro await.
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  if (usuario === null) return router.parseUrl("/login");
  return usuario.papel === "ADMIN" ? router.parseUrl("/admin/estoque") : router.parseUrl("/loja");
};

/** Pasta do `<base href>` (ex.: "/emptyvariable/"), ou "/" quando o sistema está na raiz do domínio. */
export function caminhoBase(baseURI: string): string {
  return new URL(baseURI).pathname.replace(/[^/]*$/, "");
}

/**
 * Sub-rota: os endereços absolutos do próprio sistema ("/api/...", "/equipamentos-latam.json")
 * passam a valer a partir do `<base href>`. Na raiz, nada muda.
 */
export const caminhoBaseInterceptor: HttpInterceptorFn = (req, next) => {
  const base = caminhoBase(inject(DOCUMENT).baseURI);
  if (base === "/" || !req.url.startsWith("/") || req.url.startsWith("//")) return next(req);
  return next(req.clone({ url: `${base}${req.url.slice(1)}` }));
};

/** Sessão expirada durante o uso: limpa o estado e volta para o login. */
export const sessaoExpiradaInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401 && !req.url.endsWith("/api/auth/me")) {
        auth.limpar();
        void router.navigateByUrl("/login");
      }
      return throwError(() => erro);
    }),
  );
};
