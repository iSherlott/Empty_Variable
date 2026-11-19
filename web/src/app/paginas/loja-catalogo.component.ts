import { HttpClient } from "@angular/common/http";
import { Component, computed, effect, ElementRef, inject, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import { ImagemItemComponent } from "../core/imagem-item.component";
import { AuthService } from "../core/auth.service";
import { SaldoService } from "../core/saldo.service";
import {
  maximoComprável,
  ROTULO_TIPO_ITEM,
  type ItemVitrine,
  type TipoItem,
  type Vitrine,
} from "../core/loja";
import { mensagemDeErro } from "../core/modelos";

interface ItemCatalogoLoja {
  itemId: string;
  nome: string;
  idJogo: number | null;
  tipo: TipoItem | null;
  quantidade: number;
  preco: number | null;
}

@Component({
  selector: "app-loja-catalogo",
  imports: [ImagemItemComponent, FormsModule],
  template: `
    <section class="pagina">
      <header class="vitrine-cabecalho">
        <h1>Loja de Pontos</h1>
        <label>
          Buscar item
          <input type="search" [value]="busca()" #campoBusca (input)="busca.set(campoBusca.value)" />
        </label>
      </header>

      @if (erro(); as mensagem) {
        <p role="alert">{{ mensagem }}</p>
        <button type="button" class="botao-acao" (click)="carregar()">Tentar novamente</button>
      } @else if (itens() === null) {
        <p role="status">Carregando itens…</p>
      } @else {
        <div class="grade-cartoes" data-testid="catalogo-loja">
          @for (item of visiveis(); track item.itemId) {
            <article class="cartao-b">
              <span class="cartao-arte">
                <app-imagem-item
                  [idJogo]="item.idJogo"
                  [nome]="item.nome"
                  [tipo]="item.tipo"
                  [tamanho]="88"
                  [ilustracao]="true"
                />
              </span>
              <div class="dados">
                <small>{{ rotulos[item.tipo ?? "OUTRO"] }}</small>
                <h2>
                  <button class="abrir-item" type="button" (click)="abrir(item)">{{ item.nome }}</button>
                </h2>
                <div class="cartao-rodape">
                  <span class="cartao-valor">{{
                    item.preco === null ? "Preço a definir" : item.preco + " pts"
                  }}</span>
                  <span class="cartao-meta">{{ item.quantidade }} em estoque</span>
                </div>
              </div>
            </article>
          } @empty {
            <p>{{ busca().trim() ? "Nenhum item encontrado." : "Nenhum item em estoque." }}</p>
          }
        </div>
      }
      <dialog #compraDialog aria-labelledby="titulo-compra" (cancel)="fechar($event)">
        @if (selecionado(); as item) {
          <div class="caixa-compra">
            <h2 id="titulo-compra">Solicitar compra</h2>
            <div class="item-compra">
              <app-imagem-item
                [idJogo]="item.idJogo"
                [nome]="item.nome"
                [tipo]="item.tipo"
                [tamanho]="64"
                [ilustracao]="true"
              />
              <div>
                <strong>{{ item.nome }}</strong>
                <p>{{ item.quantidade }} em estoque</p>
              </div>
            </div>
            @if (sucesso()) {
              <p role="status">Solicitação registrada. O item aguarda entrega no jogo.</p>
            } @else {
              @if (item.preco === null) {
                <p>O administrador ainda precisa definir o preço de venda.</p>
              } @else {
                <p>
                  <strong>{{ cotacao()?.preco ?? item.preco }} pts por unidade</strong>
                </p>
                @if (!auth.usuario()?.jogador) {
                  <p>É necessário ter um personagem vinculado à conta para solicitar a compra.</p>
                } @else if (consultando()) {
                  <p role="status">Conferindo disponibilidade…</p>
                } @else if (cotacao()) {
                  <p>Disponível para você: {{ maximo() }} un. · Carteira: {{ saldo.saldo() ?? "—" }} pts</p>
                  <label
                    >Quantidade
                    <input
                      type="number"
                      min="1"
                      [max]="maximo()"
                      step="1"
                      [ngModel]="quantidade()"
                      (ngModelChange)="quantidade.set($event)"
                      [disabled]="enviando()"
                    />
                  </label>
                  <p>Total: {{ total() }} pts</p>
                  @if (saldo.saldo() !== null && total() > (saldo.saldo() ?? 0)) {
                    <p role="status">Saldo insuficiente.</p>
                  }
                  <button class="botao-acao" type="button" [disabled]="!podeComprar()" (click)="comprar()">
                    Confirmar solicitação
                  </button>
                }
              }
              @if (erroCompra(); as mensagem) {
                <p role="alert">{{ mensagem }}</p>
              }
            }
            <button type="button" class="fechar-compra" [disabled]="enviando()" (click)="fechar()">
              Fechar
            </button>
          </div>
        }
      </dialog>
    </section>
  `,
  styles: `
    .vitrine-cabecalho {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      gap: 20px;
      padding: clamp(24px, 6vw, 52px) 16px 16px 16px;
      margin-bottom: 18px;
      border: 1px solid #31554e;
      border-radius: 16px;
      background:
        radial-gradient(ellipse at 50% 0%, #28524a 0%, transparent 70%),
        repeating-linear-gradient(125deg, transparent 0 24px, #6fbfae0c 25px 26px), #111b21;
    }
    .vitrine-cabecalho h1 {
      text-align: center;
      margin: 0;
      font-size: clamp(1.75rem, 4vw, 3rem);
      letter-spacing: -0.035em;
      line-height: 1.1;
      color: #eafff8;
    }
    .vitrine-cabecalho label {
      width: min(100%, 230px);
      justify-self: end;
    }
    label {
      display: grid;
      gap: 5px;
      color: var(--texto-suave);
      max-width: 100%;
    }
    input {
      box-sizing: border-box;
      max-width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--borda-forte);
      border-radius: 8px;
      background: var(--fundo);
      color: var(--texto);
      font: inherit;
    }
    .grade-cartoes {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
      gap: 12px;
    }
    .cartao-b {
      min-width: 0;
      padding: 0;
      gap: 0;
      border-color: #31554e;
    }
    .cartao-arte {
      height: auto;
      aspect-ratio: 4 / 3;
      min-height: 96px;
      border-radius: 13px 13px 0 0;
      background: radial-gradient(ellipse at 50% 54%, #254747, #111e23 78%);
    }
    .dados {
      display: grid;
      gap: 5px;
      padding: 10px;
    }
    .dados small {
      color: var(--texto-suave);
    }
    .dados h2 {
      margin: 0;
      font-size: 15px;
      overflow-wrap: anywhere;
    }
    .abrir-item {
      border: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .abrir-item::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    .cartao-b:is(:hover, :focus-within) {
      border-color: var(--acento);
    }
    dialog {
      box-sizing: border-box;
      width: min(440px, calc(100% - 24px));
      max-height: calc(100dvh - 24px);
      color: var(--texto);
      background: var(--cartao);
      border: 1px solid var(--borda-forte);
      border-radius: 14px;
      padding: 20px;
    }
    dialog::backdrop {
      background: #05080bc9;
    }
    .caixa-compra {
      display: grid;
      gap: 12px;
    }
    .caixa-compra :is(h2, p) {
      margin: 0;
    }
    .item-compra {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .item-compra p {
      color: var(--texto-suave);
    }
    .fechar-compra {
      justify-self: end;
      color: var(--texto);
      background: transparent;
      border: 1px solid var(--borda-forte);
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .cartao-rodape {
      flex-wrap: wrap;
    }
  `,
})
export class LojaCatalogoComponent {
  private readonly http = inject(HttpClient);
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>("compraDialog");
  readonly auth = inject(AuthService);
  readonly saldo = inject(SaldoService);
  readonly selecionado = signal<ItemCatalogoLoja | null>(null);
  readonly cotacao = signal<ItemVitrine | null>(null);
  readonly quantidade = signal(1);
  readonly consultando = signal(false);
  readonly enviando = signal(false);
  readonly sucesso = signal(false);
  readonly erroCompra = signal<string | null>(null);
  readonly maximo = computed(() => {
    const item = this.cotacao();
    return item ? Math.min(maximoComprável(item), 10_000) : 0;
  });
  readonly total = computed(() => (this.cotacao()?.preco ?? 0) * this.quantidade());
  readonly podeComprar = computed(() => {
    const q = this.quantidade();
    return (
      !this.enviando() &&
      Number.isInteger(q) &&
      q >= 1 &&
      q <= this.maximo() &&
      this.total() <= (this.saldo.saldo() ?? 0)
    );
  });
  readonly rotulos = ROTULO_TIPO_ITEM;
  readonly busca = signal("");
  readonly erro = signal<string | null>(null);
  readonly itens = signal<ItemCatalogoLoja[] | null>(null);
  readonly visiveis = computed(() => {
    const busca = this.busca().trim().toLocaleLowerCase("pt-BR");
    return (this.itens() ?? []).filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(busca));
  });

  constructor() {
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;
      if (!dialogo) return;
      if (this.selecionado() && !dialogo.open) dialogo.showModal();
      if (!this.selecionado() && dialogo.open) dialogo.close();
    });
    void this.carregar();
  }

  async abrir(item: ItemCatalogoLoja): Promise<void> {
    this.selecionado.set(item);
    this.cotacao.set(null);
    this.quantidade.set(1);
    this.erroCompra.set(null);
    this.sucesso.set(false);
    this.consultando.set(false);
    if (item.preco === null || !this.auth.usuario()?.jogador) return;
    this.consultando.set(true);
    try {
      const vitrine = await firstValueFrom(this.http.get<Vitrine>("/api/loja"));
      if (this.selecionado() !== item) return;
      this.saldo.definir(vitrine.saldo);
      const cotacao = vitrine.itens.find((atual) => atual.itemId === item.itemId);
      this.cotacao.set(cotacao ?? null);
      if (!cotacao) this.erroCompra.set("O item não está à venda no momento.");
    } catch (erro) {
      if (this.selecionado() === item) this.erroCompra.set(mensagemDeErro(erro));
    } finally {
      if (this.selecionado() === item) this.consultando.set(false);
    }
  }

  fechar(evento?: Event): void {
    evento?.preventDefault();
    if (!this.enviando()) this.selecionado.set(null);
  }

  async comprar(): Promise<void> {
    const cotacao = this.cotacao();
    if (!cotacao || !this.podeComprar()) return;
    this.enviando.set(true);
    this.erroCompra.set(null);
    try {
      await firstValueFrom(
        this.http.post("/api/loja/compras", {
          itemId: cotacao.itemId,
          quantidade: this.quantidade(),
          precoEsperado: cotacao.preco,
        }),
      );
      this.sucesso.set(true);
      await Promise.all([this.saldo.atualizar(), this.carregar()]);
    } catch (erro) {
      this.erroCompra.set(mensagemDeErro(erro));
      void this.saldo.atualizar();
    } finally {
      this.enviando.set(false);
    }
  }

  async carregar(): Promise<void> {
    this.erro.set(null);
    try {
      this.itens.set(await firstValueFrom(this.http.get<ItemCatalogoLoja[]>("/api/loja/catalogo")));
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro));
    }
  }
}
