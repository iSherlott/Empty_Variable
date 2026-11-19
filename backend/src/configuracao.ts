/** Configuração lida do ambiente (ver .env.example). Injetada pelo token CONFIGURACAO. */
export interface Configuracao {
  /** Origem pública do sistema (ex.: https://betel.exemplo.com). Usada no redirect pós-login e na checagem de Origin. */
  appOrigin: string;
  sessionSecret: string;
  /** Cookies com a flag Secure. Só desligue em desenvolvimento sem HTTPS. */
  cookieSecure: boolean;
  /** IDs do Discord que viram ADMIN ao entrar (bootstrap do primeiro admin). */
  adminDiscordIds: ReadonlySet<string>;
  /** null quando o OAuth do Discord não está configurado. */
  discord: { clientId: string; clientSecret: string; guildId: string; redirectUri: string } | null;
  /** Login simulado (POST /api/auth/dev-login). Nunca fica ativo com NODE_ENV=production. */
  devLogin: boolean;
}

export const CONFIGURACAO = Symbol("CONFIGURACAO");

const MIN_SEGREDO = 32;

export function carregarConfiguracao(env: NodeJS.ProcessEnv = process.env): Configuracao {
  const sessionSecret = env["SESSION_SECRET"] ?? "";
  if (sessionSecret.length < MIN_SEGREDO) {
    throw new Error(`SESSION_SECRET precisa ter pelo menos ${MIN_SEGREDO} caracteres.`);
  }
  const appOrigin = (env["APP_ORIGIN"] ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+$/.test(appOrigin)) {
    throw new Error("APP_ORIGIN precisa ser uma origem (ex.: https://betel.exemplo.com), sem caminho.");
  }
  const clientId = env["DISCORD_CLIENT_ID"] ?? "";
  const clientSecret = env["DISCORD_CLIENT_SECRET"] ?? "";
  const guildId = env["DISCORD_GUILD_ID"] ?? "";
  const redirectUri = env["DISCORD_REDIRECT_URI"] || `${appOrigin}/api/auth/discord/callback`;
  const discordCompleto = clientId !== "" && clientSecret !== "" && guildId !== "";

  return {
    appOrigin,
    sessionSecret,
    cookieSecure: env["COOKIE_SECURE"] !== "false",
    adminDiscordIds: new Set(
      (env["ADMIN_DISCORD_IDS"] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== ""),
    ),
    discord: discordCompleto ? { clientId, clientSecret, guildId, redirectUri } : null,
    devLogin: env["AUTH_DEV_LOGIN"] === "true" && env["NODE_ENV"] !== "production",
  };
}
