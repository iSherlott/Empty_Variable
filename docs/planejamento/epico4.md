# Épico IV: imagens do jogo e pontos em todas as instâncias

**Status:** M14 (T-55, T-56) implementado em 2026-11-16. M15 (T-57 a T-61) implementado e validado no navegador em 2026-11-18.

**Base:**
- Pedido do usuário (2026-11-16): trazer imagens e recursos do Ragnarok, como as imagens dos itens pela API da Divine Pride, e a pontuação para as instâncias da browiki (https://browiki.org/wiki/Instâncias).
- Decisões D41 a D46 em `docs/DECISOES.md`.

**Responsáveis:** BA (§1), Arquiteto (§2, §3), Frontend (§4), PO (§5) e QA (§6). Consolidação pelo orquestrador.

---

## 1. Pesquisa (BA)

### 1.1 Divine Pride

- As imagens ficam em `static.divine-pride.net` e abrem **sem chave**:

  | Imagem | Caminho |
  |---|---|
  | Ícone do item | `/images/items/item/{id}.png` (ex.: Alma de Betelgeuse, 1000397) |
  | Ilustração do item | `/images/items/collection/{id}.png` |
  | Monstro | `/images/mobs/png/{id}.png` |

- **A API de dados exige chave pessoal:**
  - a chave sai do perfil no site;
  - ela vai como `apiKey` em `GET /api/database/Item/{id}`;
  - o servidor vai no cabeçalho `x-server`, e `bRO` está na lista.
- **Regras de uso:** guardar as respostas em cache, respeitar o 429 e não espelhar o banco inteiro.
- **No Betel hoje:** a CSP de produção só aceita imagens do próprio site e do Discord. O catálogo já tem o ID do jogo em 4 itens; os outros têm o campo vazio.

### 1.2 Instâncias da browiki

- **Total:** 60 instâncias.
- **Agrupamento:** pelo intervalo de retorno. São 37 diárias, 10 de 3 dias, 5 que voltam em horas, 7 semanais e 1 "outros".
- **Dados de cada uma:** nível mínimo, modo (solo ou grupo), dificuldade (F, M ou D), quest de requisito e recompensa principal.
- **A Torre da Constelação** está entre elas: retorno de 3 dias, nível 240 e dificuldade D.
- **Hoje o sistema só pontua a Torre.** O chefe é um enum fixo (Naght 25, Betelgeuse 50 e 75), e as funções e ranks são globais. Cada participação já guarda o multiplicador e o rank usados (D2), então generalizar não muda o histórico.

## 2. Imagens (D41, D42)

- **`GET /api/imagens/item/{idJogo}`:** opcionalmente com `?tipo=ilustracao`.
  - Na primeira vez, a API busca na Divine Pride e guarda o PNG no banco (tabela `imagem_cache`: id do jogo, tipo, bytes, tipo MIME e data).
  - Nas seguintes, serve do cache, com `Cache-Control` longo.
  - Se a Divine Pride não tiver a imagem, grava "não existe", para não repetir a busca.
- **Limites:** só IDs numéricos e só os dois tipos. Uma requisição por ID ao mesmo tempo, sem varrer IDs. Timeout curto: se falhar, o frontend usa o ícone desenhado.
- **Frontend:** o componente `app-imagem-item` mostra a imagem quando o item tem ID; senão, ou se a imagem falhar, mostra o ícone desenhado de hoje. Ele entra na loja, na Nebula, no estoque, nos itens e nos drops da run.
- **Crédito no rodapé:** "Imagens: Divine Pride · Ragnarok Online © Gravity".
- **Itens:** a tela mostra a prévia do ícone ao preencher o ID. Assim o admin confere se o ID está certo, mesmo sem a chave da API (D42).
- **CSP:** não muda, porque as imagens vêm do próprio Betel.

## 3. Instâncias (D43 a D46)

### 3.1 Modelo de dados (migration nova)

| Tabela | Campos | Regras |
|---|---|---|
| `instancia` | `id`, `nome` (único), `ativa`, campos de referência opcionais: `nivel_minimo`, `retorno` (diário, 3 dias, horas, semanal, outro), `modo` (solo ou grupo), `dificuldade` (F, M, D), `requisito`, `premiacao` | Cadastrada pelo gestor (D43) |
| `versao_instancia` | `id`, `instancia_id`, `versao`, `vigente_desde`, `criada_por` | Só inclusão (D46) |
| `encontro` | `id`, `versao_instancia_id`, `nome`, `multiplicador_centesimos` (> 0), `ordem` | Pelo menos 1 por versão (D44) |
| `funcao_instancia` | `id`, `versao_instancia_id`, `classe_id`, `nome`, `rank` (1 a 5), `padrao` | Tabela própria por instância (D45) |

**Classes:** continuam globais (MTK, Magus…), porque são do jogo. O que muda por instância são as funções e os ranks.

**Runs:**
- a run passa a apontar para a `versao_instancia` e o `encontro`, no lugar do enum `chefe`;
- a participação aponta para a `funcao_instancia`;
- as colunas que já guardam o multiplicador e o rank (D2) continuam iguais.

**Migração da Torre:** cria a instância "Torre da Constelação" v1, com:
- **os 3 encontros**, com os multiplicadores da config v1 (1, 1,5 e 2);
- **as funções e ranks de hoje.**

Cada run antiga ganha o vínculo correspondente. Nada no histórico de pontos muda.

**Parâmetros de pontuação:** B, α, status e empréstimos continuam globais e versionados. Os multiplicadores dos chefes saem dali e vão para os encontros da Torre.

**Torre:** a "pontuação do Betelgeuse" continua como um campo opcional da run.

### 3.2 Motor (`packages/scoring`)

- A entrada deixa de receber `chefe` e passa a receber `multiplicadorEncontroCentesimos`. A fórmula não muda:

  ```
  P = arred(B × W(rank) × M_encontro × S_status × f)
  ```

- Os 84 testes do motor continuam valendo, com os multiplicadores da Torre passados explicitamente.

### 3.3 API (gestor)

| Rota | O que faz |
|---|---|
| `GET` e `POST /api/instancias`; `PATCH /api/instancias/:id` | Nome, ativa e campos de referência |
| `POST /api/instancias/:id/versoes` | Nova versão com os encontros e as funções. A tela parte da versão vigente, e a primeira versão de uma instância nova começa sem funções (D45) |
| `GET /api/instancias/:id/versoes` | Histórico |
| `GET /api/instancias/referencia` | A lista da browiki (nome, nível, retorno, modo, dificuldade, requisito, premiação) como dados de apoio, para pré-preencher o cadastro (D43) |

O registro e a correção de runs passam a receber `instanciaId` e `encontroId` e a validar a função contra a versão vigente daquela instância.

## 4. Frontend

| Onde | O que muda |
|---|---|
| Gestão → **Instâncias** (nova) | Lista em cartões, com o selo de ativa ou inativa, o nível, o retorno e a dificuldade |
| Cadastro de instância | Painel lateral, com a opção "a partir da lista da browiki" |
| Detalhe da instância | Abas Encontros, Funções e ranks e Histórico de versões. "Nova versão" abre no painel lateral, com a prévia dos pontos por rank |
| Classes e funções | Passa a mostrar só as classes (globais). As funções e ranks ficam em cada instância |
| Registrar run | O primeiro passo escolhe a instância e o encontro; os passos seguintes usam as funções daquela instância |
| Runs | Filtro por instância (chips) e o nome da instância na lista |
| Imagens | `app-imagem-item` nos cartões da loja, da Nebula e dos drops e nas tabelas de estoque e itens |

## 5. Tarefas e marcos (PO)

| Marco | Entrega verificável |
|---|---|
| M14 Imagens | Os itens com ID mostram o ícone do jogo em todo o sistema, via cache da API; sem ID, o ícone desenhado. A prévia do ícone na tela de Itens confere o ID |
| M15 Instâncias | O gestor cadastra instâncias com encontros e funções versionados; uma run de qualquer instância ativa pontua com o multiplicador e o rank dela; a Torre e o histórico seguem iguais |

| ID | Tarefa | Dono | Decisão |
|---|---|---|---|
| T-55 | Cache de imagens: tabela, rota, busca com timeout, "não existe" | BE | D41 |
| T-56 | `app-imagem-item` nas telas, prévia do ID em Itens, crédito no rodapé | FE | D41, D42 |
| T-57 | Migration das instâncias, versões, encontros e funções; migração da Torre e das runs | BE | D43 a D46 |
| T-58 | Motor: multiplicador do encontro no lugar do enum do chefe | BE | D44 |
| T-59 | API de instâncias, versões e referência da browiki; registro e correção de runs por instância | BE | D43 a D46 |
| T-60 | Telas: Instâncias (lista, cadastro, detalhe e versões), Classes só com classes, assistente da run por instância, filtro nas Runs | FE | D43 a D46 |
| T-61 | Testes de integração e e2e, verificação de integridade e relatório do Épico IV | QA | Todas |

**Caminho crítico:** T-57 → T-58 → T-59 → T-60 → T-61. O M14 (T-55 e T-56) é independente e entra primeiro.

## 6. Plano de testes (QA)

| ID | Cenário | Esperado |
|---|---|---|
| CT-139 | Item com ID e imagem na Divine Pride | A 1ª chamada busca e grava no cache; a 2ª não sai do Betel |
| CT-140 | ID sem imagem, ou a Divine Pride fora do ar | 404 da API; a tela mostra o ícone desenhado; o "não existe" evita uma nova busca |
| CT-141 | ID inválido (não numérico ou negativo) ou tipo desconhecido | 400, sem chamada externa |
| CT-142 | Migração da Torre | As runs antigas apontam para a Torre v1 e para o encontro certo, e a soma dos pontos não muda |
| CT-143 | Run numa instância nova com o multiplicador 1,2 e uma função de rank 4 | Os pontos batem com o motor (B × W(4) × 1,2 × S × f) |
| CT-144 | Nova versão da instância | Vale para as runs seguintes; as antigas mantêm a versão e os pontos (D46, D2) |
| CT-145 | Função de outra instância na run | 422 |
| CT-146 | Instância inativa, ou sem funções | Não aparece no registro de run; a API recusa com 422 |
| CT-147 | Gestor e admin cadastram instâncias; membro | 200 / 403 |
| CT-148 | Correção de uma run antiga da Torre | Usa a versão vigente da Torre na nova run; o estorno da antiga segue igual |

## 7. Impacto no que já existe

- **Pontuação:** a fórmula é a mesma. O multiplicador do chefe vira o do encontro, e a Torre continua com os mesmos valores.
- **Histórico:** nenhum ponto muda. As runs ganham o vínculo com a instância.
- **Telas:** Classes e funções vira só Classes. O assistente da run ganha a escolha da instância no primeiro passo.
- **Riscos:**
  - a migração dos dados da Torre é o passo mais delicado, por isso tem o teste CT-142 e entra na verificação de integridade do backup;
  - imagens da Divine Pride são de terceiros (© Gravity); por isso o crédito e o cache, sem redistribuir as imagens no repositório.
