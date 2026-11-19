-- M3: nomes de cadastro únicos sem diferenciar maiúsculas (mesma regra de jogador e personagem).
CREATE UNIQUE INDEX "classe_nome_oficial_lower_key" ON "classe" (lower("nome_oficial"));
CREATE UNIQUE INDEX "funcao_classe_classe_nome_lower_key" ON "funcao_classe" ("classe_id", lower("nome"));
CREATE UNIQUE INDEX "item_catalogo_nome_lower_key" ON "item_catalogo" (lower("nome"));
