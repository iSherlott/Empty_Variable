// Épico III, M11: solicitação de Nebula, entrega, cancelamento e rejeição (T-43, T-44, T-46).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SeedService } from "../src/cadastros/seed.service.js";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

const POD = "Armadura Nebulosa POD";
const STA = "Armadura Nebulosa STA";
const FRAG = "Fragmento de Meteorito";
const PO = "Pó de Meteorito do Poder";
const PO_STA = "Pó de Meteorito da Estâmina";
const ALMA_B = "Alma de Betelgeuse";
const ALMA_N = "Alma de Naght Sieger";
const ASTRAL = "Armadura Astral";

interface Solicitacao {
  id: string;
  status: string;
  preco: number;
  trazPeca: boolean;
  pecaDoEstoque: string | null;
  motivo: string | null;
  precoReceita: { versao: number };
  materiais: { item: string; quantidade: number }[];
  lotes: { item: string; lote: number; quantidade: number }[];
}

describe("Solicitação de Nebula (M11)", () => {
  let ctx: Contexto;
  let admin: string;
  let adminId: string;
  let ana: string;
  let bia: string;
  let jogadorAna: string;
  let jogadorBia: string;
  const item: Record<string, string> = {};
  const receita: Record<string, string> = {};

  const enviar = (url: string, corpo: object, cookie: string) =>
    ctx.http().post(url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);
  const patch = (url: string, corpo: object, cookie = admin) =>
    ctx.http().patch(url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);
  const get = (url: string, cookie: string) => ctx.http().get(url).set("Cookie", cookie);
  const solicitar = (cookie: string, nome = POD, trazPeca = false) =>
    enviar("/api/nebula/solicitacoes", { receitaId: receita[nome], trazPeca }, cookie);

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
    return (await get("/api/saldo/me", cookie).expect(200)).body.saldo as number;
  }
  /** Lote do grupo (ou consignado, com dono) direto no banco. Devolve o id do lote. */
  async function estocar(nome: string, quantidade: number, dono?: string): Promise<string> {
    const lote = await ctx.prisma.loteEstoque.create({
      data: {
        itemId: item[nome]!,
        origem: dono === undefined ? "MANUAL" : "OFERTA",
        donoJogadorId: dono ?? null,
        ofertaId:
          dono === undefined
            ? null
            : (
                await ctx.prisma.ofertaVenda.create({
                  data: { jogadorId: dono, itemId: item[nome]!, quantidade, status: "APROVADA" },
                })
              ).id,
        criadoPorId: adminId,
      },
    });
    await ctx.prisma.movimentoEstoque.create({
      data: { loteId: lote.id, quantidade, tipo: "ENTRADA", criadoPorId: adminId },
    });
    return lote.id;
  }
  /** Quantidade no estoque do grupo (todos os lotes ativos sem dono). */
  async function grupo(nome: string): Promise<number> {
    const r = await ctx.prisma.$queryRaw<{ q: bigint }[]>`
      SELECT COALESCE(SUM(quantidade), 0)::bigint AS q FROM saldo_lote
      WHERE item_id = ${item[nome]!}::uuid AND ativo AND dono_jogador_id IS NULL`;
    return Number(r[0]!.q);
  }
  async function noLote(loteId: string): Promise<number> {
    const r = await ctx.prisma.$queryRaw<{ q: bigint }[]>`
      SELECT quantidade::bigint AS q FROM saldo_lote WHERE lote_id = ${loteId}::uuid`;
    return Number(r[0]!.q);
  }
  async function abrir(nome: string, comPeca: number, trazendo: number) {
    await enviar(
      `/api/receitas/${receita[nome]}/precos`,
      { precoComPeca: comPeca, precoTrazendoPeca: trazendo },
      admin,
    ).expect(201);
    await patch(`/api/receitas/${receita[nome]}`, { ativa: true }).expect(200);
  }
  /** Material para uma POD: 50 Fragmentos, 30 Pós do Poder e 10 Almas de Betelgeuse. */
  async function materiaisPod(vezes = 1) {
    await estocar(FRAG, 50 * vezes);
    await estocar(PO, 30 * vezes);
    await estocar(ALMA_B, 10 * vezes);
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
    for (const i of await ctx.prisma.itemCatalogo.findMany()) item[i.nome] = i.id;
    for (const r of await ctx.prisma.receita.findMany()) receita[r.nome] = r.id;
    [ana, jogadorAna] = await membro("7001", "Ana");
    [bia, jogadorBia] = await membro("7002", "Bia");
    await abrir(POD, 800, 500);
  });

  describe("vitrine (US-17)", () => {
    it("CT-120: só as receitas ativas e com preço aparecem; as do seed não", async () => {
      const v = (await get("/api/nebula", ana).expect(200)).body as {
        saldo: number;
        receitas: { nome: string; limiteRestante: number | null }[];
      };
      expect(v.receitas.map((r) => r.nome)).toEqual([POD]);
      expect(v.receitas[0]!.limiteRestante).toBeNull();
      await solicitar(ana, STA).expect(422);
    });

    it("CT-109 / CT-110: a reserva mínima não bloqueia a Nebula", async () => {
      await estocar(FRAG, 120);
      await estocar(PO, 30);
      await estocar(ALMA_B, 10);
      await estocar(ASTRAL, 1);
      await patch(`/api/itens/${item[ALMA_B]}`, { reservaMinima: 10 }).expect(200);
      const v = (await get("/api/nebula", ana).expect(200)).body as {
        receitas: { disponibilidade: { trazendoPeca: number; comPecaDoEstoque: number } }[];
      };
      expect(v.receitas[0]!.disponibilidade).toMatchObject({ trazendoPeca: 1, comPecaDoEstoque: 1 });
      await creditar(jogadorAna, 1000);
      await solicitar(ana).expect(201);
      expect(await grupo(ALMA_B)).toBe(0);
    });
  });

  describe("solicitar (US-18, T-43)", () => {
    it("CT-112 / CT-121: com a peça pronta do estoque — débito, baixa por ordem de chegada, pendente", async () => {
      const antigo = await estocar(FRAG, 30);
      const novo = await estocar(FRAG, 40);
      await estocar(PO, 30);
      await estocar(ALMA_B, 10);
      await estocar(ASTRAL, 1);
      await estocar(ALMA_N, 5);
      await creditar(jogadorAna, 1000);

      const r = await solicitar(ana).expect(201);
      expect(r.body).toMatchObject({ preco: 800, pecaDoEstoque: "PRONTA", saldo: 200 });
      expect(await saldo(ana)).toBe(200);
      // Ordem de chegada: o lote antigo esvazia primeiro (D27)
      expect(await noLote(antigo)).toBe(0);
      expect(await noLote(novo)).toBe(20);
      expect(await grupo(ASTRAL)).toBe(0);
      expect(await grupo(ALMA_N)).toBe(5); // a peça pronta não consome os materiais dela

      const [s] = (await get("/api/nebula/solicitacoes", ana).expect(200)).body as Solicitacao[];
      expect(s).toMatchObject({
        status: "PENDENTE",
        preco: 800,
        trazPeca: false,
        precoReceita: { versao: 1 },
      });
      expect(s!.materiais).toEqual(
        expect.arrayContaining([
          { itemId: item[FRAG], item: FRAG, quantidade: 50 },
          { itemId: item[ASTRAL], item: ASTRAL, quantidade: 1 },
        ]),
      );
      const ext = (await get("/api/extrato/me", ana).expect(200)).body as {
        lancamentos: {
          tipo: string;
          valor: number;
          solicitacaoNebula: { receita: { nome: string } } | null;
        }[];
      };
      expect(ext.lancamentos.find((l) => l.tipo === "NEBULA")).toMatchObject({
        valor: -800,
        solicitacaoNebula: { receita: { nome: POD } },
      });
    });

    it("CT-122: sem a peça pronta, consome os materiais da Astral (50 + 50 Fragmentos)", async () => {
      await estocar(FRAG, 100);
      await estocar(PO, 30);
      await estocar(ALMA_B, 10);
      await estocar(ALMA_N, 5);
      await creditar(jogadorAna, 1000);
      const r = await solicitar(ana).expect(201);
      expect(r.body.pecaDoEstoque).toBe("MATERIAIS");
      expect(await grupo(FRAG)).toBe(0);
      expect(await grupo(ALMA_N)).toBe(0);
    });

    it("CT-115 / CT-124: trazendo a peça, a peça não sai do estoque e vale o outro preço", async () => {
      await materiaisPod();
      await estocar(ASTRAL, 1);
      await creditar(jogadorAna, 1000);
      const r = await solicitar(ana, POD, true).expect(201);
      expect(r.body).toMatchObject({ preco: 500, pecaDoEstoque: null });
      expect(await grupo(ASTRAL)).toBe(1);
      expect(await saldo(ana)).toBe(500);
    });

    it("CT-111: material só em lote consignado não serve (D33)", async () => {
      await estocar(FRAG, 50);
      await estocar(PO, 30);
      await estocar(ALMA_B, 10, jogadorBia);
      await creditar(jogadorAna, 1000);
      const r = await solicitar(ana, POD, true).expect(409);
      expect(r.body.message).toContain("Alma de Betelgeuse (tem 0, precisa 10)");
    });

    it("CT-116: saldo insuficiente → 422 e nada é gravado", async () => {
      await materiaisPod();
      await creditar(jogadorAna, 499);
      await solicitar(ana, POD, true).expect(422);
      expect(await ctx.prisma.solicitacaoNebula.count()).toBe(0);
      expect(await grupo(FRAG)).toBe(50);
      expect(await saldo(ana)).toBe(499);
    });

    it("CT-117: limite de 1 a cada 30 dias; cancelada não conta", async () => {
      await patch(`/api/receitas/${receita[POD]}`, { limitePorMembro: 1, limitePeriodoDias: 30 }).expect(200);
      await materiaisPod(3);
      await creditar(jogadorAna, 5000);
      const primeira = await solicitar(ana, POD, true).expect(201);
      await solicitar(ana, POD, true).expect(409);
      await enviar(`/api/nebula/solicitacoes/${primeira.body.solicitacaoId}/cancelar`, {}, ana).expect(200);
      await solicitar(ana, POD, true).expect(201);
      const v = (await get("/api/nebula", ana).expect(200)).body as {
        receitas: { limiteRestante: number }[];
      };
      expect(v.receitas[0]!.limiteRestante).toBe(0);
    });

    it("CT-113: duas solicitações simultâneas, material para uma só → uma passa", async () => {
      await materiaisPod();
      await creditar(jogadorAna, 1000);
      await creditar(jogadorBia, 1000);
      const [a, b] = await Promise.all([solicitar(ana, POD, true), solicitar(bia, POD, true)]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await grupo(FRAG)).toBe(0);
      expect(await ctx.prisma.solicitacaoNebula.count()).toBe(1);
    });

    it("CT-126: receitas diferentes disputando os Fragmentos, sem impasse", async () => {
      await abrir(STA, 800, 500);
      await estocar(FRAG, 50);
      await estocar(PO, 30);
      await estocar(PO_STA, 30);
      await estocar(ALMA_B, 20);
      await creditar(jogadorAna, 1000);
      await creditar(jogadorBia, 1000);
      const [a, b] = await Promise.all([solicitar(ana, POD, true), solicitar(bia, STA, true)]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await grupo(FRAG)).toBe(0);
    });
  });

  describe("entregar, cancelar e rejeitar (US-19, D36, T-44)", () => {
    async function pendente(cookie = ana, jogador = jogadorAna): Promise<string> {
      await materiaisPod();
      await creditar(jogador, 1000);
      return (await solicitar(cookie, POD, true).expect(201)).body.solicitacaoId as string;
    }

    it("o admin entrega; a fila mostra os materiais por item e lote; entregar de novo dá 409", async () => {
      const id = await pendente();
      const fila = (await get("/api/nebula/fila", admin).expect(200)).body as (Solicitacao & {
        jogador: { apelido: string };
      })[];
      expect(fila).toHaveLength(1);
      expect(fila[0]!.jogador.apelido).toBe("Ana");
      expect(fila[0]!.lotes).toEqual(
        expect.arrayContaining([expect.objectContaining({ item: FRAG, quantidade: 50 })]),
      );
      const r = await enviar(`/api/nebula/solicitacoes/${id}/entregar`, {}, admin).expect(200);
      expect(r.body.status).toBe("ENTREGUE");
      await enviar(`/api/nebula/solicitacoes/${id}/entregar`, {}, admin).expect(409);
      await enviar(`/api/nebula/solicitacoes/${id}/cancelar`, {}, ana).expect(409);
      expect((await get("/api/nebula/fila", admin).expect(200)).body).toHaveLength(0);
      expect((await get("/api/nebula/fila?status=ENTREGUE", admin).expect(200)).body).toHaveLength(1);
      expect(await saldo(ana)).toBe(500);
    });

    it("CT-114: rejeição com motivo estorna os pontos e devolve cada material ao lote", async () => {
      const id = await pendente();
      await enviar(`/api/nebula/solicitacoes/${id}/rejeitar`, {}, admin).expect(400);
      const r = await enviar(
        `/api/nebula/solicitacoes/${id}/rejeitar`,
        { motivo: "Sem guardião hoje" },
        admin,
      ).expect(200);
      expect(r.body).toMatchObject({ status: "REJEITADA", motivo: "Sem guardião hoje" });
      expect(await saldo(ana)).toBe(1000);
      expect(await grupo(FRAG)).toBe(50);
      expect(await grupo(PO)).toBe(30);
      expect(await grupo(ALMA_B)).toBe(10);
    });

    it("o membro cancela a própria pendente; a de outro dá 403", async () => {
      const id = await pendente();
      await enviar(`/api/nebula/solicitacoes/${id}/cancelar`, {}, bia).expect(403);
      const r = await enviar(`/api/nebula/solicitacoes/${id}/cancelar`, {}, ana).expect(200);
      expect(r.body.status).toBe("CANCELADA");
      expect(await saldo(ana)).toBe(1000);
      expect(await grupo(FRAG)).toBe(50);
    });

    it("CT-127: cancelar depois de o admin aumentar a reserva devolve ao lote de origem", async () => {
      const id = await pendente();
      await patch(`/api/itens/${item[FRAG]}`, { reservaMinima: 40 }).expect(200);
      await enviar(`/api/nebula/solicitacoes/${id}/cancelar`, {}, ana).expect(200);
      expect(await grupo(FRAG)).toBe(50);
      const lote = await ctx.prisma.loteEstoque.findFirstOrThrow({ where: { itemId: item[FRAG]! } });
      expect(await noLote(lote.id)).toBe(50);
    });

    it("CT-118: sem vínculo dá 403; membro não entrega, não rejeita nem vê a fila", async () => {
      const semVinculo = await ctx.login("7099", "novo");
      await get("/api/nebula", semVinculo).expect(403);
      await solicitar(semVinculo, POD, true).expect(403);
      const id = await pendente();
      await enviar(`/api/nebula/solicitacoes/${id}/entregar`, {}, bia).expect(403);
      await enviar(`/api/nebula/solicitacoes/${id}/rejeitar`, { motivo: "não" }, bia).expect(403);
      await get("/api/nebula/fila", bia).expect(403);
    });

    it("CT-119 / CT-125: mudar preço e componentes depois mantém o que a solicitação gravou", async () => {
      const id = await pendente();
      await enviar(
        `/api/receitas/${receita[POD]}/precos`,
        { precoComPeca: 900, precoTrazendoPeca: 700 },
        admin,
      ).expect(201);
      const comp = (await get(`/api/receitas/${receita[POD]}`, admin).expect(200)).body as {
        componentes: { item: { id: string }; quantidade: number; pecaBase: boolean }[];
      };
      const novos = comp.componentes.map((c) => ({
        itemId: c.item.id,
        quantidade: c.quantidade + 1,
        pecaBase: c.pecaBase,
      }));
      await ctx
        .http()
        .put(`/api/receitas/${receita[POD]}/componentes`)
        .set("Cookie", admin)
        .set("Origin", ORIGEM)
        .send({ componentes: novos, receitaPecaId: receita[ASTRAL] })
        .expect(409);
      await enviar(`/api/nebula/solicitacoes/${id}/entregar`, {}, admin).expect(200);
      await ctx
        .http()
        .put(`/api/receitas/${receita[POD]}/componentes`)
        .set("Cookie", admin)
        .set("Origin", ORIGEM)
        .send({ componentes: novos, receitaPecaId: receita[ASTRAL] })
        .expect(200);
      const [s] = (await get("/api/nebula/solicitacoes", ana).expect(200)).body as Solicitacao[];
      expect(s).toMatchObject({ preco: 500, precoReceita: { versao: 1 } });
      expect(s!.materiais.find((m) => m.item === FRAG)?.quantidade).toBe(50);
    });

    it("CT-128: invariantes de pontos e de estoque", async () => {
      const entregue = await pendente();
      await enviar(`/api/nebula/solicitacoes/${entregue}/entregar`, {}, admin).expect(200);
      const cancelada = await pendente();
      await enviar(`/api/nebula/solicitacoes/${cancelada}/cancelar`, {}, ana).expect(200);
      const rejeitada = await pendente(bia, jogadorBia);
      await enviar(`/api/nebula/solicitacoes/${rejeitada}/rejeitar`, { motivo: "teste" }, admin).expect(200);

      const pontos = await ctx.prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT COALESCE(SUM(l.valor), 0) = -COALESCE((SELECT SUM(preco) FROM solicitacao_nebula
          WHERE status IN ('PENDENTE', 'ENTREGUE')), 0) AS ok
        FROM lancamento_pontos l WHERE l.solicitacao_nebula_id IS NOT NULL`;
      expect(pontos[0]!.ok).toBe(true);
      const estoque = await ctx.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*)::bigint AS n FROM (
          SELECT s.id FROM solicitacao_nebula s JOIN movimento_estoque m ON m.solicitacao_nebula_id = s.id
          WHERE s.status IN ('CANCELADA', 'REJEITADA') GROUP BY s.id HAVING SUM(m.quantidade) <> 0) x`;
      expect(Number(estoque[0]!.n)).toBe(0);
    });
  });
});
