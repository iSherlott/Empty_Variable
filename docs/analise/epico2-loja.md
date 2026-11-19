# Épico II: loja de pontos e estoque. Análise (Etapa 1)

**Status:** Análise concluída. Decisões D18 a D26 **aprovadas em 2026-11-14** (ver §3.1). Próximo passo: planejamento técnico. **Nada foi implementado.**

**Base:** briefing §6 (6.1 estoque, 6.2 membros, 6.3 venda pelos jogadores), decisões D1 a D17 e o sistema do Épico I já em produção no código: ledger só de inclusão, catálogo de itens, drops por run e tipos de lançamento `COMPRA`/`VENDA` reservados.

**Participantes:** PO (regras e histórias), BA (itens e mecânica do jogo), Arquiteto (modelo) e QA (cenários). Consolidação pelo orquestrador.

---

## 1. O que o briefing pede

| Bloco | Requisitos | Já existe no Épico I |
|---|---|---|
| 6.1 Admin | Cadastrar itens; dar entrada no estoque; definir quantidade disponível e custo em pontos; consultar movimentações; gerenciar disponibilidade; histórico de entradas e saídas | Catálogo de itens (`item_catalogo`) e drops registrados por run (`drop_run`, informativo) |
| 6.2 Membros | Consultar saldo; ver itens disponíveis e preços; comprar com pontos; histórico de compras | Saldo e extrato (`/me`) |
| 6.3 Venda por jogadores | Jogador cadastra o item → admin avalia e aprova → item entra no estoque → outro membro compra → os saldos dos envolvidos são movimentados. "Precificação, aprovação e transferência dos pontos ainda precisam ser definidas" | Nada |

**Premissa central (BA):** o sistema **não movimenta itens dentro do jogo**. Ele é o registro da posse, dos preços e dos pontos. A entrega acontece no jogo, por troca entre personagens. Por isso toda compra precisa de um passo humano de **entrega**, e o estoque registra itens que estão fisicamente com alguém (um "guardião" do grupo ou o próprio vendedor).

---

## 2. Pesquisa do BA

### 2.1 Negociabilidade dos itens (bloqueio herdado do Épico I)

| Fonte | O que informa | Confiável para o bRO? |
|---|---|---|
| browiki.org (Torre da Constelação) | Nada sobre negociar, vincular à conta ou ao personagem. Só cita a troca de Meteoritos nas máquinas do NPC Oscar | Não responde |
| divine-pride.net (item 1000397, Alma de Betelgeuse) | Lista as ações Drop, Trade, Store, Cart, Sell, Mail, Auction e Guild, sem dizer se são permitidas ou restritas. Os dados são de outro servidor | **Não**: ambíguo e de outro servidor |

**Conclusão:** a negociabilidade **não foi confirmada**. Ela decide o que a loja pode vender:

- Item **vinculado à conta** não pode ser entregue a outro jogador, então não pode estar na loja.
- Se as Almas e os Pós forem vinculados à conta, a loja fica restrita a cartas, visuais e equipamentos negociáveis. Nesse caso, a Nebula do Épico III não poderia usar estoque comum.

**Ação necessária (fora do sistema):** alguém do grupo testa no bRO, para cada item do catálogo, se ele pode ser negociado com outro jogador e guardado no armazém da guilda. O resultado é registrado nos campos `negociavel` e `vinculadoConta`, pela tela `/admin/itens`.

### 2.2 Mecânica relevante

- Uma troca no jogo exige os dois personagens online ao mesmo tempo. Por isso a entrega é assíncrona.
- O armazém da guilda permite que vários admins acessem um estoque comum, mas só para itens que o jogo deixa guardar lá.
- Os drops da Torre caem para os personagens que participaram, não para o grupo. Para virar estoque comum, alguém precisa entregá-los ao guardião.

---

## 3. Decisões

### 3.1 Resultado (aprovado em 2026-11-14)

| ID | Decisão aprovada |
|---|---|
| D18 | O loot das runs **pertence ao grupo**. O admin registra as entradas no estoque, com o atalho "lançar drops da run" (cada drop uma vez) |
| D19 | Débito na compra, com o item reservado; o admin marca a entrega |
| D20 | Só itens com negociável = sim e vinculado à conta = não |
| D21 | **Preço único por item**, definido pelo admin no catálogo e igual para todos os lotes e vendedores. A compra grava o preço pago |
| D22 | Consignação. A taxa da loja existe como parâmetro e **começa em 0%** |
| D23 | Os pontos gastos em itens do grupo saem de circulação |
| D24 | Saldo nunca negativo; limite opcional por item e membro num período |
| D25 | Cancelamento pelo membro ou pelo admin antes da entrega; o vendedor retira a oferta até ser vendida |
| D26 | Reserva mínima por item, fora da loja |

**Consequências diretas (C12, C13):** o vendedor não sugere preço, porque o lote consignado é vendido pelo preço do catálogo vigente. E, como o loot da Torre é do grupo, as ofertas de jogadores valem para itens obtidos por outra origem.

### 3.2 Opções analisadas

Cada decisão traz as opções, uma recomendação e o impacto. **Nenhum valor numérico (preço, taxa, limite) foi definido**: são todos parâmetros que o admin ajusta.

### D18: De onde vem o estoque do grupo

| Opção | Como funciona | Impacto |
|---|---|---|
| A. Os drops entram sozinhos | Todo drop registrado na run vira entrada no estoque comum | Simples, mas assume que todo loot é entregue ao grupo. Se isso não for verdade, o estoque mostra itens que ninguém tem |
| **B. Entrada manual, com atalho a partir da run (recomendado)** | O admin registra as entradas; no detalhe da run, um botão "lançar drops no estoque" cria as entradas ligadas aos drops, e cada drop só pode ser lançado uma vez | O estoque só tem o que de fato chegou ao guardião. Cada entrada mostra a origem (run, doação ou oferta) |
| C. Sem ligação com as runs | Entradas sempre avulsas | Perde a rastreabilidade do loot |

**Pergunta extra:** o loot das runs pertence ao grupo, ou a quem dropou? A opção B funciona nos dois casos. A regra do grupo é sua.

### D19: Momento do débito e entrega

| Opção | Como funciona | Impacto |
|---|---|---|
| **A. Débito na compra, com reserva (recomendado)** | Ao comprar, os pontos são debitados (`COMPRA`) e o item fica reservado. O admin marca "entregue" depois da troca no jogo. Cancelar antes da entrega estorna os pontos e devolve o item | Impede gastar o mesmo saldo duas vezes e mantém o saldo exato. É preciso um fluxo de entrega e cancelamento |
| B. Débito na entrega | A compra vira um pedido; os pontos só saem quando o admin entrega | O saldo mostrado não reflete os pedidos pendentes, e dois pedidos podem disputar o mesmo saldo |

### D20: O que pode ser vendido na loja

| Opção | Impacto |
|---|---|
| **A. Só itens com `negociavel = sim` e `vinculadoConta = não` (recomendado)** | Enquanto a negociabilidade estiver "desconhecida", o item não pode ir para a loja. Isso força a verificação do §2.1 |
| B. O admin decide item a item, mesmo sem a verificação | Risco de vender algo impossível de entregar |

### D21: Quem define o preço

| Opção | Impacto |
|---|---|
| **A. O admin define o preço de cada lote (recomendado)** | Lotes do grupo têm preço definido pelo admin. Nas ofertas de jogadores, o vendedor sugere e o admin aprova ou ajusta. O preço fica gravado em cada compra, então mudar o preço não afeta compras passadas |
| B. Preço único por item no catálogo | Mais simples, mas impede que dois vendedores do mesmo item cobrem preços diferentes |
| C. Preço livre do vendedor, sem ajuste | Contraria a aprovação pelo admin pedida no 6.3 |

### D22: Venda por jogadores. Quando e quanto o vendedor recebe

| Opção | Como funciona | Impacto |
|---|---|---|
| **A. Consignação (recomendado)** | Na aprovação, o item vai para o guardião e passa a ser um lote **do vendedor**. Quando outro membro compra, o comprador paga o preço e o vendedor recebe o preço menos a taxa da loja (`VENDA`). O vendedor pode retirar a oferta enquanto ela não for vendida | Bate com o 6.3 ("movimentações no saldo dos envolvidos"). Pontos não são criados: passam do comprador para o vendedor |
| B. O grupo compra na aprovação | O vendedor recebe os pontos ao entregar; o item vira estoque do grupo | Cria pontos sem que nenhum membro pague, o que gera inflação e exige um limite de gastos do grupo |
| C. Troca direta, com a loja só como vitrine | A loja só anuncia, e os jogadores combinam entre si | Perde o controle do saldo |

**Taxa da loja:** um percentual retido nas vendas consignadas, que tira pontos de circulação. O valor fica a definir (pode ser 0%). Será um parâmetro versionado, como os de pontuação.

### D23: O que acontece com os pontos gastos em itens do grupo

| Opção | Impacto |
|---|---|
| **A. Os pontos saem de circulação (recomendado)** | É o "dreno" da economia. Equilibra os pontos criados nas runs e evita inflação |
| B. Os pontos vão para uma conta "tesouro do grupo" | Permite que o grupo gaste depois (por exemplo, para comprar ofertas), mas exige definir quem administra o tesouro |

### D24: Limites e justiça

| Opção | Impacto |
|---|---|
| A. Sem limites | Quem tem mais pontos pode comprar todo o estoque de um item escasso (por exemplo, Alma de Betelgeuse) |
| **B. Limite opcional por item e por membro num período, definido pelo admin (recomendado)** | Por padrão não há limite, e o admin ativa quando quiser. Os valores ficam a seu critério |
| C. Fila ou sorteio para itens escassos | Mais justo, porém mais complexo. Pode ser uma evolução futura |

**Saldo negativo:** a recomendação é **nunca permitir**. Compra sem saldo suficiente é recusada.

### D25: Cancelamentos e devoluções

| Situação | Recomendação |
|---|---|
| Compra ainda não entregue | O membro ou o admin cancela: estorno integral e o item volta ao estoque |
| Compra entregue | Não há devolução pelo sistema. Exceção só por ajuste manual do admin, com motivo e auditoria |
| Oferta aprovada e ainda não vendida | O vendedor retira e o item volta para ele no jogo. O admin registra a saída |
| Oferta vendida | O vendedor não pode mais retirar |

### D26: Reserva para a Nebula (ligação com o Épico III)

Se as Almas de Betelgeuse (o gargalo, segundo o Anexo A) forem vendidas na loja, a Nebula pode nunca juntar material.

| Opção | Impacto |
|---|---|
| **A. Marcação "reservado para receitas" por item ou por quantidade mínima (recomendado)** | O admin define, por exemplo, "manter sempre 10 Almas fora da loja". A regra só vale se o item for negociável (D20) |
| B. Decidir só no Épico III | Risco de vender agora o que a Nebula vai precisar |

---

## 4. Modelo proposto (Arquiteto)

Entidades novas, todas compatíveis com o Épico I:

| Entidade | Campos principais | Regras |
|---|---|---|
| `lote_estoque` | `item_id`, `dono_jogador_id` (nulo = grupo), `ativo`, origem (`MANUAL`, `DROP_RUN`, `OFERTA`) | Lote do grupo (D18) ou do vendedor (D22). Sem preço próprio: vale o preço do item (D21) |
| `preco_item` (versionado) | `item_id`, `preco_pontos` (nulo = fora da loja), `vigente_desde`, `criado_por` | Preço único por item (D21). Mudar o preço cria uma nova linha, e o histórico fica consultável |
| `movimento_estoque` | `lote_id`, `quantidade` (com sinal), `tipo` (`ENTRADA`, `RESERVA`, `ENTREGA`, `CANCELAMENTO`, `RETIRADA`, `AJUSTE`, `NEBULA` reservado), `drop_run_id`, `compra_id`, `criado_por` e data | **Só inclusão**, como o ledger. A quantidade disponível é a soma dos movimentos; um CHECK/trigger impede que ela fique negativa |
| `oferta_venda` | `jogador_id`, `item_id`, `quantidade`, `status` (`PENDENTE`, `APROVADA`, `REJEITADA`, `RETIRADA`, `ESGOTADA`), `motivo`, `analisada_por` | Ao ser aprovada, cria o lote do vendedor. Mesmo fluxo de aprovação da D12. Sem preço: vale o do item (C12) |
| `compra` | `comprador_jogador_id`, `lote_id`, `quantidade`, `preco_unitario` (fotografia), `total`, `status` (`PENDENTE_ENTREGA`, `ENTREGUE`, `CANCELADA`), `entregue_por`, datas | Gera os lançamentos `COMPRA` (−total) e, se o lote for consignado, `VENDA` (+total − taxa) para o vendedor |
| `config_loja` (versionada) | `taxa_consignacao_bp` (v1 = 0) | Mesmo padrão imutável de `config_pontuacao` (D22) |
| `item_catalogo` (+ campos) | `reserva_minima`, `limite_por_membro`, `limite_periodo_dias` | D26 e D24 (os limites são nulos por padrão). A elegibilidade vem de `negociavel` e `vinculadoConta` (D20) |

**Concorrência (gasto duplo):** a compra bloqueia a linha do jogador comprador (`SELECT ... FOR UPDATE` em `jogador`) e a do lote, recalcula o saldo e o disponível dentro da transação e só então grava. Assim, duas compras simultâneas não passam do saldo nem do estoque.

**Os pontos continuam no ledger:** nenhuma tabela nova guarda saldo. Compra e venda são apenas novos tipos de lançamento, como a arquitetura do Épico I previa.

---

## 5. Histórias de usuário (PO)

**US-09: Gerenciar o estoque (admin)**
Como admin, quero dar entrada em itens (avulsos ou drops de uma run), definir o preço de cada item e a disponibilidade e ver as movimentações, para manter a loja fiel ao que o grupo tem.
- Uma entrada exige item, quantidade inteira maior que zero e origem. Um drop de run só pode ser lançado no estoque uma vez.
- Só aceita item negociável e não vinculado à conta (D20).
- O histórico mostra cada entrada e saída, com quem fez, quando e a origem.
- A quantidade disponível nunca fica negativa.
- O preço é único por item; mudá-lo não altera compras passadas (D21). Item sem preço não aparece na loja.

**US-10: Ver a loja (membro)**
Como membro vinculado, quero ver os itens disponíveis, preços e quantidades, e meu saldo, para decidir o que comprar.
- Só aparecem lotes ativos, com quantidade disponível maior que zero, já descontada a reserva para a Nebula (D26).
- Membro sem vínculo aprovado não acessa a loja (D12).

**US-11: Comprar um item (membro)**
Como membro, quero comprar um item com meus pontos.
- Compra sem saldo suficiente é recusada, e o saldo nunca fica negativo (D24).
- Na compra, os pontos são debitados e o item reservado (D19); o preço fica gravado na compra.
- Duas compras simultâneas não passam do saldo nem do estoque.
- Os limites por item, quando configurados, são respeitados (D24).

**US-12: Entregar ou cancelar uma compra (admin e membro)**
Como admin, quero marcar a entrega depois da troca no jogo, ou cancelar uma compra, para fechar o ciclo.
- Ao entregar, o status vira `ENTREGUE`, e quem entregou e quando ficam registrados.
- Ao cancelar antes da entrega, há estorno integral (lançamento `ESTORNO`) e o item volta ao lote (D25).
- Uma compra entregue não pode ser cancelada pelo sistema.

**US-13: Histórico de compras (membro)**
Como membro, quero ver minhas compras e o status de cada uma.
- No extrato, a compra aparece como lançamento `COMPRA`, com o item e a quantidade.
- O membro vê só as próprias compras; o admin vê todas (mesma regra de visibilidade da D14).

**US-14: Oferecer um item para venda (jogador)**
Como membro, quero oferecer na loja um item meu, obtido fora das runs do grupo (C13).
- Só aceita item negociável (D20). Fica `PENDENTE` até a análise do admin.
- O admin aprova ou rejeita com motivo. A aprovação acontece depois que o item é entregue ao guardião. O preço é o do item no catálogo (C12).
- Enquanto não for vendido, o vendedor pode retirar a oferta (D25).

**US-15: Venda consignada (sistema)**
Como vendedor, quero receber os pontos quando outro membro comprar o meu item.
- O comprador recebe −preço (`COMPRA`) e o vendedor recebe +preço − taxa (`VENDA`), na mesma operação (D22).
- O vendedor não pode comprar o próprio lote.
- Se a compra for cancelada antes da entrega, os dois lançamentos são estornados.

---

## 6. Cenários de teste (QA)

| ID | Cenário | Esperado |
|---|---|---|
| CT-81 | Membro com saldo 300 compra um item de 250 | Saldo 50; lançamento `COMPRA` −250; lote com −1; status `PENDENTE_ENTREGA` |
| CT-82 | Membro com saldo 200 tenta comprar um item de 250 | Recusado; nada é gravado |
| CT-83 | Duas compras simultâneas de 200 com saldo 300 | Uma passa e a outra é recusada; o saldo nunca fica negativo |
| CT-84 | Duas compras simultâneas da última unidade | Uma passa e a outra é recusada; o estoque nunca fica negativo |
| CT-85 | Cancelar uma compra pendente | Estorno de +250; o item volta ao lote; o saldo volta ao anterior |
| CT-86 | Cancelar uma compra entregue | Recusado |
| CT-87 | Item com negociabilidade desconhecida ou vinculado à conta entrando no estoque | Recusado (D20) |
| CT-88 | Lançar no estoque o mesmo drop de run duas vezes | A segunda é recusada |
| CT-89 | Venda consignada de 100 com taxa de 0% (v1) e depois com taxa de X% numa nova versão | Com 0%: comprador −100 e vendedor +100. Com X%: vendedor +(100 − ⌊100·X⌋), e a diferença sai de circulação |
| CT-90 | Vendedor tenta comprar o próprio lote | Recusado |
| CT-91 | Mudar o preço do item depois de uma compra | A compra antiga mantém o preço gravado; as novas usam o preço novo, inclusive nos lotes consignados |
| CT-92 | Reserva mínima de 10 com 12 unidades em estoque | A loja mostra 2 disponíveis |
| CT-93 | Limite de 1 unidade por membro por semana | A segunda compra na semana é recusada |
| CT-94 | Membro tenta ver as compras de outro | 403 |
| CT-95 | Movimentos de estoque e lançamentos | Não podem ser alterados nem apagados (trigger) |

---

## 7. Riscos e dependências

1. **Negociabilidade (§2.1)** é pré-requisito para qualquer venda de verdade. Sem ela, a loja só pode ser testada com itens marcados manualmente.
2. **Economia:** a taxa (D22) e o destino dos pontos gastos (D23) definem se os pontos inflacionam. Vale acompanhar o total em circulação, e o admin pode ter um painel simples com essa informação.
3. **Operação manual da entrega:** compras pendentes acumuladas indicam gargalo do guardião. Proposta: listar as pendentes por idade.
4. **Épico III:** a reserva para a Nebula (D26) precisa ser decidida agora, para não vender o material.

## 8. Próximo passo

Decisões aprovadas. O **planejamento técnico** está em `docs/planejamento/epico2.md` (D27 decidida lá): o arquiteto detalha o schema e as rotas, o PO quebra em tarefas (marcos M7 em diante) e o QA fecha o plano de testes. **A implementação só começa com a sua aprovação.**

**Ação fora do sistema, ainda pendente:** verificar no bRO a negociabilidade de cada item (§2.1). Sem ela, nenhum item da Torre pode entrar na loja (D20).
