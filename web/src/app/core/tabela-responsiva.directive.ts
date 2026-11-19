import { type AfterViewInit, Directive, ElementRef, inject, type OnDestroy } from "@angular/core";

/**
 * Tabela sem barra de rolagem: em espaço largo as células quebram linha; em espaço estreito
 * (ver `.tabela-responsiva` em styles.scss) cada linha vira um cartão "rótulo: valor".
 * Os rótulos saem do cabeçalho: a diretiva copia o texto de cada `th` para o `data-label`
 * das células da mesma coluna, inclusive nas linhas que aparecem depois.
 */
@Directive({
  selector: "table[appResponsiva]",
  host: { class: "tabela-responsiva" },
})
export class TabelaResponsivaDirective implements AfterViewInit, OnDestroy {
  private readonly tabela = inject<ElementRef<HTMLTableElement>>(ElementRef).nativeElement;
  private observador: MutationObserver | null = null;

  ngAfterViewInit(): void {
    this.rotular();
    // Só a lista de nós: trocar atributos aqui não dispara o observador de novo.
    this.observador = new MutationObserver(() => this.rotular());
    this.observador.observe(this.tabela, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  private rotular(): void {
    const cabecalho = Array.from(this.tabela.querySelectorAll("thead tr:first-child > th")).map(
      (th) => th.textContent?.trim() ?? "",
    );
    for (const linha of Array.from(this.tabela.querySelectorAll("tbody > tr"))) {
      Array.from(linha.children).forEach((celula, i) => {
        const rotulo = cabecalho[i] ?? "";
        if (celula.getAttribute("data-label") !== rotulo) celula.setAttribute("data-label", rotulo);
      });
    }
  }
}
