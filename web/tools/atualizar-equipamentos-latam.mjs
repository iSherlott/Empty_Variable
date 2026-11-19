import { writeFile } from "node:fs/promises";

const revisao = process.argv[2] ?? "7e1902ae4ffbc6ee1e1dabb4fb411ae33dcab5b3";
if (!/^[0-9a-f]{40}$/.test(revisao)) throw new Error("Informe um SHA Git completo.");
const repo = "adsonpleal/latam-ro-calc";
const origem = `https://raw.githubusercontent.com/${repo}/${revisao}/src/assets/demo/data/`;

async function ler(arquivo) {
  const resposta = await fetch(origem + arquivo, { signal: AbortSignal.timeout(60_000) });
  if (!resposta.ok) throw new Error(`Falha consultando ${arquivo}: HTTP ${resposta.status}`);
  return resposta.json();
}

const [itens, latam] = await Promise.all([ler("item.json"), ler("latam-items.json")]);
const locaisCabeca = { Upper: "topo", Middle: "meio", Lower: "baixo" };
const armaduras = {
  510: ["acessorio2"],
  511: ["acessorio1"],
  513: ["armadura"],
  514: ["escudo"],
  515: ["capa"],
  516: ["calcado"],
  517: ["acessorio1", "acessorio2"],
};
const slots = Object.fromEntries(
  ["topo", "meio", "baixo", "arma", "armadura", "escudo", "capa", "calcado", "acessorio1", "acessorio2"].map(
    (slot) => [slot, []],
  ),
);

function slotsDoItem(item) {
  if (item.itemTypeId === 1) return ["arma"];
  if (item.itemTypeId !== 2) return [];
  if (item.itemSubTypeId !== 512) return armaduras[item.itemSubTypeId] ?? [];
  const locais = (item.locations ?? [item.location]).map((local) => locaisCabeca[local]).filter(Boolean);
  return locais.length ? locais : ["topo"];
}

for (const item of Object.values(itens)) {
  const nome = latam[item.id]?.name?.trim();
  if (!nome || !Number.isSafeInteger(item.id)) continue;
  for (const slot of slotsDoItem(item)) slots[slot].push({ id: item.id, nome });
}
const ordem = new Intl.Collator("pt-BR", { numeric: true });
for (const itensDoSlot of Object.values(slots)) {
  itensDoSlot.sort((a, b) => ordem.compare(a.nome, b.nome) || a.id - b.id);
  if (!itensDoSlot.length) throw new Error("Catálogo incompleto: slot sem equipamentos.");
}
await writeFile(
  new URL("../public/equipamentos-latam.json", import.meta.url),
  JSON.stringify({ fonte: `https://github.com/${repo}/tree/${revisao}`, slots }) + "\n",
);
console.log(
  Object.fromEntries(Object.entries(slots).map(([slot, itensDoSlot]) => [slot, itensDoSlot.length])),
);
