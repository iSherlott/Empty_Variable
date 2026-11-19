import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import {
  type Compra,
  type ItemVitrine,
  maximoComprável,
  origemCompra,
  seloDoItem,
  textoLimite,
} from "../core/loja";
import { SaldoService } from "../core/saldo.service";
import { LojaComponent } from "./loja.component";

const esperar = () => new Promise((r) => setTimeout(r));

const item = (p: Partial<ItemVitrine> = {}): ItemVitrine => ({
  itemId: "i1",
  nome: "Alma de Naght Sieger",
  tipo: "MATERIAL",
  preco: 100,
  disponivel: 4,
  temConsignado: false,
  limitePorMembro: null,
  limitePeriodoDias: null,
  limiteRestante: null,
  ...p,
});

describe("Loja: regras de exibição", () => {
  it("o máximo comprável respeita o limite restante (D24)", () => {
    expect(maximoComprável(item())).toBe(4);
    expect(maximoComprável(item({ limitePorMembro: 2, limitePeriodoDias: 7, limiteRestante: 1 }))).toBe(1);
  });

  it("selos e textos do cartão", () => {
    expect(seloDoItem(item({ disponivel: 0 }))?.texto).toBe("Indisponível");
    expect(seloDoItem(item({ limiteRestante: 0, limitePorMembro: 1, limitePeriodoDias: 7 }))?.texto).toBe(
      "Limite atingido",
    );
    expect(seloDoItem(item({ temConsignado: true }))?.texto).toBe("Consignado");
    expect(seloDoItem(item({ disponivel: 2 }))?.texto).toBe("Últimas unidades");
    expect(seloDoItem(item({ disponivel: 10 }))).toBeNull();
    expect(textoLimite(item({ limitePorMembro: 2, limitePeriodoDias: 7, limiteRestante: 1 }))).toBe(
      "2 a cada 7 dia(s) · restam 1",
    );
  });

  it("origem da compra para a fila do admin", () => {
    const c = {
      lotes: [
        { quantidade: 1, valorVendedor: 0, lote: { ordem: 1, origem: "MANUAL", dono: null } },
        { quantidade: 2, valorVendedor: 200, lote: { ordem: 2, origem: "OFERTA", dono: { apelido: "Ana" } } },
      ],
    } as unknown as Compra;
    expect(origemCompra(c)).toBe("Grupo + Ana");
  });
});

describe("LojaComponent", () => {
  it("mostra a vitrine, filtra por categoria e compra com o saldo previsto", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(LojaComponent);
    f.detectChanges();
    http.expectOne("/api/loja").flush({
      saldo: 350,
      itens: [
        item(),
        item({
          itemId: "i2",
          nome: "Carta Naght Sieger",
          tipo: "CARTA",
          preco: 300,
          disponivel: 1,
          temConsignado: true,
        }),
      ],
    });
    await esperar();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    // O saldo vai para a barra superior do sistema
    expect(TestBed.inject(SaldoService).saldo()).toBe(350);
    expect(el.querySelectorAll(".tile").length).toBe(2);
    // Detalhes do item (o cartão que aparece ao passar o mouse) estão ligados ao botão
    expect(el.querySelector("#dica-i2")?.textContent).toContain("consignados");

    const c = f.componentInstance;
    c.categoria.set("CARTA");
    f.detectChanges();
    expect(el.querySelectorAll(".tile").length).toBe(1);

    c.categoria.set("TODOS");
    c.escolher(c.vitrine()!.itens[0]!);
    c.quantidade.set(3);
    f.detectChanges();
    expect(c.total()).toBe(300);
    expect(c.saldoApos()).toBe(50);
    expect(c.podeComprar()).toBe(true);
    c.quantidade.set(4); // 400 > saldo
    expect(c.podeComprar()).toBe(false);
    c.quantidade.set(3);

    const compra = c.comprar(c.selecionado()!);
    const req = http.expectOne("/api/loja/compras");
    expect(req.request.body).toEqual({ itemId: "i1", quantidade: 3 });
    req.flush({ compraId: "c1", total: 300, saldo: 50 });
    await esperar();
    http.expectOne("/api/loja").flush({ saldo: 50, itens: [item({ disponivel: 1 })] });
    await compra;
    expect(c.selecionado()).toBeNull();
    expect(c.vitrine()?.saldo).toBe(50);
  });
});
