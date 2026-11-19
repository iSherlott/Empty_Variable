#!/bin/sh
# Ponto de entrada do serviço "backup": agenda backup.sh no cron e fica em primeiro plano.
# A saída do backup vai para os logs do contêiner (docker compose logs backup).
set -eu

CRON="${BACKUP_CRON:-0 7 * * *}"
echo "$CRON /bin/sh /scripts/backup.sh > /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "Backup agendado (UTC): $CRON. Retenção: ${BACKUP_RETENCAO:-14} arquivos em /backups."
exec crond -f -l 8
