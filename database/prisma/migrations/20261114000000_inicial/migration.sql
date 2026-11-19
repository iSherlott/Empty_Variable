-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'MEMBRO');

-- CreateEnum
CREATE TYPE "Chefe" AS ENUM ('NAGHT_25', 'BETELGEUSE_50', 'BETELGEUSE_75');

-- CreateEnum
CREATE TYPE "StatusRun" AS ENUM ('CONCLUIDA', 'FALHA_CHEFE', 'ABORTADA', 'ESTORNADA');

-- CreateEnum
CREATE TYPE "CategoriaEmprestimo" AS ENUM ('ESSENCIAL', 'IMPORTANTE', 'COMPLEMENTAR');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('PARTICIPACAO', 'EMPRESTIMO_DEBITO', 'EMPRESTIMO_CREDITO', 'ESTORNO', 'AJUSTE_ADMIN', 'COMPRA', 'VENDA');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "discord_id" TEXT NOT NULL,
    "discord_username" TEXT NOT NULL,
    "global_name" TEXT,
    "avatar" TEXT,
    "papel" "Papel" NOT NULL DEFAULT 'MEMBRO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jogador" (
    "id" UUID NOT NULL,
    "apelido" TEXT NOT NULL,
    "usuario_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jogador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personagem" (
    "id" UUID NOT NULL,
    "jogador_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacao_vinculo" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "jogador_id" UUID,
    "apelido_proposto" TEXT,
    "personagens" JSONB NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "motivo" TEXT,
    "analisada_por" UUID,
    "analisada_em" TIMESTAMPTZ(3),
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classe" (
    "id" UUID NOT NULL,
    "nome_oficial" TEXT NOT NULL,
    "apelido_grupo" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcao_classe" (
    "id" UUID NOT NULL,
    "classe_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "funcao_classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_pontuacao" (
    "id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "base" INTEGER NOT NULL,
    "alpha_centesimos" INTEGER NOT NULL,
    "m_naght_centesimos" INTEGER NOT NULL,
    "m_bet50_centesimos" INTEGER NOT NULL,
    "m_bet75_centesimos" INTEGER NOT NULL,
    "s_concluida_centesimos" INTEGER NOT NULL,
    "s_falha_centesimos" INTEGER NOT NULL,
    "s_abortada_centesimos" INTEGER NOT NULL,
    "pct_essencial_bp" INTEGER NOT NULL,
    "pct_importante_bp" INTEGER NOT NULL,
    "pct_complementar_bp" INTEGER NOT NULL,
    "teto_credores_bp" INTEGER NOT NULL,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_por" UUID,

    CONSTRAINT "config_pontuacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_catalogo" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "id_jogo" INTEGER,
    "tipo" TEXT,
    "negociavel" BOOLEAN,
    "vinculado_conta" BOOLEAN,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "chefe" "Chefe" NOT NULL,
    "status" "StatusRun" NOT NULL,
    "pontuacao_betelgeuse" INTEGER,
    "config_id" UUID NOT NULL,
    "registrada_por" UUID NOT NULL,
    "corrige_run_id" UUID,
    "observacao" TEXT,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacao" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "personagem_id" UUID NOT NULL,
    "jogador_id" UUID NOT NULL,
    "funcao_id" UUID NOT NULL,
    "fracao_centesimos" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "base" INTEGER NOT NULL,
    "alpha_centesimos" INTEGER NOT NULL,
    "peso_centesimos" INTEGER NOT NULL,
    "m_chefe_centesimos" INTEGER NOT NULL,
    "s_status_centesimos" INTEGER NOT NULL,
    "pontos_gerados" INTEGER NOT NULL,

    CONSTRAINT "participacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emprestimo" (
    "id" UUID NOT NULL,
    "participacao_id" UUID NOT NULL,
    "tomador_jogador_id" UUID NOT NULL,
    "credor_jogador_id" UUID NOT NULL,
    "item_id" UUID,
    "item_descricao" TEXT,
    "categoria" "CategoriaEmprestimo" NOT NULL,
    "pct_sugerido_bp" INTEGER NOT NULL,
    "pct_informado_bp" INTEGER,
    "pct_efetivo" DECIMAL(9,6) NOT NULL,
    "pontos" INTEGER NOT NULL,

    CONSTRAINT "emprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drop_run" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "drop_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_pontos" (
    "id" UUID NOT NULL,
    "jogador_id" UUID NOT NULL,
    "valor" INTEGER NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "criado_por" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_id" UUID,
    "participacao_id" UUID,
    "emprestimo_id" UUID,
    "estorna_lancamento_id" UUID,
    "observacao" TEXT,

    CONSTRAINT "lancamento_pontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_discord_id_key" ON "usuario"("discord_id");

-- CreateIndex
CREATE INDEX "sessao_usuario_id_idx" ON "sessao"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "jogador_apelido_key" ON "jogador"("apelido");

-- CreateIndex
CREATE UNIQUE INDEX "jogador_usuario_id_key" ON "jogador"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "personagem_nome_key" ON "personagem"("nome");

-- CreateIndex
CREATE INDEX "personagem_jogador_id_idx" ON "personagem"("jogador_id");

-- CreateIndex
CREATE INDEX "solicitacao_vinculo_usuario_id_idx" ON "solicitacao_vinculo"("usuario_id");

-- CreateIndex
CREATE INDEX "solicitacao_vinculo_status_idx" ON "solicitacao_vinculo"("status");

-- CreateIndex
CREATE UNIQUE INDEX "classe_nome_oficial_key" ON "classe"("nome_oficial");

-- CreateIndex
CREATE UNIQUE INDEX "funcao_classe_classe_id_nome_key" ON "funcao_classe"("classe_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "config_pontuacao_versao_key" ON "config_pontuacao"("versao");

-- CreateIndex
CREATE UNIQUE INDEX "item_catalogo_nome_key" ON "item_catalogo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "item_catalogo_id_jogo_key" ON "item_catalogo"("id_jogo");

-- CreateIndex
CREATE UNIQUE INDEX "run_corrige_run_id_key" ON "run"("corrige_run_id");

-- CreateIndex
CREATE INDEX "run_data_idx" ON "run"("data");

-- CreateIndex
CREATE UNIQUE INDEX "participacao_run_id_personagem_id_key" ON "participacao"("run_id", "personagem_id");

-- CreateIndex
CREATE UNIQUE INDEX "participacao_id_jogador_id_key" ON "participacao"("id", "jogador_id");

-- CreateIndex
CREATE INDEX "emprestimo_participacao_id_idx" ON "emprestimo"("participacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamento_pontos_estorna_lancamento_id_key" ON "lancamento_pontos"("estorna_lancamento_id");

-- CreateIndex
CREATE INDEX "lancamento_pontos_jogador_id_criado_em_idx" ON "lancamento_pontos"("jogador_id", "criado_em");

-- CreateIndex
CREATE INDEX "lancamento_pontos_run_id_idx" ON "lancamento_pontos"("run_id");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidade_id_idx" ON "auditoria"("entidade", "entidade_id");

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogador" ADD CONSTRAINT "jogador_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personagem" ADD CONSTRAINT "personagem_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_vinculo" ADD CONSTRAINT "solicitacao_vinculo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_vinculo" ADD CONSTRAINT "solicitacao_vinculo_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "jogador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_vinculo" ADD CONSTRAINT "solicitacao_vinculo_analisada_por_fkey" FOREIGN KEY ("analisada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcao_classe" ADD CONSTRAINT "funcao_classe_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_pontuacao" ADD CONSTRAINT "config_pontuacao_criada_por_fkey" FOREIGN KEY ("criada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "config_pontuacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_registrada_por_fkey" FOREIGN KEY ("registrada_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_corrige_run_id_fkey" FOREIGN KEY ("corrige_run_id") REFERENCES "run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao" ADD CONSTRAINT "participacao_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao" ADD CONSTRAINT "participacao_personagem_id_fkey" FOREIGN KEY ("personagem_id") REFERENCES "personagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao" ADD CONSTRAINT "participacao_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao" ADD CONSTRAINT "participacao_funcao_id_fkey" FOREIGN KEY ("funcao_id") REFERENCES "funcao_classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimo" ADD CONSTRAINT "emprestimo_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimo" ADD CONSTRAINT "emprestimo_credor_jogador_id_fkey" FOREIGN KEY ("credor_jogador_id") REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimo" ADD CONSTRAINT "emprestimo_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_run" ADD CONSTRAINT "drop_run_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_run" ADD CONSTRAINT "drop_run_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_emprestimo_id_fkey" FOREIGN KEY ("emprestimo_id") REFERENCES "emprestimo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_estorna_lancamento_id_fkey" FOREIGN KEY ("estorna_lancamento_id") REFERENCES "lancamento_pontos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =====================================================================
-- Regras de banco que o Prisma não expressa (T-07). Mantidas à mão.
-- =====================================================================

-- Unicidade sem diferenciar maiúsculas de minúsculas
CREATE UNIQUE INDEX "jogador_apelido_lower_key" ON "jogador" (lower("apelido"));
CREATE UNIQUE INDEX "personagem_nome_lower_key" ON "personagem" (lower("nome"));

-- D12: no máximo uma solicitação PENDENTE por usuário (CT-77)
CREATE UNIQUE INDEX "solicitacao_vinculo_uma_pendente_key"
  ON "solicitacao_vinculo" ("usuario_id") WHERE "status" = 'PENDENTE';
-- Alvo: jogador existente ou apelido proposto. Ao aprovar um apelido novo, jogador_id passa a apontar para o jogador criado.
ALTER TABLE "solicitacao_vinculo" ADD CONSTRAINT "solicitacao_vinculo_alvo_check"
  CHECK ("jogador_id" IS NOT NULL OR "apelido_proposto" IS NOT NULL);
ALTER TABLE "solicitacao_vinculo" ADD CONSTRAINT "solicitacao_vinculo_rejeicao_motivo_check"
  CHECK ("status" <> 'REJEITADA' OR "motivo" IS NOT NULL);

-- Funções: rank 1–5 e uma única função padrão por classe
ALTER TABLE "funcao_classe" ADD CONSTRAINT "funcao_classe_rank_check" CHECK ("rank" BETWEEN 1 AND 5);
CREATE UNIQUE INDEX "funcao_classe_um_padrao_key" ON "funcao_classe" ("classe_id") WHERE "padrao";

-- Parâmetros de pontuação
ALTER TABLE "config_pontuacao" ADD CONSTRAINT "config_pontuacao_valores_check" CHECK (
  "versao" > 0 AND "base" >= 0 AND "alpha_centesimos" >= 0
  AND "m_naght_centesimos" >= 0 AND "m_bet50_centesimos" >= 0 AND "m_bet75_centesimos" >= 0
  AND "s_concluida_centesimos" >= 0 AND "s_falha_centesimos" >= 0 AND "s_abortada_centesimos" >= 0
  AND "pct_essencial_bp" BETWEEN 0 AND 10000 AND "pct_importante_bp" BETWEEN 0 AND 10000
  AND "pct_complementar_bp" BETWEEN 0 AND 10000 AND "teto_credores_bp" BETWEEN 0 AND 10000
);

-- Participação: snapshot coerente
ALTER TABLE "participacao" ADD CONSTRAINT "participacao_valores_check" CHECK (
  "rank" BETWEEN 1 AND 5 AND "fracao_centesimos" IN (0, 50, 100) AND "pontos_gerados" >= 0
  AND "base" >= 0 AND "alpha_centesimos" >= 0 AND "peso_centesimos" >= 0
  AND "m_chefe_centesimos" >= 0 AND "s_status_centesimos" >= 0
);

-- Empréstimo: credor ≠ tomador por jogador (C3), tomador coerente com a participação
ALTER TABLE "emprestimo" ADD CONSTRAINT "emprestimo_participacao_tomador_fkey"
  FOREIGN KEY ("participacao_id", "tomador_jogador_id")
  REFERENCES "participacao" ("id", "jogador_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emprestimo" ADD CONSTRAINT "emprestimo_valores_check" CHECK (
  "credor_jogador_id" <> "tomador_jogador_id"
  AND ("item_id" IS NOT NULL OR "item_descricao" IS NOT NULL)
  AND "pct_sugerido_bp" BETWEEN 0 AND 10000
  AND ("pct_informado_bp" IS NULL OR "pct_informado_bp" BETWEEN 0 AND 10000)
  AND "pontos" >= 0
);

-- Drops: quantidade inteira positiva (CT-61)
ALTER TABLE "drop_run" ADD CONSTRAINT "drop_run_quantidade_check" CHECK ("quantidade" > 0);

-- Ledger: sem lançamentos de valor zero (C5)
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_valor_check" CHECK ("valor" <> 0);

-- Tabelas imutáveis: ledger (A2, CT-68) e versões de parâmetros (US-02)
CREATE FUNCTION "bloquear_alteracao"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % só aceita inclusão (% bloqueado)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "lancamento_pontos_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "lancamento_pontos"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "lancamento_pontos_sem_truncate"
  BEFORE TRUNCATE ON "lancamento_pontos"
  FOR EACH STATEMENT EXECUTE FUNCTION "bloquear_alteracao"();

CREATE TRIGGER "config_pontuacao_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "config_pontuacao"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();

-- Saldo por jogador (US-06)
CREATE VIEW "saldo_jogador" AS
  SELECT j."id" AS "jogador_id", COALESCE(SUM(l."valor"), 0)::bigint AS "saldo"
  FROM "jogador" j
  LEFT JOIN "lancamento_pontos" l ON l."jogador_id" = j."id"
  GROUP BY j."id";
