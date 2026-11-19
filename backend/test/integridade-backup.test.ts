// T-24: as verificações rodadas após restaurar um backup (database/backup/verificar-integridade.sql)
// passam num banco coerente e acusam um ledger inconsistente.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SeedService } from "../src/cadastros/seed.service.js";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

/** O arquivo é para o psql: tira os meta-comandos (\echo) e separa a consulta do bloco DO. */
function comandosDoArquivo(): string[] {
  const sql = readFileSync(resolve(__dirname, "../../database/backup/verificar-integridade.sql"), "utf8")
    .split("\n")
    .filter((l) => !l.startsWith("\\") && !l.trimStart().startsWith("--"))
    .join("\n");
  const inicioDo = sql.indexOf("DO $$");
  return [sql.slice(0, inicioDo).trim().replace(/;$/, ""), sql.slice(inicioDo).trim().replace(/;$/, "")];
}

describe("Verificação de integridade do backup (T-24)", () => {
  let ctx: Contexto;

  async function verificar(): Promise<void> {
    for (const comando of comandosDoArquivo()) await ctx.prisma.$executeRawUnsafe(comando);
  }

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await ctx.fechar();
  });

  beforeEach(async () => {
    await ctx.limparBanco();
    await ctx.app.get(SeedService).aplicar();
    const admin = await ctx.login(ADMIN_DISCORD_ID, "admin");
    const ana = await ctx.prisma.jogador.create({
      data: { apelido: "Ana", personagens: { create: [{ nome: "Ana-MTK" }] } },
      include: { personagens: true },
    });
    const x = await ctx.prisma.jogador.create({ data: { apelido: "X" } });
    const mtk = await ctx.prisma.funcaoClasse.findFirstOrThrow({
      where: { classe: { apelidoGrupo: "MTK" } },
    });
    const corpo = (status: string) => ({
      data: "2026-11-14",
      chefe: "NAGHT_25",
      status,
      participantes: [
        {
          personagemId: ana.personagens[0]!.id,
          funcaoId: mtk.id,
          emprestimos: [{ credorJogadorId: x.id, categoria: "ESSENCIAL", itemDescricao: "Arma" }],
        },
      ],
    });
    const r1 = await ctx
      .http()
      .post("/api/runs")
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send(corpo("CONCLUIDA"))
      .expect(201);
    // Uma run corrigida (estornada) e a correção, para cobrir as duas verificações de soma.
    await ctx
      .http()
      .post(`/api/runs/${r1.body.runId}/corrigir`)
      .set("Cookie", admin)
      .set("Origin", ORIGEM)
      .send({ motivo: "Teste", run: corpo("FALHA_CHEFE") })
      .expect(201);
  });

  it("passa num banco coerente (migrations, triggers, saldo = ledger, somas por run)", async () => {
    await expect(verificar()).resolves.toBeUndefined();
  });

  it("acusa uma run cujos lançamentos não somam os pontos gerados", async () => {
    const run = await ctx.prisma.run.findFirstOrThrow({ where: { status: { not: "ESTORNADA" } } });
    const u = await ctx.prisma.usuario.findFirstOrThrow();
    const j = await ctx.prisma.jogador.findFirstOrThrow({ where: { apelido: "X" } });
    await ctx.prisma.lancamentoPontos.create({
      data: { jogadorId: j.id, valor: 7, tipo: "AJUSTE_ADMIN", criadoPorId: u.id, runId: run.id },
    });
    await expect(verificar()).rejects.toThrow(/não somam os pontos gerados/);
  });

  it("CT-128: acusa uma Nebula cancelada que não devolveu o material", async () => {
    const u = await ctx.prisma.usuario.findFirstOrThrow();
    const j = await ctx.prisma.jogador.findFirstOrThrow({ where: { apelido: "Ana" } });
    const r = await ctx.prisma.receita.findFirstOrThrow({ where: { nome: "Armadura Nebulosa POD" } });
    const frag = await ctx.prisma.itemCatalogo.findFirstOrThrow({
      where: { nome: "Fragmento de Meteorito" },
    });
    const preco = await ctx.prisma.precoReceita.create({
      data: { receitaId: r.id, versao: 1, precoComPeca: 800, precoTrazendoPeca: 500, criadoPorId: u.id },
    });
    const lote = await ctx.prisma.loteEstoque.create({
      data: { itemId: frag.id, origem: "MANUAL", criadoPorId: u.id },
    });
    await ctx.prisma.movimentoEstoque.create({
      data: { loteId: lote.id, quantidade: 50, tipo: "ENTRADA", criadoPorId: u.id },
    });
    const s = await ctx.prisma.solicitacaoNebula.create({
      data: {
        jogadorId: j.id,
        receitaId: r.id,
        trazPeca: true,
        preco: 500,
        precoReceitaId: preco.id,
        status: "CANCELADA",
        encerradaEm: new Date(),
        encerradaPorId: u.id,
      },
    });
    await ctx.prisma.movimentoEstoque.create({
      data: {
        loteId: lote.id,
        quantidade: -50,
        tipo: "NEBULA",
        solicitacaoNebulaId: s.id,
        criadoPorId: u.id,
      },
    });
    await expect(verificar()).rejects.toThrow(/sem devolver o material/);
  });

  it("acusa a falta dos triggers de imutabilidade", async () => {
    await ctx.prisma.$executeRawUnsafe(
      'DROP TRIGGER "lancamento_pontos_sem_truncate" ON "lancamento_pontos"',
    );
    try {
      await expect(verificar()).rejects.toThrow(/Triggers de imutabilidade ausentes/);
    } finally {
      await ctx.prisma.$executeRawUnsafe(
        'CREATE TRIGGER "lancamento_pontos_sem_truncate" BEFORE TRUNCATE ON "lancamento_pontos" FOR EACH STATEMENT EXECUTE FUNCTION "bloquear_alteracao"()',
      );
    }
  });
});
