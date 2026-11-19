#!/bin/sh
# Restaura um backup SOBRE o banco de produção. Apaga os dados atuais.
# Antes: pare a API (docker compose -f docker-compose.prod.yml stop api) e rode testar-restauracao.sh
# com o mesmo arquivo. Depois: suba a API de novo.
# Uso: docker compose -f docker-compose.prod.yml exec backup sh /scripts/restaurar.sh <arquivo> --substituir-producao
set -eu

arquivo="${1:-}"
confirmacao="${2:-}"
if [ -z "$arquivo" ] || [ ! -f "$arquivo" ]; then
  echo "Uso: restaurar.sh /backups/betel-AAAAMMDD-HHMMSS.dump --substituir-producao" >&2
  exit 1
fi
if [ "$confirmacao" != "--substituir-producao" ]; then
  echo "Isto apaga o banco $PGDATABASE e o substitui por $arquivo." >&2
  echo "Para confirmar, repita o comando com --substituir-producao no final." >&2
  exit 1
fi

# Garantia extra: guarda o estado atual antes de substituir.
echo "Fazendo um backup do estado atual antes de restaurar..."
BACKUP_RETENCAO=1000 sh /scripts/backup.sh

echo "Recriando $PGDATABASE..."
psql -d postgres -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS \"$PGDATABASE\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$PGDATABASE\""
pg_restore --no-owner --exit-on-error -d "$PGDATABASE" "$arquivo"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q -f /scripts/verificar-integridade.sql
echo "Banco restaurado de $arquivo. Suba a API: docker compose -f docker-compose.prod.yml start api"
