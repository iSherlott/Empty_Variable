# Relatório de QA do Épico III: solicitação de Nebula (T-47, Agent 06)

**Data:** 2026-11-15. **Base:** branch `feat/m11-nebula`, com os marcos M10 e M11 sobre os Épicos I e II.

## 1. Resumo

| Suíte | Quantidade | Resultado |
|---|---:|---|
| Motor de cálculo | 84 | ✅ sem mudanças neste épico |
| API, integração com Postgres 16 real | 180 | ✅ todos passam; 38 são do Épico III (`disponibilidade`, `receitas`, `nebula`, o seed e a integridade) |
| Frontend (Angular) | 40 | ✅ todos passam |
| Ponta a ponta (Playwright + Chrome) | 11 | ✅ todos passam; 3 são da Nebula |

Lint, formatação, typecheck e build de produção também passam.

**Veredito:** os critérios de US-16 a US-20 e os casos CT-109 a CT-128 têm teste automatizado passando, incluindo as concorrências reais:
- dois membros disputando o material de uma única Nebulosa (CT-113);
- duas Nebulosas diferentes disputando os mesmos Fragmentos, sem impasse (CT-126).

**O que impede usar a Nebula em produção** são dados de fora do sistema (seção 5):
- conferir as receitas no jogo e ativá-las;
- definir os preços;
- confirmar a negociabilidade dos materiais.

Nada disso é defeito do sistema.

## 2. Critérios de aceite

| História | Critério | Evidência |
|---|---|---|
| US-16 Receitas | Componentes e quantidades são dados, validados pelo admin; as da fonte entram "a validar" | Seed das 9 receitas inativas; `receitas.test.ts`; tela `/admin/receitas` |
| | Dois preços versionados (D32), limite opcional (D35) | `receitas.test.ts`; CT-117, CT-124 |
| | Mudar a receita não altera o passado; bloqueado com pendente | CT-119, CT-125 |
| US-17 Disponibilidade | Só o estoque do grupo, incluindo a reserva (D33) | CT-109, CT-110, CT-111 |
| | Duas modalidades, com os Fragmentos disputados | `disponibilidade.test.ts`: CT-121 a CT-123 |
| | Solicitar só quando tudo está disponível (briefing §7) | `bloqueioSolicitar` no frontend, com a API recusando com 409 ou 422 |
| US-18 Solicitar | Débito `NEBULA`, baixa por ordem de chegada, status pendente | CT-112 |
| | Peça trazida, pronta do estoque ou fabricada com os materiais (D31) | CT-115, CT-121, CT-122 |
| | Saldo nunca negativo; limite no período | CT-116, CT-117 |
| | Sem vínculo, sem Nebula (D12) | CT-118 |
| US-19 Analisar | Entrega só pelo admin; rejeição com motivo devolve pontos e materiais (D36) | CT-114, CT-118; e2e |
| | O membro cancela a própria pendente | Teste "o membro cancela a própria pendente"; CT-127 |
| US-20 Histórico | O membro vê as próprias solicitações; o extrato descreve a Nebula | CT-112; `/nebula/solicitacoes` |
| Invariantes | Pontos e estoque fecham | CT-128, e as checagens 8 a 10 de `database/backup/verificar-integridade.sql` |

## 3. Decisões e desvios

- **Decisões aprovadas:** D29 a D36, na análise e no planejamento. Nenhuma decisão nova foi necessária na implementação.
- **Receita sem peça-base:** se uma receita solicitável não tiver peça-base, vale sempre o preço "trazendo a peça", porque não há peça a trazer. As 6 Nebulosas da fonte têm peça.
- **Defeitos achados e corrigidos durante o épico:**
  - M10: o seed das receitas derrubava o boot se um item da fonte faltasse no catálogo. Agora ele só avisa e tenta de novo no próximo boot.
  - M10: o editor de componentes não atualizava as pendências na tela.
  - M11: o detalhe ao passar o mouse ficava aberto depois do clique e cobria o painel. Agora ele aparece só no foco pelo teclado.
- **Layout:** o sistema inteiro passou para o layout do design da loja:
  - barra superior com a busca, o saldo e o avatar;
  - menu lateral com ícones;
  - cartões na loja, na Nebula, nos personagens da party e nos drops da run.

  As cores são frias: preto, cinzas e um acento azul-aço.

## 4. O que não foi verificado

| Item | Motivo |
|---|---|
| Stack de produção (Docker, Caddy) com a Nebula | O Docker não está disponível neste ambiente. O job `producao` da CI cobre a subida e o backup |
| CI | O repositório não tem remoto |
| Login com o Discord real | Depende de uma aplicação OAuth cadastrada |
| Telas num celular de verdade | Os layouts foram conferidos com a janela estreita no navegador, não num aparelho |

## 5. Pendências de dados (fora do sistema)

- **Receitas:** conferir no jogo as 9 receitas da browiki e ativar cada uma em Receitas.
- **Preços da Nebula:** os dois valores de cada Nebulosa são decisão do grupo (D32).
- **Negociabilidade no bRO** dos Fragmentos, dos Pós, das Almas e das peças Astrais. Sem ela, os materiais não entram no estoque (D20).
- **Vínculo da Nebulosa à conta** (análise §2.3): define se o fluxo é executável no jogo.

## 6. Próximo

Os três épicos do briefing estão implementados. Não há épico seguinte planejado.
