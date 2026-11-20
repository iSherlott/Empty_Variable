# Login com o Discord (SSO)

O sistema não tem senha própria. Todo mundo entra com a conta do Discord (OAuth2), e só quem é membro do servidor do grupo consegue entrar (D13). O login local com uma conta real foi confirmado pelo responsável pelo grupo em 2026-11-18.

## 1. Criar a aplicação no Discord

1. Abra https://discord.com/developers/applications e clique em **New Application**. Dê um nome, por exemplo "Empty Variable".
2. Em **OAuth2**:
   - copie o **Client ID**;
   - clique em **Reset Secret** e copie o **Client Secret**. Ele só aparece uma vez; guarde num gerenciador de senhas;
   - em **Redirects**, cadastre a URL de retorno de cada ambiente (veja a tabela abaixo). Ela precisa ser idêntica, inclusive o `http`/`https` e a porta.
3. Não é preciso criar bot nem marcar escopos no portal. O sistema pede só `identify` e `guilds.members.read`: o nome, o avatar e a confirmação de que a pessoa está no servidor. Nada de e-mail.

| Ambiente | `APP_ORIGIN` | Redirect a cadastrar |
|---|---|---|
| Produção | `https://<seu-domínio>` | `https://<seu-domínio>/api/auth/discord/callback` |
| Produção numa sub-rota (`APP_BASE_PATH=/emptyvariable`) | `https://<domínio>` | `https://<domínio>/emptyvariable/api/auth/discord/callback` |
| Local com Docker | `http://localhost:4200` | `http://localhost:4200/api/auth/discord/callback` |
| Local com `ng serve` | `http://localhost:4200` | `http://localhost:4200/api/auth/discord/callback` |

## 2. Pegar os IDs no Discord

Ative o modo desenvolvedor: **Configurações do usuário → Avançado → Modo desenvolvedor**.

- **ID do servidor do grupo** (`DISCORD_GUILD_ID`): clique com o botão direito no servidor → **Copiar ID do servidor**.
- **IDs dos admins** (`ADMIN_DISCORD_IDS`): clique com o botão direito no seu nome → **Copiar ID do usuário**. Para mais de um admin, separe por vírgula.

## 3. Preencher o `.env`

Na raiz do repositório (produção: `.env` na VPS, a partir de `.env.producao.example`):

```dotenv
APP_ORIGIN=https://<seu-domínio>
COOKIE_SECURE=true          # false só em ambiente local sem HTTPS
DISCORD_CLIENT_ID=<Client ID>
DISCORD_CLIENT_SECRET=<Client Secret>
DISCORD_GUILD_ID=<ID do servidor>
ADMIN_DISCORD_IDS=<seu ID>,<ID de outro admin>
AUTH_DEV_LOGIN=false        # o login simulado nunca fica ligado em produção
```

O `.env` não vai para o git (está no `.gitignore`). Não cole o segredo em chats nem em issues.

## 4. Conferir

```bash
pnpm --filter @betel/api build
pnpm --filter @betel/api sso:verificar
```

O verificador:
- confere as variáveis e o formato dos IDs;
- testa com o próprio Discord se o Client ID e o Secret batem;
- mostra a URL de redirect que precisa estar cadastrada no portal.

O segredo nunca é impresso. Na produção com Docker, rode o mesmo comando dentro do contêiner da API ou confira o aviso "SSO" no log da API: ela também lista no boot o que estiver faltando.

## 5. Primeiro acesso

1. Abra o `APP_ORIGIN` e clique em **Entrar com Discord**.
2. O Discord pede a autorização. Depois, a pessoa volta logada.
3. Quem está em `ADMIN_DISCORD_IDS` já entra como admin. Os demais membros pedem o vínculo com um jogador, e o admin aprova em **Jogadores**.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Login com Discord não configurado" (503) | Falta `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` ou `DISCORD_GUILD_ID` |
| O Discord mostra "Invalid OAuth2 redirect_uri" | A URL de redirect do portal não é idêntica à do verificador |
| Volta para o login com "Acesso restrito aos membros do servidor do Discord do grupo" | A conta não está no servidor de `DISCORD_GUILD_ID`, ou o ID é de outro servidor |
| "Não foi possível entrar com o Discord" | Client Secret errado ou trocado no portal: rode o verificador |
| O login funciona, mas a sessão some | `COOKIE_SECURE=true` sem HTTPS, ou `APP_ORIGIN` diferente do endereço usado no navegador |
