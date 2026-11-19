import { HttpClient } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

/** Saldo do membro mostrado na barra superior. As telas que mudam o saldo avisam aqui. */
@Injectable({ providedIn: "root" })
export class SaldoService {
  private readonly http = inject(HttpClient);
  readonly saldo = signal<number | null>(null);

  definir(valor: number): void {
    this.saldo.set(valor);
  }

  limpar(): void {
    this.saldo.set(null);
  }

  async atualizar(): Promise<void> {
    try {
      const r = await firstValueFrom(this.http.get<{ saldo: number }>("/api/saldo/me"));
      this.saldo.set(r.saldo);
    } catch {
      this.saldo.set(null);
    }
  }
}
