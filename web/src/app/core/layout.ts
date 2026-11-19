// Peças do padrão de página (paineis §5): explicação recolhida e formulários num painel lateral.
import { Component, type ElementRef, effect, HostListener, input, output, viewChild } from "@angular/core";

/** As explicações longas ficam recolhidas: a página abre direto no que importa. */
@Component({
  selector: "app-como-funciona",
  template: `
    <details class="como-funciona">
      <summary>{{ titulo() }}</summary>
      <div class="conteudo"><ng-content /></div>
    </details>
  `,
  styles: `
    .como-funciona {
      border: 1px solid var(--borda);
      border-radius: 12px;
      background: var(--superficie);
    }
    summary {
      cursor: pointer;
      padding: 10px 14px;
      font-size: 14px;
      font-weight: 600;
      color: var(--texto-suave);
      list-style-position: inside;
    }
    summary:hover {
      color: var(--texto);
    }
    .conteudo {
      padding: 0 14px 12px;
      font-size: 14px;
      color: var(--texto-suave);
    }
    .conteudo ::ng-deep p {
      margin: 6px 0;
    }
  `,
})
export class ComoFuncionaComponent {
  readonly titulo = input("Como funciona");
}

/**
 * Formulário de criar/editar fora da página: abre à direita sobre um fundo escurecido.
 * Fecha no X, no fundo ou com Esc. No celular, ocupa a tela inteira.
 */
@Component({
  selector: "app-painel-lateral",
  template: `
    @if (aberto()) {
      <div class="fundo" (click)="fechar.emit()" aria-hidden="true"></div>
      <aside
        class="painel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titulo()"
        #painel
        tabindex="-1"
      >
        <header>
          <h2>{{ titulo() }}</h2>
          <button type="button" class="fechar" (click)="fechar.emit()" aria-label="Fechar">✕</button>
        </header>
        <div class="corpo-painel"><ng-content /></div>
      </aside>
    }
  `,
  styles: `
    .fundo {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: rgba(0, 0, 0, 0.55);
    }
    .painel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 41;
      display: flex;
      flex-direction: column;
      width: min(520px, 100vw);
      box-sizing: border-box;
      background: var(--superficie);
      border-left: 1px solid var(--borda-forte);
      box-shadow: -16px 0 40px rgba(0, 0, 0, 0.5);
      outline: none;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--borda);
    }
    h2 {
      margin: 0;
      font-size: 18px;
    }
    .fechar {
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--texto-suave);
      font-size: 16px;
      cursor: pointer;
    }
    .fechar:hover,
    .fechar:focus-visible {
      background: var(--elevado);
      color: var(--texto);
    }
    /* Só o conteúdo do painel rola, e só quando o formulário é maior que a tela. */
    .corpo-painel {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class PainelLateralComponent {
  readonly titulo = input.required<string>();
  readonly aberto = input(false);
  readonly fechar = output<void>();
  private readonly painel = viewChild<ElementRef<HTMLElement>>("painel");

  constructor() {
    // Ao abrir, o foco vai para o painel (teclado e leitores de tela).
    effect(() => {
      const el = this.painel()?.nativeElement;
      if (this.aberto() && el) setTimeout(() => el.focus());
    });
  }

  @HostListener("document:keydown.escape")
  aoEsc(): void {
    if (this.aberto()) this.fechar.emit();
  }
}
