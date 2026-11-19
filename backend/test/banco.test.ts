// T-07: regras garantidas pelo próprio banco (CHECKs, FK composta, triggers, view).
import type { PrismaService } from "../src/prisma/prisma.service.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Contexto, criarApp } from "./suporte/app-de-teste.js";

describe("Schema do banco (T-07)", () => {
  let ctx: Contexto;
  let db: PrismaService;

  beforeAll(async () => {
    ctx = await criarApp();
    db = ctx.prisma;
  });
  afterAll(async () => {
    await ctx.fechar();
  });
  beforeEach(async () => {
    await ctx.limparBanco();
  });

  /** Monta uma run mínima com dois jogadores (ana participa; beto é credor em potencial). */
  async function cenario() {
    const admin = await db.usuario.create({
      data: { discordId: "1", discordUsername: "adm", papel: "ADMIN" },
    });
    const ana = await db.jogador.create({
      data: { apelido: "Ana", personagens: { create: { nome: "Ana-MTK" } } },
      include: { personagens: true },
    });
    const beto = await db.jogador.create({ data: { apelido: "Beto" } });
    const classe = await db.classe.create({ data: { nomeOficial: "Mestre Taekwon" } });
    // D44/D45: a run é de uma versão de instância, com encontro e funções próprios.
    const instancia = await db.instancia.create({ data: { nome: "Instância de teste", ativa: true } });
    const versao = await db.versaoInstancia.create({
      data: {
        instanciaId: instancia.id,
        versao: 1,
        encontros: { create: { nome: "Chefe", multiplicadorCentesimos: 100, ordem: 1 } },
        funcoes: { create: { classeId: classe.id, nome: "Padrão", rank: 5, padrao: true } },
      },
      include: { encontros: true, funcoes: true },
    });
    const config = await db.configPontuacao.create({
      data: {
        versao: 1,
        base: 100,
        alphaCentesimos: 50,
        sConcluidaCentesimos: 100,
        sFalhaCentesimos: 50,
        sAbortadaCentesimos: 0,
        pctEssencialBp: 2000,
        pctImportanteBp: 1000,
        pctComplementarBp: 500,
        tetoCredoresBp: 5000,
        criadaPorId: admin.id,
      },
    });
    const run = await db.run.create({
      data: {
        data: new Date("2026-11-14"),
        versaoInstanciaId: versao.id,
        encontroId: versao.encontros[0]!.id,
        status: "CONCLUIDA",
        configId: config.id,
        registradaPorId: admin.id,
      },
    });
    const part = await db.participacao.create({
      data: {
        runId: run.id,
        personagemId: ana.personagens[0]!.id,
        jogadorId: ana.id,
        funcaoId: versao.funcoes[0]!.id,
        fracaoCentesimos: 100,
        rank: 5,
        base: 100,
        alphaCentesimos: 50,
        pesoCentesimos: 300,
        multiplicadorChefeCentesimos: 100,
        multiplicadorStatusCentesimos: 100,
        pontosGerados: 300,
      },
    });
    return { admin, ana, beto, classe, versao, config, run, part };
  }

  it("CT-68: lançamentos não podem ser alterados nem apagados", async () => {
    const { admin, ana } = await cenario();
    const l = await db.lancamentoPontos.create({
      data: { jogadorId: ana.id, valor: 300, tipo: "PARTICIPACAO", criadoPorId: admin.id },
    });
    await expect(db.lancamentoPontos.update({ where: { id: l.id }, data: { valor: 999 } })).rejects.toThrow(
      /só aceita inclusão/,
    );
    await expect(db.lancamentoPontos.delete({ where: { id: l.id } })).rejects.toThrow(/só aceita inclusão/);
    await expect(db.$executeRawUnsafe("TRUNCATE lancamento_pontos")).rejects.toThrow(/só aceita inclusão/);
    expect((await db.lancamentoPontos.findUniqueOrThrow({ where: { id: l.id } })).valor).toBe(300);
  });

  it("C5: lançamento de valor zero é recusado", async () => {
    const { admin, ana } = await cenario();
    await expect(
      db.lancamentoPontos.create({
        data: { jogadorId: ana.id, valor: 0, tipo: "PARTICIPACAO", criadoPorId: admin.id },
      }),
    ).rejects.toThrow();
  });

  it("saldo = soma dos lançamentos (view saldo_jogador)", async () => {
    const { admin, ana, beto } = await cenario();
    await db.lancamentoPontos.createMany({
      data: [
        { jogadorId: ana.id, valor: 300, tipo: "PARTICIPACAO", criadoPorId: admin.id },
        { jogadorId: ana.id, valor: -60, tipo: "EMPRESTIMO_DEBITO", criadoPorId: admin.id },
        { jogadorId: beto.id, valor: 60, tipo: "EMPRESTIMO_CREDITO", criadoPorId: admin.id },
      ],
    });
    const saldos = await db.$queryRaw<
      { jogador_id: string; saldo: bigint }[]
    >`SELECT jogador_id, saldo FROM saldo_jogador ORDER BY saldo DESC`;
    expect(saldos.map((s) => Number(s.saldo))).toEqual([240, 60]);
  });

  it("versões de parâmetros são imutáveis", async () => {
    const { config } = await cenario();
    await expect(
      db.configPontuacao.update({ where: { id: config.id }, data: { base: 120 } }),
    ).rejects.toThrow(/só aceita inclusão/);
  });

  it("CT-56: rank fora de 1–5 é recusado pelo banco; fronteiras aceitas", async () => {
    const { classe, versao } = await cenario();
    await expect(
      db.funcaoClasse.create({
        data: { versaoInstanciaId: versao.id, classeId: classe.id, nome: "r0", rank: 0 },
      }),
    ).rejects.toThrow();
    await expect(
      db.funcaoClasse.create({
        data: { versaoInstanciaId: versao.id, classeId: classe.id, nome: "r6", rank: 6 },
      }),
    ).rejects.toThrow();
    await db.funcaoClasse.create({
      data: { versaoInstanciaId: versao.id, classeId: classe.id, nome: "r1", rank: 1 },
    });
  });

  it("uma única função padrão por classe", async () => {
    const { classe, versao } = await cenario();
    await expect(
      db.funcaoClasse.create({
        data: { versaoInstanciaId: versao.id, classeId: classe.id, nome: "Outra", rank: 3, padrao: true },
      }),
    ).rejects.toThrow();
  });

  it("CT-52: o mesmo personagem não participa duas vezes da mesma run", async () => {
    const { part } = await cenario();
    const { id: _id, ...dados } = part;
    await expect(db.participacao.create({ data: dados })).rejects.toThrow();
  });

  it("fração só aceita 0, 50 ou 100 (C6)", async () => {
    const { part, run } = await cenario();
    const p2 = await db.personagem.create({ data: { nome: "Ana-Sorc", jogadorId: part.jogadorId } });
    const { id: _id, ...dados } = part;
    await expect(
      db.participacao.create({
        data: { ...dados, runId: run.id, personagemId: p2.id, fracaoCentesimos: 75 },
      }),
    ).rejects.toThrow();
  });

  it("C3: credor igual ao tomador é recusado; tomador precisa bater com a participação", async () => {
    const { ana, beto, part } = await cenario();
    const base = {
      participacaoId: part.id,
      categoria: "ESSENCIAL" as const,
      pctSugeridoBp: 2000,
      pctEfetivo: "20",
      pontos: 60,
      itemDescricao: "Arma",
    };
    await expect(
      db.emprestimo.create({ data: { ...base, tomadorJogadorId: ana.id, credorJogadorId: ana.id } }),
    ).rejects.toThrow();
    // Tomador diferente do jogador da participação viola a FK composta
    await expect(
      db.emprestimo.create({ data: { ...base, tomadorJogadorId: beto.id, credorJogadorId: ana.id } }),
    ).rejects.toThrow();
    await db.emprestimo.create({ data: { ...base, tomadorJogadorId: ana.id, credorJogadorId: beto.id } });
  });

  it("CT-61: quantidade do drop precisa ser positiva", async () => {
    const { run } = await cenario();
    const item = await db.itemCatalogo.create({ data: { nome: "Fragmento" } });
    await expect(
      db.dropRun.create({ data: { runId: run.id, itemId: item.id, quantidade: 0 } }),
    ).rejects.toThrow();
    await expect(
      db.dropRun.create({ data: { runId: run.id, itemId: item.id, quantidade: -1 } }),
    ).rejects.toThrow();
    await db.dropRun.create({ data: { runId: run.id, itemId: item.id, quantidade: 3 } });
  });

  it("negociabilidade dos itens começa desconhecida (nula)", async () => {
    const item = await db.itemCatalogo.create({ data: { nome: "Alma de Betelgeuse" } });
    expect(item.negociavel).toBeNull();
    expect(item.vinculadoConta).toBeNull();
  });
});
