/**
 * D20: só entra no estoque da loja o item ativo, confirmado como negociável e não vinculado à conta.
 * "Desconhecido" (nulo) bloqueia até alguém verificar no jogo.
 * Devolve o motivo da recusa, ou null quando o item é elegível.
 */
export function motivoInelegivel(item: {
  ativo: boolean;
  negociavel: boolean | null;
  vinculadoConta: boolean | null;
}): string | null {
  if (!item.ativo) return "Item inativo no catálogo.";
  if (item.negociavel === null) return "Negociabilidade ainda não verificada no jogo.";
  if (!item.negociavel) return "Item não negociável.";
  if (item.vinculadoConta === null) return "Vínculo à conta ainda não verificado no jogo.";
  if (item.vinculadoConta) return "Item vinculado à conta.";
  return null;
}
