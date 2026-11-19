// Modelos do Épico III (receitas e Nebula), como a API devolve.

export interface FaltaItem {
  itemId: string;
  item: string;
  tenho: number;
  preciso: number;
  falta: number;
}

export interface Receita {
  id: string;
  nome: string;
  itemProduzido: { id: string; nome: string; idJogo?: number | null };
  solicitavel: boolean;
  ativa: boolean;
  fonte: string | null;
  limitePorMembro: number | null;
  limitePeriodoDias: number | null;
  componentes: {
    id: string;
    item: { id: string; nome: string; idJogo?: number | null };
    quantidade: number;
    pecaBase: boolean;
  }[];
  receitaPeca: { id: string; nome: string } | null;
  precoVigente: { versao: number; precoComPeca: number; precoTrazendoPeca: number } | null;
  solicitacoesPendentes: number;
  disponibilidade: {
    trazendoPeca: number;
    comPecaDoEstoque: number;
    faltasTrazendo: FaltaItem[];
    faltasComPeca: FaltaItem[];
  };
}

export interface ComponenteEditavel {
  itemId: string;
  quantidade: number;
  pecaBase: boolean;
}

/** Situação para o selo do cartão. */
export function situacaoReceita(r: Receita): { texto: string; tipo: "ativa" | "validar" | "sem-preco" } {
  if (r.ativa) return { texto: "Ativa", tipo: "ativa" };
  if (r.precoVigente === null && r.solicitavel) return { texto: "A validar · sem preço", tipo: "sem-preco" };
  return { texto: "A validar", tipo: "validar" };
}

/** Pendências do editor de componentes, antes de enviar (a API valida de novo). */
export function pendenciasComponentes(c: ComponenteEditavel[]): string[] {
  const p: string[] = [];
  if (c.length === 0) p.push("Informe ao menos um componente.");
  if (c.some((x) => x.itemId === "")) p.push("Escolha o item de cada linha.");
  if (c.some((x) => !Number.isInteger(x.quantidade) || x.quantidade < 1))
    p.push("Quantidades inteiras maiores que zero.");
  const ids = c.map((x) => x.itemId).filter((x) => x !== "");
  if (new Set(ids).size !== ids.length) p.push("Um item não pode se repetir.");
  if (c.filter((x) => x.pecaBase).length > 1) p.push("Só uma peça-base por receita.");
  return p;
}

// ---- Solicitação de Nebula (M11) ----

export type StatusSolicitacaoNebula = "PENDENTE" | "ENTREGUE" | "CANCELADA" | "REJEITADA";

export const ROTULO_STATUS_NEBULA: Record<StatusSolicitacaoNebula, string> = {
  PENDENTE: "Aguardando entrega",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
  REJEITADA: "Rejeitada",
};

export interface ReceitaAberta extends Receita {
  /** Quanto ainda cabe no limite do período (nulo = sem limite). */
  limiteRestante: number | null;
}

export interface VitrineNebula {
  saldo: number;
  receitas: ReceitaAberta[];
}

export interface SolicitacaoNebula {
  id: string;
  trazPeca: boolean;
  pecaDoEstoque: "PRONTA" | "MATERIAIS" | null;
  preco: number;
  status: StatusSolicitacaoNebula;
  motivo: string | null;
  criadaEm: string;
  entregueEm: string | null;
  encerradaEm: string | null;
  receita: { id: string; nome: string };
  precoReceita: { versao: number };
  jogador: { id: string; apelido: string };
  entreguePor: { discordUsername: string } | null;
  encerradaPor: { discordUsername: string } | null;
  materiais: { itemId: string; item: string; quantidade: number }[];
  lotes: { item: string; lote: number; quantidade: number }[];
}

export function temPeca(r: Receita): boolean {
  return r.componentes.some((c) => c.pecaBase);
}

export function precoDe(r: Receita, trazPeca: boolean): number {
  const p = r.precoVigente;
  if (p === null) return 0;
  return trazPeca || !temPeca(r) ? p.precoTrazendoPeca : p.precoComPeca;
}

export function disponivelDe(r: Receita, trazPeca: boolean): number {
  return trazPeca || !temPeca(r) ? r.disponibilidade.trazendoPeca : r.disponibilidade.comPecaDoEstoque;
}

export function faltasDe(r: Receita, trazPeca: boolean): FaltaItem[] {
  return trazPeca || !temPeca(r) ? r.disponibilidade.faltasTrazendo : r.disponibilidade.faltasComPeca;
}

/** Briefing §7: o botão Solicitar só habilita quando tudo está disponível. Devolve o motivo do bloqueio. */
export function bloqueioSolicitar(r: ReceitaAberta, trazPeca: boolean, saldo: number): string | null {
  if (disponivelDe(r, trazPeca) < 1) return "Falta material no estoque do grupo.";
  if (r.limiteRestante === 0) return "Você atingiu o limite desta Nebula no período.";
  if (saldo < precoDe(r, trazPeca)) return "Saldo insuficiente.";
  return null;
}
