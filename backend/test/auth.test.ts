// T-08: login com Discord, sessão, guards de papel e bootstrap do admin.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_DISCORD_ID, type Contexto, cookiesDe, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

describe("Autenticação (T-08)", () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await ctx.fechar();
  });
  beforeEach(async () => {
    await ctx.limparBanco();
    ctx.discord.naoMembros.clear();
  });

  it("início do login redireciona ao Discord com state e grava o cookie de state", async () => {
    const r = await ctx.http().get("/api/auth/discord").expect(302);
    const url = new URL(r.headers["location"] as string);
    expect(url.searchParams.get("state")).toMatch(/^[\w-]{20,}$/);
    const cookie = cookiesDe(r).find((c) => c.startsWith("betel_oauth_state="))!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("login completo cria o usuário MEMBRO, a sessão (cookie httpOnly/Secure) e revoga o token do Discord", async () => {
    const cookie = await ctx.login("200000000000000002", "ana");
    const me = await ctx.http().get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body).toMatchObject({
      discordUsername: "ana",
      papel: "MEMBRO",
      jogador: null,
      vinculoPendente: false,
    });
    expect(ctx.discord.revogados).toContain("token-code-200000000000000002");
    const sessoes = await ctx.prisma.sessao.findMany();
    expect(sessoes).toHaveLength(1);
    // O banco guarda o HMAC, nunca o token do cookie.
    expect(cookie).not.toContain(sessoes[0]!.id);
  });

  it("cookie de sessão tem HttpOnly, Secure e SameSite=Lax", async () => {
    ctx.discord.perfis.set("c1", { id: "300", username: "bia", globalName: null, avatar: null });
    const inicio = await ctx.http().get("/api/auth/discord");
    const state = new URL(inicio.headers["location"] as string).searchParams.get("state")!;
    const fim = await ctx
      .http()
      .get(`/api/auth/discord/callback?code=c1&state=${state}`)
      .set("Cookie", cookiesDe(inicio)[0]!.split(";")[0]!);
    expect(fim.headers["location"]).toBe(`${ORIGEM}/`);
    const sessao = cookiesDe(fim).find((c) => c.startsWith("betel_sessao="))!;
    expect(sessao).toMatch(/HttpOnly/);
    expect(sessao).toMatch(/Secure/);
    expect(sessao).toMatch(/SameSite=Lax/);
  });

  it("CT-79: conta fora do servidor do Discord é recusada (D13)", async () => {
    ctx.discord.naoMembros.add("code-400");
    ctx.discord.perfis.set("code-400", { id: "400", username: "intruso", globalName: null, avatar: null });
    const inicio = await ctx.http().get("/api/auth/discord");
    const state = new URL(inicio.headers["location"] as string).searchParams.get("state")!;
    const fim = await ctx
      .http()
      .get(`/api/auth/discord/callback?code=code-400&state=${state}`)
      .set("Cookie", cookiesDe(inicio)[0]!.split(";")[0]!)
      .expect(302);
    expect(fim.headers["location"]).toBe(`${ORIGEM}/login?erro=nao-membro`);
    expect(cookiesDe(fim).some((c) => c.startsWith("betel_sessao="))).toBe(false);
    expect(await ctx.prisma.usuario.count()).toBe(0);
  });

  it("state ausente ou diferente do cookie é recusado (CSRF no OAuth)", async () => {
    ctx.discord.perfis.set("c2", { id: "500", username: "x", globalName: null, avatar: null });
    const inicio = await ctx.http().get("/api/auth/discord");
    const cookieState = cookiesDe(inicio)[0]!.split(";")[0]!;
    const semCookie = await ctx.http().get("/api/auth/discord/callback?code=c2&state=abc").expect(302);
    expect(semCookie.headers["location"]).toBe(`${ORIGEM}/login?erro=falha`);
    const errado = await ctx
      .http()
      .get("/api/auth/discord/callback?code=c2&state=outro-state-qualquer")
      .set("Cookie", cookieState)
      .expect(302);
    expect(errado.headers["location"]).toBe(`${ORIGEM}/login?erro=falha`);
    expect(await ctx.prisma.usuario.count()).toBe(0);
  });

  it("ADMIN_DISCORD_IDS promove o primeiro admin no login", async () => {
    const cookie = await ctx.login(ADMIN_DISCORD_ID, "chefe");
    const me = await ctx.http().get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body.papel).toBe("ADMIN");
  });

  it("sem sessão → 401; sessão inválida → 401", async () => {
    await ctx.http().get("/api/auth/me").expect(401);
    await ctx.http().get("/api/auth/me").set("Cookie", "betel_sessao=forjado").expect(401);
  });

  it("sessão expirada é recusada e apagada", async () => {
    const cookie = await ctx.login("600");
    await ctx.prisma.sessao.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });
    await ctx.http().get("/api/auth/me").set("Cookie", cookie).expect(401);
    expect(await ctx.prisma.sessao.count()).toBe(0);
  });

  it("logout encerra a sessão no servidor", async () => {
    const cookie = await ctx.login("700");
    await ctx.http().post("/api/auth/logout").set("Cookie", cookie).set("Origin", ORIGEM).expect(204);
    await ctx.http().get("/api/auth/me").set("Cookie", cookie).expect(401);
  });

  it("requisições que alteram dados exigem o Origin do sistema", async () => {
    const cookie = await ctx.login("800");
    await ctx.http().post("/api/auth/logout").set("Cookie", cookie).expect(403);
    await ctx
      .http()
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("Origin", "https://malicioso.test")
      .expect(403);
    await ctx.http().get("/api/auth/me").set("Cookie", cookie).expect(200);
  });

  it("membro recebe 403 em rotas de admin; admin acessa", async () => {
    const membro = await ctx.login("900");
    const admin = await ctx.login(ADMIN_DISCORD_ID);
    await ctx.http().get("/api/usuarios").set("Cookie", membro).expect(403);
    await ctx.http().get("/api/jogadores").set("Cookie", membro).expect(403);
    await ctx.http().get("/api/vinculo/solicitacoes").set("Cookie", membro).expect(403);
    await ctx.http().get("/api/usuarios").set("Cookie", admin).expect(200);
  });

  it("admin promove e rebaixa com auditoria; o último admin ativo não pode ser removido", async () => {
    const admin = await ctx.login(ADMIN_DISCORD_ID);
    await ctx.login("1000", "beto");
    const beto = await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId: "1000" } });
    const eu = await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId: ADMIN_DISCORD_ID } });

    await ctx
      .http()
      .patch(`/api/usuarios/${eu.id}`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ papel: "MEMBRO" })
      .expect(409);
    await ctx
      .http()
      .patch(`/api/usuarios/${beto.id}`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ papel: "ADMIN" })
      .expect(200);
    await ctx
      .http()
      .patch(`/api/usuarios/${beto.id}`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ papel: "MEMBRO" })
      .expect(200);

    const trilha = await ctx.prisma.auditoria.findMany({
      where: { entidadeId: beto.id, acao: "USUARIO_ALTERADO" },
    });
    expect(trilha).toHaveLength(2);
  });

  it("usuário desativado perde as sessões e não consegue entrar de novo", async () => {
    const admin = await ctx.login(ADMIN_DISCORD_ID);
    const membro = await ctx.login("1100");
    const u = await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId: "1100" } });
    await ctx
      .http()
      .patch(`/api/usuarios/${u.id}`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ ativo: false })
      .expect(200);
    await ctx.http().get("/api/auth/me").set("Cookie", membro).expect(401);
    await expect(ctx.login("1100")).rejects.toThrow(/erro=inativo/);
  });

  it("login simulado (dev-login) não existe quando desligado", async () => {
    await ctx
      .http()
      .post("/api/auth/dev-login")
      .set("Origin", ORIGEM)
      .send({ discordId: "1", username: "x" })
      .expect(404);
  });
});

describe("Login simulado ligado (AUTH_DEV_LOGIN)", () => {
  let ctx: Contexto;
  beforeAll(async () => {
    ctx = await criarApp({ devLogin: true });
    await ctx.limparBanco();
  });
  afterAll(async () => {
    await ctx.fechar();
  });

  it("cria sessão sem passar pelo Discord", async () => {
    const r = await ctx
      .http()
      .post("/api/auth/dev-login")
      .set("Origin", ORIGEM)
      .send({ discordId: ADMIN_DISCORD_ID, username: "dev" })
      .expect(204);
    const cookie = cookiesDe(r)
      .find((c) => c.startsWith("betel_sessao="))!
      .split(";")[0]!;
    const me = await ctx.http().get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body).toMatchObject({ discordUsername: "dev", papel: "ADMIN" });
  });
});
