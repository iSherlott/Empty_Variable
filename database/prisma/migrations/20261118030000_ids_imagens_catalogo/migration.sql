-- IDs conferidos na Torre da Constelação (bROWiki) e na Divine Pride.
UPDATE item_catalogo AS item
SET id_jogo = ids.id_jogo
FROM (VALUES
  ('Pó de Meteorito do Poder', 1000398),
  ('Pó de Meteorito da Estâmina', 1000399),
  ('Pó de Meteorito da Concentração', 1000400),
  ('Pó de Meteorito da Criatividade', 1000401),
  ('Pó de Meteorito do Feitiço', 1000402),
  ('Pó de Meteorito da Sabedoria', 1000403),
  ('Veste Astral', 450166),
  ('Túnica Astral', 450167),
  ('Armadura Astral', 450168),
  ('Armadura Nebulosa POD', 450169),
  ('Armadura Nebulosa STA', 450170),
  ('Túnica Nebulosa CON', 450171),
  ('Túnica Nebulosa CRV', 450172),
  ('Veste Nebulosa FEI', 450173),
  ('Veste Nebulosa SAB', 450174),
  ('Carta Naght Sieger', 4457)
) AS ids(nome, id_jogo)
WHERE lower(item.nome) = lower(ids.nome)
  AND item.id_jogo IS NULL
  AND NOT EXISTS (SELECT 1 FROM item_catalogo outro WHERE outro.id_jogo = ids.id_jogo);
