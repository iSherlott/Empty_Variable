// Diagnóstico da configuração do login com o Discord (SSO), sem rede.
import { describe, expect, it } from "vitest";
import {
  diagnosticarConfiguracao,
  redirectEsperado,
  validarCredenciais,
} from "../src/auth/diagnostico-sso.js";
import { carregarConfiguracao } from "../src/configuracao.js";

const COMPLETO = {
  APP_ORIGIN: "https://betel.exemplo.com",
  SESSION_SECRET: "x".repeat(48),
  COOKIE_SECURE: "true",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "segredo-de-teste",
  DISCORD_GUILD_ID: "223456789012345678",
  ADMIN_DISCORD_IDS: "323456789012345678, 423456789012345678",
};

const niveis = (env: Record<string, string>) => diagnosticarConfiguracao(env).map((i) => i.nivel);

describe("diagnóstico do SSO", () => {
  it("configuração completa não tem erro nem aviso, e o segredo nunca aparece", () => {
    const itens = diagnosticarConfiguracao(COMPLETO);
    expect(itens.every((i) => i.nivel === "ok")).toBe(true);
    expect(JSON.stringify(itens)).not.toContain("segredo-de-teste");
    expect(redirectEsperado(COMPLETO)).toBe("https://betel.exemplo.com/api/auth/discord/callback");
  });

  it("aponta o que falta ou está errado", () => {
    const itens = diagnosticarConfiguracao({
      ...COMPLETO,
      DISCORD_CLIENT_SECRET: "",
      DISCORD_GUILD_ID: "servidor",
      ADMIN_DISCORD_IDS: "",
      COOKIE_SECURE: "false",
      AUTH_DEV_LOGIN: "true",
    });
    const textos = itens.filter((i) => i.nivel !== "ok").map((i) => i.texto);
    expect(textos).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DISCORD_CLIENT_SECRET vazio"),
        expect.stringContaining("DISCORD_GUILD_ID não parece"),
        expect.stringContaining("ninguém vira admin"),
        expect.stringContaining("COOKIE_SECURE=true"),
        expect.stringContaining("AUTH_DEV_LOGIN=true"),
      ]),
    );
  });

  it("redirect fora da origem gera aviso; local sem HTTPS pode ter COOKIE_SECURE=false", () => {
    expect(niveis({ ...COMPLETO, DISCORD_REDIRECT_URI: "https://outro.com/cb" })).toContain("aviso");
    expect(
      niveis({
        ...COMPLETO,
        APP_ORIGIN: "http://localhost:8080",
        COOKIE_SECURE: "false",
        AUTH_DEV_LOGIN: "true",
      }),
    ).not.toContain("aviso");
  });

  it("sub-rota: APP_BASE_PATH entra no redirect esperado e é validado", () => {
    const env = { ...COMPLETO, APP_BASE_PATH: "/emptyvariable/" };
    expect(redirectEsperado(env)).toBe("https://betel.exemplo.com/emptyvariable/api/auth/discord/callback");
    expect(diagnosticarConfiguracao(env).every((i) => i.nivel === "ok")).toBe(true);
    expect(niveis({ ...COMPLETO, APP_BASE_PATH: "sem-barra" })).toContain("erro");
    // Um redirect na raiz não recebe o cookie de state, que fica restrito à sub-rota.
    expect(
      niveis({ ...env, DISCORD_REDIRECT_URI: "https://betel.exemplo.com/api/auth/discord/callback" }),
    ).toContain("aviso");
  });

  it("a configuração da API lê APP_BASE_PATH (vazio = raiz) e recusa um caminho inválido", () => {
    expect(carregarConfiguracao(COMPLETO).caminhoBase).toBe("");
    const naSubRota = carregarConfiguracao({ ...COMPLETO, APP_BASE_PATH: "/emptyvariable/" });
    expect(naSubRota.caminhoBase).toBe("/emptyvariable");
    expect(naSubRota.discord?.redirectUri).toBe(
      "https://betel.exemplo.com/emptyvariable/api/auth/discord/callback",
    );
    expect(() => carregarConfiguracao({ ...COMPLETO, APP_BASE_PATH: "emptyvariable" })).toThrow(
      /APP_BASE_PATH/,
    );
  });

  it("valida as credenciais no endpoint de token do Discord, com Basic auth", async () => {
    let pedido: { url: string; init: RequestInit } | null = null;
    const ok = await validarCredenciais(COMPLETO, async (url, init) => {
      pedido = { url, init };
      return { status: 200 };
    });
    expect(ok.nivel).toBe("ok");
    expect(pedido!.url).toBe("https://discord.com/api/v10/oauth2/token");
    expect((pedido!.init.headers as Record<string, string>)["Authorization"]).toBe(
      `Basic ${Buffer.from("123456789012345678:segredo-de-teste").toString("base64")}`,
    );
    expect((await validarCredenciais(COMPLETO, async () => ({ status: 401 }))).nivel).toBe("erro");
    expect(
      (
        await validarCredenciais(COMPLETO, async () => {
          throw new Error("offline");
        })
      ).nivel,
    ).toBe("aviso");
  });
});
