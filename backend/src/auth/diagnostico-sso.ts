// Diagnóstico da configuração do login com o Discord (SSO). Usado pelo script `sso:verificar`
// e pelo aviso no boot da API. Nunca imprime o segredo.

export type Nivel = "ok" | "aviso" | "erro";

export interface ItemDiagnostico {
  nivel: Nivel;
  texto: string;
}

/** IDs do Discord são "snowflakes": só dígitos, de 17 a 20. */
const SNOWFLAKE = /^\d{17,20}$/;

type Env = Record<string, string | undefined>;
type Buscar = (url: string, init: RequestInit) => Promise<{ status: number }>;

const origemDe = (env: Env) => (env["APP_ORIGIN"] ?? "").replace(/\/+$/, "");
const caminhoBaseBruto = (env: Env) => (env["APP_BASE_PATH"] ?? "").trim().replace(/\/+$/, "");

/** URL que precisa estar cadastrada em OAuth2 → Redirects no portal do Discord. */
export function redirectEsperado(env: Env): string {
  return env["DISCORD_REDIRECT_URI"] || `${origemDe(env)}${caminhoBaseBruto(env)}/api/auth/discord/callback`;
}

/** Checagens locais, sem rede. */
export function diagnosticarConfiguracao(env: Env): ItemDiagnostico[] {
  const r: ItemDiagnostico[] = [];
  const origem = origemDe(env);
  const https = origem.startsWith("https://");

  if (!/^https?:\/\/[^/]+$/.test(origem)) {
    r.push({ nivel: "erro", texto: "APP_ORIGIN precisa ser só a origem, ex.: https://betel.seudominio.com" });
  } else {
    r.push({ nivel: "ok", texto: `APP_ORIGIN = ${origem}` });
  }
  const caminhoBase = caminhoBaseBruto(env);
  if (caminhoBase !== "") {
    if (/^(\/[A-Za-z0-9._~-]+)+$/.test(caminhoBase)) {
      r.push({ nivel: "ok", texto: `APP_BASE_PATH = ${caminhoBase} (sistema servido numa sub-rota)` });
    } else {
      r.push({ nivel: "erro", texto: 'APP_BASE_PATH precisa ser um caminho como "/emptyvariable".' });
    }
  }
  if ((env["SESSION_SECRET"] ?? "").length < 32) {
    r.push({
      nivel: "erro",
      texto: "SESSION_SECRET precisa ter pelo menos 32 caracteres (openssl rand -base64 48).",
    });
  }

  const id = env["DISCORD_CLIENT_ID"] ?? "";
  if (id === "") r.push({ nivel: "erro", texto: "DISCORD_CLIENT_ID vazio (portal → OAuth2 → Client ID)." });
  else if (!SNOWFLAKE.test(id))
    r.push({ nivel: "erro", texto: "DISCORD_CLIENT_ID não parece um ID do Discord (só dígitos)." });
  else r.push({ nivel: "ok", texto: `DISCORD_CLIENT_ID = ${id}` });

  const segredo = env["DISCORD_CLIENT_SECRET"] ?? "";
  if (segredo === "")
    r.push({ nivel: "erro", texto: "DISCORD_CLIENT_SECRET vazio (portal → OAuth2 → Reset Secret)." });
  else r.push({ nivel: "ok", texto: "DISCORD_CLIENT_SECRET preenchido." });

  const guild = env["DISCORD_GUILD_ID"] ?? "";
  if (guild === "")
    r.push({ nivel: "erro", texto: "DISCORD_GUILD_ID vazio: só membros desse servidor entram (D13)." });
  else if (!SNOWFLAKE.test(guild))
    r.push({ nivel: "erro", texto: "DISCORD_GUILD_ID não parece um ID do Discord (só dígitos)." });
  else r.push({ nivel: "ok", texto: `DISCORD_GUILD_ID = ${guild}` });

  const admins = (env["ADMIN_DISCORD_IDS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (admins.length === 0) {
    r.push({ nivel: "aviso", texto: "ADMIN_DISCORD_IDS vazio: ninguém vira admin ao entrar." });
  } else if (admins.some((a) => !SNOWFLAKE.test(a))) {
    r.push({ nivel: "erro", texto: "ADMIN_DISCORD_IDS tem um valor que não é ID do Discord." });
  } else {
    r.push({ nivel: "ok", texto: `${admins.length} admin(s) em ADMIN_DISCORD_IDS.` });
  }

  const redirect = redirectEsperado(env);
  if (origem !== "" && !redirect.startsWith(`${origem}${caminhoBase}/`)) {
    r.push({
      nivel: "aviso",
      texto: `DISCORD_REDIRECT_URI (${redirect}) não está em APP_ORIGIN${caminhoBase === "" ? "" : " + APP_BASE_PATH"}: o cookie da sessão não vai valer.`,
    });
  }
  if (https && env["COOKIE_SECURE"] === "false") {
    r.push({ nivel: "aviso", texto: "Com HTTPS, deixe COOKIE_SECURE=true." });
  }
  if (https && env["AUTH_DEV_LOGIN"] === "true") {
    r.push({
      nivel: "erro",
      texto: "AUTH_DEV_LOGIN=true num endereço HTTPS: desligue o login simulado em produção.",
    });
  }
  return r;
}

/**
 * Confere com o próprio Discord se o Client ID e o Secret batem (grant client_credentials).
 * O segredo só vai para o endpoint oficial de token do Discord.
 */
export async function validarCredenciais(env: Env, buscar: Buscar = fetch): Promise<ItemDiagnostico> {
  const id = env["DISCORD_CLIENT_ID"] ?? "";
  const segredo = env["DISCORD_CLIENT_SECRET"] ?? "";
  if (id === "" || segredo === "")
    return { nivel: "erro", texto: "Sem Client ID e Secret, não dá para validar no Discord." };
  try {
    const r = await buscar("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${id}:${segredo}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "identify" }).toString(),
    });
    if (r.status === 200) return { nivel: "ok", texto: "O Discord aceitou o Client ID e o Secret." };
    if (r.status === 401) return { nivel: "erro", texto: "O Discord recusou o Client ID ou o Secret (401)." };
    return { nivel: "aviso", texto: `O Discord respondeu ${r.status} ao validar as credenciais.` };
  } catch {
    return {
      nivel: "aviso",
      texto: "Não foi possível falar com o Discord para validar as credenciais (rede).",
    };
  }
}
