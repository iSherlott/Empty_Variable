# Épico III: planejamento técnico (Etapa 2)

**Status:** implementado. M10 (T-39 a T-42) e M11 (T-43 a T-47) em 2026-11-15. Relatório: `docs/qualidade/relatorio-epico3.md`.

**Base:**
- Análise: `docs/analise/epico3-nebula.md`.
- Decisões D29 a D36: `docs/DECISOES.md`.
- Sistema atual: estoque com lotes do grupo e ordem de chegada (D27), reserva mínima (D26), ledger de pontos, movimento de estoque `NEBULA` já previsto no banco.

**Responsáveis:** Arquiteto (§1 a §3), Frontend (§4), PO (§5) e QA (§6). Consolidação pelo orquestrador.

---

## 1. Princípios

1. **Receita é dado, não código.** Componentes e quantidades ficam no banco e são cadastrados e validados pelo admin, como o briefing pede.
   - As receitas da fonte (browiki) entram como **inativas**, marcadas "a validar". O admin confere com o jogo e ativa.
   - Nenhuma receita inativa ou sem preço pode ser solicitada.
2. **Mesmos padrões da loja:**
   - pontos só no ledger;
   - estoque só por movimentos, que nunca são editados nem apagados;
   - preços versionados;
   - o preço fica gravado na solicitação;
   - comprador e lotes travados durante a solicitação;
   - consumo por ordem de chegada.
3. **Só o estoque do grupo (D33):** lotes consignados nunca entram. A reserva mínima (D26) **pode** ser consumida pela Nebula, porque existe justamente para ela.
4. **O membro fabrica (D30):** o sistema registra a entrega dos **materiais**. A Nebulosa pronta não passa pelo estoque.

---

## 2. Modelo de dados (migration nova; aditiva)

### 2.1 Tabelas novas

| Tabela | Campos | Regras de banco |
|---|---|---|
| `receita` | `id`, `nome` (único), `item_produzido_id`, `solicitavel` (as 6 Nebulosas = true; as 3 Astrais = false), `ativa` (começa `false`, "a validar"), `fonte` (texto, ex.: "browiki · Trocas"), `limite_por_membro`, `limite_periodo_dias` (D35: os dois nulos ou os dois > 0), `criada_em` | CHECK do limite à prova de nulos (lição do M7) |
| `receita_componente` | `id`, `receita_id`, `item_id`, `quantidade` (> 0), `peca_base` (bool) | UNIQUE (`receita_id`, `item_id`); no máximo **uma** `peca_base` por receita (índice parcial) |
| `receita_peca` | `receita_id` (da Nebulosa), `receita_peca_id` (da Astral) | Liga a peça-base à receita dela, para usar os materiais quando não houver a peça pronta (D31) |
| `preco_receita` | `id`, `receita_id`, `versao`, `preco_com_peca`, `preco_trazendo_peca` (D32), `vigente_desde`, `criado_por` | Só inclusão (trigger); UNIQUE (`receita_id`, `versao`); preços > 0 |
| `solicitacao_nebula` | `id`, `jogador_id`, `receita_id`, `traz_peca` (D31), `peca_do_estoque` (`PRONTA`, `MATERIAIS` ou nulo), `preco` (fotografia), `preco_receita_id`, `status` (`PENDENTE`, `ENTREGUE`, `CANCELADA`, `REJEITADA`), `motivo`, `criada_em`, `entregue_em`/`entregue_por`, `encerrada_em`/`encerrada_por` | CHECK de coerência do status com os campos; a rejeição exige motivo |

### 2.2 Mudanças em tabelas existentes

| Tabela | Mudança |
|---|---|
| `movimento_estoque` | `+ solicitacao_nebula_id` (FK). CHECK: o tipo `NEBULA` exige a solicitação; `DEVOLUCAO` exige compra **ou** solicitação |
| `lancamento_pontos` | `+ solicitacao_nebula_id` (FK). Enum `TipoLancamento` ganha `NEBULA` (débito do membro) |
| `item_catalogo` | **Migração de dados:** renomeia os 6 pós ("Pó de Talento (Poder)" → "Pó de Meteorito do Poder" etc., só onde o nome ainda é o do seed) e cadastra **Armadura/Túnica/Veste Astral** e as **6 Nebulosas**, com negociabilidade desconhecida |

### 2.3 Seed das receitas (inativas, "a validar")

Fonte: browiki, seção "Trocas" (`docs/analise/epico3-nebula.md` §2.1):

- **Armadura, Túnica e Veste Astral:** 50 Fragmento de Meteorito + 5 Alma de Naght Sieger (`solicitavel = false`).
- **6 Nebulosas:** 50 Fragmento de Meteorito + 30 do pó do talento + 10 Alma de Betelgeuse + 1 peça Astral correspondente (`peca_base`).

As receitas não recebem preço. Sem preço e sem ativação, não aparecem para solicitar.

---

## 3. Fluxos (backend)

### 3.1 Disponibilidade (US-17)

Para cada receita solicitável e ativa, o sistema calcula duas quantidades:

- **trazendo a peça:** o mínimo, entre os componentes que não são a peça-base, de ⌊disponível do grupo ÷ quantidade⌋;
- **com a peça do estoque:** primeiro usa as peças prontas do grupo; o que faltar sai dos materiais da receita da peça, **somados** aos materiais da própria Nebulosa (os Fragmentos são disputados pelas duas), calculando o máximo exato.

"Disponível do grupo" = soma dos lotes **ativos do grupo**, incluindo a reserva (D33). A resposta também traz, por componente, **tenho / preciso / falta**, para a tela mostrar o que falta.

### 3.2 Solicitar (`POST /api/nebula/solicitacoes`, US-18)

Tudo numa única transação:

1. Exige vínculo (D12). Trava a linha do jogador.
2. A receita precisa estar ativa, solicitável e com preço vigente. O preço vem da versão vigente, conforme `traz_peca` (D32).
3. Confere o limite do período (D35).
4. Trava os lotes ativos do **grupo** dos itens envolvidos, em ordem de item, para evitar impasse entre transações. Calcula o consumo:
   - os componentes, exceto a peça;
   - se a peça vem do estoque: a peça pronta (`PRONTA`) ou os materiais dela (`MATERIAIS`), tudo por ordem de chegada (D27).

   Faltou material: 409, com o que falta.
5. Confere `saldo ≥ preço` (sem saldo: 422).
6. Grava a solicitação `PENDENTE`, os movimentos `NEBULA` (−) por lote e o lançamento `NEBULA` (−preço).

### 3.3 Entregar, cancelar, rejeitar (US-19, D36)

- **Entregar** (`POST /api/nebula/solicitacoes/:id/entregar`, admin): `PENDENTE` → `ENTREGUE`, com autor e data. O estoque já foi baixado.
- **Cancelar** (membro, a própria) ou **rejeitar** (admin, com motivo), só enquanto `PENDENTE`:
  - `ESTORNO` do débito;
  - `DEVOLUCAO` (+) de cada movimento `NEBULA` no lote de origem;
  - status `CANCELADA` ou `REJEITADA`.

### 3.4 Receitas (US-16, admin)

- `GET /api/receitas` devolve as receitas com componentes, preço vigente, situação (ativa, a validar) e disponibilidade.
- `POST /api/receitas` cria. `PATCH /api/receitas/:id` altera nome, ativa, solicitável e limite.
- `PUT /api/receitas/:id/componentes` substitui a lista de componentes. **Só é permitido enquanto não houver solicitação pendente da receita.** As solicitações já gravam o que consumiram (movimentos), então mudar a receita não altera o passado.
- `POST /api/receitas/:id/precos` cria uma nova versão com os dois preços. `GET /api/receitas/:id/precos` devolve o histórico.

### 3.5 Membro

- `GET /api/nebula` lista as receitas solicitáveis e ativas, com preço, disponibilidade (as duas modalidades), componentes com tenho/preciso/falta, limite restante e saldo.
- `GET /api/nebula/solicitacoes` devolve as próprias solicitações. `POST .../:id/cancelar` cancela uma pendente.

### 3.6 Autorização

| Rota | Quem |
|---|---|
| `/api/nebula*` | Membro com vínculo aprovado |
| `/api/receitas*`, fila do admin (`GET /api/nebula/fila`), entregar e rejeitar | Só admin |

---

## 4. Frontend

| Rota | Perfil | Conteúdo |
|---|---|---|
| `/nebula` | Membro vinculado | Grade das 6 Nebulosas, agrupadas por peça (Armadura, Túnica e Veste). Cada cartão mostra os componentes com uma barra tenho/preciso, a escolha "Trago minha peça Astral" (que muda o preço e a disponibilidade), o preço, o limite e o botão **Solicitar**, habilitado só quando tudo está disponível (briefing §7). Detalhes ao passar o mouse, como na loja |
| `/nebula/solicitacoes` | Membro | Minhas solicitações, situação e cancelamento enquanto pendente. Lembrete: "você fabrica nas máquinas do Oscar; é preciso ter vencido o Betelgeuse" |
| `/admin/nebula` | Admin | Fila de pendentes, das mais antigas para as mais novas, com os materiais a entregar por item e lote, e as ações entregar e rejeitar com motivo |
| `/admin/receitas` | Admin | Receitas com o selo "a validar", editor de componentes, preços (os dois valores e o histórico), limite, ativar e fonte |

As telas seguem o tema escuro frio atual. O menu do membro ganha **Nebula**; o do admin, **Nebula** (fila) e **Receitas** (em Cadastros).

---

## 5. Tarefas e marcos (PO)

| Marco | Entrega verificável |
|---|---|
| M10 Receitas e disponibilidade | Receitas cadastradas, validadas e precificadas pelo admin. A disponibilidade das 6 Nebulosas aparece corretamente nas duas modalidades |
| M11 Solicitação | O membro solicita, o admin entrega ou rejeita, o membro cancela. Pontos e estoque fecham, inclusive com concorrência. E2e e relatório |

| ID | Tarefa | Dono | Depende de | História |
|---|---|---|---|---|
| T-39 | Migration: tabelas, CHECKs, triggers, enum `NEBULA`, migração do catálogo (renomear os pós, criar as Astrais e as Nebulosas), seed das 9 receitas inativas | BE | — | Todas |
| T-40 | Módulo `receitas`: CRUD, componentes, preços versionados, ativar, limite | BE | T-39 | US-16 |
| T-41 | Cálculo de disponibilidade (as duas modalidades, com Fragmentos compartilhados) | BE | T-40 | US-17 |
| T-42 | Tela `/admin/receitas` | FE | T-40 | US-16 |
| T-43 | Solicitar (transação, travas, ordem de chegada, peça pronta ou materiais, limite, saldo) | BE | T-41 | US-18 |
| T-44 | Entregar, cancelar e rejeitar (estorno e devolução) e extrato `NEBULA` | BE | T-43 | US-19, US-20 |
| T-45 | Telas `/nebula`, `/nebula/solicitacoes` e `/admin/nebula` | FE | T-43, T-44 | US-17 a US-20 |
| T-46 | Testes de integração (CT-109 a CT-128) e e2e | QA | T-44, T-45 | Todas |
| T-47 | Relatório do Épico III; atualizar a verificação de integridade do backup | QA | T-46 | Todas |

**Caminho crítico:** T-39 → T-40 → T-41 → T-43 → T-44 → T-46 → T-47.

**Bloqueio operacional:** sem confirmar no bRO a negociabilidade dos materiais e o vínculo da Nebulosa (análise §2.3), o fluxo funciona no sistema, mas pode não ser executável no jogo.

---

## 6. Plano de testes (QA)

Os CT-109 a CT-119 da análise continuam valendo. Casos novos:

| ID | Cenário | Esperado |
|---|---|---|
| CT-120 | Receita do seed (inativa, sem preço) | Não aparece em `/api/nebula`; solicitar dá 422 |
| CT-121 | D31: a peça vem do estoque e há 1 Armadura Astral pronta | Consome a peça pronta (`PRONTA`); não consome os materiais da Astral |
| CT-122 | D31: sem peça pronta, mas há 100 Fragmentos e 5 Almas de Naght, além dos demais materiais | Consome os materiais da Astral (`MATERIAIS`): 50 + 50 Fragmentos no total |
| CT-123 | Disponibilidade com Fragmentos compartilhados: 120 Fragmentos e todo o resto sobrando | Trazendo a peça: 2. Com a peça do estoque e sem Astral pronta: 1 (120 ÷ 100) |
| CT-124 | D32: os dois preços | Trazendo a peça cobra `preco_trazendo_peca`; a peça do estoque cobra `preco_com_peca`. A solicitação grava o valor e a versão |
| CT-125 | Mudar os componentes com uma solicitação pendente | 409. Sem pendentes, é permitido, e as solicitações antigas mantêm os movimentos |
| CT-126 | Duas solicitações simultâneas de receitas diferentes que disputam os Fragmentos | Uma passa e a outra é recusada; sem impasse (travas em ordem de item) |
| CT-127 | Cancelamento depois de o admin aumentar a reserva mínima | A devolução volta ao lote de origem; a reserva continua valendo para a loja |
| CT-128 | Invariante | Σ dos lançamentos `NEBULA` + estornos = −Σ dos preços das não canceladas/rejeitadas; Σ dos movimentos `NEBULA` + devoluções por solicitação = 0 nas canceladas e rejeitadas |

**E2e (T-46):**
1. O admin valida, ativa e precifica a Armadura Nebulosa POD e dá entrada nos materiais.
2. O membro vê "pode solicitar", passa o mouse nos detalhes e solicita trazendo a peça.
3. O admin entrega.
4. Outra solicitação é rejeitada com motivo, e tudo volta.

---

## 7. Impacto no que já existe

- **Migration aditiva:** o enum de lançamentos ganha `NEBULA`, e `movimento_estoque` e `lancamento_pontos` ganham uma FK opcional.
- **Catálogo:** os pós são renomeados para o nome oficial. Compras e lançamentos antigos apontam para o mesmo item, só o nome muda.
- **Loja:** nenhuma mudança de regra. A reserva mínima continua protegendo a loja, e a Nebula pode consumi-la.
- **Backup:** a verificação de integridade ganha as checagens da Nebula (CT-128).
