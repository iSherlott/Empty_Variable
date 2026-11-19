// Épico III, M10: receitas, preços, catálogo corrigido e disponibilidade (T-39 a T-41).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SeedService } from "../src/cadastros/seed.service.js";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

interface Receita {
  id: string;
  nome: string;
  solicitavel: boolean;
  ativa: boolean;
  fonte: string | null;
  componentes: { item: { id: string; nome: string }; quantidade: number; pecaBase: boolean }[];
  receitaPeca: { id: string; nome: string } | null;
  precoVigente: { versao: number; precoComPeca: number; precoTrazendoPeca: number } | null;
  disponibilidade: {
    trazendoPeca: number;
    comPecaDoEstoque: number;
    faltasTrazendo: { item: string; tenho: number; preciso: number; falta: number }[];
  };
}

describe("Receitas e disponibilidade (M10)", () => {
  let ctx: Contexto;
  let admin: string;
  let adminId: string;
  const item: Record<string, string> = {};

  const enviar = (metodo: "post" | "patch" | "put", url: string, corpo: object, cookie = admin) =>
    ctx.http()[metodo](url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);
  const get = (url: string, cookie = admin) => ctx.http().get(url).set("Cookie", cookie);
  const receitas = async () => (await get("/api/receitas").expect(200)).body as Receita[];
  const receita = async (nome: string) => (await receitas()).find((r) => r.nome === nome)!;

  /** Lote do grupo (entrada manual exige item elegível; aqui o modelo direto basta). */
  async function estocar(nome: string, quantidade: number, dono?: string) {
    let ofertaId: string | null = null;
    if (dono !== undefined) {
      ofertaId = (
        await ctx.prisma.ofertaVenda.create({
          data: { jogadorId: dono, itemId: item[nome]!, quantidade, status: "APROVADA" },
        })
      ).id;
    }
    const lote = await ctx.prisma.loteEstoque.create({
      data: {
        itemId: item[nome]!,
        origem: dono === undefined ? "MANUAL" : "OFERTA",
        donoJogadorId: dono ?? null,
        ofertaId,
        criadoPorId: adminId,
      },
    });
    await ctx.prisma.movimentoEstoque.create({
      data: { loteId: lote.id, quantidade, tipo: "ENTRADA", criadoPorId: adminId },
    });
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
  });

  describe("seed (análise §2.2, planejamento §2.3)", () => {
    it("os pós têm os nomes oficiais e o catálogo ganhou as peças Astrais e as Nebulosas", async () => {
      expect(Object.keys(item)).toEqual(
        expect.arrayContaining([
          "Pó de Meteorito do Poder",
          "Pó de Meteorito da Sabedoria",
          "Armadura Astral",
          "Túnica Astral",
          "Veste Astral",
          "Armadura Nebulosa POD",
          "Veste Nebulosa SAB",
        ]),
      );
      expect(Object.keys(item).some((n) => n.startsWith("Pó de Talento"))).toBe(false);
    });

    it("banco antigo: renomeia os pós do M3 e cria só o que falta (idempotente)", async () => {
      await ctx.prisma.itemCatalogo.update({
        where: { id: item["Pó de Meteorito do Poder"]! },
        data: { nome: "Pó de Talento (Poder)" },
      });
      await ctx.prisma.receitaComponente.deleteMany();
      await ctx.prisma.receitaPeca.deleteMany();
      await ctx.prisma.receita.deleteMany();
      const r = await ctx.app.get(SeedService).aplicar();
      expect(r).toMatchObject({ catalogoEpico3: true, receitas: true });
      const renomeado = await ctx.prisma.itemCatalogo.findUniqueOrThrow({
        where: { id: item["Pó de Meteorito do Poder"]! },
      });
      expect(renomeado.nome).toBe("Pó de Meteorito do Poder");
      expect(await ctx.app.get(SeedService).aplicar()).toMatchObject({
        catalogoEpico3: false,
        receitas: false,
      });
      expect(await ctx.prisma.itemCatalogo.count()).toBe(20);
    });

    it("as 9 receitas da fonte entram inativas, sem preço, com a fonte e a peça ligada (D29, D31)", async () => {
      const lista = await receitas();
      expect(lista).toHaveLength(9);
      expect(lista.every((r) => !r.ativa && r.precoVigente === null && r.fonte?.includes("browiki"))).toBe(
        true,
      );
      expect(
        lista
          .filter((r) => r.solicitavel)
          .map((r) => r.nome)
          .sort(),
      ).toEqual([
        "Armadura Nebulosa POD",
        "Armadura Nebulosa STA",
        "Túnica Nebulosa CON",
        "Túnica Nebulosa CRV",
        "Veste Nebulosa FEI",
        "Veste Nebulosa SAB",
      ]);
      const pod = await receita("Armadura Nebulosa POD");
      expect(pod.componentes.map((c) => [c.item.nome, c.quantidade, c.pecaBase])).toEqual([
        ["Fragmento de Meteorito", 50, false],
        ["Pó de Meteorito do Poder", 30, false],
        ["Alma de Betelgeuse", 10, false],
        ["Armadura Astral", 1, true],
      ]);
      expect(pod.receitaPeca?.nome).toBe("Armadura Astral");
      const sab = await receita("Veste Nebulosa SAB");
      expect(sab.receitaPeca?.nome).toBe("Veste Astral");
    });
  });

  describe("disponibilidade (D31, D33)", () => {
    it("CT-109: material para uma POD; STA indisponível por falta do pó", async () => {
      await estocar("Fragmento de Meteorito", 120);
      await estocar("Pó de Meteorito do Poder", 30);
      await estocar("Alma de Betelgeuse", 10);
      await estocar("Armadura Astral", 1);
      expect((await receita("Armadura Nebulosa POD")).disponibilidade).toMatchObject({
        trazendoPeca: 1,
        comPecaDoEstoque: 1,
      });
      const sta = await receita("Armadura Nebulosa STA");
      expect(sta.disponibilidade.trazendoPeca).toBe(0);
      expect(
        sta.disponibilidade.faltasTrazendo.find((f) => f.item === "Pó de Meteorito da Estâmina"),
      ).toMatchObject({
        tenho: 0,
        preciso: 30,
        falta: 30,
      });
    });

    it("CT-110: a reserva mínima conta para a Nebula (D33)", async () => {
      await estocar("Fragmento de Meteorito", 50);
      await estocar("Pó de Meteorito do Poder", 30);
      await estocar("Alma de Betelgeuse", 10);
      await ctx.prisma.itemCatalogo.update({
        where: { id: item["Alma de Betelgeuse"]! },
        data: { reservaMinima: 10 },
      });
      expect((await receita("Armadura Nebulosa POD")).disponibilidade.trazendoPeca).toBe(1);
    });

    it("CT-111: itens consignados não contam (D33)", async () => {
      const dono = (await ctx.prisma.jogador.create({ data: { apelido: "Vendedor" } })).id;
      await estocar("Fragmento de Meteorito", 50);
      await estocar("Pó de Meteorito do Poder", 30);
      await estocar("Alma de Betelgeuse", 10, dono);
      expect((await receita("Armadura Nebulosa POD")).disponibilidade.trazendoPeca).toBe(0);
    });

    it("CT-123: Fragmentos disputados — trazendo 2, com a peça fabricada 1", async () => {
      await estocar("Fragmento de Meteorito", 120);
      await estocar("Pó de Meteorito do Poder", 300);
      await estocar("Alma de Betelgeuse", 100);
      await estocar("Alma de Naght Sieger", 50);
      expect((await receita("Armadura Nebulosa POD")).disponibilidade).toMatchObject({
        trazendoPeca: 2,
        comPecaDoEstoque: 1,
      });
    });
  });

  describe("cadastro (US-16, D32, D35)", () => {
    it("preços versionados e imutáveis; ativar exige preço", async () => {
      const pod = await receita("Armadura Nebulosa POD");
      await enviar("patch", `/api/receitas/${pod.id}`, { ativa: true }).expect(409);
      await enviar("post", `/api/receitas/${pod.id}/precos`, {
        precoComPeca: 3000,
        precoTrazendoPeca: 2500,
      }).expect(201);
      const v2 = await enviar("post", `/api/receitas/${pod.id}/precos`, {
        precoComPeca: 3200,
        precoTrazendoPeca: 2600,
      }).expect(201);
      expect(v2.body.versao).toBe(2);
      const ativa = (await enviar("patch", `/api/receitas/${pod.id}`, { ativa: true }).expect(200))
        .body as Receita;
      expect(ativa).toMatchObject({
        ativa: true,
        precoVigente: { versao: 2, precoComPeca: 3200, precoTrazendoPeca: 2600 },
      });
      const hist = (await get(`/api/receitas/${pod.id}/precos`).expect(200)).body as { versao: number }[];
      expect(hist.map((h) => h.versao)).toEqual([2, 1]);
      const p = await ctx.prisma.precoReceita.findFirstOrThrow({ where: { versao: 1 } });
      await expect(
        ctx.prisma.precoReceita.update({ where: { id: p.id }, data: { precoComPeca: 1 } }),
      ).rejects.toThrow(/só aceita inclusão/);
      await enviar("post", `/api/receitas/${pod.id}/precos`, {
        precoComPeca: 0,
        precoTrazendoPeca: 10,
      }).expect(400);
    });

    it("substitui componentes com validação; bloqueado com solicitação pendente (CT-125)", async () => {
      const pod = await receita("Armadura Nebulosa POD");
      const base = pod.componentes.map((c) => ({
        itemId: c.item.id,
        quantidade: c.quantidade,
        pecaBase: c.pecaBase,
      }));
      // Item repetido, duas peças-base, quantidade zero
      await enviar("put", `/api/receitas/${pod.id}/componentes`, { componentes: [...base, base[0]] }).expect(
        400,
      );
      await enviar("put", `/api/receitas/${pod.id}/componentes`, {
        componentes: base.map((c) => ({ ...c, pecaBase: true })),
      }).expect(400);
      await enviar("put", `/api/receitas/${pod.id}/componentes`, {
        componentes: [{ ...base[0]!, quantidade: 0 }],
      }).expect(400);
      // A receita da peça precisa produzir o item da peça-base
      const tunica = await receita("Túnica Astral");
      await enviar("put", `/api/receitas/${pod.id}/componentes`, {
        componentes: base,
        receitaPecaId: tunica.id,
      }).expect(400);

      // Ajuste válido (ex.: o grupo confirmou outra quantidade no jogo)
      const novo = base.map((c) => (c.pecaBase ? c : { ...c, quantidade: c.quantidade + 1 }));
      const astral = await receita("Armadura Astral");
      const r = (
        await enviar("put", `/api/receitas/${pod.id}/componentes`, {
          componentes: novo,
          receitaPecaId: astral.id,
        }).expect(200)
      ).body as Receita;
      expect(r.componentes.find((c) => c.item.nome === "Fragmento de Meteorito")?.quantidade).toBe(51);

      // Com uma solicitação pendente, mudar os componentes é bloqueado
      await enviar("post", `/api/receitas/${pod.id}/precos`, {
        precoComPeca: 10,
        precoTrazendoPeca: 5,
      }).expect(201);
      const preco = await ctx.prisma.precoReceita.findFirstOrThrow({ where: { receitaId: pod.id } });
      const jogador = await ctx.prisma.jogador.create({ data: { apelido: "Ana" } });
      await ctx.prisma.solicitacaoNebula.create({
        data: {
          jogadorId: jogador.id,
          receitaId: pod.id,
          trazPeca: true,
          preco: 5,
          precoReceitaId: preco.id,
        },
      });
      const bloqueio = await enviar("put", `/api/receitas/${pod.id}/componentes`, {
        componentes: base,
        receitaPecaId: astral.id,
      }).expect(409);
      expect(bloqueio.body.message).toContain("pendente");
    });

    it("limite (D35) exige quantidade e período juntos; o banco também", async () => {
      const pod = await receita("Armadura Nebulosa POD");
      await enviar("patch", `/api/receitas/${pod.id}`, { limitePorMembro: 1 }).expect(400);
      await enviar("patch", `/api/receitas/${pod.id}`, { limitePorMembro: 1, limitePeriodoDias: 30 }).expect(
        200,
      );
      await expect(
        ctx.prisma.receita.update({ where: { id: pod.id }, data: { limitePeriodoDias: null } }),
      ).rejects.toThrow();
    });

    it("cria receita nova; nome repetido dá 409", async () => {
      const r = await enviar("post", "/api/receitas", {
        nome: "Sinete Estelar",
        itemProduzidoId: item["Fragmento de Talento"],
        componentes: [
          { itemId: item["Fragmento de Meteorito"], quantidade: 100 },
          { itemId: item["Alma de Naght Sieger"], quantidade: 10 },
        ],
      }).expect(201);
      expect(r.body).toMatchObject({ ativa: false, solicitavel: false });
      await enviar("post", "/api/receitas", {
        nome: "sinete estelar",
        itemProduzidoId: item["Fragmento de Talento"],
        componentes: [{ itemId: item["Fragmento de Meteorito"], quantidade: 1 }],
      }).expect(409);
    });

    it("membro recebe 403 nas receitas", async () => {
      const membro = await ctx.login("8001", "membro");
      await get("/api/receitas", membro).expect(403);
      const pod = await receita("Armadura Nebulosa POD");
      await enviar(
        "post",
        `/api/receitas/${pod.id}/precos`,
        { precoComPeca: 1, precoTrazendoPeca: 1 },
        membro,
      ).expect(403);
    });
  });
});
