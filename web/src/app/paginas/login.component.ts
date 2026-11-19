import { Component, computed, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";

const ERROS: Record<string, string> = {
  "nao-membro": "Acesso restrito aos membros do servidor do Discord do grupo.",
  inativo: "Seu acesso foi desativado por um administrador.",
  falha: "Não foi possível entrar com o Discord. Tente novamente.",
};

@Component({
  selector: "app-login",
  imports: [MatCardModule, MatButtonModule],
  template: `
    <div class="pagina">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Betel · Torre da Constelação</mat-card-title>
          <mat-card-subtitle>Pontuação de participação do grupo</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (mensagemErro(); as msg) {
            <p class="erro" role="alert">{{ msg }}</p>
          }
          <p>Entre com a sua conta do Discord. Só membros do servidor do grupo têm acesso.</p>
        </mat-card-content>
        <mat-card-actions>
          <!-- Navegação completa: o fluxo OAuth começa na API -->
          <a mat-flat-button href="/api/auth/discord">Entrar com Discord</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: `
    .erro {
      color: var(--mat-sys-error, #b3261e);
      font-weight: 500;
    }
  `,
})
export class LoginComponent {
  /** Preenchido pelo redirect do callback (?erro=...). */
  readonly erro = input<string | undefined>();
  readonly mensagemErro = computed(() => {
    const e = this.erro();
    return e === undefined ? null : (ERROS[e] ?? ERROS["falha"]);
  });
}
