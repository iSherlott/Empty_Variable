-- CreateEnum
CREATE TYPE "OrigemLote" AS ENUM ('MANUAL', 'DROP_RUN', 'OFERTA');

-- CreateEnum
CREATE TYPE "TipoMovimentoEstoque" AS ENUM ('ENTRADA', 'VENDA', 'DEVOLUCAO', 'RETIRADA', 'AJUSTE', 'NEBULA');

-- CreateEnum
CREATE TYPE "StatusCompra" AS ENUM ('PENDENTE_ENTREGA', 'ENTREGUE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusOferta" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'RETIRADA_SOLICITADA', 'RETIRADA', 'ESGOTADA');

-- AlterTable
ALTER TABLE "item_catalogo" ADD COLUMN     "limite_periodo_dias" INTEGER,
ADD COLUMN     "limite_por_membro" INTEGER,
ADD COLUMN     "reserva_minima" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lancamento_pontos" ADD COLUMN     "compra_id" UUID,
ADD COLUMN     "compra_lote_id" UUID;

-- CreateTable
CREATE TABLE "preco_item" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "preco_pontos" INTEGER,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,

    CONSTRAINT "preco_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_loja" (
    "id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "taxa_consignacao_bp" INTEGER NOT NULL,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_por" UUID,

    CONSTRAINT "config_loja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_estoque" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "dono_jogador_id" UUID,
    "origem" "OrigemLote" NOT NULL,
    "oferta_id" UUID,
    "ordem" SERIAL NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID NOT NULL,

    CONSTRAINT "lote_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimento_estoque" (
    "id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "tipo" "TipoMovimentoEstoque" NOT NULL,
    "drop_run_id" UUID,
    "compra_id" UUID,
    "motivo" TEXT,
    "criado_por" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimento_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra" (
    "id" UUID NOT NULL,
    "comprador_jogador_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "config_loja_id" UUID NOT NULL,
    "status" "StatusCompra" NOT NULL DEFAULT 'PENDENTE_ENTREGA',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregue_em" TIMESTAMPTZ(3),
    "entregue_por" UUID,
    "cancelada_em" TIMESTAMPTZ(3),
    "cancelada_por" UUID,
    "motivo_cancelamento" TEXT,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_lote" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor_vendedor" INTEGER NOT NULL,

    CONSTRAINT "compra_lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oferta_venda" (
    "id" UUID NOT NULL,
    "jogador_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "status" "StatusOferta" NOT NULL DEFAULT 'PENDENTE',
    "motivo" TEXT,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analisada_por" UUID,
    "analisada_em" TIMESTAMPTZ(3),

    CONSTRAINT "oferta_venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preco_item_item_id_versao_key" ON "preco_item"("item_id", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "config_loja_versao_key" ON "config_loja"("versao");

-- CreateIndex
CREATE UNIQUE INDEX "lote_estoque_oferta_id_key" ON "lote_estoque"("oferta_id");

-- CreateIndex
CREATE UNIQUE INDEX "lote_estoque_ordem_key" ON "lote_estoque"("ordem");

-- CreateIndex
CREATE INDEX "lote_estoque_item_id_ordem_idx" ON "lote_estoque"("item_id", "ordem");

-- CreateIndex
CREATE INDEX "movimento_estoque_lote_id_idx" ON "movimento_estoque"("lote_id");

-- CreateIndex
CREATE INDEX "movimento_estoque_criado_em_idx" ON "movimento_estoque"("criado_em");

-- CreateIndex
CREATE INDEX "compra_comprador_jogador_id_criada_em_idx" ON "compra"("comprador_jogador_id", "criada_em");

-- CreateIndex
CREATE INDEX "compra_status_criada_em_idx" ON "compra"("status", "criada_em");

-- CreateIndex
CREATE INDEX "compra_lote_compra_id_idx" ON "compra_lote"("compra_id");

-- CreateIndex
CREATE INDEX "oferta_venda_status_criada_em_idx" ON "oferta_venda"("status", "criada_em");

-- CreateIndex
CREATE INDEX "lancamento_pontos_compra_id_idx" ON "lancamento_pontos"("compra_id");

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_compra_lote_id_fkey" FOREIGN KEY ("compra_lote_id") REFERENCES "compra_lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preco_item" ADD CONSTRAINT "preco_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preco_item" ADD CONSTRAINT "preco_item_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_loja" ADD CONSTRAINT "config_loja_criada_por_fkey" FOREIGN KEY ("criada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_estoque" ADD CONSTRAINT "lote_estoque_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_estoque" ADD CONSTRAINT "lote_estoque_dono_jogador_id_fkey" FOREIGN KEY ("dono_jogador_id") REFERENCES "jogador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_estoque" ADD CONSTRAINT "lote_estoque_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta_venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_estoque" ADD CONSTRAINT "lote_estoque_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_drop_run_id_fkey" FOREIGN KEY ("drop_run_id") REFERENCES "drop_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_comprador_jogador_id_fkey" FOREIGN KEY ("comprador_jogador_id") REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_config_loja_id_fkey" FOREIGN KEY ("config_loja_id") REFERENCES "config_loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_entregue_por_fkey" FOREIGN KEY ("entregue_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_cancelada_por_fkey" FOREIGN KEY ("cancelada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_lote" ADD CONSTRAINT "compra_lote_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_lote" ADD CONSTRAINT "compra_lote_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_venda" ADD CONSTRAINT "oferta_venda_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_venda" ADD CONSTRAINT "oferta_venda_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_venda" ADD CONSTRAINT "oferta_venda_analisada_por_fkey" FOREIGN KEY ("analisada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =====================================================================
-- Regras de banco do Épico II (T-26). Mantidas à mão.
-- =====================================================================

-- Item: reserva para a Nebula (D26) e limite opcional por membro (D24)
ALTER TABLE "item_catalogo" ADD CONSTRAINT "item_catalogo_loja_check" CHECK (
  "reserva_minima" >= 0
  AND (("limite_por_membro" IS NULL AND "limite_periodo_dias" IS NULL)
       OR ("limite_por_membro" IS NOT NULL AND "limite_periodo_dias" IS NOT NULL
           AND "limite_por_membro" > 0 AND "limite_periodo_dias" > 0))
);

-- Preço por item (D21): positivo quando definido; nulo = fora da loja
ALTER TABLE "preco_item" ADD CONSTRAINT "preco_item_preco_check" CHECK ("versao" > 0 AND ("preco_pontos" IS NULL OR "preco_pontos" > 0));

-- Parâmetros da loja (D22)
ALTER TABLE "config_loja" ADD CONSTRAINT "config_loja_valores_check" CHECK (
  "versao" > 0 AND "taxa_consignacao_bp" BETWEEN 0 AND 10000
);

-- Lote: origem coerente com o dono (oferta ⇔ consignado com oferta; demais ⇔ grupo)
ALTER TABLE "lote_estoque" ADD CONSTRAINT "lote_estoque_origem_check" CHECK (
  ("origem" = 'OFERTA' AND "dono_jogador_id" IS NOT NULL AND "oferta_id" IS NOT NULL)
  OR ("origem" <> 'OFERTA' AND "dono_jogador_id" IS NULL AND "oferta_id" IS NULL)
);

-- Movimentos: quantidade com sinal coerente com o tipo
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_quantidade_check" CHECK (
  "quantidade" <> 0
  AND ("tipo" NOT IN ('ENTRADA', 'DEVOLUCAO') OR "quantidade" > 0)
  AND ("tipo" NOT IN ('VENDA', 'RETIRADA', 'NEBULA') OR "quantidade" < 0)
  AND ("tipo" <> 'AJUSTE' OR "motivo" IS NOT NULL)
  AND ("tipo" NOT IN ('VENDA', 'DEVOLUCAO') OR "compra_id" IS NOT NULL)
);

-- D18: cada drop de run entra no estoque uma única vez
CREATE UNIQUE INDEX "movimento_estoque_drop_unico_key"
  ON "movimento_estoque" ("drop_run_id") WHERE "tipo" = 'ENTRADA' AND "drop_run_id" IS NOT NULL;

-- Compra (D19, D21): valores coerentes e status com os campos correspondentes
ALTER TABLE "compra" ADD CONSTRAINT "compra_valores_check" CHECK (
  "quantidade" > 0 AND "preco_unitario" > 0 AND "total" = "quantidade" * "preco_unitario"
  AND ("status" <> 'ENTREGUE' OR ("entregue_em" IS NOT NULL AND "entregue_por" IS NOT NULL))
  AND ("status" <> 'CANCELADA' OR ("cancelada_em" IS NOT NULL AND "cancelada_por" IS NOT NULL))
);
ALTER TABLE "compra_lote" ADD CONSTRAINT "compra_lote_valores_check" CHECK (
  "quantidade" > 0 AND "valor_vendedor" >= 0
);

-- Oferta (D22): quantidade positiva; rejeição exige motivo
ALTER TABLE "oferta_venda" ADD CONSTRAINT "oferta_venda_valores_check" CHECK (
  "quantidade" > 0 AND ("status" <> 'REJEITADA' OR "motivo" IS NOT NULL)
);

-- Só inclusão: preços, parâmetros da loja e o ledger do estoque
CREATE TRIGGER "preco_item_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "preco_item"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "config_loja_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "config_loja"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "movimento_estoque_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "movimento_estoque"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "movimento_estoque_sem_truncate"
  BEFORE TRUNCATE ON "movimento_estoque"
  FOR EACH STATEMENT EXECUTE FUNCTION "bloquear_alteracao"();

-- Um lote nunca fica com quantidade negativa (CT-104), mesmo fora do serviço.
CREATE FUNCTION "conferir_lote_nao_negativo"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  saldo bigint;
BEGIN
  SELECT coalesce(sum("quantidade"), 0) INTO saldo FROM "movimento_estoque" WHERE "lote_id" = NEW."lote_id";
  IF saldo < 0 THEN
    RAISE EXCEPTION 'O lote % ficaria com quantidade negativa (%)', NEW."lote_id", saldo
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "movimento_estoque_lote_nao_negativo"
  AFTER INSERT ON "movimento_estoque"
  FOR EACH ROW EXECUTE FUNCTION "conferir_lote_nao_negativo"();

-- Quantidade atual por lote
CREATE VIEW "saldo_lote" AS
  SELECT l."id" AS "lote_id", l."item_id", l."dono_jogador_id", l."ativo", l."ordem", l."criado_em",
         COALESCE(SUM(m."quantidade"), 0)::bigint AS "quantidade"
  FROM "lote_estoque" l
  LEFT JOIN "movimento_estoque" m ON m."lote_id" = l."id"
  GROUP BY l."id";
