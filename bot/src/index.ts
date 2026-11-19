export interface DiscordOAuthConfig {
  clientId: string;
  clientSecret: string;
  guildId: string;
  redirectUri: string;
}

export interface PerfilDiscord {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

/** Abstração da API do Discord, substituída por um dublê nos testes. */
export interface DiscordCliente {
  urlAutorizacao(state: string): string;
  trocarCodigo(code: string): Promise<string>;
  obterPerfil(accessToken: string): Promise<PerfilDiscord>;
  /** true se o usuário é membro do servidor do grupo; false se o Discord responde 404 (D13). */
  ehMembroDoServidor(accessToken: string): Promise<boolean>;
  revogar(accessToken: string): Promise<void>;
}

const API = "https://discord.com/api/v10";
/** Escopos mínimos (arquitetura §5). Não pedimos e-mail. */
const ESCOPOS = "identify guilds.members.read";

export class ErroDiscord extends Error {}

export class DiscordClienteHttp implements DiscordCliente {
  constructor(private readonly config: DiscordOAuthConfig | null) {}

  private get discord() {
    if (this.config === null) throw new ErroDiscord("Login com Discord não configurado.");
    return this.config;
  }

  urlAutorizacao(state: string): string {
    const p = new URLSearchParams({
      response_type: "code",
      client_id: this.discord.clientId,
      scope: ESCOPOS,
      redirect_uri: this.discord.redirectUri,
      state,
      prompt: "none",
    });
    return `https://discord.com/oauth2/authorize?${p.toString()}`;
  }

  async trocarCodigo(code: string): Promise<string> {
    const resposta = await fetch(`${API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.discord.redirectUri,
        client_id: this.discord.clientId,
        client_secret: this.discord.clientSecret,
      }),
    });
    if (!resposta.ok) throw new ErroDiscord(`Troca do código falhou (${resposta.status}).`);
    const corpo = (await resposta.json()) as { access_token?: unknown };
    if (typeof corpo.access_token !== "string") throw new ErroDiscord("Resposta do token sem access_token.");
    return corpo.access_token;
  }

  async obterPerfil(accessToken: string): Promise<PerfilDiscord> {
    const resposta = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resposta.ok) throw new ErroDiscord(`Consulta do perfil falhou (${resposta.status}).`);
    const u = (await resposta.json()) as Record<string, unknown>;
    if (typeof u["id"] !== "string" || typeof u["username"] !== "string") {
      throw new ErroDiscord("Perfil do Discord inválido.");
    }
    return {
      id: u["id"],
      username: u["username"],
      globalName: typeof u["global_name"] === "string" ? u["global_name"] : null,
      avatar: typeof u["avatar"] === "string" ? u["avatar"] : null,
    };
  }

  async ehMembroDoServidor(accessToken: string): Promise<boolean> {
    const resposta = await fetch(`${API}/users/@me/guilds/${this.discord.guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (resposta.status === 404) return false;
    if (!resposta.ok) throw new ErroDiscord(`Consulta de membro falhou (${resposta.status}).`);
    return true;
  }

  async revogar(accessToken: string): Promise<void> {
    await fetch(`${API}/oauth2/token/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: "access_token",
        client_id: this.discord.clientId,
        client_secret: this.discord.clientSecret,
      }),
    }).catch(() => undefined);
  }
}
