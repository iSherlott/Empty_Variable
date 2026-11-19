import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import type { SituacaoVinculo, Solicitacao } from "../core/modelos";
import { LoginComponent } from "./login.component";
import { MeComponent } from "./me.component";
import { VinculoComponent } from "./vinculo.component";

const texto = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? "";
const esperar = () => new Promise((r) => setTimeout(r));

function configurar(): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
  });
  return TestBed.inject(HttpTestingController);
}

const solicitacao: Solicitacao = {
  id: "s1",
  status: "PENDENTE",
  motivo: null,
  apelidoProposto: "Novata",
  personagensNovos: ["Nova-RG"],
  criadaEm: "2026-11-14T20:00:00.000Z",
  analisadaEm: null,
  usuario: { id: "u1", discordUsername: "ana", globalName: null },
  jogador: null,
  analisadaPor: null,
};

describe("LoginComponent", () => {
  it("mostra a mensagem de acesso restrito para quem não é do servidor (CT-79)", () => {
    configurar();
    const f = TestBed.createComponent(LoginComponent);
    f.componentRef.setInput("erro", "nao-membro");
    f.detectChanges();
    expect(texto(f)).toContain("Acesso restrito aos membros do servidor");
    const link = (f.nativeElement as HTMLElement).querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/api/auth/discord");
  });
});

describe("MeComponent", () => {
  it("mostra saldo (T-22), personagens e os pontos base por rank do motor compartilhado", async () => {
    const http = configurar();
    const f = TestBed.createComponent(MeComponent);
    f.detectChanges();
    const situacao: SituacaoVinculo = {
      jogador: { id: "j1", apelido: "Ana", personagens: [{ id: "p1", nome: "Ana-MTK", ativo: true }] },
      solicitacao: null,
    };
    http.expectOne("/api/vinculo").flush(situacao);
    http
      .expectOne("/api/extrato/me")
      .flush({ jogador: { id: "j1", apelido: "Ana" }, saldo: 240, lancamentos: [] });
    await esperar();
    f.detectChanges();
    expect(texto(f)).toContain("Ana-MTK");
    expect((f.nativeElement as HTMLElement).querySelector('[data-testid="saldo"]')?.textContent).toBe("240");
    const pontos = Array.from(
      (f.nativeElement as HTMLElement).querySelectorAll(".tabela-ranks tbody td:last-child"),
    ).map((td) => td.textContent?.trim());
    expect(pontos).toEqual(["300", "250", "200", "150", "100"]);
  });
});

describe("VinculoComponent", () => {
  async function abrir(situacao: SituacaoVinculo) {
    const http = configurar();
    const f = TestBed.createComponent(VinculoComponent);
    f.detectChanges();
    http.expectOne("/api/vinculo").flush(situacao);
    http.expectOne("/api/vinculo/classes").flush([]);
    await esperar();
    f.detectChanges();
    return { f, http };
  }

  it("com solicitação pendente mostra o status e não o formulário", async () => {
    const { f } = await abrir({ jogador: null, solicitacao });
    expect(texto(f)).toContain("Solicitação em análise");
    expect((f.nativeElement as HTMLElement).querySelector("form")).toBeNull();
  });

  it("depois de rejeitada mostra o motivo e libera nova solicitação", async () => {
    const { f } = await abrir({
      jogador: null,
      solicitacao: { ...solicitacao, status: "REJEITADA", motivo: "Personagem errado" },
    });
    expect(texto(f)).toContain("Personagem errado");
    expect(texto(f)).toContain("Adicionar personagem");
  });

  it("envia jogador novo com os personagens informados", async () => {
    const { f, http } = await abrir({ jogador: null, solicitacao: null });
    const c = f.componentInstance;
    const ficha = { nome: "Nova-RG", classeId: "rg", nivelBase: 250, build: "", equipamentos: {} };
    const envio = c.salvarFicha(ficha);
    const req = http.expectOne("/api/vinculo/solicitacoes");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ fichas: [ficha] });
    req.flush(solicitacao);
    await esperar();
    http.expectOne("/api/vinculo").flush({ jogador: null, solicitacao });
    http.expectOne("/api/vinculo/classes").flush([]);
    await envio;
    f.detectChanges();
    expect(texto(f)).toContain("Solicitação em análise");
  });

  it("mostra o erro da API (ex.: jogador já vinculado)", async () => {
    const { f, http } = await abrir({ jogador: null, solicitacao: null });
    const c = f.componentInstance;
    const envio = c.salvarFicha({
      nome: "Nova-RG",
      classeId: "rg",
      nivelBase: 250,
      build: "",
      equipamentos: {},
    });
    http
      .expectOne("/api/vinculo/solicitacoes")
      .flush(
        { message: "Este jogador já está vinculado a outro usuário." },
        { status: 409, statusText: "Conflict" },
      );
    await envio;
    f.detectChanges();
    expect(c.erroFicha()).toContain("Este jogador já está vinculado a outro usuário.");
  });
});
