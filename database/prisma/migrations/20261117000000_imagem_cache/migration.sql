-- Épico IV, M14 (D41): cache das imagens dos itens vindas da Divine Pride.
CREATE TYPE "TipoImagem" AS ENUM ('ICONE', 'ILUSTRACAO');

CREATE TABLE "imagem_cache" (
    "id_jogo" INTEGER NOT NULL,
    "tipo" "TipoImagem" NOT NULL,
    "existe" BOOLEAN NOT NULL,
    "conteudo" BYTEA,
    "mime" TEXT,
    "buscada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagem_cache_pkey" PRIMARY KEY ("id_jogo","tipo")
);

-- Com imagem, há conteúdo e tipo MIME; sem imagem, nenhum dos dois. ID sempre positivo.
ALTER TABLE "imagem_cache" ADD CONSTRAINT "imagem_cache_coerencia_check" CHECK (
  "id_jogo" > 0
  AND (("existe" AND "conteudo" IS NOT NULL AND "mime" IS NOT NULL)
       OR (NOT "existe" AND "conteudo" IS NULL AND "mime" IS NULL))
);
