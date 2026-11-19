import { Inject, Injectable, Logger } from "@nestjs/common";
import type { TipoImagem } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

/** Resposta mínima da busca externa (o `fetch` global cumpre este contrato). */
export interface RespostaImagem {
  status: number;
  headers: { get(nome: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}
export type BuscadorImagem = (url: string, init: RequestInit) => Promise<RespostaImagem>;
export const BUSCADOR_IMAGEM = Symbol("BUSCADOR_IMAGEM");

const BASE = "https://static.divine-pride.net/images/items";
const CAMINHO: Record<TipoImagem, string> = { ICONE: "item", ILUSTRACAO: "collection" };
/** Tempo máximo esperando a Divine Pride; depois disso a tela usa o ícone desenhado. */
const TIMEOUT_MS = 5_000;
/** Imagens são pequenas (ícone ~0,5 KB, ilustração ~5 KB): acima disso, algo está errado. */
const TAMANHO_MAXIMO = 512 * 1024;
/** Um "não existe" é conferido de novo depois de uma semana (a Divine Pride pode ganhar a imagem). */
const REVISAR_AUSENTE_MS = 7 * 86_400_000;

export interface Imagem {
  conteudo: Buffer;
  mime: string;
}

/**
 * T-55 (D41): imagens dos itens pela Divine Pride, sempre via cache no banco.
 * Cada ID é buscado uma vez (a Divine Pride pede cache e proíbe varrer IDs); falhas de rede não
 * entram no cache, para tentar de novo depois; "não existe" entra, e é revisto após uma semana.
 */
@Injectable()
export class ImagensService {
  private readonly log = new Logger(ImagensService.name);
  /** Buscas em andamento: dois pedidos do mesmo ID ao mesmo tempo geram uma busca só. */
  private readonly emAndamento = new Map<string, Promise<Imagem | null>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BUSCADOR_IMAGEM) private readonly buscar: BuscadorImagem,
  ) {}

  async obter(idJogo: number, tipo: TipoImagem): Promise<Imagem | null> {
    const cache = await this.prisma.imagemCache.findUnique({ where: { idJogo_tipo: { idJogo, tipo } } });
    if (cache?.existe && cache.conteudo !== null && cache.mime !== null) {
      return { conteudo: Buffer.from(cache.conteudo), mime: cache.mime };
    }
    if (cache && !cache.existe && Date.now() - cache.buscadaEm.getTime() < REVISAR_AUSENTE_MS) return null;

    const chave = `${idJogo}:${tipo}`;
    let busca = this.emAndamento.get(chave);
    if (busca === undefined) {
      busca = this.buscarEGuardar(idJogo, tipo).finally(() => this.emAndamento.delete(chave));
      this.emAndamento.set(chave, busca);
    }
    return busca;
  }

  private async buscarEGuardar(idJogo: number, tipo: TipoImagem): Promise<Imagem | null> {
    const url = `${BASE}/${CAMINHO[tipo]}/${idJogo}.png`;
    let resposta: RespostaImagem;
    try {
      resposta = await this.buscar(url, {
        headers: { "User-Agent": "Betel/1.0 (cache de imagens)" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      this.log.warn(`Divine Pride indisponível para ${url}.`);
      return null; // rede ou timeout: não guarda, tenta de novo na próxima
    }

    if (resposta.status === 404) {
      await this.guardar(idJogo, tipo, null);
      return null;
    }
    const mime = resposta.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (resposta.status !== 200 || !mime.startsWith("image/")) {
      this.log.warn(`Divine Pride respondeu ${resposta.status} (${mime || "sem tipo"}) para ${url}.`);
      return null;
    }
    const conteudo = Buffer.from(await resposta.arrayBuffer());
    if (conteudo.length === 0 || conteudo.length > TAMANHO_MAXIMO) return null;
    const imagem = { conteudo, mime };
    await this.guardar(idJogo, tipo, imagem);
    return imagem;
  }

  private async guardar(idJogo: number, tipo: TipoImagem, imagem: Imagem | null): Promise<void> {
    const dados = {
      existe: imagem !== null,
      conteudo: imagem === null ? null : new Uint8Array(imagem.conteudo),
      mime: imagem?.mime ?? null,
      buscadaEm: new Date(),
    };
    await this.prisma.imagemCache.upsert({
      where: { idJogo_tipo: { idJogo, tipo } },
      create: { idJogo, tipo, ...dados },
      update: dados,
    });
  }
}
