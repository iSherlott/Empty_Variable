import type { AuditoriaService } from "../auditoria/auditoria.service.js";
import type { Tx } from "../prisma/prisma.service.js";

export const PRECO_MAXIMO = 1_000_000_000;

export async function gravarPreco(
  tx: Tx,
  auditoria: AuditoriaService,
  itemId: string,
  precoPontos: number | null,
  adminId: string,
) {
  const ultimo = await tx.precoItem.findFirst({ where: { itemId }, orderBy: { versao: "desc" } });
  const novo = await tx.precoItem.create({
    data: { itemId, versao: (ultimo?.versao ?? 0) + 1, precoPontos, criadoPorId: adminId },
  });
  await auditoria.registrar(
    {
      usuarioId: adminId,
      acao: "PRECO_ITEM_DEFINIDO",
      entidade: "item_catalogo",
      entidadeId: itemId,
      antes: { precoPontos: ultimo?.precoPontos ?? null },
      depois: { precoPontos, versao: novo.versao },
    },
    tx,
  );
  return novo;
}
