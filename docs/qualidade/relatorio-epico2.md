# Relatório de QA do Épico II: loja de pontos e estoque (T-38, Agent 06)

**Data:** 2026-11-14. **Base:** branch `feat/m9-ofertas`, com os marcos M7 a M9 sobre o Épico I.

## 1. Resumo

| Suíte | Quantidade | Resultado |
|---|---:|---|
| Motor de cálculo | 84 | ✅ todos passam |
| API, integração com Postgres 16 real | 142 | ✅ todos passam; 46 são do Épico II (`estoque`, `loja`, `ofertas`) |
| Frontend (Angular) | 32 | ✅ todos passam |
| Ponta a ponta (Playwright + Chrome) | 8 | ✅ todos passam; 4 são da loja |

Lint, formatação, typecheck e build de produção também passam.

**Veredito:** todos os critérios de US-09 a US-15 e os casos CT-81 a CT-108 têm teste automatizado passando, incluindo as concorrências reais: duas compras do mesmo membro ao mesmo tempo e duas pessoas disputando a última unidade.

**O que impede vender itens da Torre em produção** continua sendo a verificação da negociabilidade no bRO (seção 5). Não é um defeito do sistema.

## 2. Critérios de aceite

| História | Critério | Evidência |
|---|---|---|
| US-09 Estoque | Entrada com item, quantidade inteira > 0 e origem; drop de run lançado uma vez | `estoque.test.ts`: CT-87, CT-88, CT-105 |
| | Só item negociável e não vinculado à conta (D20) | CT-87, e a aprovação de oferta é recusada se o item deixou de ser elegível |
| | Histórico de entradas e saídas com autor, data e origem | Movimentos com filtros; tela `/admin/estoque` |
| | Quantidade nunca negativa | CT-104: o serviço e o trigger do banco recusam |
| | Preço único por item, sem alterar compras passadas (D21) | Versões de preço; CT-91 (a compra grava o preço) |
| US-10 Vitrine | Só elegíveis, com preço, disponível já descontando a reserva (D26) | CT-98, CT-99 |
| | Sem vínculo, sem loja (D12) | CT-106 |
| US-11 Compra | Saldo nunca negativo (D24) | CT-82, CT-83 (concorrente) |
| | Débito na compra, item reservado (D19) | CT-81 |
| | Concorrência não passa do saldo nem do estoque | CT-83, CT-84 |
| | Limite por membro no período | CT-101 |
| | Ordem de chegada entre lotes (D27) | CT-96, CT-97 |
| US-12 Entrega e cancelamento | Entrega só pelo admin, com autor e data | CT-86, CT-107 |
| | Cancelar antes da entrega: estorno integral e o item volta (D25) | CT-85, CT-103 |
| | Compra entregue não é cancelada | CT-86 |
| US-13 Histórico | `COMPRA` no extrato com item e quantidade; só as próprias compras (D14) | CT-81, CT-94 |
| US-14 Oferta | Só item elegível, sem preço (C12), análise pelo admin, rejeição com motivo | `ofertas.test.ts` |
| | Retirada enquanto não vendida (D25) | Pendente sai na hora; aprovada para de vender e o admin conclui; CT-102, CT-103 |
| US-15 Consignação | O vendedor recebe na entrega (D28), menos a taxa vigente na compra (D22) | D28, CT-89, CT-100; e2e "Dani oferece..." |
| | O vendedor não compra o próprio lote | CT-90 |
| | Os pontos fecham (comprador = vendedores + fora de circulação) | CT-108 |

## 3. Decisões e desvios

- **Decisões aprovadas durante o épico:**
  - D18 a D27, na análise e no planejamento;
  - D28, no M8: o vendedor recebe na entrega, para nenhum saldo ficar negativo quando o comprador cancela.
- **Ajuste técnico no M9:** só é possível concluir a retirada de uma oferta depois que as compras pendentes daquele lote forem entregues ou canceladas. Sem isso, cancelar uma compra depois da retirada devolveria unidades a um lote já encerrado. A CT-102 foi testada com essa regra.
- **Ajustes técnicos do M7:**
  - versão por preço e ordem estrita dos lotes, porque horários iguais dentro de uma transação não ordenam;
  - CHECK do limite à prova de nulos.
- **Tema:** o sistema passou para um tema escuro e frio, com fundo preto e cinzas azulados e um único acento verde-acinzentado. Todos os pares de texto passam no contraste AA.

## 4. O que não foi verificado

| Item | Motivo |
|---|---|
| Stack de produção (Docker, Caddy) com a loja | O Docker não está disponível neste ambiente. O job `producao` da CI cobre a subida e o backup |
| CI | O repositório não tem remoto |
| Login com o Discord real | Depende de uma aplicação OAuth cadastrada |
| Telas em celular | Não houve revisão visual em telas estreitas. Os layouts quebram linha e as tabelas rolam dentro do bloco, mas isso não foi conferido num aparelho |

## 5. Pendências de dados (fora do sistema)

- **Negociabilidade de cada item no bRO:** sem ela, nenhum item da Torre pode entrar na loja (D20).
- **Preços dos itens:** são decisão do grupo (D21), registrada pelo admin na tela Itens.
- **Taxa da loja:** começa em 0% (D22); mudar é uma nova versão em Parâmetros.

## 6. Próximo

O **Épico III (solicitação de Nebula)** não foi iniciado. O modelo já prevê movimentos de estoque do tipo `NEBULA` e a reserva mínima por item (D26).
