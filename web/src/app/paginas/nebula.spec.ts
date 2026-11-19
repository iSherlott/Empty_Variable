import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { bloqueioSolicitar, precoDe, type ReceitaAberta } from "../core/nebula";
import { SaldoService } from "../core/saldo.service";
import { NebulaComponent } from "./nebula.component";
import { NebulaSolicitacoesComponent } from "./nebula-solicitacoes.component";

const esperar = () => new Promise((r) => setTimeout(r));

const pod = (p: Partial<ReceitaAberta> = {}): ReceitaAberta => ({
  id: "r1",
  nome: "Armadura Nebulosa POD",
  itemProduzido: { id: "i9", nome: "Armadura Nebulosa POD" },
  solicitavel: true,
  ativa: true,
  fonte: null,
  limitePorMembro: null,
  limitePeriodoDias: null,
  limiteRestante: null,
  componentes: [
    { id: "c1", item: { id: "f", nome: "Fragmento de Meteorito" }, quantidade: 50, pecaBase: false },
    { id: "c2", item: { id: "a", nome: "Armadura Astral" }, quantidade: 1, pecaBase: true },
  ],
  receitaPeca: null,
  precoVigente: { versao: 1, precoComPeca: 800, precoTrazendoPeca: 500 },
  solicitacoesPendentes: 0,
  disponibilidade: {
    trazendoPeca: 1,
    comPecaDoEstoque: 0,
    faltasTrazendo: [{ itemId: "f", item: "Fragmento de Meteorito", tenho: 60, preciso: 50, falta: 0 }],
    faltasComPeca: [
      { itemId: "f", item: "Fragmento de Meteorito", tenho: 60, preciso: 100, falta: 40 },
      { itemId: "n", item: "Alma de Naght Sieger", tenho: 0, preciso: 5, falta: 5 },
    ],
  },
  ...p,
});

describe("regras da Nebula (D31, D32, briefing §7)", () => {
  it("preço conforme a peça e bloqueios do botão Solicitar", () => {
    const r = pod();
    expect(precoDe(r, true)).toBe(500);
    expect(precoDe(r, false)).toBe(800);
    expect(bloqueioSolicitar(r, true, 500)).toBeNull();
    expect(bloqueioSolicitar(r, true, 499)).toBe("Saldo insuficiente.");
    expect(bloqueioSolicitar(r, false, 5000)).toBe("Falta material no estoque do grupo.");
    expect(
      bloqueioSolicitar(pod({ limitePorMembro: 1, limitePeriodoDias: 30, limiteRestante: 0 }), true, 5000),
    ).toBe("Você atingiu o limite desta Nebula no período.");
  });
});

describe("NebulaComponent", () => {
  it("abre na modalidade possível, mostra as faltas e solicita trazendo a peça", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(NebulaComponent);
    f.detectChanges();
    http.expectOne("/api/nebula").flush({ saldo: 600, receitas: [pod()] });
    await esperar();
    f.detectChanges();
    expect(TestBed.inject(SaldoService).saldo()).toBe(600);
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll(".tile").length).toBe(1);
    expect(el.querySelector(".cartao-selo")?.textContent).toContain("Pode solicitar");

    const c = f.componentInstance;
    c.escolher(c.receitas()[0]!);
    f.detectChanges();
    // Sem peça no estoque, já começa "trazendo a peça"
    expect(c.trazPeca()).toBe(true);
    expect(c.saldoApos(c.receitas()[0]!)).toBe(100);
    c.trazPeca.set(false);
    f.detectChanges();
    expect(el.querySelector('[data-testid="materiais"]')?.textContent).toContain("0/5");
    expect(c.bloqueio(c.receitas()[0]!)).toBe("Falta material no estoque do grupo.");
    c.trazPeca.set(true);

    const envio = c.solicitar(c.receitas()[0]!);
    const req = http.expectOne("/api/nebula/solicitacoes");
    expect(req.request.body).toEqual({ receitaId: "r1", trazPeca: true });
    req.flush({ solicitacaoId: "s1", preco: 500, pecaDoEstoque: null, saldo: 100 });
    await esperar();
    http.expectOne("/api/nebula").flush({
      saldo: 100,
      receitas: [pod({ disponibilidade: { ...pod().disponibilidade, trazendoPeca: 0 } })],
    });
    await envio;
    expect(c.selecionada()).toBeNull();
    expect(TestBed.inject(SaldoService).saldo()).toBe(100);
  });
});

describe("NebulaSolicitacoesComponent", () => {
  it("admin: carrega a fila pendente e troca o filtro", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(NebulaSolicitacoesComponent);
    f.componentRef.setInput("admin", true);
    f.detectChanges();
    http.expectOne("/api/nebula/fila?status=PENDENTE").flush([]);
    await esperar();
    const filtro = f.componentInstance.filtrar("ENTREGUE");
    http.expectOne("/api/nebula/fila?status=ENTREGUE").flush([]);
    await filtro;
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain("Nenhuma solicitação nesta situação");
  });
});
