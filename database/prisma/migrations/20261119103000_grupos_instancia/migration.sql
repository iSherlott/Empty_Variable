CREATE TABLE "grupo_instancia" (
  "id" UUID PRIMARY KEY,
  "instancia_id" UUID NOT NULL REFERENCES "instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "criado_por_id" UUID NOT NULL REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "agendado_em" TIMESTAMPTZ(3) NOT NULL,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechado_em" TIMESTAMPTZ(3),
  "vagas" JSONB NOT NULL,
  CONSTRAINT "grupo_instancia_vagas_check" CHECK (
    CASE WHEN jsonb_typeof("vagas") = 'array' THEN jsonb_array_length("vagas") = 12 ELSE false END
  )
);
CREATE INDEX "grupo_instancia_agendado_em_idx" ON "grupo_instancia"("agendado_em");
