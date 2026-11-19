# Implantação na VPS (T-24)

Guia para colocar o Betel no ar numa VPS própria com Docker. Arquivos envolvidos:

| Arquivo | Papel |
|---|---|
| `docker-compose.prod.yml` | Serviços de produção: `caddy`, `web`, `api`, `postgres` e `backup` |
| `infra/caddy/Caddyfile` | HTTPS automático, cabeçalhos de segurança e roteamento (`/api/*` → API, o resto → frontend) |
| `database/backup/*.sh` | Backup diário, teste de restauração e restauração |
| `database/backup/verificar-integridade.sql` | Verificações feitas depois de restaurar |
| `.env.producao.example` | Modelo das variáveis de produção |

## 1. Pré-requisitos

- VPS Linux com Docker Engine e o plugin Compose (`docker compose version`).
- Portas 80 e 443 liberadas no firewall. A porta do Postgres **não** é publicada.
- Um domínio (ou subdomínio) com registro DNS `A`/`AAAA` apontando para a VPS. O Caddy pede o certificado ao Let's Encrypt na primeira subida, e isso só funciona com o DNS já propagado.
- Uma aplicação no portal do Discord (https://discord.com/developers/applications). Passo a passo completo em [`sso-discord.md`](sso-discord.md):
  - Em OAuth2, cadastre o redirect `https://<DOMINIO>/api/auth/discord/callback`.
  - Anote o Client ID e o Client Secret.
  - Anote o ID do servidor do grupo (modo desenvolvedor do Discord → clique direito no servidor → Copiar ID).

## 2. Primeira subida

```bash
git clone <repositório> betel && cd betel
```

```bash
cp .env.producao.example .env.producao
```

Preencha o `.env.producao`:

- `DOMINIO`: o domínio, sem `https://`.
- `POSTGRES_PASSWORD`: gere com `openssl rand -hex 24`. Use só letras e números, porque a senha entra na URL do banco.
- `SESSION_SECRET`: gere com `openssl rand -base64 48`.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `DISCORD_GUILD_ID`.
- `ADMIN_DISCORD_IDS`: o seu ID do Discord (e o de outros admins, separados por vírgula). Quem estiver aqui vira admin ao entrar.

Suba tudo:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao up -d --build
```

Ao subir, a API aplica as migrations pendentes e insere os dados iniciais (parâmetros v1, classes e itens), só se as tabelas estiverem vazias.

Confira:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao ps
```

```bash
curl -fsS https://<DOMINIO>/api/saude
```

Depois, entre em `https://<DOMINIO>` com o Discord. O primeiro acesso de quem está em `ADMIN_DISCORD_IDS` já tem papel de admin.

## 3. Backup

- O serviço `backup` roda `pg_dump` todo dia, no horário de `BACKUP_CRON` (em UTC; o padrão `0 7 * * *` corresponde a 04:00 em Brasília).
- Os arquivos ficam em `BACKUP_DIR` (padrão `./backups`), com nomes como `betel-AAAAMMDD-HHMMSS.dump`.
- Os `BACKUP_RETENCAO` mais recentes são mantidos (padrão 14).
- Um dump que o `pg_restore` não consegue ler é descartado e não entra na rotação.

Backup manual:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao exec backup sh /scripts/backup.sh
```

Ver os logs dos backups:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao logs backup
```

**Recomendação:** copie a pasta de backups para fora da VPS (outro servidor ou armazenamento em nuvem). Um backup que fica só na VPS se perde junto com ela. Isso não foi automatizado, porque depende de onde o grupo quer guardar as cópias.

## 4. Teste de restauração

O teste restaura um backup num banco **temporário**, roda as verificações de integridade e apaga o banco temporário. A produção não é tocada. Recomenda-se rodar uma vez por mês e depois de cada atualização.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao exec backup sh /scripts/testar-restauracao.sh
```

Sem argumento, usa o backup mais recente. Para testar outro, passe o caminho (`/backups/betel-....dump`).

As verificações são:

1. Todas as migrations estão completas.
2. Os triggers que impedem alterar o ledger e os parâmetros estão presentes.
3. O saldo da view é igual à soma dos lançamentos.
4. Em cada run válida, os lançamentos somam os pontos gerados.
5. Cada run estornada tem saldo líquido zero.

## 5. Restaurar a produção

Só em caso de perda de dados. Os passos são estes:

1. Teste o arquivo (seção 4).
2. Pare a API:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.producao stop api
   ```

3. Restaure. O script faz antes um backup do estado atual e recusa rodar sem a confirmação:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.producao exec backup sh /scripts/restaurar.sh /backups/betel-AAAAMMDD-HHMMSS.dump --substituir-producao
   ```

4. Suba a API:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.producao start api
   ```

## 6. Atualizar a versão

```bash
git pull
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao exec backup sh /scripts/backup.sh
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao up -d --build
```

As migrations novas são aplicadas quando a API sobe.

## 7. Segurança

- Só o Caddy expõe portas (80 e 443). API, frontend e banco ficam na rede interna do Compose.
- O Caddy envia HSTS, CSP, `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy`.
- A sessão usa cookie `HttpOnly`, `Secure` e `SameSite=Lax`, e o banco guarda só o HMAC do token. Requisições que alteram dados precisam vir do próprio domínio.
- O login simulado fica desligado em produção, em duas camadas: `AUTH_DEV_LOGIN=false` no Compose, e a API o recusa com `NODE_ENV=production`.
- Para trocar o `SESSION_SECRET`, edite o `.env.producao` e suba de novo. Todas as sessões são invalidadas e cada pessoa precisa entrar outra vez.
