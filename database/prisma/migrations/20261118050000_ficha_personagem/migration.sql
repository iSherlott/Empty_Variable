ALTER TABLE "personagem"
  ADD COLUMN "classe_id" UUID REFERENCES "classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "nivel_base" INTEGER CHECK ("nivel_base" IS NULL OR "nivel_base" > 0),
  ADD COLUMN "build" TEXT,
  ADD COLUMN "equipamentos" JSONB NOT NULL DEFAULT '{}';
