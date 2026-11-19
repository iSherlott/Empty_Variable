// Seeds aprovados (M3). Fontes: docs/analise/etapa1-pesos.md §2.1, §2.3 e Anexo A; docs/DECISOES.md.
// Não inventar valores aqui: tudo o que não foi confirmado fica nulo ou de fora, para o admin completar.

export interface FuncaoSeed {
  nome: string;
  rank: number;
  padrao: boolean;
}

export interface ClasseSeed {
  nomeOficial: string;
  apelidoGrupo: string | null;
  funcoes: FuncaoSeed[];
}

/**
 * Classes e ranks aprovados (D6, D7, D8, D16). Nomes oficiais das 4ª classes do bRO (etapa1 §2.1).
 * - Magus: duas funções e **nenhuma padrão** (D16): o admin escolhe sempre.
 * - Asceta das Almas: 4ª classe da linha Espiritualista/Ceifador de Almas (D7).
 * - "Outra" cobre as demais classes, rank 1 (C10).
 */
export const CLASSES_INICIAIS: readonly ClasseSeed[] = [
  {
    nomeOficial: "Mestre Celestial",
    apelidoGrupo: "MTK",
    funcoes: [{ nome: "Padrão", rank: 5, padrao: true }],
  },
  {
    nomeOficial: "Magus",
    apelidoGrupo: "Magus",
    funcoes: [
      { nome: "Dano", rank: 5, padrao: false },
      { nome: "Suporte com Cometa", rank: 3, padrao: false },
    ],
  },
  {
    nomeOficial: "Elementalista",
    apelidoGrupo: "Sorcerer",
    funcoes: [{ nome: "Defesa anti-dragão", rank: 4, padrao: true }],
  },
  {
    nomeOficial: "Executor",
    apelidoGrupo: "GX",
    funcoes: [{ nome: "Garra Sombria", rank: 3, padrao: true }],
  },
  {
    nomeOficial: "Asceta das Almas",
    apelidoGrupo: "Asceta",
    funcoes: [{ nome: "Buff ao MTK", rank: 3, padrao: true }],
  },
  {
    nomeOficial: "Cardeal",
    apelidoGrupo: "Cardeal",
    funcoes: [{ nome: "Buffs e cura", rank: 3, padrao: true }],
  },
  {
    nomeOficial: "Cientista",
    apelidoGrupo: "Cientista",
    funcoes: [{ nome: "Proteção", rank: 2, padrao: true }],
  },
  {
    nomeOficial: "Engenheiro",
    apelidoGrupo: "Engenheiro",
    funcoes: [{ nome: "Suporte", rank: 2, padrao: true }],
  },
  {
    nomeOficial: "Guardião Imperial",
    apelidoGrupo: "RG",
    funcoes: [{ nome: "Sustentação", rank: 2, padrao: true }],
  },
  {
    nomeOficial: "Outra",
    apelidoGrupo: "Demais classes",
    funcoes: [{ nome: "Padrão", rank: 1, padrao: true }],
  },
];

export const TIPOS_ITEM = ["MATERIAL", "VISUAL", "CARTA", "OUTRO"] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

export interface ItemSeed {
  nome: string;
  idJogo: number | null;
  tipo: TipoItem;
}

/** Nomes oficiais dos pós de talento (browiki, "Trocas"); o seed do M3 usava nomes descritivos. */
export const POS_DE_TALENTO = {
  POD: "Pó de Meteorito do Poder",
  STA: "Pó de Meteorito da Estâmina",
  CON: "Pó de Meteorito da Concentração",
  CRV: "Pó de Meteorito da Criatividade",
  FEI: "Pó de Meteorito do Feitiço",
  SAB: "Pó de Meteorito da Sabedoria",
} as const;

/** Nomes do seed do M3 que são corrigidos para os oficiais (Épico III, análise §2.2). */
export const RENOMEAR_POS: readonly [string, string][] = [
  ["Pó de Talento (Poder)", POS_DE_TALENTO.POD],
  ["Pó de Talento (Estâmina)", POS_DE_TALENTO.STA],
  ["Pó de Talento (Concentração)", POS_DE_TALENTO.CON],
  ["Pó de Talento (Criatividade)", POS_DE_TALENTO.CRV],
  ["Pó de Talento (Feitiço)", POS_DE_TALENTO.FEI],
  ["Pó de Talento (Sabedoria)", POS_DE_TALENTO.SAB],
];

/**
 * Recompensas da Torre levantadas pelo BA (Anexo A). Só os IDs confirmados são preenchidos.
 * Negociabilidade e vínculo à conta ficam nulos (desconhecidos) até a verificação no jogo.
 * Visuais e cartas não entram: o levantamento não traz os nomes exatos. O admin cadastra.
 */
export const ITENS_INICIAIS: readonly ItemSeed[] = [
  { nome: "Pó de Meteorito", idJogo: 1000372, tipo: "MATERIAL" },
  { nome: "Fragmento de Meteorito", idJogo: 1000373, tipo: "MATERIAL" },
  { nome: "Alma de Naght Sieger", idJogo: 1000396, tipo: "MATERIAL" },
  { nome: "Alma de Betelgeuse", idJogo: 1000397, tipo: "MATERIAL" },
  ...Object.values(POS_DE_TALENTO).map((nome, indice) => ({
    nome,
    idJogo: 1000398 + indice,
    tipo: "MATERIAL" as const,
  })),
  { nome: "Fragmento de Talento", idJogo: null, tipo: "MATERIAL" },
];

// ---------------------------------------------------------------------------
// Épico III: peças Astrais, Nebulosas e receitas (fonte: browiki.org, Torre da
// Constelação, seção "Trocas", máquinas do NPC Oscar). As receitas entram
// INATIVAS ("a validar"): o admin confere com o jogo, define os preços e ativa.
// ---------------------------------------------------------------------------

export const FONTE_RECEITAS = "browiki.org · Torre da Constelação · Trocas (máquinas do Oscar)";

const FRAGMENTO = "Fragmento de Meteorito";
const ALMA_NAGHT = "Alma de Naght Sieger";
const ALMA_BETELGEUSE = "Alma de Betelgeuse";

export const PECAS_ASTRAIS = ["Armadura Astral", "Túnica Astral", "Veste Astral"] as const;

/** As 6 Nebulosas (D29): nome, pó de talento e peça Astral exigida. */
export const NEBULOSAS: readonly { nome: string; po: string; peca: (typeof PECAS_ASTRAIS)[number] }[] = [
  { nome: "Armadura Nebulosa POD", po: POS_DE_TALENTO.POD, peca: "Armadura Astral" },
  { nome: "Armadura Nebulosa STA", po: POS_DE_TALENTO.STA, peca: "Armadura Astral" },
  { nome: "Túnica Nebulosa CON", po: POS_DE_TALENTO.CON, peca: "Túnica Astral" },
  { nome: "Túnica Nebulosa CRV", po: POS_DE_TALENTO.CRV, peca: "Túnica Astral" },
  { nome: "Veste Nebulosa FEI", po: POS_DE_TALENTO.FEI, peca: "Veste Astral" },
  { nome: "Veste Nebulosa SAB", po: POS_DE_TALENTO.SAB, peca: "Veste Astral" },
];

/** Itens do Épico III garantidos no catálogo (inclusive em bancos que já existiam). */
export const ITENS_EPICO3: readonly ItemSeed[] = [
  ...PECAS_ASTRAIS.map((nome, indice) => ({ nome, idJogo: 450168 - indice, tipo: "OUTRO" as const })),
  ...NEBULOSAS.map((n, indice) => ({ nome: n.nome, idJogo: 450169 + indice, tipo: "OUTRO" as const })),
];

export interface ReceitaSeed {
  nome: string;
  produz: string;
  solicitavel: boolean;
  componentes: { item: string; quantidade: number; pecaBase?: boolean }[];
  /** Receita da peça-base, para usar os materiais quando não houver a peça pronta (D31). */
  receitaPeca?: string;
}

export const RECEITAS_INICIAIS: readonly ReceitaSeed[] = [
  ...PECAS_ASTRAIS.map((peca) => ({
    nome: peca,
    produz: peca,
    solicitavel: false,
    componentes: [
      { item: FRAGMENTO, quantidade: 50 },
      { item: ALMA_NAGHT, quantidade: 5 },
    ],
  })),
  ...NEBULOSAS.map((n) => ({
    nome: n.nome,
    produz: n.nome,
    solicitavel: true,
    receitaPeca: n.peca,
    componentes: [
      { item: FRAGMENTO, quantidade: 50 },
      { item: n.po, quantidade: 30 },
      { item: ALMA_BETELGEUSE, quantidade: 10 },
      { item: n.peca, quantidade: 1, pecaBase: true },
    ],
  })),
];
