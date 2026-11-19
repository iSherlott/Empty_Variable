# Painéis de cliente, gestor e administrador: análise e planejamento

**Status:** implementado. M12 (T-48 a T-50) e M13 (T-51 a T-54) em 2026-11-15.

**Base:**
- Decisões D37 a D40 em `docs/DECISOES.md`.
- Pedido do usuário (2026-11-15): as páginas estão poluídas e desorganizadas. Dividir em painel administrativo, de cliente e de gestor:
  - o gestor organiza os pontos e o que precisa para cada quest;
  - o administrador mexe no estoque;
  - os clientes compram itens, e os outros dois também.

**Responsáveis:** PO (§1, §6), Arquiteto (§2, §3), Frontend (§4, §5) e QA (§7). Consolidação pelo orquestrador.

---

## 1. Problema

- **Um menu para tudo:** o admin vê 15 itens de gestão de uma vez, misturando pontos, cadastros e estoque.
- **Páginas empilhadas:** cada página mostra, uma embaixo da outra, um texto longo de explicação, o formulário de cadastro, a tabela e o histórico. Estoque, Itens, Jogadores, Parâmetros e Receitas são os casos mais pesados.
- **Sem ponto de partida:** não há uma tela inicial que diga o que está pendente. Hoje é preciso abrir cada página para descobrir.

## 2. Papéis e acesso (D37, D38)

| Papel | Quem | Painéis |
|---|---|---|
| `MEMBRO` (cliente) | Todo usuário com vínculo aprovado | Cliente |
| `GESTOR` | Definido pelo admin na tela de usuários (D38) | Cliente + Gestão |
| `ADMIN` | `ADMIN_DISCORD_IDS` | Cliente + Gestão + Administração (D37) |

**Na API:**
- `enum Papel` ganha `GESTOR`, numa migration aditiva.
- `@Papeis(...)` passa a aceitar uma lista, e `ADMIN` satisfaz qualquer exigência de `GESTOR`.
- Os 403 continuam iguais para quem não tem o papel.

**Tela de usuários (admin):**
- Lista quem já entrou, com o papel de cada um.
- O admin promove a gestor ou volta a membro, com auditoria.
- Regras:
  - o papel de quem está em `ADMIN_DISCORD_IDS` não muda pela tela, porque o login reaplica ADMIN;
  - um admin não rebaixa a si mesmo.

Usar a loja e a Nebula continua exigindo vínculo com um jogador, qualquer que seja o papel (D12).

## 3. Quem acessa o quê (D39, D40)

| Painel | Telas | Hoje em |
|---|---|---|
| **Cliente** | Minha área (saldo, extrato, personagens) | `/me` |
| | Loja: vitrine, minhas compras, minhas ofertas | `/loja…` |
| | Nebula: solicitar, minhas solicitações | `/nebula…` |
| **Gestão** (gestor e admin) | Início da gestão (pendências) | nova |
| | Runs: lista, registrar, corrigir, detalhe | `/admin/runs…` |
| | Saldos dos jogadores | `/admin/saldos` |
| | Jogadores e vínculos (D40) | `/admin/jogadores` |
| | Classes e funções | `/admin/classes` |
| | Parâmetros de pontuação | `/admin/parametros` |
| | Receitas da Nebula: componentes, preços em pontos, limite e ativação (D39) | `/admin/receitas` |
| **Administração** (admin) | Início da administração (pendências) | nova |
| | Estoque: resumo, entradas, ajustes, movimentos, drops das runs | `/admin/estoque` |
| | Itens: catálogo, negociabilidade, preços da loja, reserva e limite | `/admin/itens` |
| | Entregas da loja (compras) | `/admin/compras` |
| | Ofertas de jogadores | `/admin/ofertas` |
| | Entregas da Nebula (fila dos materiais, D39) | `/admin/nebula` |
| | Taxa da loja | hoje dentro de Parâmetros |
| | Usuários e papéis (D38) | nova |

**Consequências:**
- **"Lançar drops no estoque":** fica no detalhe da run, mas só para o admin, porque mexe no estoque. O gestor vê os drops sem o botão.
- **Taxa da loja:** sai de Parâmetros (gestão) e vai para a Administração.

## 4. Navegação

- **Seletor de painel:** fica na barra superior, com **Cliente · Gestão · Administração**, e só mostra os painéis do papel da pessoa. O membro comum não vê o seletor.
- **Menu lateral:** mostra só os itens do painel ativo. São de 3 a 8 itens, em vez de 15.
- **Painel pela URL:**
  - `/me`, `/loja` e `/nebula` → Cliente;
  - `/gestao/…` → Gestão;
  - `/admin/…` → Administração.
- **URLs antigas:** as telas de gestão saem de `/admin/…` para `/gestao/…`, e as antigas redirecionam para as novas.
- **Telas iniciais de painel:** cartões de pendência, cada um com o número e um atalho.
  - **Gestão:** vínculos aguardando aprovação, receitas "a validar", runs da semana e o top de saldos.
  - **Administração:** compras a entregar (e há quanto tempo), ofertas a analisar, Nebulas a entregar e itens sem negociabilidade conferida.
- **Destino depois do login:**
  - admin → Administração;
  - gestor → Gestão;
  - membro → Minha área.

## 5. Padrão das páginas (contra a poluição visual)

Toda página segue o mesmo esqueleto:

1. **Cabeçalho:** título, uma frase curta e, à direita, a ação principal (ex.: "Nova entrada", "Registrar run").
2. **"Como funciona":** as explicações longas vão para um bloco recolhido. A página não abre com um parágrafo.
3. **Formulários fora da página:** criar e editar abre um painel lateral ou um diálogo. A página mostra a lista.
4. **Abas** quando há mais de uma seção:

   | Página | Abas |
   |---|---|
   | Estoque | Resumo · Movimentos |
   | Itens | Catálogo · Loja (preço, reserva e limite) |
   | Jogadores | Pendentes · Jogadores |
   | Parâmetros | Vigente · Histórico |
   | Receitas | Nebulosas · Peças Astrais |
   | Minha área | Extrato · Personagens · Pontos por rank |

5. **Filtros em chips** com a contagem (como na loja), em vez de selects soltos.
6. **Os cartões** (`.cartao-b`) continuam nas grades. Listas administrativas seguem em tabela, sem barra de rolagem (modo cartão no celular).

## 6. Tarefas e marcos (PO)

| Marco | Entrega verificável |
|---|---|
| M12 Papéis | Gestor existe, é definido pelo admin e só acessa o que é dele; a API recusa o resto |
| M13 Painéis e páginas | Seletor de painel, menus por painel, telas iniciais com pendências e as páginas no padrão §5 |

| ID | Tarefa | Dono | História |
|---|---|---|---|
| T-48 | Migration do papel `GESTOR`; `@Papeis` com lista e ADMIN acima de GESTOR; mover as rotas de gestão (§3) | BE | D37 |
| T-49 | Usuários e papéis: listar, promover e rebaixar, com auditoria e as regras do §2 | BE | D38 |
| T-50 | Resumo de pendências por painel (`GET /api/painel/gestao` e `/api/painel/admin`) | BE | §4 |
| T-51 | Shell: seletor de painel, menu por painel, guardas de rota, URLs novas com redirecionamento, destino depois do login | FE | §4 |
| T-52 | Telas iniciais da Gestão e da Administração; tela de usuários | FE | §4, D38 |
| T-53 | Páginas no padrão §5 (abas, "Como funciona", formulários em painel lateral) | FE | §5 |
| T-54 | Testes de permissão (matriz §3), e2e por papel, verificação de integridade e docs | QA | Todas |

**Caminho crítico:** T-48 → T-49 → T-51 → T-53 → T-54.

## 7. Plano de testes (QA)

| ID | Cenário | Esperado |
|---|---|---|
| CT-129 | Gestor acessa runs, saldos, jogadores, classes, parâmetros e receitas | 200 |
| CT-130 | Gestor tenta estoque, itens, compras, ofertas, entregas da Nebula, taxa da loja ou usuários | 403 |
| CT-131 | Admin acessa tudo das duas listas acima | 200 |
| CT-132 | Membro tenta qualquer rota de gestão ou administração | 403 |
| CT-133 | Admin promove a gestor e rebaixa; a auditoria registra quem e quando | Papel muda na hora (próxima requisição) |
| CT-134 | Mudar o papel de um ID de `ADMIN_DISCORD_IDS`, ou o admin rebaixar a si mesmo | 409 |
| CT-135 | Gestor sem vínculo | Usa a gestão, mas não a loja nem a Nebula (D12) |
| CT-136 | URL antiga `/admin/runs` | Redireciona para `/gestao/runs` |
| CT-137 | Detalhe da run para o gestor | Vê os drops, sem o botão "Lançar drops no estoque" |
| CT-138 | Telas iniciais | Contagens batem com as filas (compras, ofertas, Nebula, vínculos, receitas a validar) |

**E2e:**
1. O admin promove um membro a gestor.
2. O gestor registra uma run e não vê a Administração.
3. O admin entrega uma compra.
4. O membro compra.

## 8. Impacto no que já existe

- **Migration aditiva:** só o valor novo no enum. Nenhum dado muda.
- **API:** as rotas não mudam de endereço. Muda só quem pode chamar.
- **Frontend:**
  - as telas de gestão mudam de `/admin/…` para `/gestao/…`, com redirecionamento;
  - os e2e atuais passam a usar as URLs novas.
- **Regras de negócio:** nenhuma mudança em pontos, loja, estoque ou Nebula.
