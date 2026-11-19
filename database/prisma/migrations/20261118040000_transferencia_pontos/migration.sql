ALTER TYPE "TipoLancamento" ADD VALUE 'TRANSFERENCIA_ENVIADA';
ALTER TYPE "TipoLancamento" ADD VALUE 'TRANSFERENCIA_RECEBIDA';

CREATE TABLE "transferencia_pontos" (
  "id" UUID PRIMARY KEY,
  "remetente_id" UUID NOT NULL REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "destinatario_id" UUID NOT NULL REFERENCES "jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "pontos" INTEGER NOT NULL CHECK ("pontos" > 0),
  "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("remetente_id" <> "destinatario_id")
);
ALTER TABLE "lancamento_pontos" ADD COLUMN "transferencia_id" UUID
  REFERENCES "transferencia_pontos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "lancamento_pontos_transferencia_id_tipo_key" ON "lancamento_pontos"("transferencia_id", "tipo");
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_transferencia_check" CHECK (
  CASE "tipo"::text
    WHEN 'TRANSFERENCIA_ENVIADA' THEN "transferencia_id" IS NOT NULL AND "valor" < 0
    WHEN 'TRANSFERENCIA_RECEBIDA' THEN "transferencia_id" IS NOT NULL AND "valor" > 0
    ELSE "transferencia_id" IS NULL
  END
);
CREATE TRIGGER "transferencia_pontos_imutavel"
  BEFORE UPDATE OR DELETE OR TRUNCATE ON "transferencia_pontos"
  FOR EACH STATEMENT EXECUTE FUNCTION "bloquear_alteracao"();
