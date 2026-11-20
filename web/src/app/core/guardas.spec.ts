import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  type RouterStateSnapshot,
  type UrlTree,
} from "@angular/router";
import { adminGuard, caminhoBase, gestorGuard, inicioGuard, vinculadoGuard } from "./guardas";
import type { UsuarioMe } from "./modelos";

const base: UsuarioMe = {
  id: "u1",
  discordUsername: "ana",
  globalName: null,
  avatarUrl: null,
  papel: "MEMBRO",
  jogador: null,
  vinculoPendente: false,
};

describe("Guardas de rota", () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function rodar(guarda: typeof inicioGuard, me: UsuarioMe | null): Promise<string | boolean> {
    const resultado = TestBed.runInInjectionContext(() =>
      guarda({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
    const req = http.expectOne("/api/auth/me");
    if (me === null) req.flush({ message: "Sessão inválida" }, { status: 401, statusText: "Unauthorized" });
    else req.flush(me);
    const r = await resultado;
    return typeof r === "boolean" ? r : r.toString();
  }

  it("início: sem sessão vai para /login", async () => {
    expect(await rodar(inicioGuard, null)).toBe("/login");
  });

  it("início: membro sem vínculo vai para a Loja", async () => {
    expect(await rodar(inicioGuard, base)).toBe("/loja");
  });

  it("início: membro vinculado vai para a Loja", async () => {
    expect(await rodar(inicioGuard, { ...base, jogador: { id: "j1", apelido: "Ana" } })).toBe("/loja");
  });

  it("início: admin abre o Estoque, mesmo com vínculo", async () => {
    expect(await rodar(inicioGuard, { ...base, papel: "ADMIN", jogador: { id: "j1", apelido: "Ana" } })).toBe(
      "/admin/estoque",
    );
  });

  it("início: gestor vai para a Loja", async () => {
    expect(await rodar(inicioGuard, { ...base, papel: "GESTOR" })).toBe("/loja");
  });

  it("gestão: o gestor passa", async () => {
    expect(await rodar(gestorGuard, { ...base, papel: "GESTOR" })).toBe(true);
  });

  it("gestão: o admin passa", async () => {
    expect(await rodar(gestorGuard, { ...base, papel: "ADMIN" })).toBe(true);
  });

  it("gestão: membro volta ao início", async () => {
    expect(await rodar(gestorGuard, base)).toBe("/");
  });

  it("administração: o gestor não passa", async () => {
    expect(await rodar(adminGuard, { ...base, papel: "GESTOR" })).toBe("/");
  });

  it("admin: membro é mandado para o início", async () => {
    expect(await rodar(adminGuard, base)).toBe("/");
  });

  it("admin: admin passa", async () => {
    expect(await rodar(adminGuard, { ...base, papel: "ADMIN" })).toBe(true);
  });

  it("área do membro: sem vínculo aprovado vai para /vinculo (D12)", async () => {
    expect(await rodar(vinculadoGuard, { ...base, vinculoPendente: true })).toBe("/vinculo");
  });
});

describe("Caminho base (sub-rota)", () => {
  it("na raiz é '/'; numa sub-rota é a pasta do <base href>", () => {
    expect(caminhoBase("https://betel.exemplo.com/")).toBe("/");
    expect(caminhoBase("http://localhost:9876/context.html")).toBe("/");
    expect(caminhoBase("https://eyes.exemplo.com/emptyvariable/")).toBe("/emptyvariable/");
  });
});
