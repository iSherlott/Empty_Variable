import { type Page, expect, test } from "@playwright/test";
import { ORIGEM } from "../playwright.config";

const ADMIN = { discordId: "900000000000000001", username: "admin-e2e" };
const GIL = { discordId: "900000000000000031", username: "gil-e2e" };

async function entrar(page: Page, u: { discordId: string; username: string }): Promise<void> {
  await page.context().clearCookies();
  const r = await page.request.post("/api/auth/dev-login", { data: u, headers: { Origin: ORIGEM } });
  expect(r.status()).toBe(204);
}

test.describe.serial("Painéis por papel", () => {
  test("o admin abre na Administração, com acesso à gestão pelo mesmo menu", async ({ page }) => {
    await entrar(page, GIL); // cria o usuário que vai virar gestor
    await entrar(page, ADMIN);
    await page.goto("/");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("resumo-admin")).toContainText("Compras a entregar");
    const menu = page.getByRole("navigation", { name: "Menu principal" });
    await expect(menu.getByRole("link", { name: "Estoque" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Vínculo" })).toBeVisible();
    await menu.getByText("Gestão", { exact: true }).click();
    await menu.getByRole("link", { name: "Runs", exact: true }).click();
    await expect(page).toHaveURL(/\/gestao\/runs$/);
  });

  test("o admin promove o Gil a gestor na tela de usuários", async ({ page }) => {
    await entrar(page, ADMIN);
    await page.goto("/admin/usuarios");
    await page.getByRole("combobox", { name: "Papel de gil-e2e" }).click();
    await page.getByRole("option", { name: "Gestor" }).click();
    await expect(page.getByText("gil-e2e agora é gestor.")).toBeVisible();
  });

  test("o gestor abre na Gestão e não entra na Administração", async ({ page }) => {
    await entrar(page, GIL);
    await page.goto("/");
    await expect(page).toHaveURL(/\/gestao$/);
    await expect(page.getByTestId("resumo-gestao")).toContainText("Vínculos a aprovar");
    const menu = page.getByRole("navigation", { name: "Menu principal" });
    await expect(menu.getByRole("link", { name: "Runs", exact: true })).toBeVisible();
    await expect(menu.getByText("Administração", { exact: true })).toHaveCount(0);
    await page.goto("/gestao/runs");
    await expect(page.getByRole("link", { name: "Registrar run" })).toBeVisible();
    // A Administração manda de volta ao início (que, para o gestor, é a Gestão)
    await page.goto("/admin/estoque");
    await expect(page).toHaveURL(/\/gestao$/);
  });
});
