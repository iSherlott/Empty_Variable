# Etapa 1: análise de pontuação e pesos das classes

**Status:** ETAPA 1 CONCLUÍDA. Todas as decisões (D1–D11 e D9a) foram aprovadas em 2026-11-14. Nada implementado.
**Data:** 2026-11-14

**Participantes:**
- Orquestrador
- PO (Agent 01)
- BA (Agent 02)
- Arquiteto (Agent 03, apenas observações de modelagem)
- QA (Agent 06)

---

## 1. O que a pesquisa mudou na análise (BA)

Fontes: bROWiki, Divine Pride, Hazy Forest e FreyaWiki. As informações marcadas com [inf.] são inferência.

| Fato | Impacto no modelo |
|---|---|
| Entrada a partir do nível 240, custo de 10.000z, 60 min de duração e cooldown de **3 dias** | Cada jogador faz no máximo ~2 runs por semana. A pontuação acumula devagar, então os valores absolutos podem ser altos |
| O grupo **escolhe o chefe final**: Naght Sieger no andar 25, Betelgeuse 0–3★ no 50, Betelgeuse 3–5★ no 75 | **As runs não valem o mesmo.** Uma run de 75 andares rende muito mais materiais e exige muito mais do grupo |
| O Betelgeuse gera uma **pontuação de dificuldade**, definida pelos atributos configurados na Fonte da Deusa. Ela determina o baú e a quantidade de Almas | Existe uma métrica oficial e objetiva da qualidade da run, que pode virar multiplicador |
| Betelgeuse é da **raça Dragão** | Confirma a justificativa do Sorcerer (defesa contra dragões) |
| Ninguém avança de andar com membro morto | Proteção e cura são funções críticas, não opcionais |
| A "Garra" citada pelo grupo é a **Garra Sombria** (Sicário/Executor): o alvo recebe mais dano físico corpo a corpo, até +75% em chefes | Confirma o rank 3 do GX |
| "Cometa" é dano mágico em área do Arcano/Magus | Confirma que o Magus tem duas funções distintas |
| Avança-se andar por andar | A participação parcial pode ser medida em andares |
| Nebula: 6 armaduras e 6 sinetes, com receitas confirmadas (ver Anexo A) | Fica para o épico de Nebula |
| A negociabilidade dos itens no bRO é **desconhecida** | Risco para a loja. Precisa ser verificada no jogo antes do Épico II |

## 2. Avaliação dos ranks propostos

### 2.1. Correspondência entre os nomes do grupo e as classes

| Grupo | 3ª classe → 4ª classe (bRO) | Confirmação |
|---|---|---|
| MTK | Mestre Estelar → Mestre Celestial | bROWiki |
| Sorcerer | Feiticeiro → Elementalista | bROWiki |
| GX | Sicário → Executor | bROWiki |
| Magus | Arcano → Magus | bROWiki |
| Cientista | Bioquímico → Cientista | bROWiki |
| Engenheiro | Mecânico → Engenheiro | bROWiki |
| RG | Guardião Real → Guardião Imperial | bROWiki |
| Cardeal | Arcebispo → Cardeal | bROWiki |
| **Asceta** | **Não confirmado** | O BA sugeriu Shura/Inquisidor. Para o orquestrador, a hipótese mais forte é a 4ª classe da linha **Espiritualista/Ceifador de Almas** (Soul Ascetic), que dá o *link* espiritual ao Mestre Taekwon. Isso bate com a justificativa "buffs ao MTK". **Precisa da sua confirmação** |

### 2.2. Inconsistências e pontos de atenção

1. **O valor de uma run varia muito com o chefe e a dificuldade.** A tabela de ranks não captura isso. Proposta: um multiplicador de run separado do peso da classe (seção 3).
2. **Magus Dano (rank 5) empata com o MTK.** Isso é coerente se o Magus for o principal causador de dano, mas confirme se a intenção é mesmo essa.
3. **O valor do Asceta depende do MTK.** Os buffs dele são para o MTK, então numa run sem MTK o rank 3 perde o sentido. Opções:
   - (a) manter o peso fixo (mais simples);
   - (b) rebaixar o Asceta para o rank 1 quando não houver MTK na run.
4. **Cardeal e RG no rank 2.** A regra "morto não avança" torna cura e proteção críticas. **Resolvido (D8):** o Cardeal subiu para o rank 3 e o RG foi mantido no rank 2.
5. **Classes repetidas** (por exemplo, 2 MTKs). No modelo recomendado, cada um recebe o peso cheio. A alternativa seria dar peso cheio só aos "slots necessários" e o peso padrão aos excedentes, o que é mais justo mas mais complexo.
6. **Rank ≠ peso.** O rank (1–5) é um rótulo ordinal de importância. O peso numérico deve vir de uma função configurável, para permitir recalibrar sem reclassificar as classes.
7. **A função efetivamente desempenhada deve ser registrada por quem registra a run** (o admin), não declarada pelo jogador. Isso evita autopromoção para o rank 5.

### 2.3. Tabela de pesos sugerida (classe × função)

A unidade de peso é o par **(classe, função)**, não a classe sozinha. Toda classe tem uma função "padrão", e classes como o Magus têm mais de uma.

| Classe (função) | Rank | Peso (α = 0,5) | Pontos base (B = 100) |
|---|---:|---:|---:|
| MTK / Mestre Celestial | 5 | 3,0 | 300 |
| Magus (Dano) | 5 | 3,0 | 300 |
| Sorcerer / Elementalista (Defesa anti-dragão) | 4 | 2,5 | 250 |
| GX / Executor (Garra Sombria) | 3 | 2,0 | 200 |
| Magus (Suporte com Cometa) | 3 | 2,0 | 200 |
| Asceta (Buff ao MTK)* | 3 | 2,0 | 200 |
| Cientista (Proteção) | 2 | 1,5 | 150 |
| Engenheiro (Suporte) | 2 | 1,5 | 150 |
| RG / Guardião Imperial (Sustentação) | 2 | 1,5 | 150 |
| Cardeal (Buffs e cura) — rank alterado por D8 | 3 | 2,0 | 200 |
| Demais classes | 1 | 1,0 | 100 |

\* A classe do Asceta ainda precisa ser confirmada (D7).

## 3. Modelo matemático recomendado

### 3.1. Fórmula

```
P(i)   = arred( B × W(r_i) × M_run × f_i )
W(r)   = 1 + α × (r − 1)
```

Onde:
- `P(i)` são os pontos gerados pela participação `i` (antes dos empréstimos).
- `B` é a base de pontos por run completa. Proposta: 100.
- `W(r)` é o peso do rank `r` da função exercida. Com α = 0,5, os ranks 1 a 5 valem 1,0 / 1,5 / 2,0 / 2,5 / 3,0.
- `α` é a inclinação da curva. Configurável. Proposta: 0,5.
- `M_run` é o multiplicador da run, conforme o chefe e a dificuldade. **O valor está pendente; usar 1 até haver decisão.**
- `f_i` é a fração de participação, entre 0 e 1.
- `arred` arredonda para o inteiro mais próximo (0,5 sobe).

**Como o α muda o peso do rank 5 em relação ao rank 1:**

| α | Razão rank 5 : rank 1 | Comportamento |
|---|---|---|
| 1,0 | 5 : 1 (peso igual ao rank) | Concentra pontos no MTK e no Magus. Quem é "demais classes" quase não progride, o que desestimula trazer DPS genérico |
| **0,5** | **3 : 1** | **Recomendado.** Diferencia bem as funções sem tornar a participação das classes comuns irrelevante |
| 0,25 | 2 : 1 | Suave. Aproxima-se de "todos ganham quase igual" |

### 3.2. Respostas às questões da seção 4.2

1. **Como transformar ranks em pontos?** Pela função afim `W(r)` com α configurável. O peso e o α usados ficam gravados em cada participação (snapshot), para que mudanças futuras não alterem o histórico.
2. **Os pontos são proporcionais ao rank?** São proporcionais ao peso derivado do rank, não ao rank cru.
3. **A pontuação considera o número de participantes?** Recomendação: **não**.
   - No modelo recomendado (pontuação absoluta), cada participante ganha `B × W`, independentemente de quantos estão no grupo.
   - O modelo alternativo é o **pool fixo**: `P_i = Pool × W_i / ΣW`. Ele faz o mesmo MTK ganhar menos quando o grupo é maior ou mais forte, o que pune justamente as composições boas. Não recomendado.
4. **A pontuação é fixa ou variável por run?** É uma base fixa (B) ajustada pelo multiplicador da run (`M_run`). A sugestão é ligar o `M_run` ao chefe escolhido (Naght no andar 25, Betelgeuse no 50 ou no 75) ou à pontuação de dificuldade do Betelgeuse. **Os valores dependem da sua decisão (D3).** Também precisa ser decidido o que acontece em run com falha.
5. **Como tratar participação parcial?** Pela fração `f_i`. Duas opções:
   - (a) **Níveis discretos**, escolhidos pelo admin: 1,0 / 0,5 / 0. É simples.
   - (b) **Por andares:** `f = andares em que esteve presente ÷ andares concluídos`. É mais preciso, mas exige registrar a entrada e a saída.
   - Recomendação: (a) no MVP, com o modelo de dados já preparado para (b).
6. **Como registrar a função de classes com mais de uma atuação?** O peso fica numa tabela `ClasseFunção`. Cada participação referencia uma `ClasseFunção`, e o admin escolhe a função ao registrar a run. Se não escolher, vale a função padrão da classe.
7. **Como evitar distorções?**
   - Snapshot de pesos em cada participação.
   - Função atribuída pelo admin, não pelo jogador.
   - Uma participação por personagem por run.
   - Regra para multi-client (D5).
   - Pontos sempre inteiros.
   - Lançamentos de pontos em ledger imutável (correção = estorno + novo lançamento).
   - Controle da inflação de pontos pelos preços da loja no futuro.

### 3.3. Exemplos de cálculo (QA, gerados por `simulacao.py`)

**Composição 1: run completa com 8 jogadores (B = 100, α = 0,5, M = 1, f = 1)**

| Jogador | Classe (função) | Pontos |
|---|---|---:|
| Ana | MTK | 300 |
| Bia | Magus (Dano) | 300 |
| Caio | Sorcerer | 250 |
| Duda | Asceta | 200 |
| Enzo | GX | 200 |
| Fê | Cardeal | 200 |
| Gus | Cientista | 150 |
| Hugo | RG | 150 |
| **Total** | | **1750** |

**Composição 2: grupo enxuto, com Magus de suporte e um Sorcerer parcial (f = 0,5)**

| Jogador | Classe (função) | Pontos |
|---|---|---:|
| Ana | MTK | 300 |
| Bia | Magus (Suporte) | 200 |
| Fê | Cardeal | 200 |
| Ivo | Ranger (demais classes) | 100 |
| Caio | Sorcerer, parcial | 125 |
| **Total** | | **925** |

**A mesma Composição 1 com outros valores de α:**

| α | MTK | Cardeal | Total |
|---|---:|---:|---:|
| 1,0 | 500 | 300 | 2700 |
| 0,5 | 300 | 200 | 1750 |
| 0,25 | 200 | 150 | 1275 |

### 3.4. D3: multiplicador por run (APROVADO em 2026-11-14)

`M_run = M_chefe × S_status`

**M_chefe:** depende do chefe final escolhido. As faixas seguem as opções da própria instância.

| Chefe final | M_chefe | Justificativa |
|---|---:|---|
| Naght Sieger (andar 25) | 1,0 | É a run de referência: a mais curta e a mais fácil |
| Betelgeuse, andar 50 (0–3★) | 1,5 | O dobro de andares e um chefe com atributos configuráveis. Recompensas maiores (Almas de Betelgeuse) |
| Betelgeuse, andar 75 (3–5★) | 2,0 | Três vezes mais andares, monstros com até 2M de HP e baú avançado (Fragmento de Talento) |

- A curva cresce mais devagar que o número de andares (25 → 50 → 75). Isso acontece porque a run tem limite de 60 minutos: o esforço extra é real, mas não triplica.
- Pular andares com o Braseiro não muda o multiplicador. O que conta é o chefe final.

**S_status:** depende de como a run terminou.

| Status | S_status | Justificativa |
|---|---:|---|
| Concluída (chefe derrotado) | 1,0 | — |
| Falha no chefe (grupo chegou ao chefe e não venceu) | 0,5 | Não pune tentativas difíceis. Com o cooldown de 3 dias, não há como "farmar" falhas |
| Abortada antes do chefe | 0 | Não houve entrega. O admin pode reclassificar como "Falha no chefe" se julgar justo |

**Exemplos** (B = 100, α = 0,5, Composição 1 com Cardeal no rank 3):

| Chefe | Status | M_run | MTK | Cardeal | Demais | Total do grupo |
|---|---|---:|---:|---:|---:|---:|
| Naght 25 | Concluída | 1,0 | 300 | 200 | 100 | 1750 |
| Betelgeuse 50 | Concluída | 1,5 | 450 | 300 | 150 | 2625 |
| Betelgeuse 75 | Concluída | 2,0 | 600 | 400 | 200 | 3500 |
| Betelgeuse 50 | Falha | 0,75 | 225 | 150 | 75 | 1314 |
| Betelgeuse 75 | Falha | 1,0 | 300 | 200 | 100 | 1750 |
| Qualquer | Abortada | 0 | 0 | 0 | 0 | 0 |

**Evolução futura (fora do MVP):**
- Registrar já agora a pontuação de dificuldade do Betelgeuse, como dado informativo.
- No futuro, essa pontuação pode virar um bônus por faixa (<300, 300–899, 900+), que são as faixas que mudam o baú.
- Não proponho usá-la agora: depende de informação digitada pelo admin e ainda não tem valores validados.

**Pontos a observar:**
- Uma falha no andar 75 vale o mesmo que concluir o Naght. Isso é intencional, porque premia a tentativa difícil. Se preferir, a falha pode valer 0,25.
- O arredondamento acontece por participante. Por isso o total da falha no andar 50 é 1314, e não 1312,5.

## 4. Empréstimos e divisão de pontos

### 4.1. Opções avaliadas

| Modelo | Prós | Contras |
|---|---|---|
| L1: percentual definido em cada empréstimo | Flexível e reflete o acordo real entre os jogadores | Exige que o admin informe o % toda vez |
| L2: percentual fixo por categoria de item (por exemplo, "essencial" ou "complementar") | Padronizado e rápido de registrar | Exige catalogar e classificar os itens |
| L3: percentual por quantidade de itens (X% por item) | Simples | Trata um item crucial igual a um item trivial |

**Recomendação: L1 com sugestão vinda de L2.**
- Cada empréstimo tem o próprio percentual.
- O sistema pode pré-preencher esse percentual a partir da categoria do item, mas o admin pode ajustar.
- **Nenhum valor padrão foi definido.** Os percentuais e as categorias dependem da sua decisão (D9).

### 4.2. Regras propostas

1. Uma participação pode ter **vários empréstimos**, de credores diferentes ou do mesmo credor (um registro por item).
2. O credor não pode ser o próprio tomador. O credor pode estar na mesma run, e nesse caso recebe as duas parcelas.
3. A divisão incide sobre `P(i)` já calculado, ou seja, depois do multiplicador da run e da fração de participação.
4. **Invariante:** `Σ p_k ≤ P_max`. A soma dos percentuais dos credores nunca passa de 100%. Opcionalmente, pode haver um teto menor que garanta ao tomador uma fatia mínima (D9).
5. Cálculo:
   - Cada credor recebe `⌊P(i) × p_k⌋`.
   - **O tomador fica com o resto:** `P(i) − Σ parcelas`.
   - Isso garante que **a soma distribuída é exatamente igual a `P(i)`**. Nunca ultrapassa e nunca perde ponto no arredondamento.
6. O registro guarda:
   - os pontos originais;
   - cada parcela (credor, item, %, pontos);
   - o saldo final do tomador.
   - Cada parcela vira um lançamento separado no ledger.

### 4.3. Exemplos

| Caso | P(i) | Empréstimos | Resultado |
|---|---:|---|---|
| GX empresta de dois credores | 200 | X emprestou 2 itens, 20%. Y emprestou 1 item, 10% | X recebe 40, Y recebe 20, o GX fica com **140**. Soma: 200 ✔ |
| Sorcerer parcial, com resto no arredondamento | 125 | X 15%, Y 15% | X recebe 18 (de 18,75), Y recebe 18, o Sorcerer fica com **89**. Soma: 125 ✔ |
| Percentuais inválidos | 100 | X 60%, Y 50% | **Rejeitado**, porque a soma passa de 100% |

### 4.4. D9: regras aprovadas em 2026-11-14

**Percentual por categoria do item.** A categoria pré-preenche o percentual e o admin pode ajustar em cada empréstimo.

| Categoria | Critério | % por item |
|---|---|---:|
| Essencial | Sem o item, o jogador não cumpre a função | 20% |
| Importante | O item melhora muito o desempenho | 10% |
| Complementar | Ganho pequeno | 5% |

**Teto:**
- Somados, os credores recebem **no máximo 50%** de P.
- Quem pegou os itens emprestados fica sempre com pelo menos metade.

**Exemplos (QA):**

| Caso | P | Empréstimos | Resultado |
|---|---:|---|---|
| GX, run de referência | 200 | X: Essencial (20%). Y: Complementar (5%) | X recebe 40, Y recebe 10, o GX fica com **150** |
| Cardeal, Betelgeuse 50 | 300 | X: Essencial ajustado para 25%. Y: Importante (10%) | X recebe 75, Y recebe 30, o Cardeal fica com **195** |
| MTK, Betelgeuse 75, com 3 Essenciais (soma de 60%) | 600 | X, Y e Z: 20% cada | Redução proporcional para 16,67% cada: X, Y e Z recebem 100 cada, o MTK fica com **300** |

**D9a (APROVADO em 2026-11-14: redução proporcional): o que fazer quando as sugestões das categorias somam mais de 50%.**
- **(a) Redução proporcional (recomendada):** o sistema reduz todos os percentuais na mesma proporção até somarem 50%. No exemplo, cada credor fica com 16,67%: X, Y e Z recebem 100 cada, e o MTK fica com 300. O admin vê o aviso e pode redistribuir.
- **(b) Rejeitar:** o sistema bloqueia o registro, e o admin precisa ajustar os percentuais manualmente.
- Um ajuste manual do admin que ultrapasse o teto é sempre rejeitado.

**Observações:**
- Um empréstimo vale para uma run.
- Para itens emprestados com frequência, a interface pode oferecer "repetir empréstimos da última run". Isso não altera a regra.
- Como a divisão incide sobre P, falhas e participação parcial reduzem a parcela do credor na mesma proporção.

## 5. Problemas e exceções mapeados (QA)

- **O peso da classe muda depois que a run foi registrada.** Como o snapshot fica na participação, o histórico não muda. Recalcular é uma ação explícita do admin, com estorno no ledger.
- **A run é registrada com erro.** Não se edita o saldo. Gera-se estorno e um novo lançamento.
- **O jogador troca de classe ou personagem entre runs.** A participação referencia o personagem e a função daquela run.
- **Multi-client:** a mesma conta do Discord aparece com 2 personagens na mesma run (D5).
- **O credor sai do grupo ou é removido.** O histórico permanece e o saldo segue a regra da loja (épico futuro).
- **Run abortada ou com falha** (time-out de 60 min, wipe): é preciso definir o `M_run` (D3).
- **Classe nova** não cadastrada: cai em "demais classes" (rank 1) até ser configurada.
- **Arredondamento:** sempre inteiro. Parcelas dos credores truncadas, resto para o tomador.
- **Asceta sem MTK na run** (D6).

## 6. Decisões pendentes (precisam da sua aprovação)

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Modelo absoluto ou pool fixo dividido | Absoluto |
| D2 | Valores de B e α | B = 100 e α = 0,5 (proporção 3:1) |
| D3 | Multiplicador por run (chefe ou dificuldade) e tratamento de run com falha | Criar o campo agora, com valor 1, e definir os níveis depois. Você define os valores |
| D4 | Como medir a participação parcial | Níveis discretos 1 / 0,5 / 0 no MVP |
| D5 | Multi-client: o mesmo usuário com 2 personagens na run pontua duas vezes? | Você decide (impacto direto na justiça da pontuação) |
| D6 | Asceta: peso fixo ou dependente da presença do MTK | Você decide |
| D7 | Qual classe é o "Asceta" | Confirmar se é a linha Ceifador de Almas (Soul Ascetic) |
| D8 | Confirmar Magus Dano = 5 (empatado com o MTK) e se Cardeal e RG ficam no rank 2 | Manter como definido, salvo ajuste seu |
| D9 | Empréstimos: % por empréstimo, categorias de item, valores e teto mínimo do tomador | L1 + sugestão L2. **Valores definidos por você** |
| D10 | Classes repetidas: peso cheio para todos? | Peso cheio no MVP |
| D11 | Quem registra e quem aprova as runs (admin único, vários admins, líder da run) | Admin registra, outro admin pode revisar |

## 7. Histórias de usuário e critérios de aceite (PO)

**US-01: Configurar classes e funções**
Como admin, quero cadastrar classes, suas funções e o rank de cada função, para ajustar a importância sem alterar o código.
- Dado que existe a classe Magus, quando eu cadastrar as funções "Dano" (rank 5) e "Suporte" (rank 3), então ambas ficam disponíveis no registro de runs.
- Dado que mudei o rank de uma função, quando eu consultar runs antigas, então os pontos delas não mudam.
- Uma classe não cadastrada usa o rank padrão (1).
- O rank aceito vai de 1 a 5. Qualquer outro valor é rejeitado.

**US-02: Configurar parâmetros de pontuação**
Como admin, quero configurar B, α e os multiplicadores de run, para calibrar a economia de pontos.
- Alterações valem só para runs registradas depois da mudança.
- O sistema guarda o histórico de versões dos parâmetros.

**US-03: Registrar uma run**
Como admin, quero registrar uma run com data, chefe ou dificuldade, status (concluída ou falha) e participantes, para gerar os pontos.
- O mesmo personagem não pode aparecer duas vezes na mesma run.
- Cada participante tem personagem, classe, função (padrão: a função padrão da classe) e fração de participação.
- Dado um MTK com f = 1, B = 100 e α = 0,5, quando a run é salva, então o MTK recebe 300 pontos.
- Dado um Sorcerer com f = 0,5, quando a run é salva, então ele recebe 125 pontos.

**US-04: Registrar itens obtidos na run**
Como admin, quero registrar os itens obtidos (catálogo da Torre: Pó e Fragmento de Meteorito, Almas, Pós de Talento, visuais e cartas), para alimentar o estoque futuro.
- Os itens vêm de um catálogo cadastrado, com quantidade inteira maior que zero.
- Nesta etapa, os itens **não alteram a pontuação**.

**US-05: Registrar empréstimo e dividir pontos**
Como admin, quero registrar os empréstimos de uma participação (credor, item e %), para que o credor receba parte dos pontos.
- Dado P = 200 e empréstimos de 20% e 10%, então os credores recebem 40 e 20, e o tomador fica com 140.
- A soma das parcelas mais o que fica com o tomador é sempre igual a P.
- Uma soma de percentuais acima de 100% (ou acima do teto configurado) é rejeitada com uma mensagem clara.
- O credor não pode ser igual ao tomador.
- O histórico mostra os pontos originais e cada parcela.

**US-06: Consultar histórico e saldo**
Como membro, quero ver minhas runs, a função, o peso, a fração, as divisões e o saldo, para entender de onde vêm meus pontos.
- Cada lançamento mostra a origem (participação, parcela de empréstimo ou estorno).
- O saldo é igual à soma dos lançamentos.

**US-07: Corrigir uma run**
Como admin, quero corrigir uma run registrada com erro, para manter a integridade sem perder o histórico.
- A correção gera estornos e novos lançamentos. Nenhum lançamento é apagado.

## 8. Observações do arquiteto (somente direcionamento, sem decisão de negócio)

- Entidades previstas:
  - `Jogador` (ligado ao Discord no futuro), `Personagem`, `Classe`, `ClasseFunção`
  - `ParametrosPontuacao` (versionado), `Run`, `Participação` (com snapshot de rank, peso, α, B, M e f)
  - `Empréstimo`, `ItemCatalogo`, `DropRun`, `LancamentoPontos` (ledger)
- O ledger único de pontos já atende o Épico II: compras e vendas na loja serão apenas novos tipos de lançamento.
- O `ItemCatalogo` deve ter os campos `negociavel` e `vinculado_conta`, por causa do risco de negociabilidade levantado pelo BA.

---

## Anexo A: recompensas e Nebula (BA, resumo)

**Recompensas:**
- Pó de Meteorito (1000372)
- Fragmento de Meteorito (1000373)
- Alma de Betelgeuse (1000397): de 0 a 3 por vitória, conforme a pontuação. É o gargalo.
- Alma de Naght Sieger (1000396)
- Pós de Talento: Poder, Estâmina, Concentração, Criatividade, Feitiço e Sabedoria
- Fragmento de Talento
- Visuais: Boneco, Aura e Cabelos
- Cartas: Naght Sieger e MVPs

**Receitas** (NPC Oscar, em alberta 203/75, liberado após a 1ª vitória sobre o Betelgeuse):

| Item | Receita |
|---|---|
| Veste / Túnica / Armadura Astral | 50 Fragmentos + 5 Almas de Naght |
| Armadura / Túnica / Veste **Nebulosa** (6 variantes por atributo) | 50 Fragmentos + 30 Pó do Talento correspondente + 10 Almas de Betelgeuse + 1 peça Astral |
| Sinete Estelar | 100 Fragmentos + 10 Almas de Naght |
| Sinete Estelar de talento | 250 Fragmentos + 50 Pó do talento + 20 Almas de Betelgeuse + 1 Sinete |

**Lacunas a verificar:**
- Negociabilidade e vínculo à conta de cada item no bRO
- Limite por conta
- Se o Naght dá recompensa
- ID do Fragmento de Talento
- Identidade do "Asceta"

**Fontes:**
- browiki.org/wiki/Torre_da_Constelação
- divine-pride.net (monstros 20994 e 20996; itens 1000397 e 450169)
- hazyforest.com (constellation_tower)
- freyawiki.ragnarevival.com
