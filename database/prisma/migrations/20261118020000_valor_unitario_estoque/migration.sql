ALTER TABLE "movimento_estoque"
  ADD COLUMN "valor_unitario_pontos" INTEGER,
  ADD CONSTRAINT "movimento_estoque_valor_unitario_check"
  CHECK ("valor_unitario_pontos" IS NULL OR ("valor_unitario_pontos" >= 0 AND "tipo" = 'ENTRADA'));
