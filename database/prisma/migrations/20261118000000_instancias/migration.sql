-- Épico IV, M15 (T-57): instâncias com encontros e funções versionados (D43 a D46).
-- A Torre da Constelação vira a instância v1 com os dados de hoje; nenhum ponto do histórico muda
-- (cada participação já guarda o multiplicador e o rank usados, D2).

-- ---------------------------------------------------------------------------
-- 1. Tipos e tabelas novas
-- ---------------------------------------------------------------------------
CREATE TYPE "RetornoInstancia" AS ENUM ('DIARIO', 'TRES_DIAS', 'HORAS', 'SEMANAL', 'OUTRO');
CREATE TYPE "ModoInstancia" AS ENUM ('SOLO', 'GRUPO');
CREATE TYPE "DificuldadeInstancia" AS ENUM ('FACIL', 'MEDIA', 'DIFICIL');

CREATE TABLE "instancia" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "nivel_minimo" INTEGER,
    "retorno" "RetornoInstancia",
    "modo" "ModoInstancia",
    "dificuldade" "DificuldadeInstancia",
    "requisito" TEXT,
    "premiacao" TEXT,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instancia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instancia_nome_key" ON "instancia"("nome");
CREATE UNIQUE INDEX "instancia_nome_lower_key" ON "instancia" (lower("nome"));
CREATE UNIQUE INDEX "instancia_codigo_key" ON "instancia"("codigo");
ALTER TABLE "instancia" ADD CONSTRAINT "instancia_nivel_check" CHECK (
  "nivel_minimo" IS NULL OR "nivel_minimo" BETWEEN 1 AND 300
);

CREATE TABLE "versao_instancia" (
    "id" UUID NOT NULL,
    "instancia_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_por" UUID,

    CONSTRAINT "versao_instancia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "versao_instancia_instancia_id_versao_key" ON "versao_instancia"("instancia_id", "versao");
ALTER TABLE "versao_instancia" ADD CONSTRAINT "versao_instancia_versao_check" CHECK ("versao" > 0);
ALTER TABLE "versao_instancia" ADD CONSTRAINT "versao_instancia_instancia_id_fkey"
  FOREIGN KEY ("instancia_id") REFERENCES "instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "versao_instancia" ADD CONSTRAINT "versao_instancia_criada_por_fkey"
  FOREIGN KEY ("criada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "encontro" (
    "id" UUID NOT NULL,
    "versao_instancia_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "multiplicador_centesimos" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "encontro_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "encontro_versao_nome_lower_key" ON "encontro" ("versao_instancia_id", lower("nome"));
CREATE UNIQUE INDEX "encontro_versao_instancia_id_nome_key" ON "encontro"("versao_instancia_id", "nome");
CREATE UNIQUE INDEX "encontro_id_versao_instancia_id_key" ON "encontro"("id", "versao_instancia_id");
ALTER TABLE "encontro" ADD CONSTRAINT "encontro_valores_check" CHECK (
  "multiplicador_centesimos" > 0 AND "ordem" > 0
);
ALTER TABLE "encontro" ADD CONSTRAINT "encontro_versao_instancia_id_fkey"
  FOREIGN KEY ("versao_instancia_id") REFERENCES "versao_instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. A Torre da Constelação, v1, com os multiplicadores da config vigente
--    (sem config ainda — banco novo — valem os aprovados na D2/D3: 1, 1,5 e 2).
-- ---------------------------------------------------------------------------
INSERT INTO "instancia" ("id", "nome", "codigo", "ativa", "nivel_minimo", "retorno", "modo", "dificuldade", "premiacao")
VALUES (gen_random_uuid(), 'Torre da Constelação', 'TORRE_CONSTELACAO', true, 240, 'TRES_DIAS', 'GRUPO', 'DIFICIL', 'Pó de Meteorito');

INSERT INTO "versao_instancia" ("id", "instancia_id", "versao")
SELECT gen_random_uuid(), "id", 1 FROM "instancia" WHERE "codigo" = 'TORRE_CONSTELACAO';

WITH torre AS (
  SELECT v."id" AS versao_id
  FROM "versao_instancia" v JOIN "instancia" i ON i."id" = v."instancia_id"
  WHERE i."codigo" = 'TORRE_CONSTELACAO' AND v."versao" = 1
), cfg AS (
  SELECT
    COALESCE((SELECT "m_naght_centesimos" FROM "config_pontuacao" ORDER BY "versao" DESC LIMIT 1), 100) AS naght,
    COALESCE((SELECT "m_bet50_centesimos" FROM "config_pontuacao" ORDER BY "versao" DESC LIMIT 1), 150) AS bet50,
    COALESCE((SELECT "m_bet75_centesimos" FROM "config_pontuacao" ORDER BY "versao" DESC LIMIT 1), 200) AS bet75
)
INSERT INTO "encontro" ("id", "versao_instancia_id", "nome", "codigo", "multiplicador_centesimos", "ordem")
SELECT gen_random_uuid(), torre.versao_id, e.nome, e.codigo, e.mult, e.ordem
FROM torre, cfg,
LATERAL (VALUES
  ('Naght Sieger 25', 'NAGHT_25', GREATEST(cfg.naght, 1), 1),
  ('Betelgeuse 50', 'BETELGEUSE_50', GREATEST(cfg.bet50, 1), 2),
  ('Betelgeuse 75', 'BETELGEUSE_75', GREATEST(cfg.bet75, 1), 3)
) AS e(nome, codigo, mult, ordem);

-- ---------------------------------------------------------------------------
-- 3. Funções e ranks passam a ser de uma versão de instância (D45): as de hoje são da Torre v1.
-- ---------------------------------------------------------------------------
ALTER TABLE "funcao_classe" ADD COLUMN "versao_instancia_id" UUID;
UPDATE "funcao_classe" SET "versao_instancia_id" = (
  SELECT v."id" FROM "versao_instancia" v JOIN "instancia" i ON i."id" = v."instancia_id"
  WHERE i."codigo" = 'TORRE_CONSTELACAO' AND v."versao" = 1
);
ALTER TABLE "funcao_classe" ALTER COLUMN "versao_instancia_id" SET NOT NULL;
ALTER TABLE "funcao_classe" ADD CONSTRAINT "funcao_classe_versao_instancia_id_fkey"
  FOREIGN KEY ("versao_instancia_id") REFERENCES "versao_instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "funcao_classe_classe_id_nome_key";
DROP INDEX "funcao_classe_classe_nome_lower_key";
DROP INDEX "funcao_classe_um_padrao_key";
CREATE UNIQUE INDEX "funcao_classe_versao_instancia_id_classe_id_nome_key"
  ON "funcao_classe"("versao_instancia_id", "classe_id", "nome");
CREATE UNIQUE INDEX "funcao_classe_versao_classe_nome_lower_key"
  ON "funcao_classe" ("versao_instancia_id", "classe_id", lower("nome"));
CREATE UNIQUE INDEX "funcao_classe_um_padrao_key"
  ON "funcao_classe" ("versao_instancia_id", "classe_id") WHERE "padrao";
CREATE UNIQUE INDEX "funcao_classe_id_versao_instancia_id_key" ON "funcao_classe"("id", "versao_instancia_id");

-- ---------------------------------------------------------------------------
-- 4. Runs apontam para a versão da instância e o encontro, no lugar do enum do chefe
-- ---------------------------------------------------------------------------
ALTER TABLE "run" ADD COLUMN "versao_instancia_id" UUID;
ALTER TABLE "run" ADD COLUMN "encontro_id" UUID;
UPDATE "run" r SET
  "versao_instancia_id" = e."versao_instancia_id",
  "encontro_id" = e."id"
FROM "encontro" e
JOIN "versao_instancia" v ON v."id" = e."versao_instancia_id"
JOIN "instancia" i ON i."id" = v."instancia_id"
WHERE i."codigo" = 'TORRE_CONSTELACAO' AND v."versao" = 1 AND e."codigo" = r."chefe"::text;
ALTER TABLE "run" ALTER COLUMN "versao_instancia_id" SET NOT NULL;
ALTER TABLE "run" ALTER COLUMN "encontro_id" SET NOT NULL;
ALTER TABLE "run" ADD CONSTRAINT "run_versao_instancia_id_fkey"
  FOREIGN KEY ("versao_instancia_id") REFERENCES "versao_instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- O encontro precisa ser da mesma versão da run
ALTER TABLE "run" ADD CONSTRAINT "run_encontro_id_versao_instancia_id_fkey"
  FOREIGN KEY ("encontro_id", "versao_instancia_id") REFERENCES "encontro"("id", "versao_instancia_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "run_versao_instancia_id_idx" ON "run"("versao_instancia_id");
ALTER TABLE "run" DROP COLUMN "chefe";
DROP TYPE "Chefe";

-- ---------------------------------------------------------------------------
-- 5. Os multiplicadores dos chefes saem dos parâmetros globais (estão nos encontros da Torre)
-- ---------------------------------------------------------------------------
ALTER TABLE "config_pontuacao" DROP CONSTRAINT "config_pontuacao_valores_check";
ALTER TABLE "config_pontuacao" DROP COLUMN "m_naght_centesimos";
ALTER TABLE "config_pontuacao" DROP COLUMN "m_bet50_centesimos";
ALTER TABLE "config_pontuacao" DROP COLUMN "m_bet75_centesimos";
ALTER TABLE "config_pontuacao" ADD CONSTRAINT "config_pontuacao_valores_check" CHECK (
  "versao" > 0 AND "base" >= 0 AND "alpha_centesimos" >= 0
  AND "s_concluida_centesimos" >= 0 AND "s_falha_centesimos" >= 0 AND "s_abortada_centesimos" >= 0
  AND "pct_essencial_bp" BETWEEN 0 AND 10000 AND "pct_importante_bp" BETWEEN 0 AND 10000
  AND "pct_complementar_bp" BETWEEN 0 AND 10000 AND "teto_credores_bp" BETWEEN 0 AND 10000
);

-- ---------------------------------------------------------------------------
-- 6. Versões são imutáveis (D46): mudar é criar outra versão
-- ---------------------------------------------------------------------------
CREATE TRIGGER "versao_instancia_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "versao_instancia"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "encontro_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "encontro"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "funcao_classe_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "funcao_classe"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
