# Banco de dados

O projeto usa PostgreSQL 16. O schema fica em `prisma/schema.prisma` e os scripts SQL versionados em `prisma/migrations`. Aplique-os com o Prisma para registrar as vers?es executadas.

## Inicializa??o

Com o `.env` configurado, rode `docker compose up --build` na raiz. O Compose cria um volume PostgreSQL pr?prio e aguarda a disponibilidade do banco antes de iniciar a API. O cont?iner da API aplica as migra??es e o backend preenche o cat?logo inicial ao subir.

Para usar um PostgreSQL existente, crie um banco vazio, configure `DATABASE_URL` no ambiente com o endere?o desse banco e rode na raiz:

```sh
pnpm install --frozen-lockfile
pnpm --filter @betel/api prisma:generate
pnpm --filter @betel/api migrate:deploy
pnpm build
```

Para rodar a API fora do Docker, use uma URL alcan??vel pelo host. Se subir apenas o PostgreSQL com `docker compose up -d postgres`, use `127.0.0.1:55433` na URL em vez de `postgres:5432`. Carregue tamb?m as vari?veis de origem, sess?o e Discord antes de executar `pnpm --filter @betel/api start`.

A pasta `backup` cont?m os scripts de backup, restaura??o e verifica??o de integridade.
