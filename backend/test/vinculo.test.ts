// T-09 / US-08: jogadores, personagens e fluxo de vínculo (D12).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

describe("Jogadores e vínculo (T-09, US-08)", () => {
  let ctx: Contexto;
  let admin: string;
  let membro: string;

  const post = (url: string, cookie: string, corpo: object = {}) =>
    ctx.http().post(url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await ctx.fechar();
  });
  beforeEach(async () => {
    await ctx.limparBanco();
    admin = await ctx.login(ADMIN_DISCORD_ID, "admin");
    membro = await ctx.login("2001", "ana");
  });

  async function criarJogador(apelido: string, personagens: string[] = []) {
    const r = await post("/api/jogadores", admin, { apelido, personagens }).expect(201);
    return r.body as { id: string; apelido: string };
  }

  describe("cadastro pelo admin", () => {
    it("cria jogador com personagens e lista", async () => {
      await criarJogador("Ana", ["Ana-MTK", "Ana-Cardeal"]);
      const lista = await ctx.http().get("/api/jogadores").set("Cookie", admin).expect(200);
      expect(lista.body).toHaveLength(1);
      expect(lista.body[0].personagens.map((p: { nome: string }) => p.nome)).toEqual([
        "Ana-Cardeal",
        "Ana-MTK",
      ]);
    });

    it("apelido e nome de personagem são únicos sem diferenciar maiúsculas", async () => {
      await criarJogador("Ana", ["Ana-MTK"]);
      await post("/api/jogadores", admin, { apelido: "ANA" }).expect(409);
      const beto = await criarJogador("Beto");
      await post(`/api/jogadores/${beto.id}/personagens`, admin, { nome: "ana-mtk" }).expect(409);
    });

    it("valida entradas (400)", async () => {
      await post("/api/jogadores", admin, { apelido: "" }).expect(400);
      await post("/api/jogadores", admin, { apelido: "Ok", personagens: ["A", "a"] }).expect(400);
      await post("/api/jogadores", admin, { apelido: "Ok", personagens: ["x".repeat(24)] }).expect(400);
    });

    it("desativa personagem sem apagar", async () => {
      await criarJogador("Ana", ["Ana-MTK"]);
      const p = await ctx.prisma.personagem.findFirstOrThrow();
      await ctx
        .http()
        .patch(`/api/personagens/${p.id}`)
        .set("Cookie", admin)
        .set("Origin", ORIGEM)
        .send({ ativo: false })
        .expect(200);
      expect((await ctx.prisma.personagem.findFirstOrThrow()).ativo).toBe(false);
    });

    it("somente outro administrador pode aprovar o pedido de um administrador", async () => {
      const pedido = await post("/api/vinculo/solicitacoes", admin, {
        apelidoProposto: "Administrador",
        personagensNovos: ["Admin-MTK"],
      }).expect(201);
      const url = `/api/vinculo/solicitacoes/${pedido.body.id}`;
      const outro = await ctx.login("2002", "outro");
      await ctx.prisma.usuario.update({ where: { discordId: "2002" }, data: { papel: "GESTOR" } });
      await ctx.http().get("/api/vinculo/solicitacoes").set("Cookie", outro).expect(403);
      await post(`${url}/aprovar`, outro).expect(403);
      await post(`${url}/rejeitar`, outro, { motivo: "Teste" }).expect(403);
      await post(`${url}/aprovar`, admin).expect(403);
      const pendente = await ctx.prisma.solicitacaoVinculo.findUniqueOrThrow({
        where: { id: pedido.body.id },
      });
      expect(pendente.status).toBe("PENDENTE");
      await ctx.prisma.usuario.update({ where: { discordId: "2002" }, data: { papel: "ADMIN" } });
      await post(`${url}/aprovar`, outro).expect(200);
    });

    it("membro não cadastra jogador (403)", async () => {
      await post("/api/jogadores", membro, { apelido: "Hacker" }).expect(403);
    });
  });

  describe("solicitação e aprovação", () => {
    it("CT-76: membro reivindica jogador existente com personagem novo; admin aprova", async () => {
      const ana = await criarJogador("Ana", ["Ana-MTK"]);
      const disp = await ctx
        .http()
        .get("/api/vinculo/jogadores-disponiveis")
        .set("Cookie", membro)
        .expect(200);
      expect(disp.body.map((j: { apelido: string }) => j.apelido)).toEqual(["Ana"]);

      const s = await post("/api/vinculo/solicitacoes", membro, {
        jogadorId: ana.id,
        personagensNovos: ["Ana-GX"],
      }).expect(201);
      expect(s.body).toMatchObject({ status: "PENDENTE", personagensNovos: ["Ana-GX"] });

      // Enquanto pendente: sem vínculo
      const antes = await ctx.http().get("/api/auth/me").set("Cookie", membro).expect(200);
      expect(antes.body).toMatchObject({ jogador: null, vinculoPendente: true });

      const fila = await ctx
        .http()
        .get("/api/vinculo/solicitacoes?status=PENDENTE")
        .set("Cookie", admin)
        .expect(200);
      expect(fila.body).toHaveLength(1);
      expect(fila.body[0].usuario.discordUsername).toBe("ana");

      const ap = await post(`/api/vinculo/solicitacoes/${s.body.id}/aprovar`, admin).expect(200);
      expect(ap.body.status).toBe("APROVADA");

      const depois = await ctx.http().get("/api/vinculo").set("Cookie", membro).expect(200);
      expect(depois.body.jogador.apelido).toBe("Ana");
      expect(depois.body.jogador.personagens.map((p: { nome: string }) => p.nome)).toEqual([
        "Ana-GX",
        "Ana-MTK",
      ]);
      const me = await ctx.http().get("/api/auth/me").set("Cookie", membro).expect(200);
      expect(me.body).toMatchObject({ jogador: { apelido: "Ana" }, vinculoPendente: false });
      expect(await ctx.prisma.auditoria.count({ where: { acao: "VINCULO_APROVADO" } })).toBe(1);
    });

    it("CT-76: membro propõe jogador novo; aprovação cria jogador e personagens", async () => {
      const s = await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Novata",
        personagensNovos: ["Nova-RG"],
      }).expect(201);
      await post(`/api/vinculo/solicitacoes/${s.body.id}/aprovar`, admin).expect(200);
      const j = await ctx.prisma.jogador.findUniqueOrThrow({
        where: { apelido: "Novata" },
        include: { personagens: true, usuario: true },
      });
      expect(j.usuario?.discordId).toBe("2001");
      expect(j.personagens.map((p) => p.nome)).toEqual(["Nova-RG"]);
    });

    it("CT-77: segunda solicitação com a primeira pendente é rejeitada", async () => {
      await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Um",
        personagensNovos: ["P1"],
      }).expect(201);
      await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Dois",
        personagensNovos: ["P2"],
      }).expect(409);
      expect(await ctx.prisma.solicitacaoVinculo.count()).toBe(1);
    });

    it("CT-77: o banco também impede duas pendentes (índice parcial)", async () => {
      const u = await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId: "2001" } });
      const dados = { usuarioId: u.id, apelidoProposto: "X", personagens: { novos: [] } };
      await ctx.prisma.solicitacaoVinculo.create({ data: dados });
      await expect(ctx.prisma.solicitacaoVinculo.create({ data: dados })).rejects.toThrow();
    });

    it("CT-78: reivindicar jogador que já tem usuário é rejeitado", async () => {
      const ana = await criarJogador("Ana", ["Ana-MTK"]);
      const s = await post("/api/vinculo/solicitacoes", membro, { jogadorId: ana.id }).expect(201);
      await post(`/api/vinculo/solicitacoes/${s.body.id}/aprovar`, admin).expect(200);

      const outro = await ctx.login("2002", "impostor");
      await post("/api/vinculo/solicitacoes", outro, { jogadorId: ana.id }).expect(409);
      const disp = await ctx
        .http()
        .get("/api/vinculo/jogadores-disponiveis")
        .set("Cookie", outro)
        .expect(200);
      expect(disp.body).toEqual([]);
    });

    it("CT-78: duas reivindicações do mesmo jogador — só a primeira aprovação vale", async () => {
      const ana = await criarJogador("Ana");
      const outro = await ctx.login("2003", "outro");
      const s1 = await post("/api/vinculo/solicitacoes", membro, { jogadorId: ana.id }).expect(201);
      const s2 = await post("/api/vinculo/solicitacoes", outro, { jogadorId: ana.id }).expect(201);
      await post(`/api/vinculo/solicitacoes/${s1.body.id}/aprovar`, admin).expect(200);
      await post(`/api/vinculo/solicitacoes/${s2.body.id}/aprovar`, admin).expect(409);
      const pendente = await ctx.prisma.solicitacaoVinculo.findUniqueOrThrow({ where: { id: s2.body.id } });
      expect(pendente.status).toBe("PENDENTE");
    });

    it("rejeição exige motivo; depois o membro pode solicitar de novo", async () => {
      const s = await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Ana",
        personagensNovos: ["A1"],
      }).expect(201);
      await post(`/api/vinculo/solicitacoes/${s.body.id}/rejeitar`, admin, {}).expect(400);
      const r = await post(`/api/vinculo/solicitacoes/${s.body.id}/rejeitar`, admin, {
        motivo: "Personagem errado",
      }).expect(200);
      expect(r.body).toMatchObject({ status: "REJEITADA", motivo: "Personagem errado" });
      await post(`/api/vinculo/solicitacoes/${s.body.id}/aprovar`, admin).expect(409);

      const situacao = await ctx.http().get("/api/vinculo").set("Cookie", membro).expect(200);
      expect(situacao.body.solicitacao).toMatchObject({ status: "REJEITADA", motivo: "Personagem errado" });
      await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Ana",
        personagensNovos: ["A2"],
      }).expect(201);
    });

    it("membro já vinculado não abre nova solicitação", async () => {
      const s = await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Ana",
        personagensNovos: ["A1"],
      }).expect(201);
      await post(`/api/vinculo/solicitacoes/${s.body.id}/aprovar`, admin).expect(200);
      await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Outra",
        personagensNovos: ["A9"],
      }).expect(409);
    });

    it("rejeita pedidos mal formados e conflitos de nome", async () => {
      await criarJogador("Beto", ["Beto-MTK"]);
      const ana = await criarJogador("Ana");
      await post("/api/vinculo/solicitacoes", membro, {}).expect(400);
      await post("/api/vinculo/solicitacoes", membro, { jogadorId: ana.id, apelidoProposto: "X" }).expect(
        400,
      );
      await post("/api/vinculo/solicitacoes", membro, { apelidoProposto: "Sem personagem" }).expect(400);
      await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "beto",
        personagensNovos: ["Z"],
      }).expect(409);
      await post("/api/vinculo/solicitacoes", membro, {
        jogadorId: ana.id,
        personagensNovos: ["BETO-MTK"],
      }).expect(409);
    });

    it("aprovação falha com 409 se o personagem foi cadastrado depois da solicitação", async () => {
      const s = await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Ana",
        personagensNovos: ["Ana-MTK"],
      }).expect(201);
      await criarJogador("Outro", ["Ana-MTK"]);
      await post(`/api/vinculo/solicitacoes/${s.body.id}/aprovar`, admin).expect(409);
      expect(await ctx.prisma.jogador.count({ where: { apelido: "Ana" } })).toBe(0);
    });

    it("membro não aprova nem lista a fila (403)", async () => {
      const s = await post("/api/vinculo/solicitacoes", membro, {
        apelidoProposto: "Ana",
        personagensNovos: ["A1"],
      }).expect(201);
      await post(`/api/vinculo/solicitacoes/${s.body.id}/aprovar`, membro).expect(403);
      await post(`/api/vinculo/solicitacoes/${s.body.id}/rejeitar`, membro, { motivo: "abc" }).expect(403);
    });
  });
});
