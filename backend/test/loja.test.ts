// Épico II, M8: vitrine, compra, entrega, cancelamento e extrato (T-30 a T-32).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SeedService } from "../src/cadastros/seed.service.js";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

interface Compra {
  id: string;
  status: string;
  quantidade: number;
  total: number;
  lotes: {
    quantidade: number;
    valorVendedor: number;
    lote: { origem: string; dono: { apelido: string } | null };
  }[];
}

describe("Loja: compra, entrega e cancelamento (M8)", () => {
  let ctx: Contexto;
  let admin: string;
  let adminId: string;
  let ana: string;
  let bia: string;
  let jogadorAna: string;
  let jogadorBia: string;
  let vendedor: string;
  let jogadorVendedor: string;
  let alma: string;

  const enviar = (url: string, corpo: object, cookie: string) =>
    ctx.http().post(url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);
  const get = (url: string, cookie: string) => ctx.http().get(url).set("Cookie", cookie);

  async function membro(discordId: string, apelido: string): Promise<[string, string]> {
    const cookie = await ctx.login(discordId, apelido.toLowerCase());
    const u = await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId } });
    const j = await ctx.prisma.jogador.create({ data: { apelido, usuarioId: u.id } });
    return [cookie, j.id];
  }
  async function creditar(jogadorId: string, valor: number) {
    await ctx.prisma.lancamentoPontos.create({
      data: { jogadorId, valor, tipo: "AJUSTE_ADMIN", criadoPorId: adminId, observacao: "teste" },
    });
  }
  async function saldo(cookie: string): Promise<number> {
    return (await get("/api/extrato/me", cookie).expect(200)).body.saldo as number;
  }
  async function saldoDe(jogadorId: string): Promise<number> {
    return (await get(`/api/extrato/${jogadorId}`, admin).expect(200)).body.saldo as number;
  }
  async function preco(valor: number | null) {
    await enviar("/api/loja/precos", { itemId: alma, precoPontos: valor }, admin).expect(201);
  }
  async function entrada(quantidade: number) {
    await enviar("/api/estoque/entradas", { itemId: alma, quantidade }, admin).expect(201);
  }
  /** Lote consignado de um jogador (o fluxo de ofertas é do M9; aqui só o modelo). */
  async function consignado(donoId: string, quantidade: number) {
    const oferta = await ctx.prisma.ofertaVenda.create({
      data: { jogadorId: donoId, itemId: alma, quantidade, status: "APROVADA" },
    });
    const lote = await ctx.prisma.loteEstoque.create({
      data: {
        itemId: alma,
        donoJogadorId: donoId,
        origem: "OFERTA",
        ofertaId: oferta.id,
        criadoPorId: adminId,
      },
    });
    await ctx.prisma.movimentoEstoque.create({
      data: { loteId: lote.id, quantidade, tipo: "ENTRADA", criadoPorId: adminId },
    });
    return oferta.id;
  }
  async function disponivelGrupo(): Promise<number> {
    const r = (await get("/api/estoque", admin).expect(200)).body as { itemId: string; grupo: number }[];
    return r.find((x) => x.itemId === alma)?.grupo ?? 0;
  }
  function comprar(cookie: string, quantidade: number) {
    return enviar("/api/loja/compras", { itemId: alma, quantidade }, cookie);
  }

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
    [ana, jogadorAna] = await membro("6001", "Ana");
    [bia, jogadorBia] = await membro("6002", "Bia");
    [vendedor, jogadorVendedor] = await membro("6003", "Vendedor");
    alma = (await ctx.prisma.itemCatalogo.findUniqueOrThrow({ where: { nome: "Alma de Betelgeuse" } })).id;
    await ctx
      .http()
      .patch(`/api/itens/${alma}`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ negociavel: true, vinculadoConta: false })
      .expect(200);
  });

  describe("compra (D19, D24)", () => {
    it("CT-81: saldo 300, compra de 2 × 100 → saldo 100, débito COMPRA, estoque baixado, compra pendente", async () => {
      await preco(100);
      await entrada(5);
      await creditar(jogadorAna, 300);
      const r = await comprar(ana, 2).expect(201);
      expect(r.body).toMatchObject({ total: 200, saldo: 100 });
      expect(await saldo(ana)).toBe(100);
      expect((await get("/api/saldo/me", ana).expect(200)).body).toEqual({ saldo: 100 });
      expect(await disponivelGrupo()).toBe(3);
      const minhas = (await get("/api/loja/compras", ana).expect(200)).body as Compra[];
      expect(minhas).toEqual([
        expect.objectContaining({ status: "PENDENTE_ENTREGA", quantidade: 2, total: 200 }),
      ]);
      const ext = (await get("/api/extrato/me", ana).expect(200)).body as {
        lancamentos: {
          tipo: string;
          valor: number;
          compra: { item: { nome: string }; quantidade: number } | null;
        }[];
      };
      expect(ext.lancamentos.find((l) => l.tipo === "COMPRA")).toMatchObject({
        valor: -200,
        compra: { item: { nome: "Alma de Betelgeuse" }, quantidade: 2 },
      });
    });

    it("CT-82: saldo insuficiente é recusado (422) e nada é gravado", async () => {
      await preco(100);
      await entrada(5);
      await creditar(jogadorAna, 100);
      const r = await comprar(ana, 2).expect(422);
      expect(r.body.message).toContain("Saldo insuficiente");
      expect(await ctx.prisma.compra.count()).toBe(0);
      expect(await disponivelGrupo()).toBe(5);
    });

    it("CT-83: duas compras simultâneas do mesmo membro não passam do saldo", async () => {
      await preco(200);
      await entrada(5);
      await creditar(jogadorAna, 300);
      const rs = await Promise.all([comprar(ana, 1), comprar(ana, 1)]);
      expect(rs.map((r) => r.status).sort()).toEqual([201, 422]);
      expect(await saldo(ana)).toBe(100);
    });

    it("CT-84: duas pessoas disputando a última unidade: só uma leva", async () => {
      await preco(50);
      await entrada(1);
      await creditar(jogadorAna, 100);
      await creditar(jogadorBia, 100);
      const rs = await Promise.all([comprar(ana, 1), comprar(bia, 1)]);
      expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await disponivelGrupo()).toBe(0);
    });

    it("CT-99: item sem preço não está na vitrine e não pode ser comprado", async () => {
      await entrada(5);
      await creditar(jogadorAna, 300);
      expect((await get("/api/loja", ana).expect(200)).body.itens).toEqual([]);
      await comprar(ana, 1).expect(422);
      await preco(100);
      await preco(null);
      await comprar(ana, 1).expect(422);
    });

    it("item que deixa de ser elegível (D20) sai da loja", async () => {
      await preco(100);
      await entrada(5);
      await creditar(jogadorAna, 300);
      await ctx
        .http()
        .patch(`/api/itens/${alma}`)
        .set("Cookie", admin)
        .set("Origin", ORIGEM)
        .send({ vinculadoConta: true })
        .expect(200);
      expect((await get("/api/loja", ana).expect(200)).body.itens).toEqual([]);
      await comprar(ana, 1).expect(422);
    });
  });

  describe("reserva, ordem de chegada e limite (D24, D26, D27)", () => {
    it("CT-98: grupo 12 com reserva 10 e consignado 3 → no máximo 5; compra de 6 é recusada", async () => {
      await preco(10);
      await entrada(12);
      await ctx
        .http()
        .patch(`/api/itens/${alma}`)
        .set("Cookie", admin)
        .set("Origin", ORIGEM)
        .send({ reservaMinima: 10 })
        .expect(200);
      await consignado(jogadorVendedor, 3);
      await creditar(jogadorAna, 1000);
      const v = (await get("/api/loja", ana).expect(200)).body.itens[0];
      expect(v).toMatchObject({ disponivel: 5, temConsignado: true, preco: 10 });
      await comprar(ana, 6).expect(409);
      await comprar(ana, 5).expect(201);
      expect(await disponivelGrupo()).toBe(10); // a reserva ficou intacta
    });

    it("CT-96/CT-97: sai do lote mais antigo; uma compra pode consumir dois lotes", async () => {
      await preco(100);
      await entrada(1); // grupo, mais antigo
      await consignado(jogadorVendedor, 5); // mais novo
      await creditar(jogadorAna, 1000);
      const r = await comprar(ana, 3).expect(201);
      const c = (await get("/api/loja/compras", ana).expect(200)).body[0] as Compra;
      expect(c.id).toBe(r.body.compraId);
      expect(c.lotes.map((l) => [l.lote.origem, l.quantidade, l.valorVendedor])).toEqual([
        ["MANUAL", 1, 0],
        ["OFERTA", 2, 200],
      ]);
    });

    it("CT-90: o comprador nunca compra do próprio lote; se só houver os dele, a compra é recusada", async () => {
      await preco(100);
      await consignado(jogadorVendedor, 2);
      await creditar(jogadorVendedor, 500);
      expect((await get("/api/loja", vendedor).expect(200)).body.itens[0]).toMatchObject({ disponivel: 0 });
      await comprar(vendedor, 1).expect(409);
    });

    it("CT-101: limite de 2 a cada 7 dias; cancelar devolve a cota", async () => {
      await preco(10);
      await entrada(10);
      await ctx
        .http()
        .patch(`/api/itens/${alma}`)
        .set("Cookie", admin)
        .set("Origin", ORIGEM)
        .send({ limitePorMembro: 2, limitePeriodoDias: 7 })
        .expect(200);
      await creditar(jogadorAna, 1000);
      const c1 = (await comprar(ana, 1).expect(201)).body.compraId as string;
      await comprar(ana, 1).expect(201);
      expect((await get("/api/loja", ana).expect(200)).body.itens[0].limiteRestante).toBe(0);
      const r = await comprar(ana, 1).expect(409);
      expect(r.body.message).toContain("Limite de 2 a cada 7");
      await enviar(`/api/loja/compras/${c1}/cancelar`, {}, ana).expect(200);
      await comprar(ana, 1).expect(201);
      await comprar(bia, 1).expect(422); // Bia sem saldo, mas o limite dela é independente
    });
  });

  describe("entrega e cancelamento (D25, D28)", () => {
    it("CT-85: cancelar compra pendente devolve os pontos e as unidades", async () => {
      await preco(100);
      await entrada(5);
      await creditar(jogadorAna, 300);
      const id = (await comprar(ana, 2).expect(201)).body.compraId as string;
      const r = await enviar(`/api/loja/compras/${id}/cancelar`, { motivo: "Desisti" }, ana).expect(200);
      expect(r.body).toMatchObject({ status: "CANCELADA", motivoCancelamento: "Desisti" });
      expect(await saldo(ana)).toBe(300);
      expect(await disponivelGrupo()).toBe(5);
      await enviar(`/api/loja/compras/${id}/cancelar`, {}, ana).expect(409);
    });

    it("CT-86: compra entregue não pode ser cancelada; entregar duas vezes também não", async () => {
      await preco(100);
      await entrada(5);
      await creditar(jogadorAna, 300);
      const id = (await comprar(ana, 1).expect(201)).body.compraId as string;
      const e = await enviar(`/api/compras/${id}/entregar`, {}, admin).expect(200);
      expect(e.body).toMatchObject({ status: "ENTREGUE", entreguePor: { discordUsername: "admin" } });
      await enviar(`/api/loja/compras/${id}/cancelar`, {}, ana).expect(409);
      await enviar(`/api/compras/${id}/cancelar`, { motivo: "Tarde" }, admin).expect(409);
      await enviar(`/api/compras/${id}/entregar`, {}, admin).expect(409);
    });

    it("D28: o vendedor consignado só recebe na entrega; cancelar antes só devolve ao comprador", async () => {
      await preco(100);
      await consignado(jogadorVendedor, 3);
      await creditar(jogadorAna, 500);
      const c1 = (await comprar(ana, 1).expect(201)).body.compraId as string;
      expect(await saldoDe(jogadorVendedor)).toBe(0);
      await enviar(`/api/compras/${c1}/cancelar`, { motivo: "Item não encontrado" }, admin).expect(200);
      expect(await saldoDe(jogadorVendedor)).toBe(0);
      expect(await saldo(ana)).toBe(500);

      const c2 = (await comprar(ana, 2).expect(201)).body.compraId as string;
      await enviar(`/api/compras/${c2}/entregar`, {}, admin).expect(200);
      expect(await saldoDe(jogadorVendedor)).toBe(200);
      const ext = (await get("/api/extrato/me", vendedor).expect(200)).body as {
        lancamentos: { tipo: string; valor: number; compra: { comprador: { apelido: string } } | null }[];
      };
      expect(ext.lancamentos).toEqual([
        expect.objectContaining({
          tipo: "VENDA",
          valor: 200,
          compra: expect.objectContaining({ comprador: { apelido: "Ana" } }),
        }),
      ]);
    });

    it("CT-89/CT-100: a taxa vigente na compra fica gravada e vale na entrega", async () => {
      await preco(100);
      await consignado(jogadorVendedor, 5);
      await creditar(jogadorAna, 1000);
      const c1 = (await comprar(ana, 1).expect(201)).body.compraId as string; // taxa 0% (v1)
      await enviar("/api/config-loja", { taxaConsignacaoBp: 1000 }, admin).expect(201);
      const c2 = (await comprar(ana, 1).expect(201)).body.compraId as string; // taxa 10%
      await enviar(`/api/compras/${c2}/entregar`, {}, admin).expect(200);
      await enviar(`/api/compras/${c1}/entregar`, {}, admin).expect(200);
      expect(await saldoDe(jogadorVendedor)).toBe(100 + 90);
      expect(await saldo(ana)).toBe(800);
    });

    it("CT-103: comprar todo o lote consignado esgota a oferta; cancelar reabre", async () => {
      await preco(100);
      const ofertaId = await consignado(jogadorVendedor, 2);
      await creditar(jogadorAna, 500);
      const id = (await comprar(ana, 2).expect(201)).body.compraId as string;
      expect((await ctx.prisma.ofertaVenda.findUniqueOrThrow({ where: { id: ofertaId } })).status).toBe(
        "ESGOTADA",
      );
      await enviar(`/api/loja/compras/${id}/cancelar`, {}, ana).expect(200);
      expect((await ctx.prisma.ofertaVenda.findUniqueOrThrow({ where: { id: ofertaId } })).status).toBe(
        "APROVADA",
      );
    });

    it("fila do admin: pendentes das mais antigas para as mais novas; filtro por status", async () => {
      await preco(10);
      await entrada(10);
      await creditar(jogadorAna, 100);
      const a = (await comprar(ana, 1).expect(201)).body.compraId as string;
      const b = (await comprar(ana, 1).expect(201)).body.compraId as string;
      const fila = (await get("/api/compras?status=PENDENTE_ENTREGA", admin).expect(200)).body as Compra[];
      expect(fila.map((c) => c.id)).toEqual([a, b]);
      await get("/api/compras?status=QUALQUER", admin).expect(400);
    });
  });

  describe("acesso (D12, D14)", () => {
    it("CT-106: membro sem vínculo não usa a loja", async () => {
      const semVinculo = await ctx.login("6099", "novo");
      await get("/api/loja", semVinculo).expect(403);
      await get("/api/saldo/me", semVinculo).expect(403);
      await enviar("/api/loja/compras", { itemId: alma, quantidade: 1 }, semVinculo).expect(403);
    });

    it("CT-107 / CT-94: membro não entrega, não vê a fila e não cancela compra de outro", async () => {
      await preco(10);
      await entrada(5);
      await creditar(jogadorAna, 100);
      const id = (await comprar(ana, 1).expect(201)).body.compraId as string;
      await enviar(`/api/compras/${id}/entregar`, {}, bia).expect(403);
      await get("/api/compras", bia).expect(403);
      await enviar(`/api/loja/compras/${id}/cancelar`, {}, bia).expect(403);
      expect((await get("/api/loja/compras", bia).expect(200)).body).toEqual([]);
    });

    it("cancelamento pelo admin exige motivo", async () => {
      await preco(10);
      await entrada(5);
      await creditar(jogadorAna, 100);
      const id = (await comprar(ana, 1).expect(201)).body.compraId as string;
      await enviar(`/api/compras/${id}/cancelar`, {}, admin).expect(400);
    });
  });

  it("CT-108: os pontos fecham — o que saiu dos compradores = o que os vendedores receberam + o que saiu de circulação", async () => {
    await preco(100);
    await entrada(3);
    await consignado(jogadorVendedor, 3);
    await creditar(jogadorAna, 1000);
    await creditar(jogadorBia, 1000);
    await enviar("/api/config-loja", { taxaConsignacaoBp: 500 }, admin).expect(201);
    const c1 = (await comprar(ana, 2).expect(201)).body.compraId as string; // 2 do grupo
    const c2 = (await comprar(bia, 3).expect(201)).body.compraId as string; // 1 grupo + 2 consignados
    const c3 = (await comprar(ana, 1).expect(201)).body.compraId as string; // 1 consignado
    await enviar(`/api/compras/${c2}/entregar`, {}, admin).expect(200);
    await enviar(`/api/loja/compras/${c3}/cancelar`, {}, ana).expect(200);
    await enviar(`/api/compras/${c1}/entregar`, {}, admin).expect(200);

    const lancs = await ctx.prisma.lancamentoPontos.findMany({ where: { compraId: { not: null } } });
    const soma = lancs.reduce((a, l) => a + l.valor, 0);
    const compras = await ctx.prisma.compra.findMany({ include: { lotes: true } });
    const pagos = compras.filter((c) => c.status !== "CANCELADA").reduce((a, c) => a + c.total, 0);
    const aosVendedores = compras
      .filter((c) => c.status === "ENTREGUE")
      .flatMap((c) => c.lotes)
      .reduce((a, l) => a + l.valorVendedor, 0);
    expect(aosVendedores).toBe(2 * (100 - 5)); // taxa de 5%
    expect(soma).toBe(-(pagos - aosVendedores));
    const negativos = await ctx.prisma.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM saldo_lote WHERE quantidade < 0`;
    expect(Number(negativos[0]!.n)).toBe(0);
  });
});
