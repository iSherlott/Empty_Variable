// Dados de apoio para cadastrar instâncias (D43): a lista da browiki (https://browiki.org/wiki/Instâncias,
// consultada em 2026-11-15). São só referência para pré-preencher o cadastro: nada aqui entra no sistema
// sozinho, e o multiplicador de cada encontro é sempre decisão do gestor (D44).
import type { DificuldadeInstancia, ModoInstancia, RetornoInstancia } from "@prisma/client";

export interface ReferenciaInstancia {
  nome: string;
  nivelMinimo: number | null;
  retorno: RetornoInstancia;
  /** Texto do retorno quando não é um dos padrões (ex.: "12 horas", "quinta-feira"). */
  detalheRetorno: string | null;
  modo: ModoInstancia | null;
  dificuldade: DificuldadeInstancia | null;
  requisito: string | null;
  premiacao: string | null;
}

type Linha = [
  string,
  number | null,
  RetornoInstancia,
  string | null,
  "S" | "G" | null,
  "F" | "M" | "D" | null,
  string | null,
  string | null,
];

// nome, nível, retorno, detalhe do retorno, modo (Solo/Grupo), dificuldade, requisito, premiação
const LINHAS: Linha[] = [
  ["Vila dos Porings", 30, "DIARIO", null, "G", "F", null, "Vegetal"],
  ["Batalha dos Orcs", 60, "DIARIO", null, "G", "F", null, "Anel dos Orcs"],
  ["Edda do Quarto Crescente", 80, "DIARIO", null, "S", "F", null, "Fragmento de Sonho"],
  ["Torneio de Magia", 90, "DIARIO", null, "S", "F", null, "Moeda Mágica de Geffen"],
  ["Memórias de Sarah", 99, "DIARIO", null, "G", "F", null, "EXP"],
  ["Salão de Ymir", 100, "DIARIO", null, "S", "M", "Ritual de Coroação", "Marca de Honra"],
  ["Base Militar", 100, "DIARIO", null, "G", "M", "Terra Gloria", "Brasão de Honra"],
  ["Laboratório Werner", 100, "DIARIO", null, "G", "M", "Terra Gloria", "Brasão de Honra"],
  ["Missão OS", 110, "DIARIO", null, "G", "M", "Ocupação OS", "Chip Misterioso"],
  ["Memorial COR", 110, "DIARIO", null, "G", "M", "Ilusión", "Núcleo COR"],
  ["Palácio das Mágoas", 120, "DIARIO", null, "S", "F", null, "Fragmento de Cinzas"],
  ["Sonho Sombrio", 120, "DIARIO", null, "G", "M", null, "Dente de Jitterbug"],
  ["Invasão ao Aeroplano", 125, "DIARIO", null, "S", "F", null, "EXP"],
  ["Aos Pés do Rei", 130, "DIARIO", null, "G", "M", null, "Carta Dourada"],
  ["Torre do Demônio", 130, "DIARIO", null, "G", "M", null, "EXP"],
  ["Ortus Aqua", 130, "DIARIO", null, "G", "M", "Salvando Elyumina", "Vale Varmida"],
  ["Jardim Secreto", 130, "DIARIO", null, "G", "D", "Zona Restrita", "Vale Varmida"],
  ["Fazenda de Pitayas", 130, "DIARIO", null, "G", "F", "Legado do Sábio", "Vale Varmida"],
  ["Duelo com Sweety", 130, "DIARIO", null, "G", "F", "Legado do Sábio", "Vale Varmida"],
  ["Caverna de Buwaya", 130, "DIARIO", null, "G", "D", "Segredos na Floresta", "Tatuagem de Buwaya"],
  ["Maldição de Glastheim", 130, "DIARIO", null, "G", "M", null, "Mana Coagulada"],
  ["Ruína de Glastheim", 130, "DIARIO", null, "G", "M", "Edda de Glastheim", "Cristal Corrompido"],
  ["Covil de Vermes", 140, "DIARIO", null, "G", "D", null, "Pele da Rainha Verme"],
  ["Fábrica do Terror", 140, "DIARIO", null, "G", "M", null, "Moeda Sangrenta"],
  ["Laboratório Central", 140, "DIARIO", null, "G", "D", "Fantasmagórica", null],
  ["Sala Final", 150, "DIARIO", null, "G", "M", "Investigando o Passado", "Peça Intacta"],
  ["Ilha Bios", 160, "DIARIO", null, "G", "M", "Viagem Dimensional", "Marca do Herói"],
  ["Caverna de Mors", 160, "DIARIO", null, "G", "M", "Ilha Bios", "Prêmio do Herói"],
  ["Templo do Demônio Rei", 160, "DIARIO", null, "G", "D", "Caverna de Mors", "Prêmio de Esquadrão"],
  ["Edda do Biolaboratório", 170, "DIARIO", null, "G", "D", null, "Fragmento de Experimento"],
  ["Purificação do Santuário", 170, "DIARIO", null, "G", "F", null, "Fragmento de Ametista"],
  ["Memórias de Thanatos", 180, "DIARIO", null, "G", "D", null, "Acessórios Especiais"],
  ["Mansão da Desilusão", 200, "DIARIO", null, "G", "D", null, "Armas Adulter Fides"],
  ["Patrulha da Águia", 200, "DIARIO", null, "G", "F", null, "Pétala de Flor Invernal"],
  ["Batalha de Simulação", 200, "DIARIO", null, "G", "M", null, null],
  ["Operação Destruição", 200, "DIARIO", null, "G", "D", null, null],
  ["Mausoléu das Mágoas", 220, "DIARIO", null, "G", "D", null, "Mineas"],
  ["Torre Submersa", 40, "TRES_DIAS", null, "G", "F", null, "EXP"],
  ["Ninho de Nidhogg", 70, "TRES_DIAS", null, "G", "M", "Guardiã de Yggdrasil", "EXP"],
  ["Laboratório de Wolfchev", 90, "TRES_DIAS", null, "G", "D", "Rumores Sérios", null],
  ["Fortaleza Voadora", 145, "TRES_DIAS", null, "G", "M", "Salão de Ymir", "Armas Sobrenaturais"],
  ["Glastheim Sombria", 160, "TRES_DIAS", null, "G", "D", "Maldição de Glastheim", "Mana Sombria"],
  ["Queda de Glastheim", 170, "TRES_DIAS", null, "G", "D", "Edda de Glastheim", "Gema Corrompida"],
  ["Glastheim Infernal", 170, "TRES_DIAS", null, "G", "D", null, "Fragmento Temporal"],
  ["Queda do Aeroplano", 200, "TRES_DIAS", null, "G", "M", null, "Fragmento de Ymir"],
  ["Arena Noturna", 210, "TRES_DIAS", null, "G", "D", null, "Moeda Noturna de Geffen"],
  ["Torre da Constelação", 240, "TRES_DIAS", null, "G", "D", null, "Pó de Meteorito"],
  ["Altar do Selo", 75, "HORAS", "12 horas", "G", "M", null, "Chifres Místicos de Bafomé"],
  ["Caverna do Polvo", 90, "HORAS", "3 horas", "G", "F", null, "Caixa das Melhores Armas"],
  ["Esgotos de Malangdo", 90, "HORAS", "1 hora", "G", "M", null, "Ira do Deus do Mar"],
  ["Labirinto da Neblina", 99, "HORAS", "2 horas", "G", "M", null, null],
  ["Espaço Infinito", 100, "HORAS", "3 horas", "G", "F", null, "Pó Espacial"],
  ["Cripta", 60, "SEMANAL", "fim de semana", "G", "F", null, "Embalagem de Poções"],
  ["Glastheim Infantil", 65, "SEMANAL", "quinta-feira", "G", "F", null, "Mana Coagulada"],
  ["Fábrica Infantil", 70, "SEMANAL", "quinta-feira", "G", "F", null, "Moeda Sangrenta"],
  ["Túmulo do Monarca", 99, "SEMANAL", "sexta-feira", "G", "F", null, "Pedra Bruta"],
  [
    "Hospital Abandonado",
    100,
    "SEMANAL",
    "7 dias",
    "G",
    "M",
    "Enfermeira em Porto Malaya",
    "Tatuagem de Bangungot",
  ],
  ["Lago de Bakonawa", 140, "SEMANAL", "7 dias", "G", "D", "Livre-se de Bakonawa", "Tatuagem de Bakonawa"],
  ["Sarah vs Fenrir", 145, "SEMANAL", "7 dias", "G", "D", null, "Fragmento de Gigantes"],
  ["Livros Fantásticos", null, "OUTRO", null, null, null, null, null],
];

const MODO = { S: "SOLO", G: "GRUPO" } as const;
const DIFICULDADE = { F: "FACIL", M: "MEDIA", D: "DIFICIL" } as const;

export const REFERENCIA_BROWIKI: readonly ReferenciaInstancia[] = LINHAS.map(
  ([nome, nivelMinimo, retorno, detalheRetorno, modo, dif, requisito, premiacao]) => ({
    nome,
    nivelMinimo,
    retorno,
    detalheRetorno,
    modo: modo === null ? null : MODO[modo],
    dificuldade: dif === null ? null : DIFICULDADE[dif],
    requisito,
    premiacao,
  }),
);
