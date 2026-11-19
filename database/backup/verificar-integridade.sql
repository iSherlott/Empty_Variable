-- Verificações feitas depois de restaurar um backup (testar-restauracao.sh).
-- Qualquer falha interrompe o psql com erro (ON_ERROR_STOP).

\echo 'Contagem de registros:'
SELECT 'usuario' AS tabela, count(*) FROM usuario
UNION ALL SELECT 'jogador', count(*) FROM jogador
UNION ALL SELECT 'personagem', count(*) FROM personagem
UNION ALL SELECT 'classe', count(*) FROM classe
UNION ALL SELECT 'config_pontuacao', count(*) FROM config_pontuacao
UNION ALL SELECT 'item_catalogo', count(*) FROM item_catalogo
UNION ALL SELECT 'run', count(*) FROM run
UNION ALL SELECT 'participacao', count(*) FROM participacao
UNION ALL SELECT 'lancamento_pontos', count(*) FROM lancamento_pontos
UNION ALL SELECT 'lote_estoque', count(*) FROM lote_estoque
UNION ALL SELECT 'movimento_estoque', count(*) FROM movimento_estoque
UNION ALL SELECT 'compra', count(*) FROM compra;

DO $$
DECLARE
  pendentes int;
  soma_view bigint;
  soma_ledger bigint;
  divergentes int;
BEGIN
  -- 1. Todas as migrations aplicadas por completo.
  SELECT count(*) INTO pendentes FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;
  IF pendentes > 0 THEN
    RAISE EXCEPTION 'Há % migration(s) incompleta(s) no backup.', pendentes;
  END IF;

  -- 2. As proteções do ledger e dos parâmetros vieram junto (A2).
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgname IN ('lancamento_pontos_somente_inclusao', 'lancamento_pontos_sem_truncate',
                       'config_pontuacao_somente_inclusao')) <> 3 THEN
    RAISE EXCEPTION 'Triggers de imutabilidade ausentes no banco restaurado.';
  END IF;

  -- 3. Saldo da view = soma do ledger (US-06).
  SELECT coalesce(sum(saldo), 0) INTO soma_view FROM saldo_jogador;
  SELECT coalesce(sum(valor), 0) INTO soma_ledger FROM lancamento_pontos;
  IF soma_view <> soma_ledger THEN
    RAISE EXCEPTION 'Saldo da view (%) diferente da soma do ledger (%).', soma_view, soma_ledger;
  END IF;

  -- 4. Em cada run não estornada, os lançamentos somam os pontos gerados (empréstimo só redistribui).
  SELECT count(*) INTO divergentes FROM (
    SELECT r.id
    FROM run r
    WHERE r.status <> 'ESTORNADA'
      AND (SELECT coalesce(sum(p.pontos_gerados), 0) FROM participacao p WHERE p.run_id = r.id)
       <> (SELECT coalesce(sum(l.valor), 0) FROM lancamento_pontos l WHERE l.run_id = r.id AND l.tipo <> 'ESTORNO')
  ) x;
  IF divergentes > 0 THEN
    RAISE EXCEPTION '% run(s) com lançamentos que não somam os pontos gerados.', divergentes;
  END IF;

  -- 5. Runs estornadas têm saldo líquido zero.
  SELECT count(*) INTO divergentes FROM (
    SELECT r.id FROM run r
    WHERE r.status = 'ESTORNADA'
      AND (SELECT coalesce(sum(l.valor), 0) FROM lancamento_pontos l WHERE l.run_id = r.id) <> 0
  ) x;
  IF divergentes > 0 THEN
    RAISE EXCEPTION '% run(s) estornada(s) com saldo diferente de zero.', divergentes;
  END IF;

  -- 6. Épico II: nenhum lote de estoque com quantidade negativa (CT-104).
  SELECT count(*) INTO divergentes FROM saldo_lote WHERE quantidade < 0;
  IF divergentes > 0 THEN
    RAISE EXCEPTION '% lote(s) de estoque com quantidade negativa.', divergentes;
  END IF;

  -- 7. Épico II: as proteções do estoque vieram junto.
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgname IN ('movimento_estoque_somente_inclusao', 'movimento_estoque_lote_nao_negativo',
                       'preco_item_somente_inclusao', 'config_loja_somente_inclusao')) <> 4 THEN
    RAISE EXCEPTION 'Triggers do estoque ausentes no banco restaurado.';
  END IF;

  -- 8. Épico III (CT-128): os pontos da Nebula fecham com as solicitações não canceladas nem rejeitadas.
  IF (SELECT coalesce(sum(l.valor), 0) FROM lancamento_pontos l WHERE l.solicitacao_nebula_id IS NOT NULL)
     <> -(SELECT coalesce(sum(s.preco), 0) FROM solicitacao_nebula s WHERE s.status IN ('PENDENTE', 'ENTREGUE')) THEN
    RAISE EXCEPTION 'Lançamentos da Nebula não fecham com o preço das solicitações ativas.';
  END IF;

  -- 9. Épico III (CT-128): solicitação cancelada ou rejeitada devolveu todo o material.
  SELECT count(*) INTO divergentes FROM (
    SELECT s.id FROM solicitacao_nebula s
    JOIN movimento_estoque m ON m.solicitacao_nebula_id = s.id
    WHERE s.status IN ('CANCELADA', 'REJEITADA')
    GROUP BY s.id HAVING sum(m.quantidade) <> 0
  ) x;
  IF divergentes > 0 THEN
    RAISE EXCEPTION '% solicitação(ões) da Nebula encerrada(s) sem devolver o material.', divergentes;
  END IF;

  -- 10. Épico III: a imutabilidade dos preços das receitas veio junto.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'preco_receita_somente_inclusao') THEN
    RAISE EXCEPTION 'Trigger dos preços das receitas ausente no banco restaurado.';
  END IF;

  -- 11. Épico IV (D45): a função de cada participação é da mesma versão de instância da run.
  SELECT count(*) INTO divergentes
  FROM participacao p JOIN run r ON r.id = p.run_id JOIN funcao_classe f ON f.id = p.funcao_id
  WHERE f.versao_instancia_id <> r.versao_instancia_id;
  IF divergentes > 0 THEN
    RAISE EXCEPTION '% participação(ões) com função de outra versão de instância.', divergentes;
  END IF;

  -- 12. Épico IV (D46): a imutabilidade das versões de instância veio junto.
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgname IN ('versao_instancia_somente_inclusao', 'encontro_somente_inclusao',
                       'funcao_classe_somente_inclusao')) <> 3 THEN
    RAISE EXCEPTION 'Triggers das versões de instância ausentes no banco restaurado.';
  END IF;

  RAISE NOTICE 'Integridade OK: migrations completas, triggers presentes, saldo = ledger (% pontos).', soma_ledger;
END $$;
