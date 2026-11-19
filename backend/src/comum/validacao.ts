import { BadRequestException } from "@nestjs/common";

/** Validações simples de entrada. Erros viram 400 com mensagem em PT-BR. */

export function objeto(valor: unknown): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new BadRequestException("Corpo da requisição inválido.");
  }
  return valor as Record<string, unknown>;
}

export function texto(valor: unknown, campo: string, min: number, max: number): string {
  if (typeof valor !== "string") throw new BadRequestException(`${campo} é obrigatório.`);
  const limpo = valor.trim().replace(/\s+/g, " ");
  if (limpo.length < min || limpo.length > max) {
    throw new BadRequestException(`${campo} deve ter entre ${min} e ${max} caracteres.`);
  }
  return limpo;
}

export function textoOpcional(valor: unknown, campo: string, min: number, max: number): string | undefined {
  return valor === undefined || valor === null || valor === "" ? undefined : texto(valor, campo, min, max);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !UUID.test(valor)) throw new BadRequestException(`${campo} inválido.`);
  return valor.toLowerCase();
}

export function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== "boolean") throw new BadRequestException(`${campo} deve ser verdadeiro ou falso.`);
  return valor;
}

/** Nome de personagem: limite do jogo é 23 caracteres. */
export const nomePersonagem = (v: unknown, campo = "Nome do personagem") =>
  texto(typeof v === "string" ? v.normalize("NFC") : v, campo, 1, 23);
export const apelidoJogador = (v: unknown, campo = "Apelido") => texto(v, campo, 2, 32);

/** Lista de nomes de personagens sem repetição (ignorando maiúsculas). */
export function listaPersonagens(valor: unknown, max: number): string[] {
  if (valor === undefined) return [];
  if (!Array.isArray(valor)) throw new BadRequestException("Personagens deve ser uma lista.");
  if (valor.length > max) throw new BadRequestException(`Informe no máximo ${max} personagens.`);
  const nomes = valor.map((v) => nomePersonagem(v));
  const vistos = new Set<string>();
  for (const n of nomes) {
    const chave = n.toLowerCase();
    if (vistos.has(chave)) throw new BadRequestException(`Personagem repetido: ${n}.`);
    vistos.add(chave);
  }
  return nomes;
}

export function inteiro(valor: unknown, campo: string, min: number, max: number): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < min || valor > max) {
    throw new BadRequestException(`${campo} deve ser um número inteiro entre ${min} e ${max}.`);
  }
  return valor;
}

/** true, false ou null (desconhecido). */
export function booleanoOuNulo(valor: unknown, campo: string): boolean | null {
  if (valor === null) return null;
  return booleano(valor, campo);
}
