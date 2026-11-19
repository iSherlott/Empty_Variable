// Épico II, M9: ofertas de jogadores em consignação (T-34, T-35).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SeedService } from "../src/cadastros/seed.service.js";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

interface Oferta {
  id: string;
  status: string;
  quantidade: number;
  motivo: string | null;
  lote: { id: string; ativo: boolean } | null;
}

describe("Ofertas em consignação (M9)", () => {
  let ctx: Contexto;
  let admin: string;
  let adminId: string;
  let vendedor: string;
  let comprador: string;
  let jogadorVendedor: string;
  let jogadorComprador: string;
  let alma: string;
  let po: string;

  const enviar = (url: string, corpo: object, cookie: string) =>
    ctx.http().post(url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);
  const get = (url: string, cookie: string) => ctx.http().get(url).set("Cookie", cookie);

  async function membro(discordId: string, apelido: string): Promise<[string, string]> {
    const cookie = await ctx.login(discordId, apelido.toLowerCase());
    const u = await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId } });
    const j = await ctx.prisma.jogador.create({ data: { apelido, usuarioId: u.id } });
    return [cookie, j.id];
  }
  async function ofertar(quantidade: number, itemId = alma) {
    return (await enviar("/api/loja/ofertas", { itemId, quantidade }, vendedor).expect(201)).body as Oferta;
  }
  async function saldoDe(jogadorId: string): Promise<number> {
    return (await get(`/api/extrato/${jogadorId}`, admin).expect(200)).body.saldo as number;
  }
  async function disponivelNaLoja(cookie: string): Promise<number> {
    const v = (await get("/api/loja", cookie).expect(200)).body as {
      itens: { itemId: string; disponivel: number }[];
    };
    return v.itens.find((i) => i.itemId === alma)?.disponivel ?? 0;
  }
  const oferta = async (id: string) => ctx.prisma.ofertaVenda.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await ctx.fechar();
  });
  beforeEach(async () => {
    await ctx.limparBanco();
    await ctx.app.get(SeedService).aplicar();
    admin = await ctx.login(ADMIN_DISCORD_ID, "admin");
    adminId = (await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId: ADMIN_DISCORD_ID } })).id;
    [vendedor, jogadorVendedor] = await membro("7001", "Vendedor");
    [comprador, jogadorComprador] = await membro("7002", "Comprador");
    alma = (await ctx.prisma.itemCatalogo.findUniqueOrThrow({ where: { nome: "Alma de Betelgeuse" } })).id;
    po = (await ctx.prisma.itemCatalogo.findUniqueOrThrow({ where: { nome: "Pó de Meteorito" } })).id;
    await ctx
      .http()
      .patch(`/api/itens/${alma}`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ negociavel: true, vinculadoConta: false })
      .expect(200);
    await enviar("/api/loja/precos", { itemId: alma, precoPontos: 100 }, admin).expect(201);
    await ctx.prisma.lancamentoPontos.create({
      data: {
        jogadorId: jogadorComprador,
        valor: 1000,
        tipo: "AJUSTE_ADMIN",
        criadoPorId: adminId,
        observacao: "teste",
      },
    });
  });

  it("fluxo completo: oferta → aprovação → compra → entrega → vendedor recebe (D22, D28)", async () => {
    const o = await ofertar(3);
    expect(o).toMatchObject({ status: "PENDENTE", lote: null });
    expect(await disponivelNaLoja(comprador)).toBe(0); // ainda não está com o guardião

    const fila = (await get("/api/ofertas?status=PENDENTE", admin).expect(200)).body as Oferta[];
    expect(fila.map((x) => x.id)).toEqual([o.id]);
    const ap = (await enviar(`/api/ofertas/${o.id}/aprovar`, {}, admin).expect(200)).body as Oferta;
    expect(ap).toMatchObject({ status: "APROVADA", lote: expect.objectContaining({ ativo: true }) });
    expect(await disponivelNaLoja(comprador)).toBe(3);
    expect(await disponivelNaLoja(vendedor)).toBe(0); // o vendedor não compra o próprio lote (CT-90)

    const c = (await enviar("/api/loja/compras", { itemId: alma, quantidade: 2 }, comprador).expect(201))
      .body;
    expect(await saldoDe(jogadorVendedor)).toBe(0);
    await enviar(`/api/compras/${c.compraId}/entregar`, {}, admin).expect(200);
    expect(await saldoDe(jogadorVendedor)).toBe(200);
    expect(await saldoDe(jogadorComprador)).toBe(800);

    const minhas = (await get("/api/loja/ofertas", vendedor).expect(200)).body as Oferta[];
    expect(minhas).toEqual([expect.objectContaining({ id: o.id, status: "APROVADA" })]);
  });

  it("C12/C13: oferta não tem preço (vale o do item) e só de item elegível (D20)", async () => {
    await enviar("/api/loja/ofertas", { itemId: po, quantidade: 1 }, vendedor).expect(422);
    const o = await ofertar(1);
    expect(o).not.toHaveProperty("preco");
    const itens = (await get("/api/loja/ofertas/itens", vendedor).expect(200)).body as {
      nome: string;
      precoVigente: number | null;
    }[];
    expect(itens).toEqual([expect.objectContaining({ nome: "Alma de Betelgeuse", precoVigente: 100 })]);
    await enviar("/api/loja/ofertas", { itemId: alma, quantidade: 0 }, vendedor).expect(400);
  });

  it("rejeição exige motivo; oferta analisada não é aprovada de novo", async () => {
    const o = await ofertar(1);
    await enviar(`/api/ofertas/${o.id}/rejeitar`, {}, admin).expect(400);
    const r = (
      await enviar(`/api/ofertas/${o.id}/rejeitar`, { motivo: "Item não recebido" }, admin).expect(200)
    ).body;
    expect(r).toMatchObject({ status: "REJEITADA", motivo: "Item não recebido" });
    await enviar(`/api/ofertas/${o.id}/aprovar`, {}, admin).expect(409);
    expect(await ctx.prisma.loteEstoque.count()).toBe(0);
  });

  it("aprovação recusada se o item deixou de ser elegível depois da oferta", async () => {
    const o = await ofertar(1);
    await ctx
      .http()
      .patch(`/api/itens/${alma}`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ vinculadoConta: true })
      .expect(200);
    await enviar(`/api/ofertas/${o.id}/aprovar`, {}, admin).expect(422);
  });

  it("D25: oferta pendente retirada sai na hora; aprovada para de vender e o admin conclui", async () => {
    const pendente = await ofertar(1);
    const r1 = (await enviar(`/api/loja/ofertas/${pendente.id}/retirar`, {}, vendedor).expect(200)).body;
    expect(r1.status).toBe("RETIRADA");

    const o = await ofertar(4);
    await enviar(`/api/ofertas/${o.id}/aprovar`, {}, admin).expect(200);
    const r2 = (await enviar(`/api/loja/ofertas/${o.id}/retirar`, {}, vendedor).expect(200)).body as Oferta;
    expect(r2).toMatchObject({
      status: "RETIRADA_SOLICITADA",
      lote: expect.objectContaining({ ativo: false }),
    });
    expect(await disponivelNaLoja(comprador)).toBe(0);
    await enviar("/api/loja/compras", { itemId: alma, quantidade: 1 }, comprador).expect(409);

    const fim = (await enviar(`/api/ofertas/${o.id}/concluir-retirada`, {}, admin).expect(200)).body;
    expect(fim).toMatchObject({ status: "RETIRADA", devolvido: 4 });
    const mov = await ctx.prisma.movimentoEstoque.findMany({ where: { tipo: "RETIRADA" } });
    expect(mov.map((m) => m.quantidade)).toEqual([-4]);
  });

  it("CT-102: retirada pedida com compra pendente — a compra segue; concluir só depois de entregar ou cancelar", async () => {
    const o = await ofertar(3);
    await enviar(`/api/ofertas/${o.id}/aprovar`, {}, admin).expect(200);
    const c = (await enviar("/api/loja/compras", { itemId: alma, quantidade: 1 }, comprador).expect(201))
      .body;
    await enviar(`/api/loja/ofertas/${o.id}/retirar`, {}, vendedor).expect(200);

    const bloqueio = await enviar(`/api/ofertas/${o.id}/concluir-retirada`, {}, admin).expect(409);
    expect(bloqueio.body.message).toContain("compra(s) pendente(s)");

    await enviar(`/api/compras/${c.compraId}/entregar`, {}, admin).expect(200);
    expect(await saldoDe(jogadorVendedor)).toBe(100);
    const fim = (await enviar(`/api/ofertas/${o.id}/concluir-retirada`, {}, admin).expect(200)).body;
    expect(fim).toMatchObject({ status: "RETIRADA", devolvido: 2 }); // baixa só o restante
  });

  it("CT-103: oferta esgotada não pode ser retirada; cancelar a compra reabre a oferta", async () => {
    const o = await ofertar(1);
    await enviar(`/api/ofertas/${o.id}/aprovar`, {}, admin).expect(200);
    const c = (await enviar("/api/loja/compras", { itemId: alma, quantidade: 1 }, comprador).expect(201))
      .body;
    expect((await oferta(o.id)).status).toBe("ESGOTADA");
    const r = await enviar(`/api/loja/ofertas/${o.id}/retirar`, {}, vendedor).expect(409);
    expect(r.body.message).toContain("já foram vendidas");
    await enviar(`/api/loja/compras/${c.compraId}/cancelar`, {}, comprador).expect(200);
    expect((await oferta(o.id)).status).toBe("APROVADA");
    await enviar(`/api/loja/ofertas/${o.id}/retirar`, {}, vendedor).expect(200);
  });

  it("acesso: só o dono retira; membro não aprova; sem vínculo não oferta", async () => {
    const o = await ofertar(1);
    await enviar(`/api/loja/ofertas/${o.id}/retirar`, {}, comprador).expect(403);
    await enviar(`/api/ofertas/${o.id}/aprovar`, {}, vendedor).expect(403);
    await get("/api/ofertas", comprador).expect(403);
    const semVinculo = await ctx.login("7099", "novo");
    await enviar("/api/loja/ofertas", { itemId: alma, quantidade: 1 }, semVinculo).expect(403);
    expect((await get("/api/loja/ofertas", comprador).expect(200)).body).toEqual([]);
  });

  it("filtro inválido na fila do admin dá 400", async () => {
    await get("/api/ofertas?status=QUALQUER", admin).expect(400);
  });
});
