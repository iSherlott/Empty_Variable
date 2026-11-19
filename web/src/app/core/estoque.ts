// Modelos do estoque e da loja (Épico II), como a API devolve.

export interface ResumoItemEstoque {
  itemId: string;
  nome: string;
  idJogo?: number | null;
  ultimoValorUnitarioPontos?: number | null;
  precoVigente: number | null;
  motivoInelegivel: string | null;
  reservaMinima: number;
  grupo: number;
  consignado: number;
  disponivel: number;
}

export interface LoteEstoque {
  id: string;
  ordem: number;
  origem: "MANUAL" | "DROP_RUN" | "OFERTA";
  ativo: boolean;
  criadoEm: string;
  item: { id: string; nome: string };
  dono: { id: string; apelido: string } | null;
  quantidade: number;
}

export type TipoMovimento = "ENTRADA" | "VENDA" | "DEVOLUCAO" | "RETIRADA" | "AJUSTE" | "NEBULA";

export interface OrigemEstoque {
  id: string;
  nome: string;
  itensIds: string[];
}

export interface MovimentoEstoque {
  valorUnitarioPontos?: number | null;
  id: string;
  quantidade: number;
  tipo: TipoMovimento;
  motivo: string | null;
  origemEntrada?: string | null;
  criadoEm: string;
  compraId: string | null;
  criadoPor: { discordUsername: string };
  dropRun: { run: { id: string; data: string } } | null;
  lote: {
    id: string;
    ordem: number;
    origem: LoteEstoque["origem"];
    item: { nome: string };
    dono: { apelido: string } | null;
  };
}

export interface ResultadoDropsRun {
  lancados: { dropId: string; item: string; quantidade: number }[];
  naoLancados: { dropId: string; item: string; quantidade: number; motivo: string }[];
}

export interface VersaoConfigLoja {
  id: string;
  versao: number;
  taxaConsignacaoBp: number;
  vigenteDesde: string;
}

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  ENTRADA: "Entrada",
  VENDA: "Venda",
  DEVOLUCAO: "Devolução",
  RETIRADA: "Retirada",
  AJUSTE: "Ajuste",
  NEBULA: "Nebula",
};

export const ROTULO_ORIGEM: Record<LoteEstoque["origem"], string> = {
  MANUAL: "Entrada manual",
  DROP_RUN: "Drop de run",
  OFERTA: "Consignado",
};

/** Texto curto de um lote: "#12 · Drop de run" ou "#13 · Consignado (Ana)". */
export function descreverLote(l: {
  ordem: number;
  origem: LoteEstoque["origem"];
  dono: { apelido: string } | null;
}): string {
  return `#${l.ordem} · ${ROTULO_ORIGEM[l.origem]}${l.dono === null ? "" : ` (${l.dono.apelido})`}`;
}

/** Descrição da origem de um movimento para o histórico. */
export function origemMovimento(m: MovimentoEstoque): string {
  if (m.dropRun !== null) return `Run de ${m.dropRun.run.data.slice(0, 10).split("-").reverse().join("/")}`;
  if (m.compraId !== null) return "Compra na loja";
  return [m.origemEntrada, m.motivo].filter(Boolean).join(" · ") || "—";
}
