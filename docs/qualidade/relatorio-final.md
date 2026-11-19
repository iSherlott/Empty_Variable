# Relatório final de QA do Épico I (T-25, Agent 06)

**Data:** 2026-11-14. **Base:** branch `feat/m6-implantacao`, que contém os marcos M0 a M6.

## 1. Resumo

| Suíte | Quantidade | Resultado | Onde roda |
|---|---:|---|---|
| Motor de cálculo (unitários e de propriedade) | 84 | ✅ todos passam | `packages/scoring` |
| API (integração com Postgres 16 real) | 96 | ✅ todos passam | `backend/test` |
| Frontend (Angular, Karma) | 24 | ✅ todos passam | `web` |
| Ponta a ponta (Playwright + Chrome) | 4 | ✅ todos passam | `tests/e2e` |

Lint, verificação de formatação, typecheck e build de produção também passam.

**Veredito:** todos os critérios de aceite de US-01 a US-08 têm teste automatizado passando. O que impede declarar o Épico I "em produção" é o que **não pôde ser executado neste ambiente** (seção 4), não uma falha de comportamento.

## 2. Critérios de aceite

### US-01: Configurar classes e funções

| Critério | Evidência |
|---|---|
| Magus com "Dano" (r5) e "Suporte" (r3) fica disponível no registro | CT-57 (`cadastros.test.ts`, `runs.test.ts`). O Magus não tem função padrão, e a escolha é obrigatória (D16) |
| Mudar o rank não altera runs antigas | CT-58 (`runs.test.ts`): R1 continua com rank 3 e 200 pontos; R2 já sai com 250 |
| Classe não cadastrada usa rank 1 | CT-55: classe "Outra" (rank 1), 100 pontos (C10) |
| Rank aceito vai de 1 a 5 | CT-56, em três camadas: motor, API (400) e banco (CHECK) |

### US-02: Configurar parâmetros de pontuação

| Critério | Evidência |
|---|---|
| Alterações valem só para runs registradas depois | CT-59 (B = 120: R1 fica 300, R2 sai 360) e CT-60 (α = 1,0), na API e no motor |
| Histórico de versões guardado | Versões imutáveis (o trigger bloqueia UPDATE/DELETE, `banco.test.ts`). `GET /api/config-pontuacao` e a tela `/admin/parametros` mostram o histórico |

### US-03: Registrar uma run

| Critério | Evidência |
|---|---|
| O mesmo personagem não aparece duas vezes | CT-52: rejeitado na API, no banco (UNIQUE) e no assistente (pendência no passo 2) |
| Participante com personagem, classe, função (padrão da classe) e fração | Assistente (T-20) e `POST /api/runs`. Frações 1 / 0,5 / 0 (C6) |
| MTK com f = 1, B = 100, α = 0,5 recebe 300 | CT-01 a CT-05 e CT-53/CT-54 na API; também no e2e |
| Sorcerer com f = 0,5 recebe 125 | CT-15 e CT-28 (composição 2, total 925) |
| Pontos lançados na hora (D11) | CT-63: os lançamentos são criados na mesma transação; falha no meio não deixa nada gravado (CT-72) |
| Status da run | Três status: Concluída, Falha no chefe e Abortada (D3, C8). A US original citava só "concluída ou falha" |

### US-04: Registrar itens obtidos

| Critério | Evidência |
|---|---|
| Itens do catálogo, com quantidade inteira maior que zero | CT-61: quantidade 0, negativa ou fracionária e item fora do catálogo são rejeitados (API e CHECK no banco) |
| Os itens não alteram a pontuação | CT-61: o saldo não muda com os drops |

### US-05: Empréstimos e divisão de pontos

| Critério | Evidência |
|---|---|
| P = 200 com 20% e 10% → 40, 20 e tomador 140 | CT-30 (motor) e o equivalente CT-29/CT-63 na API e no e2e |
| Parcelas + tomador = P | Propriedade P1 (fast-check) e CT-51 |
| Soma acima do teto é rejeitada com mensagem clara | **Refinado por D9a/D15:** só sugestões acima do teto são reduzidas, com aviso (CT-35, CT-73); com um percentual informado, a run é rejeitada com 422 e mensagem (CT-40, CT-41, CT-50, CT-75). No assistente, o erro aparece antes do envio |
| Credor ≠ tomador | CT-42 e C3 (comparação por jogador, inclusive entre personagens do mesmo jogador): motor, API (422), banco (CHECK e FK composta) e assistente (o próprio jogador não aparece como credor) |
| Histórico mostra os pontos originais e cada parcela | CT-64: no extrato, +300, −75 (X, 25%) e −30 (Y, 10%), com o credor, o item e os percentuais |

### US-06: Histórico e saldo

| Critério | Evidência |
|---|---|
| Cada lançamento mostra a origem | CT-64, CT-67 e CT-71. A tela `/me` descreve cada linha (participação, parcela, crédito de empréstimo e estorno) |
| Saldo = soma dos lançamentos | CT-67 (API), a view `saldo_jogador` (`banco.test.ts`) e a verificação de integridade pós-restauração |
| Membro vê só o próprio saldo (D14) | CT-80 (403 em outro jogador); o e2e confirma o acesso do membro |

### US-07: Corrigir uma run

| Critério | Evidência |
|---|---|
| A correção gera estornos e novos lançamentos | CT-65 (+300, −300, +200, saldo 200) e CT-66 (correção para "sem empréstimo"). E2e: correção para Cardeal |
| Nenhum lançamento é apagado | CT-68: o trigger bloqueia UPDATE, DELETE e TRUNCATE; os estornos apontam para o original |
| Parâmetros da correção | D17: os da run original (teste específico em `runs.test.ts`) |

### US-08: Vínculo Discord ↔ jogador (D12, D13)

| Critério | Evidência |
|---|---|
| Membro solicita e o admin aprova | CT-76 (jogador existente e jogador novo), no e2e e na tela da fila |
| Segunda solicitação pendente é rejeitada | CT-77, na API e no índice parcial do banco |
| Jogador já vinculado não pode ser reivindicado | CT-78, inclusive com duas aprovações concorrentes |
| Só membros do servidor entram | CT-79, com o dublê do Discord (consulta de membro respondendo 404) |

### Autorização (D11)

| Critério | Evidência |
|---|---|
| Membro não registra, corrige nem altera cadastros | CT-69, CT-70 e CT-E4: 403 na API, e o e2e confirma que a tela redireciona |

## 3. Desvios e decisões tomadas durante a implementação

Nenhuma regra de negócio foi definida sem aprovação. As decisões D16 (Magus sem função padrão) e D17 (a correção usa os parâmetros da run original) foram aprovadas pelo usuário durante os marcos M3 e M4.

**Decisões técnicas sem efeito na pontuação:**

- O último admin ativo não pode ser rebaixado.
- Nomes são únicos sem diferenciar maiúsculas.
- O nome de personagem tem até 23 caracteres.
- O login simulado existe só fora de produção.

## 4. O que NÃO foi verificado

| Item | Motivo | Como verificar |
|---|---|---|
| Login com o Discord real | Exige uma aplicação OAuth cadastrada; os testes usam um dublê | Seguir `docs/implantacao.md` §1 e entrar com uma conta do servidor e outra de fora |
| `docker compose up` (desenvolvimento e produção), Caddy com HTTPS e build das imagens | O Docker Desktop não iniciou neste ambiente. Os arquivos foram validados com `docker compose config` e `sh -n` | O job `producao` da CI sobe a stack com HTTPS local, faz um backup e testa a restauração. Na VPS: guia de implantação |
| Execução dos scripts de backup e restauração | Precisam de `pg_dump`/`pg_restore`, que só existem na imagem do Postgres | Job `producao` da CI; as consultas de integridade foram testadas contra Postgres real (`integridade-backup.test.ts`) |
| Pipeline de CI | O repositório não tem remoto Git | Primeiro push para o GitHub |
| Visual das telas em celulares | Não houve revisão visual em telas estreitas | Abrir as telas no celular depois de implantar |

## 5. Pendências de dados (não são defeitos)

- Nome da classe Asceta no bRO: cadastrada como "Soul Ascetic" (D7), e o admin pode renomear.
- IDs no jogo dos 6 Pós de Talento e do Fragmento de Talento; visuais e cartas não cadastrados.
- Negociabilidade e vínculo à conta dos itens: todos "desconhecido". **Precisa ser verificado no jogo antes do Épico II (loja).**

## 6. Fora do escopo

Os Épicos II (loja e estoque) e III (Nebula) não foram iniciados, conforme combinado. O modelo já está preparado para eles: tipos de lançamento `COMPRA` e `VENDA` reservados, campos de negociabilidade no catálogo e tabela de drops por run.
