// T-37: loja ponta a ponta — estoque e preço pelo admin, compra pelo membro, entrega,
// oferta consignada aprovada, venda a um terceiro com crédito ao vendedor na entrega, e cancelamento.
import { type APIRequestContext, type Page, expect, test } from "@playwright/test";
import { ORIGEM } from "../playwright.config";

const ADMIN = { discordId: "900000000000000001", username: "admin-e2e" };
const CAIO = { discordId: "900000000000000011", username: "caio-e2e" };
const DANI = { discordId: "900000000000000012", username: "dani-e2e" };

async function entrar(page: Page, u: { discordId: string; username: string }): Promise<void> {
  await page.context().clearCookies();
  const r = await page.request.post("/api/auth/dev-login", { data: u, headers: { Origin: ORIGEM } });
  expect(r.status()).toBe(204);
}

async function json<T>(
  req: APIRequestContext,
  metodo: "get" | "post" | "patch",
  url: string,
  data?: object,
): Promise<T> {
  const r = await req[metodo](url, { ...(data === undefined ? {} : { data }), headers: { Origin: ORIGEM } });
  expect(r.ok(), `${metodo.toUpperCase()} ${url} → ${r.status()} ${await r.text()}`).toBe(true);
  return (r.status() === 204 ? undefined : await r.json()) as T;
}

/** Cria o jogador, vincula o usuário do Discord e credita pontos por uma run. */
async function prepararMembro(page: Page, u: typeof CAIO, apelido: string, personagem: string) {
  await entrar(page, ADMIN);
  const jogador = await json<{ id: string; personagens: { id: string }[] }>(
    page.request,
    "post",
    "/api/jogadores",
    {
      apelido,
      personagens: [personagem],
    },
  );
  const classes = await json<{ apelidoGrupo: string; funcoes: { id: string }[] }[]>(
    page.request,
    "get",
    "/api/classes",
  );
  const mtk = classes.find((c) => c.apelidoGrupo === "MTK")!.funcoes[0]!.id;
  // MTK no Betelgeuse 75, concluída: 600 pontos
  await json(page.request, "post", "/api/runs", {
    data: "2026-11-14",
    chefe: "BETELGEUSE_75",
    status: "CONCLUIDA",
    participantes: [{ personagemId: jogador.personagens[0]!.id, funcaoId: mtk }],
  });
  await entrar(page, u);
  const sol = await json<{ id: string }>(page.request, "post", "/api/vinculo/solicitacoes", {
    jogadorId: jogador.id,
  });
  await entrar(page, ADMIN);
  await json(page.request, "post", `/api/vinculo/solicitacoes/${sol.id}/aprovar`, {});
}

test.describe.serial("Loja de pontos", () => {
  test("preparação: admin libera e precifica a Carta Naght Sieger, estoca 1 e vincula Caio e Dani", async ({
    page,
  }) => {
    await entrar(page, ADMIN);
    const itens = await json<{ id: string; nome: string }[]>(page.request, "get", "/api/itens");
    let carta = itens.find((i) => i.nome === "Carta Naght Sieger");
    if (!carta) {
      carta = await json<{ id: string; nome: string }>(page.request, "post", "/api/itens", {
        nome: "Carta Naght Sieger",
        tipo: "CARTA",
      });
    }
    await json(page.request, "patch", `/api/itens/${carta.id}`, { negociavel: true, vinculadoConta: false });
    await json(page.request, "post", "/api/loja/precos", { itemId: carta.id, precoPontos: 250 });
    await json(page.request, "post", "/api/estoque/entradas", { itemId: carta.id, quantidade: 1 });
    await prepararMembro(page, CAIO, "Caio", "Caio-MTK");
    await prepararMembro(page, DANI, "Dani", "Dani-MTK");
  });

  test("Caio compra pela vitrine; o detalhe aparece ao passar o mouse", async ({ page }) => {
    await entrar(page, CAIO);
    await page.goto("/loja");
    await expect(page.getByTestId("saldo-topo")).toContainText("600 pts");
    await page.setViewportSize({ width: 360, height: 740 });
    const menu = page.getByRole("navigation", { name: "Menu principal" });
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(menu.getByRole("link", { name: "Cartas" })).toBeVisible();
    await expect(menu.getByText("Gestão", { exact: true })).toHaveCount(0);
    await menu.getByRole("link", { name: "Cartas" }).click();
    await expect(menu).toBeHidden();
    await page.getByRole("searchbox", { name: "Buscar na loja" }).fill("Naght");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/categoria=CARTA.*busca=Naght/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    const detalhes = page.getByRole("dialog");
    await page.getByRole("button", { name: "Comprar Carta Naght Sieger" }).click();
    await expect(detalhes).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detalhes).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 900 });
    const cartao = page.getByRole("button", { name: "Comprar Carta Naght Sieger" });
    await cartao.hover();
    await expect(page.getByRole("tooltip")).toContainText("250 pts por unidade");
    await cartao.click();
    await expect(page.getByTestId("painel-compra")).toContainText("Saldo depois da compra: 350 pts");
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByTestId("saldo-topo")).toContainText("350 pts");
    await page.goto("/loja/compras");
    await expect(page.getByTestId("minhas-compras")).toContainText("Aguardando entrega");
  });

  test("Dani oferece a carta; o admin aprova na fila; Caio compra a consignada e o admin entrega", async ({
    page,
  }) => {
    await entrar(page, DANI);
    await page.goto("/loja/ofertas");
    await page.getByRole("button", { name: "Nova oferta" }).click();
    await page.getByRole("combobox", { name: "Item" }).click();
    await page.getByRole("option", { name: /Carta Naght Sieger/ }).click();
    await page.getByRole("button", { name: "Oferecer" }).click();
    await expect(page.getByTestId("minhas-ofertas")).toContainText("Aguardando o guardião");

    await entrar(page, ADMIN);
    page.on("dialog", (d) => void d.accept());
    await page.goto("/admin/ofertas");
    await page.getByRole("button", { name: "Recebi, aprovar" }).click();
    await expect(page.getByText("Oferta aprovada")).toBeVisible();

    await entrar(page, CAIO);
    await page.goto("/loja");
    await page.getByRole("button", { name: "Comprar Carta Naght Sieger" }).click();
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByTestId("saldo-topo")).toContainText("100 pts");

    // Antes da entrega, Dani ainda não recebeu (D28)
    await entrar(page, DANI);
    await page.goto("/me");
    await expect(page.getByTestId("saldo")).toHaveText("600");

    await entrar(page, ADMIN);
    await page.goto("/admin/compras");
    const entregar = page.getByRole("button", { name: "Entregue", exact: true });
    await expect(entregar).toHaveCount(2);
    await entregar.first().click();
    await expect(page.getByText("Entrega registrada.")).toBeVisible();
    await entregar.first().click();
    await expect(page.getByRole("button", { name: "Entregue", exact: true })).toHaveCount(0);

    await entrar(page, DANI);
    await page.goto("/me");
    await expect(page.getByTestId("saldo")).toHaveText("850");
    await expect(page.getByTestId("historico")).toContainText(
      "Venda consignada: 1× Carta Naght Sieger para Caio",
    );
  });

  test("cancelamento antes da entrega devolve os pontos", async ({ page }) => {
    await entrar(page, ADMIN);
    const itens = await json<{ id: string; nome: string }[]>(page.request, "get", "/api/itens");
    const carta = itens.find((i) => i.nome === "Carta Naght Sieger")!;
    await json(page.request, "post", "/api/estoque/entradas", { itemId: carta.id, quantidade: 1 });

    await entrar(page, DANI);
    page.on("dialog", (d) => void d.accept());
    await page.goto("/loja");
    await page.getByRole("button", { name: "Comprar Carta Naght Sieger" }).click();
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.getByTestId("saldo-topo")).toContainText("600 pts");
    await page.goto("/loja/compras");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByTestId("minhas-compras")).toContainText("Cancelada");
    await page.goto("/me");
    await expect(page.getByTestId("saldo")).toHaveText("850");
  });
});
