-- D37: papel de gestor (pontos, runs, jogadores e receitas). Aditiva: nenhum usuário muda de papel.
ALTER TYPE "Papel" ADD VALUE 'GESTOR' BEFORE 'MEMBRO';
