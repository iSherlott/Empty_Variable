import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Contexto, criarApp } from "./suporte/app-de-teste.js";

describe("GET /api/saude", () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  it("responde ok sem sessão e carrega o motor de pontuação", async () => {
    const resposta = await ctx.http().get("/api/saude").expect(200);
    expect(resposta.body).toEqual({ status: "ok", motorPontuacao: { base: 100 } });
  });
});
