// Sobe o banco dos testes de integração e aplica as migrations.
// - Com TEST_DATABASE_URL (CI, Docker): usa esse banco, que deve estar vazio (só recebe migrate deploy).
// - Sem TEST_DATABASE_URL: sobe um Postgres 16 local com os binários do pacote embedded-postgres.
//   Os binários são copiados para uma pasta temporária de caminho curto, porque o initdb falha
//   com caminhos acima de 260 caracteres no Windows.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { GlobalSetupContext } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const require = createRequire(__filename);
const raizApi = resolve(__dirname, "..", "..");
const EXE = platform() === "win32" ? ".exe" : "";

function aplicarMigrations(url: string): void {
  const cli = require.resolve("prisma/build/index.js");
  execFileSync(process.execPath, [cli, "migrate", "deploy", "--schema", "../database/prisma/schema.prisma"], {
    cwd: raizApi,
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });
}

/** Pasta `native` (bin/, lib/, share/) do pacote de binários desta plataforma, copiada para um caminho curto. */
async function binariosPostgres(): Promise<string> {
  const pacote = `@embedded-postgres/${platform() === "win32" ? "windows" : platform()}-${arch()}`;
  const { pg_ctl } = (await import(pacote)) as { pg_ctl: string };
  const nativo = dirname(dirname(pg_ctl));
  const versao = (JSON.parse(readFileSync(join(nativo, "..", "package.json"), "utf8")) as { version: string })
    .version;
  const destino = join(tmpdir(), `betel-pg-${versao}`);
  if (!existsSync(join(destino, "bin", `pg_ctl${EXE}`))) cpSync(nativo, destino, { recursive: true });
  return destino;
}

export default async function setup({ provide }: GlobalSetupContext): Promise<() => Promise<void>> {
  const externa = process.env["TEST_DATABASE_URL"];
  if (externa) {
    aplicarMigrations(externa);
    provide("databaseUrl", externa);
    return async () => undefined;
  }

  const bin = join(await binariosPostgres(), "bin");
  const pasta = mkdtempSync(join(tmpdir(), "betel-pgdata-"));
  const dados = join(pasta, "dados");
  const porta = 55_000 + Math.floor(Math.random() * 5_000);
  const opcoes = { stdio: "pipe" as const };

  execFileSync(
    join(bin, `initdb${EXE}`),
    ["-D", dados, "-U", "betel", "--auth=trust", "-E", "UTF8", "--no-locale"],
    opcoes,
  );
  execFileSync(
    join(bin, `pg_ctl${EXE}`),
    [
      "-D",
      dados,
      "-o",
      `-p ${porta} -c listen_addresses=127.0.0.1`,
      "-l",
      join(pasta, "log.txt"),
      "-w",
      "start",
    ],
    // "ignore": o servidor herdaria os pipes e o execFileSync esperaria para sempre.
    { stdio: "ignore" },
  );
  const url = `postgresql://betel@127.0.0.1:${porta}/postgres`;
  try {
    aplicarMigrations(url);
  } catch (erro) {
    execFileSync(join(bin, `pg_ctl${EXE}`), ["-D", dados, "-m", "immediate", "stop"], opcoes);
    throw erro;
  }
  provide("databaseUrl", url);

  return async () => {
    execFileSync(join(bin, `pg_ctl${EXE}`), ["-D", dados, "-m", "fast", "-w", "stop"], opcoes);
    rmSync(pasta, { recursive: true, force: true });
  };
}
