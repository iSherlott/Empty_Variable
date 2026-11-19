// M4: registro de runs, ledger, saldo e correção por estorno (T-13, T-14, T-15, T-17).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PARAMETROS_V1 } from "../src/cadastros/config-pontuacao.service.js";
import { SeedService } from "../src/cadastros/seed.service.js";
import { LedgerService } from "../src/ledger/ledger.service.js";
import { ADMIN_DISCORD_ID, type Contexto, criarApp, ORIGEM } from "./suporte/app-de-teste.js";

type Chefe = "NAGHT_25" | "BETELGEUSE_50" | "BETELGEUSE_75";
type Status = "CONCLUIDA" | "FALHA_CHEFE" | "ABORTADA";

interface Emp {
  credorJogadorId: string;
  categoria: "ESSENCIAL" | "IMPORTANTE" | "COMPLEMENTAR";
  percentualInformadoBp?: number;
  itemId?: string;
  itemDescricao?: string;
}
interface Part {
  personagemId: string;
  funcaoId?: string;
  classeId?: string;
  fracaoCentesimos?: number;
  emprestimos?: Emp[];
}

describe("Runs e ledger (M4)", () => {
  let ctx: Contexto;
  let admin: string;

  /** Personagens: nome → { id, jogadorId }. Funções: "MTK", "Cardeal", "Magus:Dano"... → id. */
  const personagem: Record<string, { id: string; jogadorId: string }> = {};
  const jogador: Record<string, string> = {};
  const funcao: Record<string, string> = {};
  interface Instancia {
    id: string;
    codigo: string | null;
    vigente: {
      encontros: { nome: string; multiplicadorCentesimos: number }[];
      funcoes: { id: string; nome: string; rank: number; padrao: boolean; classe: { id: string } }[];
    };
  }
  const classe: Record<string, string> = {};
  let item: Record<string, string> = {};

  const post = (url: string, corpo: object, cookie = admin) =>
    ctx.http().post(url).set("Cookie", cookie).set("Origin", ORIGEM).send(corpo);
  const get = (url: string, cookie = admin) => ctx.http().get(url).set("Cookie", cookie);

  function run(
    participantes: Part[],
    o: { chefe?: Chefe; status?: Status; drops?: object[]; data?: string } = {},
  ) {
    return {
      data: o.data ?? "2026-11-14",
      chefe: o.chefe ?? "NAGHT_25",
      status: o.status ?? "CONCLUIDA",
      participantes,
      drops: o.drops ?? [],
    };
  }
  /** Participante com a função padrão (ou a indicada) de um personagem. */
  const p = (nome: string, func: string, extra: Partial<Part> = {}): Part => ({
    personagemId: personagem[nome]!.id,
    funcaoId: funcao[func]!,
    ...extra,
  });
  const e = (credor: string, categoria: Emp["categoria"], pct?: number): Emp => ({
    credorJogadorId: jogador[credor]!,
    categoria,
    itemDescricao: "Arma emprestada",
    ...(pct === undefined ? {} : { percentualInformadoBp: pct * 100 }),
  });

  async function saldo(apelido: string): Promise<number> {
    return (await get(`/api/extrato/${jogador[apelido]!}`).expect(200)).body.saldo as number;
  }
  async function valores(apelido: string): Promise<number[]> {
    const ext = (await get(`/api/extrato/${jogador[apelido]!}`).expect(200)).body as {
      lancamentos: { valor: number }[];
    };
    return ext.lancamentos.map((l) => l.valor).sort((a, b) => b - a);
  }
  async function registrar(corpo: object) {
    return (await post("/api/runs", corpo).expect(201)).body as {
      runId: string;
      avisosReducao: { somaPercentuaisBp: number }[];
    };
  }

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await ctx.fechar();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await ctx.limparBanco();
    await ctx.app.get(SeedService).aplicar();
    admin = await ctx.login(ADMIN_DISCORD_ID, "admin");

    const cadastro: Record<string, string[]> = {
      Ana: ["Ana-MTK", "Ana-Cardeal"],
      Beto: ["Beto-GX"],
      Caio: ["Caio-MTK", "Caio-Magus"],
      Gus: ["Gus-RG"],
      Duda: ["Duda-Asceta", "Duda-Outra"],
      X: ["X-Sorc"],
      Y: ["Y-Eng"],
      Z: ["Z-Cien"],
    };
    for (const [apelido, nomes] of Object.entries(cadastro)) {
      const j = await ctx.prisma.jogador.create({
        data: { apelido, personagens: { create: nomes.map((nome) => ({ nome })) } },
        include: { personagens: true },
      });
      jogador[apelido] = j.id;
      for (const pp of j.personagens) personagem[pp.nome] = { id: pp.id, jogadorId: j.id };
    }
    const classes = await ctx.prisma.classe.findMany({ include: { funcoes: true } });
    for (const c of classes) {
      classe[c.apelidoGrupo!] = c.id;
      for (const f of c.funcoes) {
        funcao[c.funcoes.length === 1 ? c.apelidoGrupo! : `${c.apelidoGrupo!}:${f.nome}`] = f.id;
      }
    }
    item = Object.fromEntries((await ctx.prisma.itemCatalogo.findMany()).map((i) => [i.nome, i.id]));
  });

  describe("registro e lançamentos imediatos", () => {
    it("CT-63 / CT-29: GX 200 com empréstimos de X (E) e Y (C) → GX 150, X 40, Y 10", async () => {
      await registrar(
        run([p("Beto-GX", "GX", { emprestimos: [e("X", "ESSENCIAL"), e("Y", "COMPLEMENTAR")] })]),
      );
      expect(await valores("Beto")).toEqual([200, -10, -40]);
      expect(await saldo("Beto")).toBe(150);
      expect(await saldo("X")).toBe(40);
      expect(await saldo("Y")).toBe(10);
    });

    it("CT-53: multi-client — MTK (300) e Cardeal (200) do mesmo jogador somam 500", async () => {
      await registrar(run([p("Ana-MTK", "MTK"), p("Ana-Cardeal", "Cardeal")]));
      expect(await valores("Ana")).toEqual([300, 200]);
      expect(await saldo("Ana")).toBe(500);
    });

    it("CT-54: dois MTKs recebem peso cheio (300 cada)", async () => {
      await registrar(run([p("Ana-MTK", "MTK"), p("Caio-MTK", "MTK")]));
      expect([await saldo("Ana"), await saldo("Caio")]).toEqual([300, 300]);
    });

    it("CT-55 / C10: classe 'Outra' pela função padrão → rank 1, 100 pontos", async () => {
      const r = await registrar(
        run([{ personagemId: personagem["Duda-Outra"]!.id, classeId: classe["Demais classes"]! }]),
      );
      const det = (await get(`/api/runs/${r.runId}`).expect(200)).body;
      expect(det.participacoes[0]).toMatchObject({ rank: 1, pontosGerados: 100 });
    });

    it("CT-57 / D16: Magus sem função escolhida é recusado; Magus Suporte recebe 200", async () => {
      const semFuncao = await post(
        "/api/runs",
        run([{ personagemId: personagem["Caio-Magus"]!.id, classeId: classe["Magus"]! }]),
      ).expect(400);
      expect(semFuncao.body.message).toContain("não tem função padrão");
      await registrar(run([p("Caio-Magus", "Magus:Suporte com Cometa")]));
      expect(await saldo("Caio")).toBe(200);
    });

    it("CT-62 / D6: Asceta sem MTK na run recebe 200", async () => {
      await registrar(run([p("Duda-Asceta", "Asceta")]));
      expect(await saldo("Duda")).toBe(200);
    });

    it("CT-28: composição 2 com Sorcerer parcial → total 925", async () => {
      const r = await registrar(
        run([
          p("Ana-MTK", "MTK"),
          p("Beto-GX", "GX"),
          p("Ana-Cardeal", "Cardeal"),
          p("Duda-Outra", "Demais classes"),
          p("X-Sorc", "Sorcerer", { fracaoCentesimos: 50 }),
        ]),
      );
      const lista = (await get("/api/runs").expect(200)).body as { id: string; pontosTotais: number }[];
      expect(lista.find((x) => x.id === r.runId)?.pontosTotais).toBe(925);
      expect(await saldo("X")).toBe(125);
    });

    it("CT-43: credor que também participou recebe a parcela além dos próprios pontos", async () => {
      await registrar(
        run([p("Ana-MTK", "MTK"), p("Gus-RG", "RG", { emprestimos: [e("Ana", "ESSENCIAL")] })]),
      );
      expect(await saldo("Ana")).toBe(330);
      expect(await saldo("Gus")).toBe(120);
    });

    it("C5 / CT-47: run abortada grava participação e empréstimo, mas nenhum lançamento", async () => {
      const r = await registrar(
        run([p("Beto-GX", "GX", { emprestimos: [e("X", "ESSENCIAL")] })], { status: "ABORTADA" }),
      );
      const det = (await get(`/api/runs/${r.runId}`).expect(200)).body;
      expect(det.participacoes[0].pontosGerados).toBe(0);
      expect(det.participacoes[0].emprestimos[0].pontos).toBe(0);
      expect(det.lancamentos).toEqual([]);
      expect(await saldo("Beto")).toBe(0);
    });

    it("CT-61: drops do catálogo com quantidade positiva são gravados e não alteram pontos", async () => {
      const r = await registrar(
        run([p("Ana-MTK", "MTK")], { drops: [{ itemId: item["Alma de Betelgeuse"], quantidade: 2 }] }),
      );
      const det = (await get(`/api/runs/${r.runId}`).expect(200)).body;
      expect(det.drops).toEqual([
        expect.objectContaining({
          quantidade: 2,
          item: expect.objectContaining({ nome: "Alma de Betelgeuse" }),
        }),
      ]);
      expect(await saldo("Ana")).toBe(300);
      for (const quantidade of [0, -1, 1.5]) {
        await post(
          "/api/runs",
          run([p("Ana-MTK", "MTK")], { drops: [{ itemId: item["Alma de Betelgeuse"], quantidade }] }),
        ).expect(400);
      }
      await post(
        "/api/runs",
        run([p("Ana-MTK", "MTK")], { drops: [{ itemId: crypto.randomUUID(), quantidade: 1 }] }),
      ).expect(400);
    });
  });

  describe("empréstimos (US-05)", () => {
    it("CT-64 / CT-31: histórico mostra P original e cada parcela (X 25% → 75, Y 10% → 30, tomador 195)", async () => {
      await registrar(
        run([p("Ana-MTK", "MTK", { emprestimos: [e("X", "ESSENCIAL", 25), e("Y", "IMPORTANTE")] })]),
      );
      const ext = (await get(`/api/extrato/${jogador["Ana"]!}`).expect(200)).body;
      expect(ext.saldo).toBe(195);
      const debitos = (
        ext.lancamentos as {
          tipo: string;
          valor: number;
          emprestimo: { credor: { apelido: string }; pctInformadoBp: number | null; pctSugeridoBp: number };
        }[]
      )
        .filter((l) => l.tipo === "EMPRESTIMO_DEBITO")
        .map((l) => [
          l.emprestimo.credor.apelido,
          l.emprestimo.pctSugeridoBp,
          l.emprestimo.pctInformadoBp,
          l.valor,
        ])
        .sort();
      expect(debitos).toEqual([
        ["X", 2000, 2500, -75],
        ["Y", 1000, null, -30],
      ]);
      const participacao = (
        ext.lancamentos as {
          tipo: string;
          valor: number;
          participacao: { rank: number; pesoCentesimos: number };
        }[]
      ).find((l) => l.tipo === "PARTICIPACAO")!;
      expect(participacao).toMatchObject({ valor: 300, participacao: { rank: 5, pesoCentesimos: 300 } });
    });

    it("CT-73 / CT-35: sugestões acima do teto são reduzidas, com aviso; % efetivo gravado reduzido", async () => {
      const r = await registrar(
        run(
          [
            p("Ana-MTK", "MTK", {
              emprestimos: [e("X", "ESSENCIAL"), e("Y", "ESSENCIAL"), e("Z", "ESSENCIAL")],
            }),
          ],
          {
            chefe: "BETELGEUSE_75",
          },
        ),
      );
      expect(r.avisosReducao).toEqual([
        expect.objectContaining({ somaPercentuaisBp: 6000, tetoCredoresBp: 5000 }),
      ]);
      const det = (await get(`/api/runs/${r.runId}`).expect(200)).body;
      const emps = det.participacoes[0].emprestimos as { pontos: number; pctEfetivo: string }[];
      expect(emps.map((x) => x.pontos)).toEqual([100, 100, 100]);
      expect(emps.every((x) => x.pctEfetivo === "16.666667")).toBe(true);
      expect(await saldo("Ana")).toBe(300);
    });

    it("CT-75 / D15: override com total acima de 50% é rejeitado (422) e nada é gravado", async () => {
      const r = await post(
        "/api/runs",
        run([p("Ana-MTK", "MTK", { emprestimos: [e("X", "ESSENCIAL", 35), e("Y", "ESSENCIAL")] })]),
      ).expect(422);
      expect(r.body.codigo).toBe("TETO_EXCEDIDO_COM_OVERRIDE");
      expect(await ctx.prisma.run.count()).toBe(0);
      expect(await ctx.prisma.lancamentoPontos.count()).toBe(0);
    });

    it("CT-74: override de 30% + sugestão de 20% = 50% é aceito (X 90, Y 60, tomador 150)", async () => {
      await registrar(
        run([p("Ana-MTK", "MTK", { emprestimos: [e("X", "ESSENCIAL", 30), e("Y", "ESSENCIAL")] })]),
      );
      expect([await saldo("Ana"), await saldo("X"), await saldo("Y")]).toEqual([150, 90, 60]);
    });

    it("C3: o jogador não empresta para si mesmo, nem entre os próprios personagens (422)", async () => {
      const r = await post(
        "/api/runs",
        run([p("Ana-MTK", "MTK", { emprestimos: [e("Ana", "ESSENCIAL")] })]),
      ).expect(422);
      expect(r.body.codigo).toBe("CREDOR_IGUAL_TOMADOR");
    });

    it("C4: credor precisa ser jogador cadastrado; item do empréstimo precisa estar no catálogo", async () => {
      await post(
        "/api/runs",
        run([
          p("Ana-MTK", "MTK", {
            emprestimos: [
              { credorJogadorId: crypto.randomUUID(), categoria: "ESSENCIAL", itemDescricao: "x1" },
            ],
          }),
        ]),
      ).expect(400);
      await post(
        "/api/runs",
        run([
          p("Ana-MTK", "MTK", {
            emprestimos: [
              { credorJogadorId: jogador["X"]!, categoria: "ESSENCIAL", itemId: crypto.randomUUID() },
            ],
          }),
        ]),
      ).expect(400);
      await post(
        "/api/runs",
        run([
          p("Ana-MTK", "MTK", { emprestimos: [{ credorJogadorId: jogador["X"]!, categoria: "ESSENCIAL" }] }),
        ]),
      ).expect(400);
      expect(await ctx.prisma.run.count()).toBe(0);
    });
  });

  describe("validações e atomicidade", () => {
    it("CT-52: mesmo personagem duas vezes na run é rejeitado; nada é gravado", async () => {
      await post("/api/runs", run([p("Ana-MTK", "MTK"), p("Ana-MTK", "Cardeal")])).expect(400);
      expect(await ctx.prisma.run.count()).toBe(0);
    });

    it("C6: fração diferente de 1 / 0,5 / 0 é rejeitada; status ESTORNADA não pode ser registrado", async () => {
      await post("/api/runs", run([p("Ana-MTK", "MTK", { fracaoCentesimos: 75 })])).expect(400);
      await post("/api/runs", { ...run([p("Ana-MTK", "MTK")]), status: "ESTORNADA" }).expect(400);
      await post("/api/runs", { ...run([p("Ana-MTK", "MTK")]), data: "2026-02-30" }).expect(400);
      await post("/api/runs", run([])).expect(400);
    });

    it("personagem inativo não entra em run", async () => {
      await ctx.prisma.personagem.update({
        where: { id: personagem["Ana-MTK"]!.id },
        data: { ativo: false },
      });
      await post("/api/runs", run([p("Ana-MTK", "MTK")])).expect(400);
    });

    it("CT-72: falha no meio do registro (3º lançamento) não deixa nada gravado", async () => {
      const ledger = ctx.app.get(LedgerService);
      const original = ledger.lancar.bind(ledger);
      let chamadas = 0;
      vi.spyOn(ledger, "lancar").mockImplementation(async (tx, l) => {
        chamadas += 1;
        if (chamadas === 3) throw new Error("falha simulada");
        return original(tx, l);
      });
      await post(
        "/api/runs",
        run([p("Beto-GX", "GX", { emprestimos: [e("X", "ESSENCIAL")] }), p("Ana-MTK", "MTK")]),
      ).expect(500);
      vi.restoreAllMocks();
      expect(await ctx.prisma.run.count()).toBe(0);
      expect(await ctx.prisma.participacao.count()).toBe(0);
      expect(await ctx.prisma.emprestimo.count()).toBe(0);
      expect(await ctx.prisma.lancamentoPontos.count()).toBe(0);
    });
  });

  describe("snapshot e versões (A1, US-02)", () => {
    it("CT-58: mudar o rank do GX depois não altera R1; R2 já usa o rank novo", async () => {
      const r1 = await registrar(run([p("Beto-GX", "GX")]));
      // D46: mudar o rank é uma versão nova da Torre; as funções da versão nova têm IDs novos.
      const torre = ((await get("/api/instancias").expect(200)).body as Instancia[]).find(
        (i) => i.codigo === "TORRE_CONSTELACAO",
      )!;
      await post(`/api/instancias/${torre.id}/versoes`, {
        encontros: torre.vigente.encontros.map((e) => ({
          nome: e.nome,
          multiplicadorCentesimos: e.multiplicadorCentesimos,
        })),
        funcoes: torre.vigente.funcoes.map((f) => ({
          classeId: f.classe.id,
          nome: f.nome,
          rank: f.id === funcao["GX"] ? 4 : f.rank,
          padrao: f.padrao,
        })),
      }).expect(201);
      // A função antiga não vale mais (CT-145); a run nova usa a função vigente do GX.
      await post("/api/runs", run([p("Beto-GX", "GX")])).expect(422);
      const gx = (
        (await get("/api/classes").expect(200)).body as { apelidoGrupo: string; funcoes: { id: string }[] }[]
      ).find((c) => c.apelidoGrupo === "GX")!;
      await registrar(run([{ ...p("Beto-GX", "GX"), funcaoId: gx.funcoes[0]!.id }]));
      const det = (await get(`/api/runs/${r1.runId}`).expect(200)).body;
      expect(det.participacoes[0]).toMatchObject({ rank: 3, pontosGerados: 200 });
      expect(await valores("Beto")).toEqual([250, 200]);
    });

    it("CT-59: R1 com B=100 fica 300; depois de B=120, R2 gera 360", async () => {
      const r1 = await registrar(run([p("Ana-MTK", "MTK")]));
      await post("/api/config-pontuacao", { ...PARAMETROS_V1, base: 120 }).expect(201);
      const r2 = await registrar(run([p("Ana-MTK", "MTK")]));
      const d1 = (await get(`/api/runs/${r1.runId}`).expect(200)).body;
      const d2 = (await get(`/api/runs/${r2.runId}`).expect(200)).body;
      expect([d1.config.versao, d1.participacoes[0].base, d1.participacoes[0].pontosGerados]).toEqual([
        1, 100, 300,
      ]);
      expect([d2.config.versao, d2.participacoes[0].base, d2.participacoes[0].pontosGerados]).toEqual([
        2, 120, 360,
      ]);
      expect(await saldo("Ana")).toBe(660);
    });
  });

  describe("correção por estorno (US-07)", () => {
    it("CT-65: MTK lançado como 300 era Cardeal 200 → +300, −300, +200; saldo 200; nada apagado", async () => {
      const r1 = await registrar(run([p("Ana-MTK", "MTK")]));
      const r2 = (
        await post(`/api/runs/${r1.runId}/corrigir`, {
          motivo: "Era o Cardeal",
          run: run([p("Ana-Cardeal", "Cardeal")]),
        }).expect(201)
      ).body as { runId: string };
      expect(await valores("Ana")).toEqual([300, 200, -300]);
      expect(await saldo("Ana")).toBe(200);
      const d1 = (await get(`/api/runs/${r1.runId}`).expect(200)).body;
      const d2 = (await get(`/api/runs/${r2.runId}`).expect(200)).body;
      expect(d1.status).toBe("ESTORNADA");
      expect(d1.corrigidaPorRunId).toBe(r2.runId);
      expect(d2.corrigeRunId).toBe(r1.runId);
      const estorno = (d1.lancamentos as { tipo: string; estornaLancamentoId: string | null }[]).find(
        (l) => l.tipo === "ESTORNO",
      );
      expect(estorno?.estornaLancamentoId).toBeTruthy();
    });

    it("CT-66: correção da run com empréstimos para 'sem empréstimo' → X 0, Y 0, GX 200", async () => {
      const r1 = await registrar(
        run([p("Beto-GX", "GX", { emprestimos: [e("X", "ESSENCIAL"), e("Y", "COMPLEMENTAR")] })]),
      );
      await post(`/api/runs/${r1.runId}/corrigir`, {
        motivo: "Sem empréstimo",
        run: run([p("Beto-GX", "GX")]),
      }).expect(201);
      expect([await saldo("X"), await saldo("Y"), await saldo("Beto")]).toEqual([0, 0, 200]);
    });

    it("D17: a correção usa a versão de parâmetros da run original, não a vigente", async () => {
      const r1 = await registrar(run([p("Ana-MTK", "MTK")]));
      await post("/api/config-pontuacao", { ...PARAMETROS_V1, base: 120 }).expect(201);
      const r2 = (
        await post(`/api/runs/${r1.runId}/corrigir`, {
          motivo: "Ajuste de data",
          run: run([p("Ana-MTK", "MTK")], { data: "2026-11-13" }),
        }).expect(201)
      ).body;
      const d2 = (await get(`/api/runs/${r2.runId}`).expect(200)).body;
      expect([d2.config.versao, d2.participacoes[0].pontosGerados]).toEqual([1, 300]);
      expect(await saldo("Ana")).toBe(300);
    });

    it("C8: run abortada pode ser reclassificada como falha no chefe pela correção", async () => {
      const r1 = await registrar(run([p("Ana-MTK", "MTK")], { status: "ABORTADA" }));
      await post(`/api/runs/${r1.runId}/corrigir`, {
        motivo: "Chegamos no chefe",
        run: run([p("Ana-MTK", "MTK")], { status: "FALHA_CHEFE" }),
      }).expect(201);
      expect(await saldo("Ana")).toBe(150);
    });

    it("uma run já corrigida não pode ser corrigida de novo; a correção dela pode", async () => {
      const r1 = await registrar(run([p("Ana-MTK", "MTK")]));
      const r2 = (
        await post(`/api/runs/${r1.runId}/corrigir`, {
          motivo: "Primeira",
          run: run([p("Ana-Cardeal", "Cardeal")]),
        }).expect(201)
      ).body;
      await post(`/api/runs/${r1.runId}/corrigir`, {
        motivo: "Segunda",
        run: run([p("Ana-MTK", "MTK")]),
      }).expect(409);
      await post(`/api/runs/${r2.runId}/corrigir`, {
        motivo: "Segunda",
        run: run([p("Ana-MTK", "MTK")]),
      }).expect(201);
      expect(await saldo("Ana")).toBe(300);
    });

    it("correção inválida (D15) não estorna nada", async () => {
      const r1 = await registrar(run([p("Ana-MTK", "MTK")]));
      await post(`/api/runs/${r1.runId}/corrigir`, {
        motivo: "Teste",
        run: run([p("Ana-MTK", "MTK", { emprestimos: [e("X", "ESSENCIAL", 60)] })]),
      }).expect(422);
      expect(await saldo("Ana")).toBe(300);
      expect((await get(`/api/runs/${r1.runId}`).expect(200)).body.status).toBe("CONCLUIDA");
    });
  });

  describe("acesso (D11, D14)", () => {
    let membroAna: string;
    beforeEach(async () => {
      membroAna = await ctx.login("4001", "ana");
      const u = await ctx.prisma.usuario.findUniqueOrThrow({ where: { discordId: "4001" } });
      await ctx.prisma.jogador.update({ where: { id: jogador["Ana"]! }, data: { usuarioId: u.id } });
    });

    it("CT-71 / CT-67: membro consulta o próprio saldo e histórico com a origem detalhada", async () => {
      await registrar(run([p("Ana-MTK", "MTK", { emprestimos: [e("X", "ESSENCIAL")] })]));
      const ext = (await get("/api/extrato/me", membroAna).expect(200)).body;
      expect(ext.jogador.apelido).toBe("Ana");
      expect(ext.saldo).toBe(240);
      expect(ext.lancamentos.reduce((a: number, l: { valor: number }) => a + l.valor, 0)).toBe(240);
      const part = ext.lancamentos.find((l: { tipo: string }) => l.tipo === "PARTICIPACAO");
      expect(part.participacao).toMatchObject({
        rank: 5,
        fracaoCentesimos: 100,
        funcao: { classe: { apelidoGrupo: "MTK" } },
      });
      expect(part.run).toMatchObject({
        encontro: { codigo: "NAGHT_25" },
        versaoInstancia: { instancia: { nome: "Torre da Constelação" } },
        status: "CONCLUIDA",
      });
      await get(`/api/extrato/${jogador["Ana"]!}`, membroAna).expect(200);
    });

    it("CT-80: membro consultando outro jogador recebe 403", async () => {
      await get(`/api/extrato/${jogador["Beto"]!}`, membroAna).expect(403);
      await get("/api/saldos", membroAna).expect(403);
    });

    it("membro sem vínculo aprovado não tem extrato (403)", async () => {
      const semVinculo = await ctx.login("4002", "novo");
      await get("/api/extrato/me", semVinculo).expect(403);
    });

    it("CT-69 / CT-70 / CT-E4: membro não registra, não corrige nem lista runs (403)", async () => {
      await post("/api/runs", run([p("Ana-MTK", "MTK")]), membroAna).expect(403);
      const r1 = await registrar(run([p("Ana-MTK", "MTK")]));
      await post(
        `/api/runs/${r1.runId}/corrigir`,
        { motivo: "Hack", run: run([p("Ana-MTK", "MTK")]) },
        membroAna,
      ).expect(403);
      await get("/api/runs", membroAna).expect(403);
      expect(await ctx.prisma.run.count()).toBe(1);
    });

    it("admin vê o saldo de todos", async () => {
      await registrar(run([p("Ana-MTK", "MTK"), p("Beto-GX", "GX")]));
      const s = (await get("/api/saldos").expect(200)).body as { apelido: string; saldo: number }[];
      expect(s.slice(0, 2)).toEqual([
        expect.objectContaining({ apelido: "Ana", saldo: 300 }),
        expect.objectContaining({ apelido: "Beto", saldo: 200 }),
      ]);
    });
  });

  it("lista runs com filtros de instância, status e período", async () => {
    await registrar(run([p("Ana-MTK", "MTK")], { chefe: "NAGHT_25", data: "2026-11-01" }));
    await registrar(
      run([p("Ana-MTK", "MTK")], { chefe: "BETELGEUSE_50", status: "FALHA_CHEFE", data: "2026-11-10" }),
    );
    const todos = (await get("/api/runs").expect(200)).body as {
      encontro: { codigo: string };
      versaoInstancia: { instancia: { id: string } };
    }[];
    expect(todos.map((r) => r.encontro.codigo)).toEqual(["BETELGEUSE_50", "NAGHT_25"]);
    const torreId = todos[0]!.versaoInstancia.instancia.id;
    expect((await get(`/api/runs?instanciaId=${torreId}`).expect(200)).body).toHaveLength(2);
    expect(
      (await get("/api/runs?instanciaId=00000000-0000-4000-8000-000000000000").expect(200)).body,
    ).toHaveLength(0);
    expect((await get("/api/runs?status=FALHA_CHEFE").expect(200)).body).toHaveLength(1);
    expect((await get("/api/runs?dataDe=2026-11-05&dataAte=2026-11-30").expect(200)).body).toHaveLength(1);
    await get("/api/runs?instanciaId=bafome").expect(400);
  });
});
