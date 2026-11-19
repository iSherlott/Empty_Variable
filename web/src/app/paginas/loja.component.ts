import { HttpClient } from "@angular/common/http";
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  type OnInit,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { Acao } from "../core/acao";
import {
  type ItemVitrine,
  maximoComprável,
  ROTULO_TIPO_ITEM,
  seloDoItem,
  textoLimite,
  type TipoItem,
  type Vitrine,
} from "../core/loja";
import { mensagemDeErro } from "../core/modelos";
import { SaldoService } from "../core/saldo.service";
import { IconeComponent } from "../core/icone.component";
import { ImagemItemComponent } from "../core/imagem-item.component";

type Categoria = "TODOS" | TipoItem;
type Filtro = "TODOS" | "DISPONIVEIS" | "CONSIGNADOS";

const TITULOS: Record<Categoria, string> = {
  TODOS: "Loja de pontos",
  MATERIAL: "Materiais",
  CARTA: "Cartas",
  VISUAL: "Visuais",
  OUTRO: "Outros",
};

const FILTROS: { id: Filtro; nome: string }[] = [
  { id: "TODOS", nome: "Todos" },
  { id: "DISPONIVEIS", nome: "Disponíveis" },
  { id: "CONSIGNADOS", nome: "Consignados" },
];

const ehCategoria = (v: string | null): v is TipoItem =>
  v === "MATERIAL" || v === "CARTA" || v === "VISUAL" || v === "OUTRO";

/**
 * US-10 / US-11 (T-33): vitrine da loja no layout do design: categorias no menu lateral do sistema,
 * filtros em chips, grade de cartões e detalhes do item ao passar o mouse (ou focar pelo teclado).
 */
@Component({
  selector: "app-loja",
  imports: [
    ImagemItemComponent,
    IconeComponent,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="loja">
      <header class="cabecalho-pagina vitrine-cabecalho">
        <div>
          <h1>{{ titulo() }}</h1>
          <p>Use seus pontos para resgatar itens. A entrega é feita no jogo.</p>
        </div>
        <form class="busca-loja" role="search" (ngSubmit)="buscar()">
          <app-icone nome="busca" [tamanho]="18" />
          <input
            type="search"
            name="termo"
            aria-label="Buscar na loja"
            placeholder="Buscar item"
            [(ngModel)]="termo"
          />
          <button type="submit">Buscar</button>
        </form>
      </header>

      <div class="chips" role="group" aria-label="Filtrar itens">
        @for (f of filtros; track f.id) {
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="f.id === filtro()"
            (click)="filtro.set(f.id)"
          >
            {{ f.nome }}
          </button>
        }
        @if (busca(); as b) {
          <button
            type="button"
            class="chip"
            aria-pressed="true"
            (click)="limparBusca()"
            title="Limpar a busca"
          >
            “{{ b }}” ✕
          </button>
        }
      </div>

      @if (erro(); as e) {
        <p class="erro" role="alert">{{ e }}</p>
      }

      <dialog #dialogo aria-labelledby="titulo-compra" (cancel)="cancelar($event)">
        @if (selecionado(); as s) {
          <section class="painel-compra" data-testid="painel-compra">
            <div class="item-detalhe">
              <app-imagem-item
                [idJogo]="s.idJogo"
                [nome]="s.nome"
                [tipo]="s.tipo"
                [tamanho]="72"
                [ilustracao]="true"
              />
              <div>
                <h2 id="titulo-compra">{{ s.nome }}</h2>
                <p>{{ tipo(s) }} · {{ s.preco }} pts por unidade</p>
                <p>{{ s.disponivel }} em estoque · {{ limite(s) }}</p>
              </div>
            </div>
            @if (maximo(s) > 0) {
              <div class="linha-acoes">
                <mat-form-field subscriptSizing="dynamic">
                  <mat-label>Quantidade</mat-label>
                  <input
                    matInput
                    type="number"
                    min="1"
                    [max]="maximo(s)"
                    step="1"
                    [ngModel]="quantidade()"
                    (ngModelChange)="quantidade.set($event)"
                    name="quantidade"
                  />
                  <mat-hint>Até {{ maximo(s) }}</mat-hint>
                </mat-form-field>
                <div class="resumo-compra">
                  <span
                    >{{ quantidade() }} × {{ s.preco }} pts = <strong>{{ total() }} pts</strong></span
                  >
                  <span [class.erro]="saldoApos() < 0">Saldo depois da compra: {{ saldoApos() }} pts</span>
                </div>
              </div>
              <div class="linha-acoes">
                <button
                  mat-flat-button
                  type="button"
                  (click)="comprar(s)"
                  [disabled]="!podeComprar() || comprando()"
                >
                  Confirmar compra
                </button>
                <button mat-button type="button" [disabled]="comprando()" (click)="cancelar()">
                  Cancelar
                </button>
              </div>
            } @else {
              <p>
                {{
                  s.limiteRestante === 0
                    ? "Você atingiu o limite deste item no período."
                    : "Item sem unidades disponíveis."
                }}
              </p>
              <button mat-button type="button" (click)="cancelar()">Fechar</button>
            }
          </section>
        }
      </dialog>

      <div class="grade-cartoes" data-testid="vitrine">
        @for (i of visiveis(); track i.itemId) {
          <div class="tile">
            <button
              type="button"
              class="cartao-b"
              [class.cartao-apagado]="maximo(i) === 0"
              (click)="escolher(i)"
              [attr.aria-describedby]="'dica-' + i.itemId"
              [attr.aria-label]="maximo(i) > 0 ? 'Comprar ' + i.nome : 'Ver detalhes de ' + i.nome"
            >
              <span class="cartao-arte">
                <app-imagem-item
                  [idJogo]="i.idJogo"
                  [nome]="i.nome"
                  [tipo]="i.tipo"
                  [tamanho]="92"
                  [ilustracao]="true"
                />
                @if (selo(i); as sl) {
                  <span [class]="'cartao-selo ' + classeSelo(sl.tipo)">{{ sl.texto }}</span>
                }
              </span>
              <span class="cartao-nome">{{ i.nome }}</span>
              <span class="cartao-rodape">
                <span class="cartao-valor">{{ i.preco }} pts</span>
                <span class="cartao-meta">{{
                  maximo(i) === 0 ? "indisponível" : i.disponivel + " un."
                }}</span>
              </span>
            </button>

            <div class="dica" role="tooltip" [id]="'dica-' + i.itemId">
              <strong>{{ i.nome }}</strong>
              <span class="dica-tipo">{{ tipo(i) }}</span>
              <dl>
                <dt>Preço</dt>
                <dd>{{ i.preco }} pts por unidade</dd>
                <dt>Disponível</dt>
                <dd>{{ i.disponivel === 0 ? "Nenhuma unidade agora" : i.disponivel + " unidade(s)" }}</dd>
                <dt>Origem</dt>
                <dd>{{ i.temConsignado ? "Estoque do grupo e consignados" : "Estoque do grupo" }}</dd>
                <dt>Limite</dt>
                <dd>{{ limite(i) }}</dd>
              </dl>
              <span class="dica-nota">
                @if (i.temConsignado) {
                  Parte das unidades é de outros jogadores: eles recebem os pontos na entrega.
                } @else {
                  Os pontos gastos em itens do grupo saem de circulação.
                }
              </span>
            </div>
          </div>
        } @empty {
          @if (!vitrine() && !erro()) {
            <p class="estado-loja" role="status">Carregando itens…</p>
          } @else if (!erro()) {
            <p class="estado-loja">Nenhum item encontrado com estes filtros.</p>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .loja {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .vitrine-cabecalho {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: end;
      padding: clamp(16px, 4cqi, 28px);
      border: 1px solid #31554e;
      border-radius: 16px;
      background: linear-gradient(115deg, #142a29, var(--superficie) 74%);
    }
    .vitrine-cabecalho h1 {
      margin: 0;
    }
    .vitrine-cabecalho p {
      margin: 6px 0 0;
      color: var(--texto-suave);
    }
    .busca-loja {
      display: flex;
      flex: 0 1 290px;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 4px 4px 4px 10px;
      border: 1px solid var(--borda-forte);
      border-radius: 10px;
      background: var(--fundo);
      color: var(--acento);
    }
    .busca-loja:focus-within {
      border-color: var(--acento);
    }
    .busca-loja input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      color: var(--texto);
      background: transparent;
      font: inherit;
    }
    .busca-loja button {
      padding: 8px 12px;
      border: 0;
      border-radius: 6px;
      background: var(--acento-fundo);
      color: var(--acento-forte);
      font: inherit;
      cursor: pointer;
    }
    .grade-cartoes {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 145px), 1fr));
      gap: 12px;
    }
    .cartao-b {
      gap: 0;
      padding: 0;
      min-width: 0;
      border-color: #31554e;
      border-radius: 12px;
      background: #131c20;
    }
    .cartao-b:is(:hover, :focus-visible) {
      border-color: var(--acento);
      box-shadow: 0 0 18px #6fbfae29;
    }
    .cartao-arte {
      width: 100%;
      height: auto;
      aspect-ratio: 4 / 3;
      min-height: 98px;
      border-radius: 11px 11px 0 0;
      border-bottom: 1px solid #31554e;
      background: radial-gradient(ellipse at 50% 54%, #254747, #111e23 78%);
    }
    .cartao-arte app-imagem-item {
      filter: drop-shadow(0 7px 10px #0009);
    }
    .cartao-selo {
      top: 5px;
      left: 5px;
    }
    .cartao-nome {
      min-height: 0;
      padding: 9px 10px 4px;
      overflow-wrap: anywhere;
    }
    .cartao-rodape {
      width: 100%;
      margin-top: auto;
      padding: 4px 10px 10px;
      flex-wrap: wrap;
    }
    .estado-loja {
      grid-column: 1 / -1;
      padding: 18px;
      border: 1px dashed var(--borda-forte);
      border-radius: 12px;
      color: var(--texto-suave);
    }
    dialog {
      box-sizing: border-box;
      width: min(460px, calc(100% - 24px));
      max-height: calc(100dvh - 24px);
      padding: 0;
      border: 0;
      border-radius: 14px;
      background: var(--cartao);
      color: var(--texto);
    }
    dialog::backdrop {
      background: #05080bc9;
    }
    .item-detalhe {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .item-detalhe p {
      margin: 4px 0 0;
      color: var(--texto-suave);
    }
    .painel-compra {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--acento);
      border-radius: 14px;
      background: var(--cartao);
    }
    .painel-compra h2 {
      margin: 0;
      font-size: 18px;
    }
    .resumo-compra {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tile {
      position: relative;
      display: flex;
    }
    .dica {
      position: absolute;
      left: 0;
      right: 0;
      bottom: calc(100% + 10px);
      z-index: 10;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--elevado);
      border: 1px solid var(--acento);
      color: var(--texto);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
      transform: translateY(6px);
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transition:
        opacity 0.15s,
        transform 0.15s;
    }
    .tile:hover .dica,
    .tile:has(:focus-visible) .dica {
      visibility: visible;
      opacity: 1;
      transform: translateY(0);
    }
    .dica-tipo {
      font-size: 12px;
      color: var(--texto-suave);
    }
    .dica dl {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0 10px;
      margin: 0;
      font-size: 13px;
    }
    .dica dt {
      color: var(--texto-suave);
    }
    .dica dd {
      margin: 0 0 6px;
    }
    .dica-nota {
      font-size: 12px;
      color: var(--texto-suave);
    }
    .erro {
      color: var(--mat-sys-error, #b3261e);
    }
  `,
})
export class LojaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly acao = inject(Acao);
  private readonly saldo = inject(SaldoService);
  private readonly router = inject(Router);

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>("dialogo");
  termo = "";

  readonly filtros = FILTROS;
  readonly vitrine = signal<Vitrine | null>(null);
  readonly categoria = signal<Categoria>("TODOS");
  readonly filtro = signal<Filtro>("TODOS");
  readonly busca = signal<string | null>(null);
  readonly selecionado = signal<ItemVitrine | null>(null);
  readonly quantidade = signal(1);
  readonly comprando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly visiveis = computed(() => {
    const c = this.categoria();
    const f = this.filtro();
    const b = this.busca()?.toLowerCase() ?? null;
    return (this.vitrine()?.itens ?? []).filter(
      (i) =>
        (c === "TODOS" || (i.tipo ?? "OUTRO") === c) &&
        (f !== "DISPONIVEIS" || maximoComprável(i) > 0) &&
        (f !== "CONSIGNADOS" || i.temConsignado) &&
        (b === null || i.nome.toLowerCase().includes(b)),
    );
  });
  readonly titulo = computed(() => TITULOS[this.categoria()]);
  readonly total = computed(() => (this.selecionado()?.preco ?? 0) * (Number(this.quantidade()) || 0));
  readonly saldoApos = computed(() => (this.vitrine()?.saldo ?? 0) - this.total());
  readonly podeComprar = computed(() => {
    const s = this.selecionado();
    const q = Number(this.quantidade());
    return s !== null && Number.isInteger(q) && q >= 1 && q <= maximoComprável(s) && this.saldoApos() >= 0;
  });

  constructor() {
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;
      if (!dialogo) return;
      if (this.selecionado()) {
        if (!dialogo.open) dialogo.showModal();
      } else if (dialogo.open) {
        dialogo.close();
      }
    });
    // Mantém a categoria e a busca na URL para navegação e compartilhamento.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((q) => {
        const c = q.get("categoria");
        this.categoria.set(ehCategoria(c) ? c : "TODOS");
        const b = q.get("busca")?.trim() ?? "";
        this.termo = b;
        this.busca.set(b === "" ? null : b);
      });
  }

  async ngOnInit(): Promise<void> {
    await this.recarregar();
  }

  async recarregar(): Promise<void> {
    try {
      const v = await firstValueFrom(this.http.get<Vitrine>("/api/loja"));
      this.vitrine.set(v);
      this.saldo.definir(v.saldo);
      this.erro.set(null);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    }
  }

  buscar(): void {
    void this.router.navigate([], {
      queryParams: { busca: this.termo.trim() || null },
      queryParamsHandling: "merge",
    });
  }

  limparBusca(): void {
    void this.router.navigate([], { queryParams: { busca: null }, queryParamsHandling: "merge" });
  }

  maximo(i: ItemVitrine): number {
    return maximoComprável(i);
  }
  selo(i: ItemVitrine) {
    return seloDoItem(i);
  }
  classeSelo(tipo: string): string {
    if (tipo === "consignado") return "selo-acento";
    return tipo === "ultimas" ? "" : "selo-alerta";
  }
  limite(i: ItemVitrine): string {
    return textoLimite(i);
  }
  tipo(i: ItemVitrine): string {
    return ROTULO_TIPO_ITEM[i.tipo ?? "OUTRO"];
  }

  escolher(i: ItemVitrine): void {
    this.selecionado.set(i);
    this.quantidade.set(1);
  }

  cancelar(event?: Event): void {
    event?.preventDefault();
    if (!this.comprando()) this.selecionado.set(null);
  }

  async comprar(i: ItemVitrine): Promise<void> {
    if (!this.podeComprar()) return;
    this.comprando.set(true);
    try {
      await firstValueFrom(
        this.http.post("/api/loja/compras", { itemId: i.itemId, quantidade: Number(this.quantidade()) }),
      );
      this.acao.avisar("Compra registrada. O guardião do grupo vai entregar o item no jogo.");
      this.selecionado.set(null);
    } catch (e) {
      this.acao.avisar(mensagemDeErro(e));
    } finally {
      this.comprando.set(false);
      await this.recarregar();
    }
  }
}
