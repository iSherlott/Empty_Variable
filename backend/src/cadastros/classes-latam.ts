// Catálogo de personagens, sem atribuir funções ou ranks às classes adicionais.
// Evoluções oficiais: https://ro.gnjoyamericas.com/pt/news/notice/334 e /368.
// Classes iniciais, transcendentais e expandidas: https://ragnaplace.com/pt/laro-pt/class.
const EVOLUCOES_LATAM = [
  {
    grupo: "1-1",
    classes: [
      "Aprendiz",
      "Espadachim",
      "Mago",
      "Arqueiro",
      "Noviço",
      "Mercador",
      "Gatuno",
      "Taekwon",
      "Ninja",
      "Justiceiro",
      "Invocador",
    ],
  },
  {
    grupo: "1-2",
    classes: ["Aprendiz T", "Espadachim T", "Mago T", "Arqueiro T", "Noviço T", "Mercador T", "Gatuno T"],
  },
  {
    grupo: "2-1",
    classes: [
      "Cavaleiro",
      "Bruxo",
      "Ferreiro",
      "Sacerdote",
      "Mercenário",
      "Caçador",
      "Lorde",
      "Arquimago",
      "Mestre-Ferreiro",
      "Sumo Sacerdote",
      "Algoz",
      "Atirador de Elite",
      "Superaprendiz",
      "Mestre Taekwon",
      "Kagerou",
      "Oboro",
      "Insurgente",
    ],
  },
  {
    grupo: "2-2",
    classes: [
      "Templário",
      "Sábio",
      "Alquimista",
      "Monge",
      "Arruaceiro",
      "Bardo",
      "Odalisca",
      "Paladino",
      "Professor",
      "Criador",
      "Mestre",
      "Desordeiro",
      "Menestrel",
      "Cigana",
      "Superaprendiz EX",
      "Espiritualista",
    ],
  },
  {
    grupo: "3",
    classes: [
      "Cavaleiro Rúnico",
      "Guardião Real",
      "Arcano",
      "Feiticeiro",
      "Mecânico",
      "Bioquímico",
      "Arcebispo",
      "Shura",
      "Sicário",
      "Renegado",
      "Sentinela",
      "Trovador",
      "Musa",
      "Mestre Estelar",
      "Ceifador de Almas",
    ],
  },
  {
    grupo: "4",
    classes: [
      "Cavaleiro Draconiano",
      "Guardião Imperial",
      "Magus",
      "Elementalista",
      "Engenheiro",
      "Cientista",
      "Cardeal",
      "Inquisidor",
      "Executor",
      "Mandraque",
      "Falcão dos Ventos",
      "Maestro",
      "Diva",
      "Hiperaprendiz",
      "Mestre Celestial",
      "Asceta das Almas",
      "Shinkiro",
      "Shiranui",
      "Guerrilheiro",
      "Animista",
    ],
  },
] as const;

export const CLASSES_LATAM = EVOLUCOES_LATAM.flatMap(({ classes }): readonly string[] => classes);

const evolucaoPorNome = new Map<string, string>(
  EVOLUCOES_LATAM.flatMap(({ grupo, classes }) =>
    classes.map((nome) => [nome.toLowerCase(), grupo] as const),
  ),
);

export function grupoDaClasseLatam(nome: string): string {
  return evolucaoPorNome.get(nome.toLowerCase()) ?? "Outras";
}
