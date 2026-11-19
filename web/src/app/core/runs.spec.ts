import { CONFIG_V1 } from "@betel/scoring";
import type { Classe } from "./cadastros";
import type { Instancia } from "./instancias";
import {
  ajustarAVersaoVigente,
  calcularPrevia,
  type Catalogos,
  type DetalheRun,
  descreverLancamento,
  type LancamentoExtrato,
  montarCorpo,
  novoEmprestimo,
  novoRascunho,
  pendencias,
  type RascunhoRun,
  rascunhoDeRun,
} from "./runs";

const classes: Classe[] = [
  {
    id: "c-mtk",
    nomeOficial: "Mestre Celestial",
    apelidoGrupo: "MTK",
    ativa: true,
    funcoes: [{ id: "f-mtk", nome: "Padrão", rank: 5, padrao: true }],
  },
  {
    id: "c-gx",
    nomeOficial: "Executor",
    apelidoGrupo: "GX",
    ativa: true,
    funcoes: [{ id: "f-gx", nome: "Garra Sombria", rank: 3, padrao: true }],
  },
  {
    id: "c-magus",
    nomeOficial: "Magus",
    apelidoGrupo: "Magus",
    ativa: true,
    funcoes: [
      { id: "f-dano", nome: "Dano", rank: 5, padrao: false },
      { id: "f-sup", nome: "Suporte com Cometa", rank: 3, padrao: false },
    ],
  },
];

/** A Torre, com dois dos encontros (os multiplicadores vêm da instância, D44). */
const torre: Instancia = {
  id: "i-torre",
  nome: "Torre da Constelação",
  codigo: "TORRE_CONSTELACAO",
  ativa: true,
  nivelMinimo: 240,
  retorno: "TRES_DIAS",
  modo: "GRUPO",
  dificuldade: "DIFICIL",
  requisito: null,
  premiacao: null,
  vigente: {
    id: "v2",
    versao: 2,
    vigenteDesde: "",
    criadaPor: null,
    encontros: [
      { id: "e-naght", nome: "Naght Sieger 25", codigo: "NAGHT_25", multiplicadorCentesimos: 100 },
      { id: "e-b50", nome: "Betelgeuse 50", codigo: "BETELGEUSE_50", multiplicadorCentesimos: 150 },
    ],
    funcoes: [],
  },
};

const cat: Catalogos = {
  jogadores: [
    {
      id: "j-ana",
      apelido: "Ana",
      personagens: [
        { id: "p-ana", nome: "Ana-MTK", ativo: true },
        { id: "p-ana2", nome: "Ana-Magus", ativo: true },
      ],
    },
    { id: "j-beto", apelido: "Beto", personagens: [{ id: "p-beto", nome: "Beto-GX", ativo: true }] },
    { id: "j-x", apelido: "X", personagens: [] },
    { id: "j-y", apelido: "Y", personagens: [] },
  ],
  classes,
  instancias: [torre],
  itens: [],
};

function rascunho(parcial: Partial<RascunhoRun> = {}): RascunhoRun {
  return { ...novoRascunho("i-torre", "e-naght"), data: "2026-11-14", participantes: [], ...parcial };
}

describe("Rascunho de run", () => {
  it("prévia de CT-29: GX 200 com X (E) e Y (C) → GX fica 150, X 40, Y 10", () => {
    const r = rascunho({
      participantes: [
        {
          personagemId: "p-beto",
          classeId: "c-gx",
          funcaoId: "f-gx",
          fracaoCentesimos: 100,
          emprestimos: [
            { ...novoEmprestimo(), credorJogadorId: "j-x", categoria: "ESSENCIAL", itemDescricao: "Arma" },
            {
              ...novoEmprestimo(),
              credorJogadorId: "j-y",
              categoria: "COMPLEMENTAR",
              itemDescricao: "Acessório",
            },
          ],
        },
      ],
    });
    const pv = calcularPrevia(r, CONFIG_V1, cat);
    expect(pv.erros).toEqual([]);
    expect(pv.linhas[0]).toEqual(jasmine.objectContaining({ pontos: 200, pontosTomador: 150 }));
    expect(pv.porJogador).toEqual([
      { jogador: "Beto", pontos: 150 },
      { jogador: "X", pontos: 40 },
      { jogador: "Y", pontos: 10 },
    ]);
  });

  it("prévia acusa D15 (override com total acima do teto) antes de enviar", () => {
    const r = rascunho({
      participantes: [
        {
          personagemId: "p-ana",
          classeId: "c-mtk",
          funcaoId: "f-mtk",
          fracaoCentesimos: 100,
          emprestimos: [
            {
              ...novoEmprestimo(),
              credorJogadorId: "j-x",
              categoria: "ESSENCIAL",
              percentualInformado: 35,
              itemDescricao: "a1",
            },
            { ...novoEmprestimo(), credorJogadorId: "j-y", categoria: "ESSENCIAL", itemDescricao: "a2" },
          ],
        },
      ],
    });
    const pv = calcularPrevia(r, CONFIG_V1, cat);
    expect(pv.erros.length).toBe(1);
    expect(pv.erros[0]).toContain("acima do teto");
  });

  it("pendências: personagem repetido (CT-52), Magus sem função (D16), drop com quantidade 0 (CT-61)", () => {
    const r = rascunho({
      participantes: [
        {
          personagemId: "p-ana",
          classeId: "c-mtk",
          funcaoId: "f-mtk",
          fracaoCentesimos: 100,
          emprestimos: [],
        },
        {
          personagemId: "p-ana",
          classeId: "c-mtk",
          funcaoId: "f-mtk",
          fracaoCentesimos: 100,
          emprestimos: [],
        },
        {
          personagemId: "p-ana2",
          classeId: "c-magus",
          funcaoId: null,
          fracaoCentesimos: 100,
          emprestimos: [],
        },
      ],
      drops: [{ itemId: "i1", quantidade: 0 }],
    });
    const p = pendencias(r, cat);
    expect(p[2].join(" ")).toContain("já está na run");
    expect(p[2].join(" ")).toContain("não tem função padrão");
    expect(p[4].join(" ")).toContain("quantidade inteira");
  });

  it("monta o corpo da API: % informado em pontos-base e item descrito", () => {
    const r = rascunho({
      pontuacaoBetelgeuse: 120,
      participantes: [
        {
          personagemId: "p-ana",
          classeId: "c-mtk",
          funcaoId: null,
          fracaoCentesimos: 50,
          emprestimos: [
            {
              ...novoEmprestimo(),
              credorJogadorId: "j-x",
              categoria: "ESSENCIAL",
              percentualInformado: 25.5,
              itemDescricao: " Arma ",
            },
          ],
        },
      ],
      drops: [{ itemId: "i1", quantidade: 3 }],
    });
    expect(montarCorpo(r, cat)).toEqual({
      data: "2026-11-14",
      instanciaId: "i-torre",
      encontroId: "e-naght",
      status: "CONCLUIDA",
      pontuacaoBetelgeuse: 120,
      participantes: [
        {
          personagemId: "p-ana",
          funcaoId: "f-mtk",
          fracaoCentesimos: 50,
          emprestimos: [
            {
              credorJogadorId: "j-x",
              categoria: "ESSENCIAL",
              itemDescricao: "Arma",
              percentualInformadoBp: 2550,
            },
          ],
        },
      ],
      drops: [{ itemId: "i1", quantidade: 3 }],
    });
  });

  it("correção (US-07): o rascunho reproduz a run registrada", () => {
    const d = {
      id: "r1",
      data: "2026-11-10T00:00:00.000Z",
      encontro: {
        id: "e-b50-v1",
        nome: "Betelgeuse 50",
        codigo: "BETELGEUSE_50",
        multiplicadorCentesimos: 150,
      },
      versaoInstancia: { id: "v1", versao: 1, instancia: { id: "i-torre", nome: "Torre da Constelação" } },
      status: "FALHA_CHEFE",
      pontuacaoBetelgeuse: null,
      observacao: null,
      participacoes: [
        {
          personagem: { id: "p-beto", nome: "Beto-GX" },
          funcao: {
            id: "f-gx",
            nome: "Garra Sombria",
            classe: { id: "c-gx", nomeOficial: "Executor", apelidoGrupo: "GX" },
          },
          fracaoCentesimos: 50,
          emprestimos: [
            {
              credor: { id: "j-x", apelido: "X" },
              item: null,
              itemDescricao: "Arma",
              categoria: "ESSENCIAL",
              pctInformadoBp: 2500,
            },
          ],
        },
      ],
      drops: [{ id: "d1", quantidade: 2, item: { id: "i1", nome: "Alma" } }],
    } as unknown as DetalheRun;
    const r = rascunhoDeRun(d);
    expect(r.data).toBe("2026-11-10");
    expect(r.participantes[0]).toEqual({
      personagemId: "p-beto",
      classeId: "c-gx",
      funcaoId: "f-gx",
      fracaoCentesimos: 50,
      emprestimos: [
        {
          credorJogadorId: "j-x",
          itemId: null,
          itemDescricao: "Arma",
          categoria: "ESSENCIAL",
          percentualInformado: 25,
        },
      ],
    });
    expect(r.drops).toEqual([{ itemId: "i1", quantidade: 2 }]);
  });

  it("descreve a origem dos lançamentos do extrato (US-06)", () => {
    const participacao = {
      personagem: { nome: "Beto-GX" },
      jogador: { id: "j-beto", apelido: "Beto" },
      funcao: { nome: "Garra Sombria", classe: { nomeOficial: "Executor", apelidoGrupo: "GX" } },
      rank: 3,
      pesoCentesimos: 200,
      multiplicadorChefeCentesimos: 100,
      multiplicadorStatusCentesimos: 100,
      fracaoCentesimos: 100,
      pontosGerados: 200,
    };
    const emprestimo = {
      categoria: "ESSENCIAL" as const,
      pctSugeridoBp: 2000,
      pctInformadoBp: null,
      pctEfetivo: "20.000000",
      pontos: 40,
      itemDescricao: "Arma",
      item: null,
      credor: { id: "j-x", apelido: "X" },
    };
    const base = { id: "l", criadoEm: "", observacao: null, estornaLancamentoId: null, run: null };
    const part = {
      ...base,
      valor: 200,
      tipo: "PARTICIPACAO",
      participacao,
      emprestimo: null,
    } as LancamentoExtrato;
    const deb = {
      ...base,
      valor: -40,
      tipo: "EMPRESTIMO_DEBITO",
      participacao,
      emprestimo,
    } as LancamentoExtrato;
    const cred = {
      ...base,
      valor: 40,
      tipo: "EMPRESTIMO_CREDITO",
      participacao,
      emprestimo,
    } as LancamentoExtrato;
    expect(descreverLancamento(part)).toContain("rank 3, peso 2 × encontro 1 × status 1 × fração 1");
    expect(descreverLancamento(deb)).toBe("Parcela para X pelo empréstimo de Arma (Essencial, 20%)");
    expect(descreverLancamento(cred)).toContain("para Beto (Beto-GX)");
  });

  it("instância e encontro (D44): sem encontro é pendência; o multiplicador vem do encontro", () => {
    const sem = rascunho({ encontroId: null });
    expect(pendencias(sem, cat)[1]).toContain("Escolha o encontro.");
    expect(pendencias(rascunho({ instanciaId: null }), cat)[1]).toContain("Escolha a instância.");
    const p = {
      personagemId: "p-ana",
      classeId: "c-mtk",
      funcaoId: "f-mtk",
      fracaoCentesimos: 100 as const,
      emprestimos: [],
    };
    // MTK rank 5: 300 no Naght (×1); 450 no Betelgeuse 50 (×1,5)
    expect(calcularPrevia(rascunho({ participantes: [p] }), CONFIG_V1, cat).total).toBe(300);
    expect(calcularPrevia(rascunho({ participantes: [p], encontroId: "e-b50" }), CONFIG_V1, cat).total).toBe(
      450,
    );
    expect(calcularPrevia(sem, CONFIG_V1, cat).linhas).toEqual([]);
  });

  it("correção (D46): encontro e funções da versão antiga passam para os da vigente, pelo nome", () => {
    const antigo = rascunho({
      encontroId: "e-b50-v1",
      participantes: [
        {
          personagemId: "p-beto",
          classeId: "c-gx",
          funcaoId: "f-gx-v1",
          fracaoCentesimos: 100,
          emprestimos: [],
        },
        {
          personagemId: "p-ana2",
          classeId: "c-magus",
          funcaoId: "f-sumiu",
          fracaoCentesimos: 100,
          emprestimos: [],
        },
      ],
    });
    const r = ajustarAVersaoVigente(antigo, cat, {
      encontro: "Betelgeuse 50",
      funcoes: new Map([
        ["f-gx-v1", "Garra Sombria"],
        ["f-sumiu", "Função que não existe mais"],
      ]),
    });
    expect(r.encontroId).toBe("e-b50");
    expect(r.participantes[0]!.funcaoId).toBe("f-gx");
    // Sem igual pelo nome e sem padrão (Magus, D16): fica para escolher de novo
    expect(r.participantes[1]!.funcaoId).toBeNull();
    expect(pendencias(r, cat)[2]).toEqual([
      "Participante 2: esta classe não tem função padrão; escolha a função.",
    ]);
  });
});
