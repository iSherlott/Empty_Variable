import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { computed, inject, Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { UsuarioMe } from "./modelos";

/** Estado da sessão. A sessão em si vive num cookie httpOnly; aqui só guardamos quem está logado. */
@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _usuario = signal<UsuarioMe | null>(null);
  private carregamento: Promise<UsuarioMe | null> | null = null;

  readonly usuario = this._usuario.asReadonly();
  readonly logado = computed(() => this._usuario() !== null);
  readonly ehAdmin = computed(() => this._usuario()?.papel === "ADMIN");
  /** D37: o admin também acessa tudo o que é do gestor. */
  readonly ehGestor = computed(() => {
    const p = this._usuario()?.papel;
    return p === "GESTOR" || p === "ADMIN";
  });

  /** Consulta /api/auth/me uma vez (ou de novo com `forcar`). 401 significa "sem sessão". */
  carregar(forcar = false): Promise<UsuarioMe | null> {
    if (this.carregamento === null || forcar) {
      this.carregamento = firstValueFrom(this.http.get<UsuarioMe>("/api/auth/me")).then(
        (u) => {
          this._usuario.set(u);
          return u;
        },
        (erro: unknown) => {
          if (erro instanceof HttpErrorResponse && erro.status === 401) {
            this._usuario.set(null);
            return null;
          }
          this.carregamento = null;
          throw erro;
        },
      );
    }
    return this.carregamento;
  }

  /** Chamado pelo interceptor quando a API responde 401 no meio do uso. */
  limpar(): void {
    this._usuario.set(null);
    this.carregamento = Promise.resolve(null);
  }

  async sair(): Promise<void> {
    await firstValueFrom(this.http.post<void>("/api/auth/logout", {})).catch(() => undefined);
    this.limpar();
  }
}
