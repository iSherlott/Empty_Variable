#!/bin/sh
# Backup do banco (pg_dump em formato custom), validado e com retenção dos N mais recentes.
# Conexão pelas variáveis PGHOST, PGUSER, PGPASSWORD e PGDATABASE.
# Manual: docker compose -f docker-compose.prod.yml exec backup sh /scripts/backup.sh
set -eu

DESTINO="${BACKUP_DESTINO:-/backups}"
RETENCAO="${BACKUP_RETENCAO:-14}"
carimbo="$(date -u +%Y%m%d-%H%M%S)"
arquivo="$DESTINO/betel-$carimbo.dump"
parcial="$arquivo.parcial"

mkdir -p "$DESTINO"
trap 'rm -f "$parcial"' EXIT

pg_dump --format=custom --no-owner --file="$parcial"
# Um arquivo que o pg_restore não consegue listar está corrompido: não entra na rotação.
pg_restore --list "$parcial" > /dev/null
mv "$parcial" "$arquivo"
echo "$(date -u +%FT%TZ) backup ok: $arquivo ($(du -h "$arquivo" | cut -f1))"

# Retenção: mantém os $RETENCAO backups mais recentes.
ls -1t "$DESTINO"/betel-*.dump 2> /dev/null | tail -n +"$((RETENCAO + 1))" | while read -r antigo; do
  rm -f -- "$antigo"
  echo "removido pela retenção: $antigo"
done
