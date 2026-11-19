// Telas iniciais dos painéis (paineis §4): o que a API devolve em /api/painel/*.

export interface Pendencia {
  quantidade: number;
  maisAntiga: string | null;
}

export interface ResumoGestao {
  vinculosPendentes: Pendencia;
  receitasAValidar: number;
  runsNaSemana: number;
  maioresSaldos: { jogadorId: string; apelido: string; saldo: number }[];
}

export interface ResumoAdmin {
  comprasAEntregar: Pendencia;
  ofertasAAnalisar: Pendencia;
  nebulasAEntregar: Pendencia;
  itensSemConferencia: number;
}

const DIA_MS = 86_400_000;

/** "a mais antiga é de hoje" / "esperando há 3 dias", para o rodapé dos cartões. */
export function esperaDe(p: Pendencia, agora = Date.now()): string {
  if (p.quantidade === 0 || p.maisAntiga === null) return "Nada pendente";
  const dias = Math.floor((agora - new Date(p.maisAntiga).getTime()) / DIA_MS);
  if (dias <= 0) return "A mais antiga é de hoje";
  return dias === 1 ? "Esperando há 1 dia" : `Esperando há ${dias} dias`;
}

/** Pendência de 2 dias ou mais pede atenção (mesmo critério da fila de compras). */
export function atrasada(p: Pendencia, agora = Date.now()): boolean {
  return p.maisAntiga !== null && agora - new Date(p.maisAntiga).getTime() >= 2 * DIA_MS;
}
