// Uso: pnpm --filter @betel/api sso:verificar   (lê o .env da raiz do repositório)
// Confere a configuração do login com o Discord e mostra a URL a cadastrar no portal.
import {
  diagnosticarConfiguracao,
  type ItemDiagnostico,
  redirectEsperado,
  validarCredenciais,
} from "./auth/diagnostico-sso.js";

const MARCA: Record<ItemDiagnostico["nivel"], string> = { ok: "[ok]   ", aviso: "[aviso]", erro: "[erro] " };

async function main(): Promise<void> {
  const itens = diagnosticarConfiguracao(process.env);
  if (!itens.some((i) => i.nivel === "erro" && i.texto.startsWith("DISCORD_CLIENT"))) {
    itens.push(await validarCredenciais(process.env));
  }
  console.log("Login com o Discord (SSO)\n");
  for (const i of itens) console.log(`${MARCA[i.nivel]} ${i.texto}`);
  console.log(`\nCadastre no portal (OAuth2 → Redirects): ${redirectEsperado(process.env)}`);
  const erros = itens.filter((i) => i.nivel === "erro").length;
  console.log(erros === 0 ? "\nTudo certo para entrar com o Discord." : `\n${erros} problema(s) a corrigir.`);
  process.exitCode = erros === 0 ? 0 : 1;
}

void main();
