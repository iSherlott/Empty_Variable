# Épico III: solicitação de Nebula. Análise (Etapa 1)

**Status:** Análise concluída. Decisões D29 a D36 **aprovadas em 2026-11-14** (§3.1). Próximo passo: planejamento técnico. **Nada foi implementado.**

**Base:**
- Briefing §7.
- Anexo A da análise do Épico I.
- Sistema atual: estoque com lotes do grupo e consignados, reserva mínima por item (D26) e movimento de estoque `NEBULA` já reservado no banco.

**Participantes:** BA (receitas e mecânica), PO (regras e histórias), Arquiteto (modelo) e QA (cenários). Consolidação pelo orquestrador.

---

## 1. O que o briefing pede (§7)

> O sistema deverá identificar automaticamente quando o estoque possuir todos os itens necessários para a fabricação ou obtenção da Nebula.

Quando os requisitos forem atendidos:

1. o sistema identifica que os materiais estão disponíveis;
2. a opção de solicitar a Nebula é habilitada;
3. o membro pode iniciar uma solicitação;
4. o administrador analisa e aprova;
5. o estoque é atualizado conforme a operação aprovada.

**Cuidado explícito do briefing:** "Não assuma receitas ou quantidades sem validar as informações". Por isso as receitas abaixo vêm com a fonte, e o sistema vai tratá-las como **dados que o admin cadastra e o grupo valida**, nunca como constantes no código.

---

## 2. Pesquisa do BA

### 2.1 Receitas (fonte: browiki.org, Torre da Constelação, seção "Trocas", máquinas do NPC Oscar)

| Produto | Ingredientes |
|---|---|
| Fragmento de Meteorito | 50 Pó de Meteorito |
| Armadura Astral / Túnica Astral / Veste Astral | 50 Fragmento de Meteorito + 5 Alma de Naght Sieger |
| Sinete Estelar | 100 Fragmento de Meteorito + 10 Alma de Naght Sieger |
| **Armadura Nebulosa POD** | 50 Fragmento de Meteorito + 30 **Pó de Meteorito do Poder** + 10 Alma de Betelgeuse + 1 **Armadura Astral** |
| **Armadura Nebulosa STA** | 50 Fragmento de Meteorito + 30 **Pó de Meteorito da Estâmina** + 10 Alma de Betelgeuse + 1 **Armadura Astral** |
| **Túnica Nebulosa CON** | 50 Fragmento de Meteorito + 30 **Pó de Meteorito da Concentração** + 10 Alma de Betelgeuse + 1 **Túnica Astral** |
| **Túnica Nebulosa CRV** | 50 Fragmento de Meteorito + 30 **Pó de Meteorito da Criatividade** + 10 Alma de Betelgeuse + 1 **Túnica Astral** |
| **Veste Nebulosa FEI** | 50 Fragmento de Meteorito + 30 **Pó de Meteorito do Feitiço** + 10 Alma de Betelgeuse + 1 **Veste Astral** |
| **Veste Nebulosa SAB** | 50 Fragmento de Meteorito + 30 **Pó de Meteorito da Sabedoria** + 10 Alma de Betelgeuse + 1 **Veste Astral** |
| Sinete Estelar POD/STA/CON/CRV/FEI/SAB | 250 Fragmento de Meteorito + 50 Pó de Meteorito do talento + 20 Alma de Betelgeuse + 1 Sinete Estelar |

**Também na página:**
- Uma máquina (OSC0007) converte 1 Fragmento em 40 Pó de Meteorito.
- As máquinas só aparecem para quem já venceu o Betelgeuse ao menos uma vez.

### 2.2 Correções em relação ao que já está no sistema

| Ponto | Situação | Ação proposta |
|---|---|---|
| Nome dos pós de talento | O seed cadastrou "Pó de Talento (Poder)" e afins. O nome na fonte é **"Pó de Meteorito do Poder"**, "da Estâmina", "da Concentração", "da Criatividade", "do Feitiço" e "da Sabedoria" | Renomear no catálogo, pelo admin ou por migração de dados. Correção de dado, não regra |
| Peça base da Nebulosa | O Anexo A dizia só "1 peça Astral". A fonte mostra que **cada variante exige uma peça específica** (Armadura, Túnica ou Veste) | As receitas registram a peça exata |
| Itens que faltam no catálogo | As 3 peças Astrais, as 6 Nebulosas, o Sinete Estelar e os Sinetes de talento | Cadastrar no catálogo, conforme o escopo (D29) |

### 2.3 O que a fonte **não** responde (precisa ser verificado no jogo)

1. **Negociabilidade dos materiais.** Alma de Betelgeuse, Fragmento, pós de talento e Alma de Naght. **Bloqueio central:** se algum desses for vinculado à conta, o grupo não consegue juntar o material de vários jogadores num estoque comum, e o Épico III não funciona como o briefing descreve.
2. **Vínculo do item fabricado.** Se a Nebulosa ou a peça Astral ficar presa ao personagem que fabrica, quem precisa fabricar é o próprio membro, e não o guardião (D30).
3. **Quem pode usar as máquinas.** Só quem já venceu o Betelgeuse. Isso define quem consegue fabricar.

---

## 3. Decisões

### 3.1 Resultado (aprovado em 2026-11-14)

| ID | Decisão aprovada |
|---|---|
| D29 | As **6 Nebulosas**. O membro escolhe a variante, e ela define o pó de talento e a peça Astral |
| D30 | O guardião entrega os **materiais**, e o **membro fabrica** nas máquinas do Oscar |
| D31 | O membro escolhe se traz a própria peça Astral. Se ela vier do estoque, sai a **peça pronta**, quando houver; **senão, os materiais dela** (50 Fragmentos + 5 Almas de Naght) |
| D32 | **Preço em pontos por receita**, definido pelo admin e versionado, com **dois valores**: com a peça do estoque e trazendo a própria. Os pontos saem de circulação |
| D33 | Só o **estoque do grupo**, incluindo a reserva mínima; consignados ficam fora |
| D34 | Pontos e materiais **reservados ao solicitar**, por ordem de chegada |
| D35 | Limite **opcional** por membro num período, por receita |
| D36 | Antes da entrega, o **membro cancela** ou o **admin rejeita** (com motivo): tudo volta. Entregue não se desfaz |

### 3.2 Opções analisadas

Nenhuma quantidade ou preço é definido aqui. As receitas são cadastradas pelo admin a partir da fonte e validadas pelo grupo.

### D29: Escopo. O que conta como "Nebula" para a solicitação

| Opção | Impacto |
|---|---|
| **A. As 6 Nebulosas (Armadura, Túnica e Veste, cada uma com 2 talentos) (recomendado)** | É o que o grupo chama de Nebula. O membro escolhe a variante, e isso define o pó de talento e a peça Astral |
| B. Nebulosas e Sinetes Estelares de talento | Mais completo, mas os Sinetes consomem o dobro de Almas de Betelgeuse (20 cada), o gargalo |
| C. Qualquer receita cadastrada pelo admin | O mais flexível. O sistema fica genérico, e o admin decide o que é "solicitável" |

### D30: Quem fabrica

| Opção | Impacto |
|---|---|
| **A. O guardião entrega os materiais e o membro fabrica (recomendado)** | Funciona mesmo se a Nebulosa ficar vinculada a quem fabrica. Exige que o membro já tenha vencido o Betelgeuse. O estoque baixa os materiais na entrega |
| B. O guardião fabrica e entrega o item pronto | Mais simples para o membro, mas só funciona se a Nebulosa for negociável |
| C. O admin escolhe em cada solicitação | Cobre os dois casos, mas cada solicitação exige uma decisão a mais |

### D31: A peça Astral

| Opção | Impacto |
|---|---|
| A. O membro traz a própria peça Astral | O estoque só precisa de Fragmentos, pós e Almas de Betelgeuse. A peça vem do membro |
| **B. O estoque fornece a peça (pronta, ou os materiais dela: 50 Fragmentos + 5 Almas de Naght) (recomendado: o membro escolhe na solicitação)** | Mais acessível para quem não tem a peça. Consome mais estoque |
| C. Sempre do estoque | Mais caro para o grupo |

### D32: Custo para o membro

| Opção | Impacto |
|---|---|
| A. Grátis, distribuída por fila ou critério do grupo | Não usa pontos. Precisa de um critério justo (fila, participação ou sorteio) |
| **B. Preço em pontos por receita, definido pelo admin (recomendado)** | Mesmo modelo da loja (D21). Os pontos saem de circulação (D23). Quem mais participou consegue primeiro, que é o espírito do sistema de pontuação |
| C. Soma dos preços dos materiais na loja | Automático, mas depende de todos os materiais terem preço |

### D33: O que conta como "disponível"

| Opção | Impacto |
|---|---|
| **A. Só o estoque do grupo, incluindo as unidades da reserva mínima (recomendado)** | A reserva da D26 existe justamente para a Nebula. Os lotes consignados são de jogadores e ficam fora |
| B. Grupo e consignados | Usaria itens de outros jogadores sem eles venderem. Contraria a D22 |

### D34: Concorrência entre solicitações

| Opção | Impacto |
|---|---|
| **A. Os materiais e os pontos são reservados ao solicitar, por ordem de chegada (recomendado)** | Mesmo modelo da compra (D19). Duas solicitações não disputam o mesmo material. A rejeição devolve tudo |
| B. Reserva só na aprovação | A solicitação não garante nada. O admin escolhe quem atender quando faltar material |

### D35: Limites

| Opção | Impacto |
|---|---|
| A. Sem limite | Um membro com muitos pontos pode levar todas as Nebulas que o estoque permitir |
| **B. Limite opcional por membro num período, por receita, como na D24 (recomendado)** | O admin ativa quando quiser. Os valores ficam a seu critério |

### D36: Cancelamento e rejeição

| Situação | Recomendação |
|---|---|
| Solicitação pendente (antes da entrega) | O membro cancela ou o admin rejeita (com motivo): pontos estornados e materiais de volta ao estoque |
| Solicitação entregue | Não há volta pelo sistema; só por ajuste manual do admin, com motivo |

---

## 4. Modelo proposto (Arquiteto)

| Entidade | Campos | Regras |
|---|---|---|
| `receita` | `id`, `nome` (ex.: "Armadura Nebulosa POD"), `item_produzido_id`, `solicitavel` (D29: as 6 Nebulosas; as peças Astrais são receitas não solicitáveis), `ativa`, limite opcional (D35) | Cadastrada pelo admin |
| `preco_receita` (versionado) | `receita_id`, `versao`, `preco_com_peca`, `preco_trazendo_peca` (D32) | Só inclusão, como `preco_item` |
| `receita_componente` | `receita_id`, `item_id`, `quantidade` (> 0), `peca_base` (a peça Astral, que o membro pode trazer, D31) | As quantidades vêm da fonte e são validadas pelo grupo. Para a peça vinda do estoque: a peça pronta se houver; senão, os componentes da receita da peça (D31) |
| `solicitacao_nebula` | `jogador_id`, `receita_id`, `traz_peca_astral`, `preco` (fotografia), `status` (`PENDENTE`, `ENTREGUE`, `REJEITADA`, `CANCELADA`), `motivo`, autor e data de cada etapa | Débito e reserva dos materiais na solicitação (D34). A entrega fecha |
| `movimento_estoque` (existe) | tipo `NEBULA` (−) na solicitação e `DEVOLUCAO` (+) no cancelamento ou na rejeição | Só lotes do grupo (D33), por ordem de chegada (D27), **podendo usar a reserva mínima** |
| `lancamento_pontos` (existe) | novo tipo `NEBULA` (−) e `ESTORNO` | Os pontos saem de circulação |

**Disponibilidade automática (US-17):** para cada receita solicitável, quantas cabem no estoque do grupo agora:

> menor valor, entre os componentes, de ⌊disponível do grupo do componente ÷ quantidade⌋

Se o membro traz a peça Astral, ela fica fora da conta. Se a peça vem do estoque, conta a peça pronta **ou** os materiais dela (D31). A tela mostra "pode solicitar" ou "faltam X de Y".

**Interação com a loja:** a reserva mínima (D26) continua impedindo a loja de vender as unidades reservadas, e a Nebula pode consumi-las. Quando os componentes da Nebula também estiverem à venda na loja, os dois disputam o estoque do grupo; a trava por lote, que a compra já usa, impede venda dupla.

---

## 5. Histórias de usuário (PO)

**US-16: Cadastrar receitas (admin)**
Como admin, quero cadastrar receitas com componentes e quantidades e marcar quais podem ser solicitadas, para refletir o jogo sem alterar o código.
- Quantidade inteira maior que zero; um item não se repete na mesma receita.
- Mudar o preço ou os componentes não altera solicitações já feitas: a solicitação grava o que consumiu.

**US-17: Ver se a Nebula está disponível (membro)**
Como membro, quero ver quais Nebulas o estoque do grupo permite fabricar agora e o que falta nas outras.
- A disponibilidade considera só o estoque do grupo, incluindo a reserva (D33).
- A opção "Solicitar" só fica habilitada quando todos os componentes estão disponíveis (briefing §7).

**US-18: Solicitar Nebula (membro)**
Como membro, quero solicitar uma variante, dizendo se trago a peça Astral.
- Os pontos e os materiais são reservados na hora (D32, D34). Sem saldo ou sem material, a solicitação é recusada.
- O limite do período é respeitado (D35).

**US-19: Analisar a solicitação (admin)**
Como admin, quero ver a fila de solicitações, entregar no jogo e marcar como entregue, ou rejeitar com motivo.
- Rejeitar ou cancelar devolve os pontos e os materiais (D36).
- A entrega registra quem entregou e quando.

**US-20: Histórico**
Como membro, quero ver minhas solicitações e o status de cada uma. O extrato mostra o débito "Nebula".

---

## 6. Cenários de teste (QA)

| ID | Cenário | Esperado |
|---|---|---|
| CT-109 | Estoque do grupo com 120 Fragmentos, 30 Pó do Poder, 10 Almas de Betelgeuse e 1 Armadura Astral | Armadura Nebulosa POD: disponível 1. STA: indisponível (falta o Pó da Estâmina) |
| CT-110 | Alma de Betelgeuse com reserva mínima de 10 e 10 em estoque | Loja: 0 disponíveis. Nebula: pode usar as 10 (D26, D33) |
| CT-111 | Almas de Betelgeuse só em lote consignado | A Nebula não fica disponível (D33) |
| CT-112 | Solicitação com saldo suficiente | Débito `NEBULA`; movimentos `NEBULA` em cada componente, por ordem de chegada; status `PENDENTE` |
| CT-113 | Duas solicitações simultâneas, material para uma só | Uma passa e a outra é recusada. O estoque nunca fica negativo |
| CT-114 | Rejeição com motivo | Estorno dos pontos e `DEVOLUCAO` de cada componente |
| CT-115 | Membro traz a peça Astral | A peça não é baixada do estoque. O preço segue a regra da D31 |
| CT-116 | Saldo insuficiente | Recusada. Nada é gravado |
| CT-117 | Limite de 1 por 30 dias | A segunda solicitação no período é recusada |
| CT-118 | Membro sem vínculo, ou membro tentando entregar | 403 |
| CT-119 | Mudar o preço ou a receita depois de uma solicitação | A solicitação mantém o que gravou |

---

## 7. Riscos e dependências

1. **Negociabilidade dos materiais (§2.3):** bloqueio central. Sem ela, o épico só pode ser testado com itens marcados manualmente.
2. **Vínculo do item fabricado e acesso às máquinas:** definem a D30. Precisam ser testados no jogo antes da implantação.
3. **Conversão Fragmento ↔ Pó (OSC0007):** fica fora do escopo. Se o guardião converter no jogo, o admin registra como ajuste de estoque. Uma tela de "conversão" pode vir depois.
4. **Catálogo:** é preciso renomear os pós e cadastrar as peças Astrais e as Nebulosas (§2.2).

## 8. Próximo passo

Decisões aprovadas. O planejamento técnico está em `docs/planejamento/epico3.md`. Falta aprová-lo para implementar (schema, rotas, telas, tarefas a partir do M10 e plano de testes). **A implementação só começa com a sua aprovação.**
