import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { type Oferta, podeRetirar } from "../core/loja";
import { LojaOfertasComponent } from "./loja-ofertas.component";

const esperar = () => new Promise((r) => setTimeout(r));

const oferta = (p: Partial<Oferta>): Oferta => ({
  id: "o1",
  quantidade: 2,
  status: "PENDENTE",
  motivo: null,
  criadaEm: "2026-11-14T20:00:00.000Z",
  analisadaEm: null,
  item: { id: "i1", nome: "Carta Naght Sieger", tipo: "CARTA" },
  jogador: { id: "j1", apelido: "Ana" },
  analisadaPor: null,
  lote: null,
  ...p,
});

describe("Ofertas (M9)", () => {
  it("só pendente ou à venda pode ser retirada (D25)", () => {
    expect(podeRetirar(oferta({ status: "PENDENTE" }))).toBe(true);
    expect(podeRetirar(oferta({ status: "APROVADA" }))).toBe(true);
    for (const status of ["ESGOTADA", "REJEITADA", "RETIRADA", "RETIRADA_SOLICITADA"] as const) {
      expect(podeRetirar(oferta({ status }))).toBe(false);
    }
  });

  it("lista as ofertas com o motivo da rejeição e envia uma nova oferta", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(LojaOfertasComponent);
    f.detectChanges();
    http.expectOne("/api/loja/ofertas").flush([oferta({ status: "REJEITADA", motivo: "Item não recebido" })]);
    http
      .expectOne("/api/loja/ofertas/itens")
      .flush([{ id: "i1", nome: "Carta Naght Sieger", tipo: "CARTA", precoVigente: 300 }]);
    await esperar();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="minhas-ofertas"]')?.textContent).toContain("Item não recebido");
    expect(el.querySelector('[data-testid="minhas-ofertas"] button')).toBeNull(); // rejeitada não retira

    const c = f.componentInstance;
    c.nova = { itemId: "i1", quantidade: 2 };
    const envio = c.ofertar();
    const req = http.expectOne((r) => r.method === "POST" && r.url === "/api/loja/ofertas");
    expect(req.request.body).toEqual({ itemId: "i1", quantidade: 2 });
    req.flush(oferta({}));
    await esperar();
    http.expectOne("/api/loja/ofertas").flush([oferta({})]);
    http.expectOne("/api/loja/ofertas/itens").flush([]);
    await envio;
    expect(c.nova).toEqual({ itemId: "", quantidade: 1 });
  });
});
