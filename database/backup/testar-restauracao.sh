#!/bin/sh
# Teste de restauração (T-24): restaura um backup num banco TEMPORÁRIO, confere a integridade e apaga
# o banco temporário. Não toca no banco de produção.
# Uso: docker compose -f docker-compose.prod.yml exec backup sh /scripts/testar-restauracao.sh [arquivo]
#      (sem arquivo, usa o backup mais recente)
set -eu

arquivo="${1:-$(ls -1t /backups/betel-*.dump 2> /dev/null | head -n 1)}"
if [ -z "$arquivo" ] || [ ! -f "$arquivo" ]; then
  echo "Nenhum backup encontrado em /backups." >&2
  exit 1
fi
TEMP="betel_teste_restauracao"

echo "Restaurando $arquivo no banco temporário $TEMP..."
psql -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS $TEMP" -c "CREATE DATABASE $TEMP"
trap 'psql -d postgres -q -c "DROP DATABASE IF EXISTS $TEMP" > /dev/null' EXIT
pg_restore --no-owner --exit-on-error -d "$TEMP" "$arquivo"

psql -d "$TEMP" -v ON_ERROR_STOP=1 -q -f /scripts/verificar-integridade.sql
echo "Restauração OK: $arquivo"
