// Épico II, M7: estoque, preços por item, parâmetros da loja e campos do item (T-26 a T-28).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SeedService } from "../src/cadastros/seed.service.js";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

describe("Estoque, preços e parâmetros da loja (M7)", () => {
  let ctx: Contexto;
  let admin: string;
  let membro: string;
  let adminId: string;
  /** Alma de Betelgeuse: marcada como negociável e não vinculada (elegível). */
  let alma: string;
  /** Pó de Meteorito: negociabilidade desconhecida (inelegível, D20). */
  let po: string;

  const enviar = (metodo: "post" | "patch", url: string, corpo: object, cookie = admin) =>
    ctx.http()[metodo](url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);
  const get = (url: string, cookie = admin) => ctx.http().get(url).set("Cookie", cookie);

  async function resumoDe(itemId: string) {
    const r = (await get("/api/estoque").expect(200)).body as { itemId: string }[];
    return r.find((x) => x.itemId === itemId) as
      | {
          grupo: number;
          consignado: number;
          disponivel: number;
          reservaMinima: number;
          precoVigente: number | null;
        }
      | undefined;
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
    membro = await ctx.login("5001", "membro");
    adminId = (await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId: ADMIN_DISCORD_ID } })).id;
    alma = (await ctx.prisma.itemCatalogo.findUniqueOrThrow({ where: { nome: "Alma de Betelgeuse" } })).id;
    po = (await ctx.prisma.itemCatalogo.findUniqueOrThrow({ where: { nome: "Pó de Meteorito" } })).id;
    await enviar("patch", `/api/itens/${alma}`, { negociavel: true, vinculadoConta: false }).expect(200);
  });

  describe("elegibilidade e entradas (D20, US-09)", () => {
    it("CT-87: item com negociabilidade desconhecida ou vinculado à conta não entra no estoque", async () => {
      const r = await enviar("post", "/api/estoque/entradas", { itemId: po, quantidade: 5 }).expect(400);
      expect(r.body.message).toContain("Negociabilidade ainda não verificada");
      await enviar("patch", `/api/itens/${po}`, { negociavel: true, vinculadoConta: true }).expect(200);
      await enviar("post", "/api/estoque/entradas", { itemId: po, quantidade: 5 }).expect(400);
      expect(await ctx.prisma.loteEstoque.count()).toBe(0);
    });

    it("cria um lote com preço de venda e exige ajuste para aumentar a quantidade", async () => {
      const entrada = await enviar("post", "/api/estoque/entradas", {
        itemId: alma,
        quantidade: 3,
        motivo: "Doação",
        precoPontos: 50,
      }).expect(201);
      await enviar("post", "/api/estoque/entradas", {
        itemId: alma,
        quantidade: 2,
        precoPontos: 90,
      }).expect(409);
      await enviar("post", "/api/estoque/ajustes", {
        loteId: entrada.body.loteId,
        quantidade: 2,
        motivo: "Reposição",
      }).expect(201);
      expect(await ctx.prisma.loteEstoque.count()).toBe(1);
      expect(await resumoDe(alma)).toMatchObject({ grupo: 5, disponivel: 5, precoVigente: 50 });
    });

    it("registra a origem da entrada e restringe as origens ao administrador", async () => {
      await get("/api/estoque/origens", membro).expect(403);
      const resposta = await get("/api/estoque/origens").expect(200);
      const torre = (resposta.body as { id: string; nome: string }[]).find(
        (instancia) => instancia.nome === "Torre da Constelação",
      );
      expect(torre).toBeDefined();
      await enviar("post", "/api/estoque/entradas", {
        origem: "10000000-0000-4000-8000-000000000001",
        itemId: alma,
        quantidade: 2,
      }).expect(404);
      await enviar("patch", `/api/itens/${po}`, { negociavel: true, vinculadoConta: false }).expect(200);
      await enviar("post", "/api/estoque/entradas", {
        origem: torre!.id,
        itemId: alma,
        quantidade: 2,
      }).expect(201);
      await enviar("post", "/api/estoque/entradas", {
        origem: "DROP_SOLTO",
        itemId: po,
        quantidade: 2,
      }).expect(201);
      const movimentos = await get("/api/estoque/movimentos").expect(200);
      expect(movimentos.body).toHaveLength(2);
      expect(movimentos.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ origemEntrada: "Torre da Constelação" }),
          expect.objectContaining({ origemEntrada: "Drop Solto" }),
        ]),
      );
    });

    it("valida quantidade inteira positiva", async () => {
      for (const quantidade of [0, -1, 1.5, "2"]) {
        await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade }).expect(400);
      }
    });
  });

  describe("disponibilidade e reserva (D26)", () => {
    it("CT-98: grupo 12 com reserva 10 e consignado 3 → disponível 5", async () => {
      await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade: 12 }).expect(201);
      await enviar("patch", `/api/itens/${alma}`, { reservaMinima: 10 }).expect(200);
      expect(await resumoDe(alma)).toMatchObject({ grupo: 12, reservaMinima: 10, disponivel: 2 });

      // Lote consignado (o fluxo de ofertas é do M9; aqui só o modelo)
      const vendedor = await ctx.prisma.jogador.create({ data: { apelido: "Vendedor" } });
      const oferta = await ctx.prisma.ofertaVenda.create({
        data: { jogadorId: vendedor.id, itemId: alma, quantidade: 3, status: "APROVADA" },
      });
      const lote = await ctx.prisma.loteEstoque.create({
        data: {
          itemId: alma,
          donoJogadorId: vendedor.id,
          origem: "OFERTA",
          ofertaId: oferta.id,
          criadoPorId: adminId,
        },
      });
      await ctx.prisma.movimentoEstoque.create({
        data: { loteId: lote.id, quantidade: 3, tipo: "ENTRADA", criadoPorId: adminId },
      });
      expect(await resumoDe(alma)).toMatchObject({ grupo: 12, consignado: 3, disponivel: 5 });

      // A reserva não pode deixar o disponível do grupo negativo: com reserva 20, o grupo contribui 0.
      await enviar("patch", `/api/itens/${alma}`, { reservaMinima: 20 }).expect(200);
      expect(await resumoDe(alma)).toMatchObject({ disponivel: 3 });
    });

    it("lote inativo não conta como disponível", async () => {
      const r = await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade: 4 }).expect(201);
      await ctx.prisma.loteEstoque.update({ where: { id: r.body.loteId }, data: { ativo: false } });
      expect(await resumoDe(alma)).toMatchObject({ grupo: 0, disponivel: 0 });
    });
  });

  describe("ajustes e ledger do estoque (CT-95, CT-104)", () => {
    it("CT-104: ajuste que deixaria o lote negativo é recusado pelo serviço e pelo banco", async () => {
      const r = await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade: 12 }).expect(201);
      const loteId = r.body.loteId as string;
      await enviar("post", "/api/estoque/ajustes", { loteId, quantidade: -20, motivo: "Contagem" }).expect(
        400,
      );
      await expect(
        ctx.prisma.movimentoEstoque.create({
          data: { loteId, quantidade: -20, tipo: "AJUSTE", motivo: "direto", criadoPorId: adminId },
        }),
      ).rejects.toThrow(/quantidade negativa/);
      await enviar("post", "/api/estoque/ajustes", { loteId, quantidade: -2, motivo: "Perdido" }).expect(201);
      await enviar("post", "/api/estoque/ajustes", { loteId, quantidade: -1 }).expect(400); // motivo obrigatório
      await enviar("post", "/api/estoque/ajustes", { loteId, quantidade: 0, motivo: "nada" }).expect(400);
      expect(await resumoDe(alma)).toMatchObject({ grupo: 10 });
    });

    it("CT-95: movimentos de estoque não podem ser alterados nem apagados", async () => {
      await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade: 1 }).expect(201);
      const m = await ctx.prisma.movimentoEstoque.findFirstOrThrow();
      await expect(
        ctx.prisma.movimentoEstoque.update({ where: { id: m.id }, data: { quantidade: 99 } }),
      ).rejects.toThrow(/só aceita inclusão/);
      await expect(ctx.prisma.movimentoEstoque.delete({ where: { id: m.id } })).rejects.toThrow(
        /só aceita inclusão/,
      );
      await expect(ctx.prisma.$executeRawUnsafe("TRUNCATE movimento_estoque CASCADE")).rejects.toThrow(
        /só aceita inclusão/,
      );
    });

    it("o banco recusa movimentos com sinal incoerente com o tipo", async () => {
      const r = await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade: 5 }).expect(201);
      await expect(
        ctx.prisma.movimentoEstoque.create({
          data: { loteId: r.body.loteId, quantidade: -1, tipo: "ENTRADA", criadoPorId: adminId },
        }),
      ).rejects.toThrow();
    });

    it("histórico de movimentos com filtros por item e tipo", async () => {
      const r = await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade: 5 }).expect(201);
      await enviar("post", "/api/estoque/ajustes", {
        loteId: r.body.loteId,
        quantidade: -1,
        motivo: "Quebra",
      }).expect(201);
      const todos = (await get(`/api/estoque/movimentos?itemId=${alma}`).expect(200)).body as {
        tipo: string;
      }[];
      expect(todos.map((m) => m.tipo).sort()).toEqual(["AJUSTE", "ENTRADA"]);
      const ajustes = (await get("/api/estoque/movimentos?tipo=AJUSTE").expect(200)).body as {
        motivo: string;
      }[];
      expect(ajustes).toEqual([expect.objectContaining({ motivo: "Quebra" })]);
      await get("/api/estoque/movimentos?tipo=QUALQUER").expect(400);
    });
  });

  describe("drops da run no estoque (D18, CT-88, CT-105)", () => {
    async function registrarRunComDrops(): Promise<string> {
      const j = await ctx.prisma.jogador.create({
        data: { apelido: "Ana", personagens: { create: [{ nome: "Ana-MTK" }] } },
        include: { personagens: true },
      });
      const mtk = await ctx.prisma.funcaoClasse.findFirstOrThrow({
        where: { classe: { apelidoGrupo: "MTK" } },
      });
      const r = await enviar("post", "/api/runs", {
        data: "2026-11-14",
        chefe: "BETELGEUSE_50",
        status: "CONCLUIDA",
        participantes: [{ personagemId: j.personagens[0]!.id, funcaoId: mtk.id }],
        drops: [
          { itemId: alma, quantidade: 2 },
          { itemId: po, quantidade: 7 },
        ],
      }).expect(201);
      return r.body.runId as string;
    }

    it("CT-105: só o drop elegível entra; o outro volta com o motivo; o mesmo drop não entra duas vezes (CT-88)", async () => {
      const runId = await registrarRunComDrops();
      const r1 = (await enviar("post", `/api/runs/${runId}/estoque`, {}).expect(200)).body;
      expect(r1.lancados).toEqual([expect.objectContaining({ item: "Alma de Betelgeuse", quantidade: 2 })]);
      expect(r1.naoLancados).toEqual([
        expect.objectContaining({
          item: "Pó de Meteorito",
          motivo: "Negociabilidade ainda não verificada no jogo.",
        }),
      ]);

      const r2 = (await enviar("post", `/api/runs/${runId}/estoque`, {}).expect(200)).body;
      expect(r2.lancados).toEqual([]);
      expect(r2.naoLancados.map((x: { motivo: string }) => x.motivo)).toContain("Já lançado no estoque.");
      expect(await resumoDe(alma)).toMatchObject({ grupo: 2 });

      const det = (await get(`/api/runs/${runId}`).expect(200)).body as {
        drops: { item: { nome: string }; lancadoNoEstoque: boolean }[];
      };
      expect(Object.fromEntries(det.drops.map((d) => [d.item.nome, d.lancadoNoEstoque]))).toEqual({
        "Alma de Betelgeuse": true,
        "Pó de Meteorito": false,
      });

      // O índice único do banco também barra a segunda entrada do mesmo drop.
      const drop = await ctx.prisma.dropRun.findFirstOrThrow({ where: { itemId: alma } });
      const lote = await ctx.prisma.loteEstoque.create({
        data: { itemId: alma, origem: "DROP_RUN", criadoPorId: adminId },
      });
      await expect(
        ctx.prisma.movimentoEstoque.create({
          data: { loteId: lote.id, quantidade: 2, tipo: "ENTRADA", dropRunId: drop.id, criadoPorId: adminId },
        }),
      ).rejects.toThrow();
    });

    it("os drops de uma mesma run entram em lotes com ordem de chegada distinta", async () => {
      await enviar("patch", `/api/itens/${po}`, { negociavel: true, vinculadoConta: false }).expect(200);
      const runId = await registrarRunComDrops();
      await enviar("post", `/api/runs/${runId}/estoque`, {}).expect(200);
      const ordens = (await ctx.prisma.loteEstoque.findMany({ select: { ordem: true } })).map((l) => l.ordem);
      expect(new Set(ordens).size).toBe(2);
    });

    it("run estornada não lança drops (vale a run corrigida)", async () => {
      const runId = await registrarRunComDrops();
      await ctx.prisma.run.update({ where: { id: runId }, data: { status: "ESTORNADA" } });
      await enviar("post", `/api/runs/${runId}/estoque`, {}).expect(409);
    });
  });

  describe("preço por item (D21)", () => {
    it("cada mudança cria uma versão; a vigente é a última; nulo tira da loja; histórico imutável", async () => {
      await enviar("post", "/api/loja/precos", { itemId: alma, precoPontos: 500 }).expect(201);
      const v2 = await enviar("post", "/api/loja/precos", { itemId: alma, precoPontos: 450 }).expect(201);
      expect(v2.body.versao).toBe(2);
      const itens = (await get("/api/itens").expect(200)).body as {
        id: string;
        precoVigente: number | null;
        motivoInelegivel: string | null;
      }[];
      expect(itens.find((i) => i.id === alma)).toMatchObject({ precoVigente: 450, motivoInelegivel: null });
      expect(itens.find((i) => i.id === po)?.motivoInelegivel).toContain("Negociabilidade");

      await enviar("post", "/api/loja/precos", { itemId: alma, precoPontos: null }).expect(201);
      expect(
        ((await get("/api/itens").expect(200)).body as { id: string; precoVigente: unknown }[]).find(
          (i) => i.id === alma,
        )?.precoVigente,
      ).toBeNull();

      const hist = (await get(`/api/loja/precos/${alma}`).expect(200)).body as {
        versao: number;
        precoPontos: number | null;
      }[];
      expect(hist.map((h) => [h.versao, h.precoPontos])).toEqual([
        [3, null],
        [2, 450],
        [1, 500],
      ]);
      const p = await ctx.prisma.precoItem.findFirstOrThrow({ where: { versao: 1 } });
      await expect(
        ctx.prisma.precoItem.update({ where: { id: p.id }, data: { precoPontos: 1 } }),
      ).rejects.toThrow(/só aceita inclusão/);
    });

    it("preço precisa ser inteiro positivo; item inexistente dá 404", async () => {
      for (const precoPontos of [0, -10, 1.5, "100"]) {
        await enviar("post", "/api/loja/precos", { itemId: alma, precoPontos }).expect(400);
      }
      await enviar("post", "/api/loja/precos", { itemId: crypto.randomUUID(), precoPontos: 10 }).expect(404);
    });
  });

  describe("parâmetros da loja (D22)", () => {
    it("começa com taxa 0% (v1); nova versão não altera a anterior", async () => {
      const h1 = (await get("/api/config-loja").expect(200)).body as {
        versao: number;
        taxaConsignacaoBp: number;
      }[];
      expect(h1.map((v) => [v.versao, v.taxaConsignacaoBp])).toEqual([[1, 0]]);
      await enviar("post", "/api/config-loja", { taxaConsignacaoBp: 1000 }).expect(201);
      const h2 = (await get("/api/config-loja").expect(200)).body as {
        versao: number;
        taxaConsignacaoBp: number;
      }[];
      expect(h2.map((v) => [v.versao, v.taxaConsignacaoBp])).toEqual([
        [2, 1000],
        [1, 0],
      ]);
      await enviar("post", "/api/config-loja", { taxaConsignacaoBp: 10_001 }).expect(400);
      const v1 = await ctx.prisma.configLoja.findFirstOrThrow({ where: { versao: 1 } });
      await expect(
        ctx.prisma.configLoja.update({ where: { id: v1.id }, data: { taxaConsignacaoBp: 5 } }),
      ).rejects.toThrow(/só aceita inclusão/);
    });
  });

  describe("reserva e limite no item (D24, D26)", () => {
    it("limite exige quantidade e período juntos; nulos removem; reserva não negativa", async () => {
      await enviar("patch", `/api/itens/${alma}`, { limitePorMembro: 2 }).expect(400);
      await enviar("patch", `/api/itens/${alma}`, { limitePorMembro: 2, limitePeriodoDias: 0 }).expect(400);
      await enviar("patch", `/api/itens/${alma}`, { reservaMinima: -1 }).expect(400);
      const ok = await enviar("patch", `/api/itens/${alma}`, {
        limitePorMembro: 2,
        limitePeriodoDias: 7,
      }).expect(200);
      expect(ok.body).toMatchObject({ limitePorMembro: 2, limitePeriodoDias: 7 });
      const limpo = await enviar("patch", `/api/itens/${alma}`, {
        limitePorMembro: null,
        limitePeriodoDias: null,
      }).expect(200);
      expect(limpo.body).toMatchObject({ limitePorMembro: null, limitePeriodoDias: null });
      // O banco também exige os dois juntos.
      await expect(
        ctx.prisma.itemCatalogo.update({ where: { id: alma }, data: { limitePorMembro: 3 } }),
      ).rejects.toThrow();
    });
  });

  it("membro recebe 403 no estoque, nos preços e nos parâmetros da loja", async () => {
    await get("/api/estoque", membro).expect(403);
    await get("/api/estoque/movimentos", membro).expect(403);
    await enviar("post", "/api/estoque/entradas", { itemId: alma, quantidade: 1 }, membro).expect(403);
    await enviar("post", "/api/loja/precos", { itemId: alma, precoPontos: 1 }, membro).expect(403);
    await enviar("post", "/api/config-loja", { taxaConsignacaoBp: 0 }, membro).expect(403);
    await enviar("post", `/api/runs/${crypto.randomUUID()}/estoque`, {}, membro).expect(403);
  });
});
