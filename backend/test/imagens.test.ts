// Épico IV, M14 (T-55, D41): imagens dos itens pela Divine Pride, sempre via cache.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Contexto, criarApp } from "./suporte/app-de-teste.js";

const ICONE = (id: number) => `https://static.divine-pride.net/images/items/item/${id}.png`;
const ILUSTRACAO = (id: number) => `https://static.divine-pride.net/images/items/collection/${id}.png`;
/** Um PNG mínimo (cabeçalho) basta: o cache guarda os bytes como vieram. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("Imagens dos itens (M14)", () => {
  let ctx: Contexto;
  let cookie: string;
  const get = (url: string, c = cookie) => ctx.http().get(url).set("Cookie", c);

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await ctx.fechar();
  });
  beforeEach(async () => {
    await ctx.limparBanco();
    ctx.imagens.chamadas.length = 0;
    ctx.imagens.respostas.clear();
    cookie = await ctx.login("9100", "ana");
  });

  it("CT-139: a 1ª chamada busca e grava no cache; a 2ª não sai do Betel", async () => {
    ctx.imagens.respostas.set(ICONE(1000397), { status: 200, tipo: "image/png", corpo: PNG });
    const r1 = await get("/api/imagens/item/1000397").expect(200);
    expect(r1.headers["content-type"]).toBe("image/png");
    expect(r1.headers["cache-control"]).toContain("max-age=604800");
    expect(new Uint8Array(r1.body as Buffer)).toEqual(PNG);

    const r2 = await get("/api/imagens/item/1000397").expect(200);
    expect(new Uint8Array(r2.body as Buffer)).toEqual(PNG);
    expect(ctx.imagens.chamadas).toEqual([ICONE(1000397)]);
  });

  it("a ilustração é outra imagem, com cache próprio", async () => {
    ctx.imagens.respostas.set(ILUSTRACAO(501), { status: 200, tipo: "image/png", corpo: PNG });
    await get("/api/imagens/item/501?tipo=ilustracao").expect(200);
    await get("/api/imagens/item/501?tipo=ilustracao").expect(200);
    expect(ctx.imagens.chamadas).toEqual([ILUSTRACAO(501)]);
  });

  it("CT-140: sem imagem na Divine Pride → 404, e o 'não existe' evita buscar de novo", async () => {
    await get("/api/imagens/item/777").expect(404);
    await get("/api/imagens/item/777").expect(404);
    expect(ctx.imagens.chamadas).toEqual([ICONE(777)]);
    const cache = await ctx.prisma.imagemCache.findMany();
    expect(cache).toEqual([
      expect.objectContaining({ idJogo: 777, tipo: "ICONE", existe: false, conteudo: null }),
    ]);
  });

  it("CT-140: Divine Pride fora do ar ou resposta estranha → 404 sem cache; tenta de novo depois", async () => {
    ctx.imagens.respostas.set(ICONE(501), "falha");
    await get("/api/imagens/item/501").expect(404);
    ctx.imagens.respostas.set(ICONE(501), { status: 200, tipo: "text/html", corpo: PNG });
    await get("/api/imagens/item/501").expect(404);
    ctx.imagens.respostas.set(ICONE(501), { status: 503 });
    await get("/api/imagens/item/501").expect(404);
    expect(await ctx.prisma.imagemCache.count()).toBe(0);

    ctx.imagens.respostas.set(ICONE(501), { status: 200, tipo: "image/png", corpo: PNG });
    await get("/api/imagens/item/501").expect(200);
    expect(ctx.imagens.chamadas).toHaveLength(4);
  });

  it("um 'não existe' antigo (mais de 7 dias) é conferido de novo", async () => {
    await ctx.prisma.imagemCache.create({
      data: { idJogo: 888, tipo: "ICONE", existe: false, buscadaEm: new Date(Date.now() - 8 * 86_400_000) },
    });
    ctx.imagens.respostas.set(ICONE(888), { status: 200, tipo: "image/png", corpo: PNG });
    await get("/api/imagens/item/888").expect(200);
    expect(ctx.imagens.chamadas).toEqual([ICONE(888)]);
  });

  it("dois pedidos do mesmo ID ao mesmo tempo geram uma busca só", async () => {
    ctx.imagens.respostas.set(ICONE(1000373), { status: 200, tipo: "image/png", corpo: PNG });
    const [a, b] = await Promise.all([get("/api/imagens/item/1000373"), get("/api/imagens/item/1000373")]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(ctx.imagens.chamadas).toEqual([ICONE(1000373)]);
  });

  it("CT-141: ID ou tipo inválido → 400, sem chamada externa", async () => {
    for (const url of [
      "/api/imagens/item/abc",
      "/api/imagens/item/0",
      "/api/imagens/item/-5",
      "/api/imagens/item/12.5",
      "/api/imagens/item/1234567890",
      "/api/imagens/item/501?tipo=monstro",
      "/api/imagens/item/501?tipo=constructor",
    ]) {
      expect([url, (await get(url)).status]).toEqual([url, 400]);
    }
    expect(ctx.imagens.chamadas).toEqual([]);
  });

  it("sem sessão → 401", async () => {
    await ctx.http().get("/api/imagens/item/501").expect(401);
    expect(ctx.imagens.chamadas).toEqual([]);
  });
});
