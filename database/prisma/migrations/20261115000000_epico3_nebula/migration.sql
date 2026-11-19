-- CreateEnum
CREATE TYPE "StatusSolicitacaoNebula" AS ENUM ('PENDENTE', 'ENTREGUE', 'CANCELADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "PecaDoEstoque" AS ENUM ('PRONTA', 'MATERIAIS');

-- AlterEnum
ALTER TYPE "TipoLancamento" ADD VALUE 'NEBULA';

-- AlterTable
ALTER TABLE "lancamento_pontos" ADD COLUMN     "solicitacao_nebula_id" UUID;

-- AlterTable
ALTER TABLE "movimento_estoque" ADD COLUMN     "solicitacao_nebula_id" UUID;

-- CreateTable
CREATE TABLE "receita" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "item_produzido_id" UUID NOT NULL,
    "solicitavel" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "fonte" TEXT,
    "limite_por_membro" INTEGER,
    "limite_periodo_dias" INTEGER,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receita_componente" (
    "id" UUID NOT NULL,
    "receita_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "peca_base" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "receita_componente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receita_peca" (
    "receita_id" UUID NOT NULL,
    "receita_peca_id" UUID NOT NULL,

    CONSTRAINT "receita_peca_pkey" PRIMARY KEY ("receita_id")
);

-- CreateTable
CREATE TABLE "preco_receita" (
    "id" UUID NOT NULL,
    "receita_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "preco_com_peca" INTEGER NOT NULL,
    "preco_trazendo_peca" INTEGER NOT NULL,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,

    CONSTRAINT "preco_receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacao_nebula" (
    "id" UUID NOT NULL,
    "jogador_id" UUID NOT NULL,
    "receita_id" UUID NOT NULL,
    "traz_peca" BOOLEAN NOT NULL,
    "peca_do_estoque" "PecaDoEstoque",
    "preco" INTEGER NOT NULL,
    "preco_receita_id" UUID NOT NULL,
    "status" "StatusSolicitacaoNebula" NOT NULL DEFAULT 'PENDENTE',
    "motivo" TEXT,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregue_em" TIMESTAMPTZ(3),
    "entregue_por" UUID,
    "encerrada_em" TIMESTAMPTZ(3),
    "encerrada_por" UUID,

    CONSTRAINT "solicitacao_nebula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receita_nome_key" ON "receita"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "receita_componente_receita_id_item_id_key" ON "receita_componente"("receita_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "preco_receita_receita_id_versao_key" ON "preco_receita"("receita_id", "versao");

-- CreateIndex
CREATE INDEX "solicitacao_nebula_jogador_id_criada_em_idx" ON "solicitacao_nebula"("jogador_id", "criada_em");

-- CreateIndex
CREATE INDEX "solicitacao_nebula_status_criada_em_idx" ON "solicitacao_nebula"("status", "criada_em");

-- AddForeignKey
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_solicitacao_nebula_id_fkey" FOREIGN KEY ("solicitacao_nebula_id") REFERENCES "solicitacao_nebula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_solicitacao_nebula_id_fkey" FOREIGN KEY ("solicitacao_nebula_id") REFERENCES "solicitacao_nebula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita" ADD CONSTRAINT "receita_item_produzido_id_fkey" FOREIGN KEY ("item_produzido_id") REFERENCES "item_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_componente" ADD CONSTRAINT "receita_componente_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_componente" ADD CONSTRAINT "receita_componente_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_peca" ADD CONSTRAINT "receita_peca_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_peca" ADD CONSTRAINT "receita_peca_receita_peca_id_fkey" FOREIGN KEY ("receita_peca_id") REFERENCES "receita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preco_receita" ADD CONSTRAINT "preco_receita_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preco_receita" ADD CONSTRAINT "preco_receita_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_nebula" ADD CONSTRAINT "solicitacao_nebula_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_nebula" ADD CONSTRAINT "solicitacao_nebula_receita_id_fkey" FOREIGN KEY ("receita_id") REFERENCES "receita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_nebula" ADD CONSTRAINT "solicitacao_nebula_preco_receita_id_fkey" FOREIGN KEY ("preco_receita_id") REFERENCES "preco_receita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_nebula" ADD CONSTRAINT "solicitacao_nebula_entregue_por_fkey" FOREIGN KEY ("entregue_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_nebula" ADD CONSTRAINT "solicitacao_nebula_encerrada_por_fkey" FOREIGN KEY ("encerrada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =====================================================================
-- Regras de banco do Épico III (T-39). Mantidas à mão.
-- =====================================================================

-- Receita: limite opcional (D35), à prova de nulos
ALTER TABLE "receita" ADD CONSTRAINT "receita_limite_check" CHECK (
  ("limite_por_membro" IS NULL AND "limite_periodo_dias" IS NULL)
  OR ("limite_por_membro" IS NOT NULL AND "limite_periodo_dias" IS NOT NULL
      AND "limite_por_membro" > 0 AND "limite_periodo_dias" > 0)
);
CREATE UNIQUE INDEX "receita_nome_lower_key" ON "receita" (lower("nome"));

-- Componentes: quantidade positiva; no máximo uma peça-base por receita (D31)
ALTER TABLE "receita_componente" ADD CONSTRAINT "receita_componente_quantidade_check" CHECK ("quantidade" > 0);
CREATE UNIQUE INDEX "receita_componente_uma_peca_key" ON "receita_componente" ("receita_id") WHERE "peca_base";

-- Uma receita não é a peça dela mesma
ALTER TABLE "receita_peca" ADD CONSTRAINT "receita_peca_distinta_check" CHECK ("receita_id" <> "receita_peca_id");

-- Preços da receita (D32): positivos, versionados e imutáveis
ALTER TABLE "preco_receita" ADD CONSTRAINT "preco_receita_valores_check" CHECK (
  "versao" > 0 AND "preco_com_peca" > 0 AND "preco_trazendo_peca" > 0
);
CREATE TRIGGER "preco_receita_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "preco_receita"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();

-- Solicitação (D31, D34, D36): coerência entre a peça e o status
ALTER TABLE "solicitacao_nebula" ADD CONSTRAINT "solicitacao_nebula_valores_check" CHECK (
  "preco" > 0
  AND (("traz_peca" AND "peca_do_estoque" IS NULL) OR (NOT "traz_peca" AND "peca_do_estoque" IS NOT NULL))
  AND ("status" <> 'ENTREGUE' OR ("entregue_em" IS NOT NULL AND "entregue_por" IS NOT NULL))
  AND ("status" NOT IN ('CANCELADA', 'REJEITADA') OR ("encerrada_em" IS NOT NULL AND "encerrada_por" IS NOT NULL))
  AND ("status" <> 'REJEITADA' OR "motivo" IS NOT NULL)
);

-- Movimentos: NEBULA exige a solicitação; DEVOLUÇÃO exige compra ou solicitação
ALTER TABLE "movimento_estoque" DROP CONSTRAINT "movimento_estoque_quantidade_check";
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_quantidade_check" CHECK (
  "quantidade" <> 0
  AND ("tipo" NOT IN ('ENTRADA', 'DEVOLUCAO') OR "quantidade" > 0)
  AND ("tipo" NOT IN ('VENDA', 'RETIRADA', 'NEBULA') OR "quantidade" < 0)
  AND ("tipo" <> 'AJUSTE' OR "motivo" IS NOT NULL)
  AND ("tipo" <> 'VENDA' OR "compra_id" IS NOT NULL)
  AND ("tipo" <> 'NEBULA' OR "solicitacao_nebula_id" IS NOT NULL)
  AND ("tipo" <> 'DEVOLUCAO' OR "compra_id" IS NOT NULL OR "solicitacao_nebula_id" IS NOT NULL)
);
