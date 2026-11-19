# QA — simulação do modelo de pontuação proposto (Etapa 1). Valores de B/alpha são PROPOSTAS, não decisões.
import math
def peso(rank, alpha): return 1 + alpha*(rank-1)
def pontos(rank, B=100, alpha=0.5, f=1.0):
    return math.floor(B*peso(rank,alpha)*f + 0.5)  # arredondamento half-up
def dividir(P, emprestimos):
    """emprestimos: lista (credor, pct). Credores recebem floor; tomador fica com o resto -> soma == P."""
    assert sum(p for _,p in emprestimos) <= 1, "soma dos percentuais > 100%"
    partes = {c: 0 for c,_ in emprestimos}
    for c,p in emprestimos: partes[c] += math.floor(P*p)
    tomador = P - sum(partes.values()); assert tomador >= 0
    return tomador, partes

comp1 = [("Ana","MTK",5,1),("Bia","Magus (dano)",5,1),("Caio","Sorcerer",4,1),("Duda","Asceta",3,1),
         ("Enzo","GX",3,1),("Fê","Cardeal",3,1),("Gus","Cientista",2,1),("Hugo","RG",2,1)]
comp2 = [("Ana","MTK",5,1),("Bia","Magus (suporte)",3,1),("Fê","Cardeal",3,1),("Ivo","Ranger (demais)",1,1),
         ("Caio","Sorcerer",4,0.5)]
for nome,comp in [("Composição 1 — completa",comp1),("Composição 2 — enxuta + parcial",comp2)]:
    print("\n##",nome)
    for a in (1.0,0.5,0.25):
        tot=0; linha=[]
        for j,c,r,f in comp:
            p=pontos(r,alpha=a,f=f); tot+=p; linha.append(f"{c}={p}")
        print(f"alpha={a}: "+", ".join(linha)+f" | total={tot}")
print("\n## Empréstimo — GX 200 pts, X emprestou 2 itens (20%), Y 1 item (10%)")
print(dividir(pontos(3), [("X",0.20),("Y",0.10)]))
print("## Empréstimo com resto — Sorcerer parcial 125 pts, X 15%, Y 15%")
print(dividir(pontos(4,f=0.5), [("X",0.15),("Y",0.15)]))
try: dividir(100,[("X",0.6),("Y",0.5)])
except AssertionError as e: print("## Rejeitado:", e)

# --- Proposta D3 (multiplicador por run) — valores PROPOSTOS, não aprovados ---
M_CHEFE = {"Naght (andar 25)":1.0, "Betelgeuse andar 50 (0–3★)":1.5, "Betelgeuse andar 75 (3–5★)":2.0}
S_STATUS = {"Concluída":1.0, "Falha no chefe":0.5, "Abortada antes do chefe":0.0}
print("\n## D3 — pontos por chefe × status (MTK r5 / Cardeal r3 / demais r1; total comp.1)")
for ch,m in M_CHEFE.items():
    for st,s in S_STATUS.items():
        M=m*s
        tot=sum(math.floor(100*peso(r,0.5)*M*f+0.5) for _,_,r,f in comp1)
        print(f"{ch:28} {st:24} M={M:<4} MTK={math.floor(100*3*M+.5):>3} Cardeal={math.floor(100*2*M+.5):>3} Demais={math.floor(100*M+.5):>3} total={tot}")

# --- D9 aprovada: categoria sugere %, admin ajusta; tomador fica com >= 50% ---
CATEG = {"Essencial":0.20, "Importante":0.10, "Complementar":0.05}
TETO_CREDORES = 0.50
def dividir_d9(P, emprestimos, excedente="proporcional"):
    """emprestimos: (credor, categoria, pct_override|None). excedente: 'proporcional' (PROPOSTA) ou 'rejeitar'."""
    pcts = [(c, ov if ov is not None else CATEG[cat]) for c,cat,ov in emprestimos]
    soma = sum(p for _,p in pcts)
    if soma > TETO_CREDORES + 1e-9:
        if excedente == "rejeitar": raise ValueError(f"soma {soma:.0%} > teto {TETO_CREDORES:.0%}")
        pcts = [(c, p*TETO_CREDORES/soma) for c,p in pcts]
    return dividir(P, pcts)
print("\n## D9")
print("GX 200 | X essencial, Y complementar:", dividir_d9(200, [("X","Essencial",None),("Y","Complementar",None)]))
print("MTK 600 (Bet75) | X,Y,Z essenciais (60%) proporcional:", dividir_d9(600, [("X","Essencial",None),("Y","Essencial",None),("Z","Essencial",None)]))
try: dividir_d9(600, [("X","Essencial",None),("Y","Essencial",None),("Z","Essencial",None)], "rejeitar")
except ValueError as e: print("MTK 600 | mesma situação, modo rejeitar:", e)
print("Cardeal 300 (Bet50) | X essencial ajustado p/ 25%, Y importante:", dividir_d9(300, [("X","Essencial",0.25),("Y","Importante",None)]))
