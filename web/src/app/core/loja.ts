// Modelos da loja (Épico II, M8), como a API devolve, e regras de exibição.

export type TipoItem = "MATERIAL" | "VISUAL" | "CARTA" | "OUTRO";
export type StatusCompra = "PENDENTE_ENTREGA" | "ENTREGUE" | "CANCELADA";

export interface ItemVitrine {
  itemId: string;
  nome: string;
  /** ID do jogo, para a imagem da Divine Pride (D41). */
  idJogo?: number | null;
  tipo: TipoItem | null;
  preco: number;
  disponivel: number;
  temConsignado: boolean;
  limitePorMembro: number | null;
  limitePeriodoDias: number | null;
  limiteRestante: number | null;
}

export interface Vitrine {
  saldo: number;
  itens: ItemVitrine[];
}

export interface Compra {
  id: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
  status: StatusCompra;
  criadaEm: string;
  entregueEm: string | null;
  canceladaEm: string | null;
  motivoCancelamento: string | null;
  item: { id: string; nome: string };
  comprador: { id: string; apelido: string };
  entreguePor: { discordUsername: string } | null;
  canceladaPor: { discordUsername: string } | null;
  lotes: {
    quantidade: number;
    valorVendedor: number;
    lote: { ordem: number; origem: "MANUAL" | "DROP_RUN" | "OFERTA"; dono: { apelido: string } | null };
  }[];
}

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  MATERIAL: "Material",
  CARTA: "Carta",
  VISUAL: "Visual",
  OUTRO: "Outro",
};

export const ROTULO_STATUS_COMPRA: Record<StatusCompra, string> = {
  PENDENTE_ENTREGA: "Aguardando entrega",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
};

/** Quanto este membro pode comprar agora: o menor entre o disponível e o que resta do limite (D24). */
export function maximoComprável(i: ItemVitrine): number {
  return i.limiteRestante === null ? i.disponivel : Math.min(i.disponivel, i.limiteRestante);
}

/** Selo do cartão: o motivo mais importante para o comprador. */
export function seloDoItem(
  i: ItemVitrine,
): { texto: string; tipo: "indisponivel" | "limite" | "consignado" | "ultimas" } | null {
  if (i.disponivel === 0) return { texto: "Indisponível", tipo: "indisponivel" };
  if (i.limiteRestante === 0) return { texto: "Limite atingido", tipo: "limite" };
  if (i.temConsignado) return { texto: "Consignado", tipo: "consignado" };
  if (i.disponivel <= 3) return { texto: "Últimas unidades", tipo: "ultimas" };
  return null;
}

export function textoLimite(i: ItemVitrine): string {
  if (i.limitePorMembro === null) return "Sem limite";
  return `${i.limitePorMembro} a cada ${i.limitePeriodoDias} dia(s) · restam ${i.limiteRestante ?? 0}`;
}

/** Quem vendeu, para o histórico do admin: "Grupo", "Ana" ou "Grupo + Ana". */
export function origemCompra(c: Compra): string {
  const nomes = c.lotes.map((l) => (l.lote.dono === null ? "Grupo" : l.lote.dono.apelido));
  return [...new Set(nomes)].join(" + ");
}

// ---- Ofertas em consignação (M9) ----

export type StatusOferta =
  "PENDENTE" | "APROVADA" | "REJEITADA" | "RETIRADA_SOLICITADA" | "RETIRADA" | "ESGOTADA";

export interface Oferta {
  id: string;
  quantidade: number;
  status: StatusOferta;
  motivo: string | null;
  criadaEm: string;
  analisadaEm: string | null;
  item: { id: string; nome: string; tipo: TipoItem | null };
  jogador: { id: string; apelido: string };
  analisadaPor: { discordUsername: string } | null;
  lote: { id: string; ordem: number; ativo: boolean } | null;
}

export interface ItemOfertavel {
  id: string;
  nome: string;
  tipo: TipoItem | null;
  precoVigente: number | null;
}

export const ROTULO_STATUS_OFERTA: Record<StatusOferta, string> = {
  PENDENTE: "Aguardando o guardião",
  APROVADA: "À venda",
  REJEITADA: "Rejeitada",
  RETIRADA_SOLICITADA: "Retirada pedida",
  RETIRADA: "Retirada",
  ESGOTADA: "Vendida",
};

/** O vendedor pode retirar enquanto nada foi vendido por completo (D25). */
export function podeRetirar(o: Oferta): boolean {
  return o.status === "PENDENTE" || o.status === "APROVADA";
}
