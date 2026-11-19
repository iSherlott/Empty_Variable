# Plano de testes, projeto Betel (Épico I)

**Autor:** QA (Agent 06)
**Data:** 2026-11-14
**Base:** `docs/DECISOES.md` (D1–D11, D9a, todas APROVADAS), `docs/BACKLOG.md` (US-01 a US-07), `docs/analise/etapa1-pesos.md`.
**Valores esperados:** calculados com aritmética exata (frações) e conferidos contra `docs/analise/simulacao.py` (mesmos resultados em todos os casos não marcados como pendentes).

---

## 1. Estratégia

A stack ainda não foi definida. O plano fala em **camadas**, não em ferramentas.

| Camada | O que cobre | Características |
|---|---|---|
| **Unitário (motor de cálculo puro)** | `W(r)`, `P(i)`, arredondamento half-up, sugestão por categoria, teto de 50%, redução proporcional (D9a), divisão credor/tomador, validações de entrada do cálculo | Funções puras, sem banco nem rede. Tabela de casos (seção 2) executada como teste parametrizado. Testes baseados em propriedade (seção 4) sobre o mesmo motor. É a camada com mais casos e deve rodar em todo commit |
| **Integração (persistência, ledger, autorização)** | Gravação de run/participação/empréstimo com snapshot, ledger imutável, estorno (US-07), saldo = soma do ledger, unicidade de personagem por run, versionamento de parâmetros (US-02), regras de permissão (admin × membro) | Banco real (ou equivalente fiel) recriado por teste. Verifica restrições no nível do armazenamento, não só na interface |
| **E2E mínimo** | Fluxo admin: registrar run com empréstimo e ver os pontos lançados; corrigir run por estorno. Fluxo membro: consultar histórico e saldo; tentar registrar run e ser bloqueado | Poucos cenários (seção 3.3), só caminhos felizes principais e um bloqueio de permissão. Não repetir aqui o que o unitário já cobre |

**Diretrizes para o motor (não são regra de negócio, são requisitos de testabilidade):**
- O cálculo deve usar aritmética decimal ou racional exata, não ponto flutuante binário. Exemplo do risco: em ponto flutuante, `100 × 0,29 = 28,999999999999996`, e `floor` daria 28 em vez de 29 (caso CT-44).
- A divisão incide sobre `P` **já arredondado** (etapa1 §4.2, regra 3 + §4.3). O caso CT-45 detecta implementações que dividem o valor não arredondado.
- Fórmulas de referência:
  - `P = floor(B × (1 + α(r−1)) × M_chefe × S_status × f + 0,5)`
  - `p_k` = override do admin, se houver; senão o % da categoria (Essencial 20%, Importante 10%, Complementar 5%).
  - Se `Σ p_k > 50%` e os percentuais vêm de sugestão: `p_k ← p_k × 0,5 / Σ p_k` (com aviso ao admin).
  - Credor `k` recebe `floor(P × p_k)`; tomador recebe `P − Σ parcelas`.

Parâmetros fixos em todos os casos da seção 2, salvo indicação: **B = 100, α = 0,5**. Abreviações: N25 = Naght Sieger andar 25 (M_chefe 1,0); B50 = Betelgeuse andar 50 (1,5); B75 = Betelgeuse andar 75 (2,0); Conc = Concluída (S 1,0); Falha = Falha no chefe (0,5); Abort = Abortada antes do chefe (0). Categorias: E = Essencial, I = Importante, C = Complementar.

---

## 2. Casos de teste do motor de cálculo (unitário)

### 2.1. Ranks (N25, Conc, f = 1, sem empréstimo)

| ID | US | Rank | M_chefe | S_status | f | Empréstimos | P esperado |
|---|---|---:|---:|---:|---:|---|---:|
| CT-01 | US-01, US-03 | 1 | 1,0 | 1,0 | 1 | — | 100 |
| CT-02 | US-01, US-03 | 2 | 1,0 | 1,0 | 1 | — | 150 |
| CT-03 | US-01, US-03 | 3 | 1,0 | 1,0 | 1 | — | 200 |
| CT-04 | US-01, US-03 | 4 | 1,0 | 1,0 | 1 | — | 250 |
| CT-05 | US-01, US-03 | 5 | 1,0 | 1,0 | 1 | — | 300 (critério da US-03) |

### 2.2. Chefe × status (rank 5, f = 1; colunas de referência para ranks 1 e 3)

| ID | US | Rank | Chefe (M_chefe) | Status (S) | f | P esperado (r5) | Ref. r3 | Ref. r1 |
|---|---|---:|---|---|---:|---:|---:|---:|
| CT-06 | US-03 | 5 | N25 (1,0) | Conc (1,0) | 1 | 300 | 200 | 100 |
| CT-07 | US-03 | 5 | N25 (1,0) | Falha (0,5) | 1 | 150 | 100 | 50 |
| CT-08 | US-03 | 5 | N25 (1,0) | Abort (0) | 1 | 0 | 0 | 0 |
| CT-09 | US-03 | 5 | B50 (1,5) | Conc (1,0) | 1 | 450 | 300 | 150 |
| CT-10 | US-03 | 5 | B50 (1,5) | Falha (0,5) | 1 | 225 | 150 | 75 |
| CT-11 | US-03 | 5 | B50 (1,5) | Abort (0) | 1 | 0 | 0 | 0 |
| CT-12 | US-03 | 5 | B75 (2,0) | Conc (1,0) | 1 | 600 | 400 | 200 |
| CT-13 | US-03 | 5 | B75 (2,0) | Falha (0,5) | 1 | 300 | 200 | 100 |
| CT-14 | US-03 | 5 | B75 (2,0) | Abort (0) | 1 | 0 | 0 | 0 |

### 2.3. Participação parcial e arredondamento half-up

| ID | US | Rank | M_chefe | S | f | Valor exato | P esperado |
|---|---|---:|---:|---:|---:|---:|---:|
| CT-15 | US-03 | 4 | 1,0 | 1,0 | 0,5 | 125 | 125 (critério da US-03) |
| CT-16 | US-03 | 4 | 1,0 | 0,5 | 0,5 | 62,5 | **63** |
| CT-17 | US-03 | 1 | 1,5 | 0,5 | 1 | 75 | 75 |
| CT-18 | US-03 | 2 | 1,5 | 0,5 | 1 | 112,5 | **113** |
| CT-19 | US-03 | 1 | 1,5 | 0,5 | 0,5 | 37,5 | **38** |
| CT-20 | US-03 | 2 | 1,5 | 0,5 | 0,5 | 56,25 | **56** |
| CT-21 | US-03 | 4 | 1,5 | 0,5 | 0,5 | 93,75 | **94** (250 × 0,75 × 0,5) |
| CT-22 | US-03 | 5 | 1,5 | 0,5 | 0,5 | 112,5 | **113** |
| CT-23 | US-03 | 2 | 1,5 | 1,0 | 0,5 | 112,5 | **113** |
| CT-24 | US-03 | 4 | 1,5 | 1,0 | 0,5 | 187,5 | **188** |
| CT-25 | US-03 | 4 | 2,0 | 0,5 | 0,5 | 125 | 125 |
| CT-26 | US-03 | 5 | 2,0 | 1,0 | 0 | 0 | 0 |
| CT-27 | US-03 | Composição 1 (r5, r5, r4, r3, r3, r3, r2, r2) | 1,5 | 0,5 | 1 | Σ exato 1312,5 | Por participante: 225, 225, 188, 150, 150, 150, 113, 113. **Total 1314** (arredondamento por participante, não no total) |
| CT-28 | US-03 | Composição 2 (r5, r3, r3, r1, r4 com f = 0,5) | 1,0 | 1,0 | — | — | 300, 200, 200, 100, 125. **Total 925** |

### 2.4. Empréstimos e divisão de pontos (US-05)

Formato da saída: credores `X/Y/Z/W/...` e tomador `T`. A coluna "Aviso" indica se a redução proporcional (D9a) foi aplicada.

| ID | US | Contexto (rank, chefe, status, f) | P | Empréstimos (credor: categoria → % efetivo) | Saída esperada | Aviso |
|---|---|---|---:|---|---|---|
| CT-29 | US-05 | GX r3, N25, Conc, 1 | 200 | X: E (20%); Y: C (5%) | X = 40, Y = 10, **T = 150** | Não |
| CT-30 | US-05 | GX r3, N25, Conc, 1 | 200 | X: E (20%); Y: I (10%) | X = 40, Y = 20, **T = 140** (critério da US-05) | Não |
| CT-31 | US-05 | Cardeal r3, B50, Conc, 1 | 300 | X: E com **override 25%**; Y: I (10%) | X = 75, Y = 30, **T = 195** | Não |
| CT-32 | US-05 | Sorcerer r4, N25, Conc, 0,5 | 125 | X: override 15%; Y: override 15% | X = 18 (de 18,75), Y = 18, **T = 89** | Não |
| CT-33 | US-05 | Cardeal r3, B50, Conc, 1 | 300 | X: E; Y: E; Z: I (soma **exatamente 50%**) | X = 60, Y = 60, Z = 30, **T = 150** | **Não** (50% não excede o teto) |
| CT-34 | US-05 | Sorcerer r4, N25, Conc, 0,5 | 125 | X: E; Y: E; Z: I (soma 50%) | X = 25, Y = 25, Z = 12, **T = 63** | Não |
| CT-35 | US-05 | MTK r5, B75, Conc, 1 | 600 | X: E; Y: E; Z: E (sugestões somam 60%) → 16,67% cada | X = 100, Y = 100, Z = 100, **T = 300** | **Sim** |
| CT-36 | US-05 | Sorcerer r4, N25, Conc, 1 | 250 | X: E; Y: E; Z: E (60%) → 1/6 cada | X = 41, Y = 41, Z = 41, **T = 127** | Sim |
| CT-37 | US-05 | Cardeal r3, B50, Conc, 1 | 300 | X: E; Y: E; Z: E; W: I (70%) → 14,29% ×3 e 7,14% | X = 42, Y = 42, Z = 42, W = 21, **T = 153** | Sim |
| CT-38 | US-05 | r1, N25, Conc, 1 | 100 | X, Y, Z, W, V: I; U: C (55%) → 9,09% ×5 e 4,55% | X..V = 9 cada, U = 4, **T = 51** | Sim |
| CT-39 | US-05 | MTK r5, B50, Conc, 1 | 450 | X: E com override **50%** (exatamente no teto) | X = 225, **T = 225** | Não |
| CT-40 | US-05 | MTK r5, N25, Conc, 1 | 300 | X: override 30%; Y: override 25% (soma manual 55%) | **Rejeitado** (override manual acima do teto). Nenhum lançamento gerado | — |
| CT-41 | US-05 | MTK r5, N25, Conc, 1 | 300 | X: override 51% | **Rejeitado** | — |
| CT-42 | US-05 | GX r3, N25, Conc, 1, tomador = Enzo | 200 | Enzo: E (credor = tomador) | **Rejeitado** (credor não pode ser o tomador) | — |
| CT-43 | US-05 | Run N25, Conc: Ana MTK r5 e Gus Cientista r2, ambos f = 1 | Gus: 150 (Ana: 300) | Gus pega de **Ana**: E (20%) | Parcela de Ana = 30; Gus **T = 120**; Ana total na run = 300 + 30 = **330** (dois lançamentos distintos para Ana). Total da run = 450 = 300 + 150 | Não |
| CT-44 | US-05 | r1, N25, Conc, 1 | 100 | X: override 29% | X = **29**, **T = 71** (detecta erro de ponto flutuante, que daria 28/72) | Não |
| CT-45 | US-05 | r4, B50, Falha, 0,5 | 94 (de 93,75) | X: override 33% | X = **31** (floor(94 × 0,33) = floor(31,02)), **T = 63**. Dividir o valor não arredondado daria 30/64 (errado) | Não |
| CT-46 | US-05 | r4, B50, Falha, 0,5 | 94 | X: E; Y: C | X = 18, Y = 4, **T = 72** | Não |
| CT-47 | US-05 | Qualquer rank, qualquer chefe, **Abort** | 0 | X: E; Y: I | X = 0, Y = 0, **T = 0**. Soma = 0 = P. (Ver lacuna L6 sobre lançamentos de valor zero) | Não |
| CT-48 | US-05 | GX r3, N25, Conc, 1 | 200 | X: E; X: C (mesmo credor, dois itens) | X = 50 (40 + 10; igual com floor por item ou agregado), **T = 150** | Não |
| CT-49 | US-05 | Sorcerer r4, N25, Conc, 0,5 | 125 | X: I; X: I (mesmo credor, dois itens) | **X = 12 + 12 = 24, T = 101** (truncamento por item, C1) | — |
| CT-50 | US-05 | MTK r5, N25, Conc, 1 | 300 | X: override 30%; Y: E (20%); Z: C (5%) (mistura manual + sugestão = 55%) | **Rejeitado (D15)** | — |
| CT-51 | US-05 | Todos os casos CT-29 a CT-48 | — | — | **Invariante:** `T + Σ parcelas = P` e `T ≥ ceil(P/2)` em todos; nenhuma parcela negativa | — |

---

## 3. Regras de domínio e integração

### 3.1. Registro, cadastro e snapshot

| ID | US | Cenário | Resultado esperado |
|---|---|---|---|
| CT-52 | US-03 | Admin registra run com o personagem "Ana-MTK" duas vezes | **Rejeitado** na validação e na restrição do armazenamento (unicidade personagem × run). Nada é gravado, nenhum lançamento é gerado |
| CT-53 | US-03, D5 | Jogador J participa com 2 personagens: MTK r5 e Cardeal r3, N25, Conc, f = 1 | Duas participações aceitas; J recebe **300 + 200 = 500** (dois lançamentos, um por participação) |
| CT-54 | US-03, D10 | Run com 2 MTKs (personagens diferentes), N25, Conc, f = 1 | Cada um recebe **300** (peso cheio, sem redução para o excedente) |
| CT-55 | US-01 | Participante com classe não cadastrada (ex.: "Ranger" sem configuração), N25, Conc, f = 1 | Usa rank 1: **100**. Snapshot grava rank 1 |
| CT-56 | US-01 | Admin cadastra função com rank 0, 6, −1 ou valor não inteiro (ex.: 2,5) | **Rejeitado** em todos. Ranks 1 e 5 são aceitos (fronteiras) |
| CT-57 | US-01 | Magus com funções "Dano" (r5) e "Suporte" (r3); run N25, Conc com Magus Suporte | Ambas as funções ficam disponíveis no registro; o Magus Suporte recebe **200**. Sem escolha explícita, vale a função padrão da classe |
| CT-58 | US-01, A1 | Run R1 registrada com GX r3 (200 pts). Depois o admin muda o GX para rank 4 | Saldo e histórico de R1 continuam com **200** e rank 3 no snapshot. Nova run R2 com GX, N25, Conc → **250** |
| CT-59 | US-02 | Run R1 registrada com B = 100 (MTK 300). Admin muda B para 120 (nova versão de parâmetros). Nova run R2 | R1 permanece **300**; R2 gera **360**. A versão anterior dos parâmetros continua consultável. Cada participação grava B, α, M, f e peso usados |
| CT-60 | US-02 | Admin muda α para 1,0 depois de R1 (Cardeal 200) | R1 permanece **200**; nova run com Cardeal r3, N25, Conc → **300** |
| CT-61 | US-04 | Admin registra itens obtidos com quantidade 0, negativa ou fracionária; item fora do catálogo | **Rejeitado**. Quantidade inteira > 0 de item do catálogo é aceita e **não altera** nenhum ponto |
| CT-62 | D6 | Run sem MTK, com Asceta, N25, Conc, f = 1 | Asceta recebe **200** (peso fixo rank 3) |

### 3.2. Ledger, estorno, saldo e autorização

| ID | US | Cenário | Resultado esperado |
|---|---|---|---|
| CT-63 | US-03, D11 | Admin salva run (GX 200 com empréstimo de X: E) | Lançamentos criados **imediatamente** na mesma operação: GX +160, X +40, cada um com origem (participação / parcela de empréstimo). Sem estado "pendente de aprovação" |
| CT-64 | US-05, US-06 | Run CT-31 gravada | Histórico mostra P original = 300 e cada parcela (credor, item, %, pontos): X 25% → 75, Y 10% → 30, tomador 195 |
| CT-65 | US-07 | Run R1 com MTK lançado como 300, mas o correto era Cardeal 200. Admin corrige | Ledger passa a ter: +300 (original), **−300 (estorno)**, +200 (novo). Nenhum lançamento é apagado ou editado. Saldo final do jogador = 200 |
| CT-66 | US-07 | Correção de run com empréstimo (CT-29: X 40, Y 10, GX 150) para "sem empréstimo" | Estornos −40 (X), −10 (Y), −150 (GX); novo lançamento +200 (GX). Saldos: X 0, Y 0, GX 200 |
| CT-67 | US-06 | Jogador com vários lançamentos (participações, parcelas recebidas, estornos) | Saldo exibido = **soma de todos os lançamentos** do jogador. Cada lançamento mostra a origem |
| CT-68 | US-07, A2 | Tentativa direta de alterar ou apagar um lançamento (via API ou camada de dados) | Operação recusada; ledger inalterado |
| CT-69 | D11 | Membro (não admin) tenta registrar run | **403**; nada gravado |
| CT-70 | D11 | Membro tenta corrigir run, alterar parâmetros ou cadastrar classe/função | **403** em todos |
| CT-71 | US-06 | Membro consulta o próprio histórico e saldo | **200**, com runs, função, peso, fração, divisões e saldo |
| CT-72 | US-03 | Falha no meio do registro (ex.: erro ao gravar o 3º lançamento) | Nada fica gravado (run, participações e lançamentos são atômicos) |
| CT-73 | US-05, D9a | Registro com sugestões acima de 50% (CT-35) | Admin recebe o aviso de redução; os percentuais efetivos gravados são os reduzidos |

### 3.3. E2E mínimo

| ID | Fluxo | Passos | Verificação |
|---|---|---|---|
| CT-E1 | Admin | Login como admin → registrar run B75, Conc com MTK (empréstimos E, E, E de X, Y, Z) e Cardeal | Aviso de redução exibido; MTK 300, X/Y/Z 100 cada, Cardeal 400 aparecem nos saldos |
| CT-E2 | Admin | Corrigir a run do CT-E1 (MTK sem empréstimos) | Histórico mostra estornos e novos lançamentos; saldos MTK 600, X/Y/Z 0 |
| CT-E3 | Membro | Login como membro → abrir histórico | Vê origem de cada lançamento e saldo igual à soma |
| CT-E4 | Membro | Tentar acessar a tela/ação de registro de run | Bloqueado (sem acesso e 403 na ação) |

---

## 4. Propriedades (testes baseados em propriedade)

Geradores: rank ∈ {1..5}; M_chefe ∈ {1,0; 1,5; 2,0}; S ∈ {1; 0,5; 0}; f ∈ {0; 0,5; 1}; B e α positivos; 0 a 10 empréstimos com categoria aleatória e override opcional.

1. **Conservação:** `T + Σ parcelas = P` para toda entrada válida.
2. **Teto do tomador:** `T ≥ P − floor(P/2)`, ou seja, o tomador nunca fica com menos da metade (com arredondamento a seu favor).
3. **Não negatividade e integralidade:** `P`, cada parcela e `T` são inteiros ≥ 0.
4. **Arredondamento:** `|P − valor_exato| ≤ 0,5`, e quando a parte fracionária é exatamente 0,5 o resultado é o inteiro de cima.
5. **Monotonicidade:** com os demais fatores fixos, `P` não diminui quando rank, M_chefe, S ou f aumentam.
6. **Zero absorvente:** S = 0 ou f = 0 ⇒ P = 0 e todas as parcelas = 0.
7. **Independência do grupo (D1):** os pontos de um participante não mudam ao adicionar ou remover outros participantes da run.
8. **Redução proporcional:** se `Σ sugestões > 50%`, os percentuais efetivos somam exatamente 50% e mantêm as razões entre si; se `≤ 50%`, ficam inalterados.
9. **Parcela limitada:** cada parcela ≤ `P × p_k` efetivo, e a diferença é < 1.
10. **Rejeição de override:** qualquer conjunto só de overrides com soma > 50% é rejeitado, nunca reduzido.
11. **Snapshot:** recalcular uma participação a partir do seu snapshot reproduz exatamente os pontos gravados, independentemente da configuração atual.
12. **Ledger:** para qualquer sequência de registros e correções, saldo = soma dos lançamentos; o número de lançamentos nunca diminui; estorno + lançamento original somam 0.
13. **Ordem dos empréstimos:** permutar a lista de empréstimos não altera parcelas nem T.

---

## 5. Lacunas encontradas (perguntas ao orquestrador; nenhuma foi decidida pelo QA)

| # | Pergunta | Casos afetados |
|---|---|---|
| L1 | Quando o **mesmo credor** tem vários empréstimos na mesma participação, o truncamento é por item (o script faz assim e etapa1 §4.2 diz "cada parcela vira um lançamento") ou pelo total do credor? Ex.: P = 125, I + I do mesmo credor → 24/101 ou 25/100. | CT-49 |
| L2 | Quando há **mistura** de override manual e sugestão de categoria e a soma passa de 50%, o sistema rejeita (regra do override) ou reduz proporcionalmente? Se reduz, reduz todos ou só os sugeridos? | CT-50 |
| L3 | Depois da redução proporcional, se o admin edita um dos percentuais, todos passam a ser tratados como "manuais" (e então >50% é rejeitado)? E qual valor é persistido: a fração exata (1/6) ou um percentual arredondado (16,67%)? Qual a granularidade aceita no override (inteiro, 1 ou 2 casas decimais)? | CT-35 a CT-38, CT-73 |
| L4 | "Credor ≠ tomador" vale por **personagem** ou por **jogador**? No multi-client (D5), o personagem A do jogador J pode "emprestar" ao personagem B do mesmo J? | CT-42, CT-53 |
| L5 | O credor precisa ser um jogador cadastrado no sistema? Os pontos da parcela vão para o jogador (conta) ou para o personagem? | CT-43, CT-63 |
| L6 | Com P = 0 (run abortada ou f = 0), os empréstimos devem ser registrados? Devem ser gerados lançamentos de valor 0 no ledger (participação e parcelas) ou nenhum lançamento? | CT-47, CT-26 |
| L7 | A fração f aceita apenas {0; 0,5; 1} (D4) ou qualquer valor em [0, 1]? Ex.: f = 0,75 deve ser rejeitado? | CT-15 a CT-28 |
| L8 | O teto de 50% é fixo (D9) ou um parâmetro configurável (a US-05 menciona "teto configurado")? Se configurável, entra no versionamento/snapshot da US-02? O mesmo vale para os percentuais das categorias (20/10/5). | CT-39 a CT-41, CT-59 |
| L9 | A US-03 cita só os status "concluída ou falha", mas D3 tem três (incluindo "Abortada"). Confirmar os três. A reclassificação de "Abortada" para "Falha no chefe" pelo admin é feita pelo fluxo de correção (estorno, US-07) ou é uma edição antes do lançamento? | CT-08, CT-11, CT-14, CT-65 |
| L10 | Etapa1 §5 menciona "recalcular é uma ação explícita do admin" após mudança de pesos. Existe uma funcionalidade de recálculo em massa com parâmetros novos, ou só a correção manual run a run (US-07)? | CT-58 a CT-60 |
| L11 | Classe não cadastrada → rank 1: como o admin informa uma classe que não existe no cadastro (texto livre? classe genérica "Demais classes")? Quando a classe for cadastrada depois, as runs antigas permanecem em rank 1 (snapshot)? | CT-55 |
| L12 | O aviso de redução proporcional (D9a) exige confirmação do admin antes de gravar ou é apenas informativo (grava direto)? Afeta CT-E1 e a atomicidade do registro. | CT-73, CT-E1 |

## Adendo do orquestrador (2026-11-14): casos derivados de D12 a D15

| ID | História | Cenário | Esperado |
|---|---|---|---|
| CT-74 | US-05 | P=300. X: Essencial com override de 30%. Y: Essencial (20% sugerido). Total de 50% | Aceito: X=90, Y=60, T=150 |
| CT-75 | US-05 | P=300. X: override de 35%. Y: Essencial (20% sugerido). Total de 55% | **Rejeitado (D15)**, sem redução automática |
| CT-76 | US-08 | Membro sem vínculo envia uma solicitação, e o admin aprova | Vínculo criado e personagens novos cadastrados. O membro passa a ver o próprio saldo |
| CT-77 | US-08 | Membro tenta abrir uma segunda solicitação enquanto a primeira está pendente | Rejeitado |
| CT-78 | US-08 | Membro reivindica um jogador que já tem usuário vinculado | Rejeitado |
| CT-79 | — | Login de conta que não está no servidor do Discord (a API do Discord responde 404) | Login recusado (D13) |
| CT-80 | US-06 | Membro consulta o saldo ou o histórico de outro jogador | 403 (D14) |

As lacunas L1 a L12 foram respondidas nos esclarecimentos C1 a C11 e na D15 (`docs/DECISOES.md`). Os casos pendentes CT-49 e CT-50 devem ser fechados de acordo com esses esclarecimentos.
