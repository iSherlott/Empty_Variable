import { type Page, expect, test } from "@playwright/test";
import { ORIGEM } from "../playwright.config";

const INSTANCIA = "Cripta M15";
const ENCONTRO = "Guardião da Cripta";
const FUNCAO = "Tanque da Cripta";
const JOGADOR = "Lia M15";
const PERSONAGEM = "Lia-M15-MTK";

async function escolher(page: Page, rotulo: string, opcao: string): Promise<void> {
  await page.getByRole("combobox", { name: rotulo, exact: true }).click();
  await page.getByRole("option", { name: opcao, exact: true }).click();
}

async function salvarVersao(page: Page, versao: number): Promise<void> {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Criar versão v${versao}` }).click();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(
    page.getByTestId("historico-versoes").getByRole("cell", { name: `v${versao}`, exact: true }),
  ).toBeVisible();
}

async function avancarAteRevisao(page: Page): Promise<void> {
  for (let passo = 0; passo < 3; passo++) {
    await page.getByRole("button", { name: "Próximo", exact: true }).click();
  }
}

test("M15: cadastra, versiona e ativa uma instância; registra e corrige uma run", async ({ page }) => {
  // O login simulado e o jogador são preparação. O fluxo M15 usa a interface.
  const headers = { Origin: ORIGEM };
  const login = await page.request.post("/api/auth/dev-login", {
    headers,
    data: { discordId: "900000000000000001", username: "admin-e2e" },
  });
  expect(login.status()).toBe(204);
  const jogador = await page.request.post("/api/jogadores", {
    headers,
    data: { apelido: JOGADOR, personagens: [PERSONAGEM] },
  });
  expect(jogador.status()).toBe(201);

  const proximo = page.getByRole("button", { name: "Próximo", exact: true });
  const resumo = page.getByTestId("resumo");
  const participacao = page.getByRole("article", { name: PERSONAGEM });
  const previa = page.getByTestId("ganho-por-jogador");

  await test.step("Cadastrar v1 sem funções e verificar que não pode ser ativada", async () => {
    await page.goto("/gestao/instancias");
    await page.getByRole("button", { name: "Nova instância" }).click();
    await page.getByRole("textbox", { name: "Nome", exact: true }).fill(INSTANCIA);
    await page.getByRole("textbox", { name: "Encontro", exact: true }).fill(ENCONTRO);
    await page.getByRole("spinbutton", { name: "Multiplicador" }).fill("1.2");
    await page.getByRole("button", { name: "Cadastrar", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText(INSTANCIA);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sem funções");
    await page.getByRole("button", { name: "Ativar", exact: true }).click();
    await expect(
      page.getByText("Cadastre as funções e ranks antes de ativar a instância", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sem funções");
  });
  const detalheInstancia = page.url();

  await test.step("Criar v2 com função de rank 4 e ativar a instância", async () => {
    await page.getByRole("button", { name: "Nova versão", exact: true }).click();
    await page.getByRole("button", { name: "Adicionar função" }).click();
    await escolher(page, "Classe", "MTK");
    await page.getByRole("textbox", { name: "Função", exact: true }).fill(FUNCAO);
    await page.getByRole("spinbutton", { name: "Rank", exact: true }).fill("4");
    await page.getByRole("checkbox", { name: "Padrão", exact: true }).check();
    await salvarVersao(page, 2);
    await expect(
      page.getByTestId("historico-versoes").getByRole("cell", { name: "v1", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Inativa");

    await page.goto("/gestao/runs/nova");
    const instancias = page.getByRole("combobox", { name: "Instância", exact: true });
    await instancias.click();
    await expect(page.getByRole("option", { name: "Torre da Constelação", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: INSTANCIA, exact: true })).toHaveCount(0);

    await page.goto(detalheInstancia);
    await page.getByRole("button", { name: "Ativar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Desativar", exact: true })).toBeVisible();
  });

  await test.step("Registrar run da v2 e validar CT-143", async () => {
    await page.goto("/gestao/runs/nova");
    await escolher(page, "Instância", INSTANCIA);
    await escolher(page, "Encontro", `${ENCONTRO} (×1,2)`);
    await expect(page.getByLabel("Pontuação do Betelgeuse")).toHaveCount(0);
    await proximo.click();
    await escolher(page, "Personagem", PERSONAGEM);
    await escolher(page, "Classe", "MTK");
    await expect(page.getByRole("combobox", { name: "Função", exact: true })).toContainText(
      `${FUNCAO} (rank 4)`,
    );
    await avancarAteRevisao(page);

    // CT-143: 100 × 2,5 × 1,2 = 300.
    await expect(previa).toContainText(`${JOGADOR}: 300`);
    await page.getByRole("button", { name: "Registrar run", exact: true }).click();
    await expect(page).toHaveURL(/\/gestao\/runs\/[0-9a-f-]{36}$/);
    await expect(resumo).toContainText(`${INSTANCIA} (v2) · ${ENCONTRO}`);
    await expect(participacao).toContainText("Rank 4");
    await expect(participacao).toContainText("300 pts");
  });
  const runOriginal = page.url();

  await test.step("Criar v3 e confirmar que a run original mantém versão e pontos", async () => {
    await page.goto(detalheInstancia);
    await page.getByRole("button", { name: "Nova versão", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Multiplicador" }).fill("1.23");
    await page.getByRole("spinbutton", { name: "Rank", exact: true }).fill("2");
    await salvarVersao(page, 3);

    await page.goto(runOriginal);
    await expect(resumo).toContainText(`${INSTANCIA} (v2) · ${ENCONTRO}`);
    await expect(participacao).toContainText("Rank 4");
    await expect(participacao).toContainText("300 pts");
  });

  await test.step("Corrigir na v3 da mesma instância e verificar o estorno da v2", async () => {
    await page.getByRole("link", { name: "Corrigir", exact: true }).click();
    const instancia = page.getByRole("combobox", { name: "Instância", exact: true });
    await expect(instancia).toHaveText(INSTANCIA);
    await expect(instancia).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Encontro", exact: true })).toContainText(
      `${ENCONTRO} (×1,23)`,
    );
    await page.getByLabel("Motivo da correção").fill("Recalcular com a versão vigente da Cripta");
    await proximo.click();
    await expect(page.getByRole("combobox", { name: "Função", exact: true })).toContainText(
      `${FUNCAO} (rank 2)`,
    );
    await avancarAteRevisao(page);

    // 100 × 1,5 × 1,23 = 184,5, arredondado para 185.
    await expect(previa).toContainText(`${JOGADOR}: 185`);
    await page.getByRole("button", { name: "Registrar correção", exact: true }).click();
    await expect(page).toHaveURL(/\/gestao\/runs\/[0-9a-f-]{36}$/);
    await expect(resumo).toContainText(`${INSTANCIA} (v3) · ${ENCONTRO}`);
    await expect(participacao).toContainText("Rank 2");
    await expect(participacao).toContainText("185 pts");
    const runCorrigida = page.url();

    await page.getByRole("link", { name: "a run original" }).click();
    await expect(page).toHaveURL(runOriginal);
    await expect(resumo).toContainText(`${INSTANCIA} (v2) · ${ENCONTRO}`);
    await expect(resumo).toContainText("Estornada");
    await expect(participacao).toContainText("300 pts");
    await page.getByRole("link", { name: "Ver a correção" }).click();
    await expect(page).toHaveURL(runCorrigida);
  });
});
