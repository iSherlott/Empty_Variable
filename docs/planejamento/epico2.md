# Épico II: planejamento técnico (Etapa 2)

**Status:** Aprovado e **implementado (M7 a M9)** em 2026-11-14. Relatório: `docs/qualidade/relatorio-epico2.md`. **D28 ajustou o momento do crédito ao vendedor (§3.1, §3.2).**

**Base:**
- Análise: `docs/analise/epico2-loja.md`.
- Decisões D18 a D27 e esclarecimentos C12 e C13: `docs/DECISOES.md`.
- Sistema do Épico I: ledger só de inclusão, catálogo de itens, drops por run, autenticação e papéis.

**Responsáveis:** Arquiteto (§1 a §3), Frontend (§4), PO (§5) e QA (§6). Consolidação pelo orquestrador.

---

## 1. Princípios

1. **Os pontos continuam só no ledger** (`lancamento_pontos`). Compra é `COMPRA` (−) e venda consignada é `VENDA` (+); um cancelamento gera `ESTORNO`. Nenhuma tabela nova guarda saldo.
2. **O estoque é um segundo ledger:** `movimento_estoque`, também só de inclusão. A quantidade de um lote é a soma dos seus movimentos.
3. **Gasto duplo impossível:** a compra trava o comprador e os lotes, confere saldo e estoque dentro da transação, e o banco ainda recusa qualquer lote negativo (trigger).
4. **Imutabilidade de preços e parâmetros:** preço por item (`preco_item`) e `config_loja` são versionados, como `config_pontuacao`. A compra grava o preço e a taxa usados.
5. **O módulo `loja` usa `ledger` e `estoque`; o `ledger` continua sem conhecer a loja** (a mesma regra de dependência do Épico I).

---

## 2. Modelo de dados (migration nova; nenhuma tabela do Épico I muda de significado)

### 2.1 Tabelas novas

| Tabela | Campos | Regras de banco |
|---|---|---|
| `preco_item` | `id`, `item_id`, `preco_pontos` (nulo = fora da loja), `vigente_desde`, `criado_por` | CHECK `preco_pontos > 0` quando não nulo. Trigger bloqueia UPDATE/DELETE. O preço vigente é a linha mais recente do item (D21) |
| `config_loja` | `id`, `versao` (única), `taxa_consignacao_bp` (0–10000), `vigente_desde`, `criada_por` | Imutável (trigger). Seed v1 com taxa 0 (D22) |
| `lote_estoque` | `id`, `item_id`, `dono_jogador_id` (nulo = grupo), `origem` (`MANUAL`, `DROP_RUN`, `OFERTA`), `oferta_id` (único, nulo), `ativo`, `criado_em`, `criado_por` | Um lote por oferta. Um lote inativo não vende, mas mantém o histórico |
| `movimento_estoque` | `id`, `lote_id`, `quantidade` (≠ 0, com sinal), `tipo`, `drop_run_id`, `compra_id`, `motivo`, `criado_por`, `criado_em` | Só inclusão (trigger). **Trigger AFTER INSERT recusa se a soma do lote ficar negativa.** Índice único parcial: um `drop_run_id` só pode ter uma `ENTRADA` (D18) |
| `compra` | `id`, `comprador_jogador_id`, `item_id`, `quantidade` (> 0), `preco_unitario`, `total`, `config_loja_id`, `status` (`PENDENTE_ENTREGA`, `ENTREGUE`, `CANCELADA`), `criada_em`, `entregue_em`, `entregue_por`, `cancelada_em`, `cancelada_por`, `motivo_cancelamento` | CHECK `total = quantidade × preco_unitario`. CHECK de coerência entre o status e os campos de entrega e cancelamento |
| `compra_lote` | `id`, `compra_id`, `lote_id`, `quantidade` (> 0), `valor_vendedor` (≥ 0; zero para lote do grupo) | Uma compra pode consumir vários lotes, por ordem de chegada (D27). A soma das quantidades é igual à da compra |
| `oferta_venda` | `id`, `jogador_id`, `item_id`, `quantidade` (> 0), `status` (`PENDENTE`, `APROVADA`, `REJEITADA`, `RETIRADA_SOLICITADA`, `RETIRADA`, `ESGOTADA`), `motivo`, `criada_em`, `analisada_por`, `analisada_em` | Sem preço (C12). Rejeição exige motivo |

**Tipos de movimento:**

| Tipo | Sinal | Quando |
|---|---|---|
| `ENTRADA` | + | Entrada manual, drop de run ou aprovação de oferta |
| `VENDA` | − | Compra (a reserva acontece na hora, D19) |
| `DEVOLUCAO` | + | Compra cancelada antes da entrega (D25) |
| `RETIRADA` | − | Item consignado devolvido ao vendedor (D25) |
| `AJUSTE` | ± | Correção do admin; exige motivo |
| `NEBULA` | − | Reservado para o Épico III |

### 2.2 Mudanças em tabelas existentes

| Tabela | Mudança |
|---|---|
| `item_catalogo` | `+ reserva_minima` (inteiro ≥ 0, padrão 0, D26), `+ limite_por_membro` e `+ limite_periodo_dias` (os dois nulos ou os dois > 0, D24) |
| `lancamento_pontos` | `+ compra_id` (FK, nulo). `+ compra_lote_id` para o lançamento de `VENDA` ao vendedor |

### 2.3 Regras derivadas (calculadas, não guardadas)

- **Elegível para a loja:** `negociavel = true`, `vinculado_conta = false`, item ativo e preço vigente não nulo (D20, D21).
- **Disponível do grupo** = max(0, Σ dos lotes ativos do grupo − `reserva_minima`) (D26).
- **Disponível consignado** = Σ dos lotes ativos consignados. A reserva não se aplica a eles: os itens são dos vendedores.
- **Disponível na loja** = disponível do grupo + disponível consignado.
- **Ordem de consumo (D27):** lotes ativos do item por `criado_em` crescente (o mais antigo primeiro). A reserva mínima é sempre preservada nos lotes do grupo.
- **Limite (D24):** soma das quantidades das compras não canceladas do membro naquele item nos últimos `limite_periodo_dias`.

---

## 3. Fluxos transacionais (backend)

### 3.1 Compra (`POST /api/loja/compras`, US-11)

Tudo numa única transação:

1. Trava a linha do jogador comprador (`SELECT ... FOR UPDATE`) e os lotes ativos do item, na ordem de consumo.
2. Confere a elegibilidade (§2.3) e o vínculo do comprador (D12). O comprador não pode ser dono de nenhum lote consumido: lotes próprios são pulados, e se só restarem eles, a compra é recusada (CT-90).
3. Confere o limite do período (D24) e o disponível (§2.3).
4. `total = quantidade × preço vigente` e confere `saldo ≥ total` (D24: nunca negativo).
5. Grava a compra (status `PENDENTE_ENTREGA`, preço e `config_loja` vigentes), uma linha de `compra_lote` por lote consumido (FIFO) e os movimentos `VENDA` (−).
6. Lançamentos:
   - `COMPRA` −total ao comprador;
   - para cada lote consignado, o valor do vendedor, (valor − ⌊valor × taxa⌋), fica **gravado** em `compra_lote` com a taxa vigente na compra. **Pela D28, o `VENDA` só é lançado na entrega (§3.2).**

   No lote do grupo os pontos saem de circulação (D23). Com a taxa v1 = 0, o vendedor recebe o valor integral.
7. Se algum lote consignado zerar, a oferta passa a `ESGOTADA`.

### 3.2 Entrega e cancelamento (US-12)

- **Entregar** (`POST /api/compras/:id/entregar`, só admin): `PENDENTE_ENTREGA` → `ENTREGUE`, com `entregue_por` e `entregue_em`. Lança o `VENDA` de cada vendedor consignado (D28). Não movimenta estoque, que já foi baixado na compra.
- **Cancelar** (`POST /api/loja/compras/:id/cancelar` pelo comprador, ou `/api/compras/:id/cancelar` pelo admin, com motivo), só antes da entrega (D25):
  - um `ESTORNO` para cada lançamento da compra (pela D28, só o `COMPRA` do comprador: o vendedor ainda não recebeu);
  - um movimento `DEVOLUCAO` (+) em cada lote;
  - a oferta `ESGOTADA` volta a `APROVADA`, se o lote dela ainda estiver ativo.

  Compra entregue: 409.

### 3.3 Estoque (US-09)

- **Entrada manual** (`POST /api/estoque/entradas`): item elegível (exceto pelo preço: dá para estocar antes de precificar) e quantidade > 0. Cada entrada cria um **lote novo** do grupo, de origem `MANUAL`, para preservar a ordem de chegada (D27), e registra uma `ENTRADA`.
- **Drops da run** (`POST /api/runs/:id/estoque`): para cada drop da run ainda não lançado e cujo item é elegível, cria um lote do grupo de origem `DROP_RUN` e uma `ENTRADA` com `drop_run_id`.
  - O índice único impede lançar o mesmo drop duas vezes (CT-88).
  - Drops de itens não elegíveis são listados na resposta como "não lançados (negociabilidade)".
  - Runs `ESTORNADA` não lançam: vale a run corrigida.
- **Ajuste** (`POST /api/estoque/ajustes`): ± com motivo obrigatório. O trigger recusa resultado negativo.
- **Consulta:** `GET /api/estoque` (por item: grupo, reservado, consignado e disponível) e `GET /api/estoque/movimentos` (filtros por item, lote, tipo e período).

### 3.4 Ofertas (US-14, US-15)

- **Membro:** `POST /api/loja/ofertas` (item elegível exceto pelo preço, C13) → `PENDENTE`. Pode haver várias ofertas pendentes, uma por item.
- **Admin aprova** (`POST /api/ofertas/:id/aprovar`), depois de receber o item no jogo: cria o lote do vendedor (origem `OFERTA`) e uma `ENTRADA`, e a oferta passa a `APROVADA`.
- **Admin rejeita** (`POST /api/ofertas/:id/rejeitar`, com motivo): a oferta passa a `REJEITADA`.
- **Retirada** (D25), em dois passos:
  1. O vendedor pede (`POST /api/loja/ofertas/:id/retirar`): o lote é desativado na hora, deixa de vender, e a oferta fica `RETIRADA_SOLICITADA`.
  2. O admin conclui (`POST /api/ofertas/:id/concluir-retirada`) depois de devolver o item no jogo: registra uma `RETIRADA` do saldo restante, e a oferta fica `RETIRADA`.

  As compras já feitas desse lote continuam válidas.

### 3.5 Preços e parâmetros

- `POST /api/loja/precos` `{ itemId, precoPontos | null }` (admin) cria uma nova linha em `preco_item`. Nulo tira o item da loja.
- `GET /api/loja/precos/:itemId` devolve o histórico.
- `POST /api/config-loja` cria uma nova versão da taxa, e `GET /api/config-loja` devolve o histórico.
- `PATCH /api/itens/:id` passa a aceitar `reservaMinima`, `limitePorMembro` e `limitePeriodoDias`.

### 3.6 Leitura para o membro

- `GET /api/loja`: itens elegíveis com preço vigente, disponível e quanto ainda cabe no limite do membro.
- `GET /api/loja/compras` e `GET /api/loja/ofertas`: só as do próprio membro (mesma visibilidade da D14).
- O extrato (`/api/extrato/*`) passa a descrever os lançamentos `COMPRA`, `VENDA` e os estornos da loja: item, quantidade e comprador ou vendedor.

### 3.7 Autorização

| Rota | Quem |
|---|---|
| `/api/loja/*` | Membro com vínculo aprovado (sem vínculo, 403) |
| `/api/estoque/*`, `/api/compras/*` (admin), `/api/ofertas/*` (admin), preços, config da loja | Só admin (403 para membro) |

---

## 4. Frontend

| Rota | Perfil | Conteúdo |
|---|---|---|
| `/loja` | Membro vinculado | Vitrine: item, tipo, preço, disponível, limite restante e saldo. Botão "Comprar", com quantidade e confirmação mostrando o saldo depois da compra |
| `/loja/compras` | Membro | Minhas compras: status e data, com cancelar enquanto pendente |
| `/loja/ofertas` | Membro | Minhas ofertas (status e motivo da rejeição), nova oferta e pedido de retirada |
| `/admin/estoque` | Admin | Por item: grupo, reserva, consignado e disponível. Entrada manual, ajuste com motivo e histórico de movimentos com filtros |
| `/admin/compras` | Admin | Compras pendentes de entrega, das mais antigas para as mais novas (risco do §7.3 da análise), com entregar e cancelar. Filtro por status |
| `/admin/ofertas` | Admin | Fila de ofertas pendentes (aprovar ou rejeitar com motivo) e retiradas a concluir |
| `/admin/itens` (existente) | Admin | Novas colunas: preço vigente (com histórico), reserva mínima e limite. Itens não elegíveis aparecem sinalizados com o motivo ("negociabilidade desconhecida") |
| `/admin/parametros` (existente) | Admin | Nova seção "Taxa da loja", com versões e histórico |
| `/admin/runs/:id` (existente) | Admin | Botão "Lançar drops no estoque", com o resultado: lançados e não lançados, com o motivo |

O menu do membro ganha **Loja**. O de admin ganha **Estoque**, **Compras** e **Ofertas**.

---

## 5. Tarefas e marcos (PO)

| Marco | Entrega verificável |
|---|---|
| M7 Estoque e preços | O admin dá entrada no estoque (manual e pelos drops), define preços e reservas, e o banco garante estoque não negativo e ledger de estoque imutável |
| M8 Loja e compras | O membro compra e cancela; o admin entrega. Saldo e estoque nunca ficam negativos, nem com compras simultâneas |
| M9 Ofertas e consignação | O jogador oferece, o admin aprova, outro membro compra, o vendedor recebe; a retirada funciona. Testes e2e e relatório de QA |

| ID | Tarefa | Dono | Depende de | História |
|---|---|---|---|---|
| T-26 | Migration: tabelas novas, campos novos, triggers (imutabilidade e lote não negativo), índice único de drop, seed `config_loja` v1 | BE | — | Todas |
| T-27 | Módulo `estoque`: entradas, drops da run, ajustes, consulta de disponibilidade e movimentos | BE | T-26 | US-09 |
| T-28 | Preço por item e `config_loja` versionados; reserva e limite no item | BE | T-26 | US-09 |
| T-29 | Telas `/admin/estoque`, colunas novas em `/admin/itens`, taxa em `/admin/parametros` e botão na run | FE | T-27, T-28 | US-09 |
| T-30 | Módulo `loja`: vitrine, compra transacional (travas, FIFO, limite, reserva, saldo) | BE | T-27, T-28 | US-10, US-11 |
| T-31 | Entrega e cancelamento (estornos e devolução ao lote) | BE | T-30 | US-12 |
| T-32 | Extrato com `COMPRA`/`VENDA`/estornos da loja | BE + FE | T-30 | US-13 |
| T-33 | Telas `/loja`, `/loja/compras` e `/admin/compras` | FE | T-30, T-31 | US-10 a US-13 |
| T-34 | Ofertas: criar, aprovar, rejeitar, pedir e concluir retirada; `ESGOTADA` e reabertura no cancelamento | BE | T-30 | US-14 |
| T-35 | Venda consignada: `VENDA` ao vendedor com taxa, estorno no cancelamento | BE | T-34 | US-15 |
| T-36 | Telas `/loja/ofertas` e `/admin/ofertas` | FE | T-34 | US-14, US-15 |
| T-37 | Testes de integração (CT-81 a CT-105) e e2e da loja | QA | T-31, T-35 | Todas |
| T-38 | Validação dos critérios de aceite e relatório do Épico II | QA | T-37 | Todas |

**Caminho crítico:** T-26 → T-27 → T-30 → T-31 → T-34 → T-35 → T-37 → T-38.

**Bloqueio operacional (não técnico):** sem a verificação da negociabilidade no bRO, a loja funciona, mas nenhum item da Torre fica elegível (D20). Para testar em produção antes disso, o admin pode marcar um item já confirmado no jogo.

---

## 6. Plano de testes (QA)

Os CT-81 a CT-95 da análise continuam valendo (com CT-89 e CT-91 já ajustados para D21 e D22). Casos novos:

| ID | História | Cenário | Esperado |
|---|---|---|---|
| CT-96 | D27 | Item com lote do grupo (entrada em 01/11) e lote consignado de B (em 05/11). Compra de 1 | Sai do lote do grupo: pontos fora de circulação; B não recebe |
| CT-97 | D27 | Compra de 3 unidades: 2 no lote mais antigo (consignado de B) e 5 no seguinte (grupo) | 2 do lote de B (B recebe 2 × preço) e 1 do grupo; duas linhas em `compra_lote` |
| CT-98 | D26 | Grupo com 12, reserva 10, e consignado de B com 3 | Disponível = 2 + 3 = 5. Uma compra de 6 é recusada |
| CT-99 | D21 | Item com preço nulo ou sem preço | Não aparece na loja; a compra é recusada |
| CT-100 | D22 | Taxa muda de 0% para 10% entre duas compras consignadas | A primeira paga o valor integral e a segunda 90%. Cada compra grava a sua `config_loja` |
| CT-101 | D24 | Limite de 2 por 7 dias; o membro comprou 2 há 3 dias e cancelou 1 | Pode comprar mais 1; a segunda é recusada |
| CT-102 | D25 | Vendedor pede retirada com uma compra pendente do lote | O lote para de vender; a compra pendente pode ser entregue; a retirada concluída baixa só o restante |
| CT-103 | D25 | Cancelamento de compra que esgotou uma oferta | Estornos ao comprador e ao vendedor; o lote recebe a devolução; a oferta volta a `APROVADA` |
| CT-104 | US-09 | Ajuste negativo que deixaria o lote abaixo de zero | Recusado pelo serviço e pelo trigger do banco |
| CT-105 | D18 | Lançar drops de uma run com um item não elegível e outro elegível | Só o elegível entra; a resposta lista o outro com o motivo. Run `ESTORNADA` não lança |
| CT-106 | D12 | Membro sem vínculo acessa `/api/loja` | 403 |
| CT-107 | US-12 | Membro tenta entregar uma compra ou cancelar a de outro | 403 |
| CT-108 | Invariante | Após qualquer sequência de compras, cancelamentos e vendas | Σ dos `COMPRA` + Σ dos `VENDA` + Σ dos estornos da loja = −(pontos que saíram de circulação). O estoque de cada lote é igual à soma dos movimentos |

**E2e (T-37):**
1. O admin precifica um item já marcado como negociável e lança os drops de uma run.
2. O membro compra; o saldo cai e a compra fica pendente.
3. O admin entrega.
4. Outro membro oferece um item; o admin aprova; um terceiro compra e o vendedor recebe.
5. O comprador cancela uma compra pendente e recebe o estorno.

**Verificação de integridade pós-restauração:** `database/backup/verificar-integridade.sql` ganha a checagem "lote nunca negativo" e a soma dos lançamentos por compra.

---

## 7. Impacto no que já existe

- **Migration aditiva:** nenhuma coluna existente muda de sentido; backup e restauração seguem iguais.
- **Extrato e relatório:** os tipos `COMPRA`/`VENDA` já existiam no enum (reservados no Épico I).
- **CSP e infraestrutura:** sem mudanças.
- **Épico III:** os movimentos `NEBULA` e `reserva_minima` já deixam o caminho preparado; a receita da Nebula continua fora deste épico.

---

## 8. Ajustes feitos na implementação do M7

- **`preco_item.versao`** (1, 2, 3... por item, único com o item): a versão vigente é a de maior número. O horário não basta, porque duas mudanças na mesma transação teriam o mesmo horário.
- **`lote_estoque.ordem`** (sequência única): é a ordem de chegada estrita da D27. Os drops de uma mesma run são gravados na mesma transação e teriam o mesmo `criado_em`.
- **View `saldo_lote`:** quantidade atual por lote, usada no resumo, nos lotes e na verificação de integridade do backup.
- **CHECK do limite (D24) escrito com `IS NOT NULL` explícito:** com valor nulo, a comparação vira `NULL`, e o Postgres aceitaria só um dos dois campos. O teste de integração pegou esse caso.
