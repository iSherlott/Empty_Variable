#!/usr/bin/env bash
# Gerencia a stack do Empty Variable na VPS (docker-compose.vps.yml). Rode de dentro do clone da VPS.
#
#   deploy/vps-deploy.sh deploy   atualiza o código, faz um backup, reconstrói e sobe a stack
#   deploy/vps-deploy.sh status   docker compose ps + saúde da API
#
# Precisa do .env na raiz do clone (modelo: .env.vps.example; guia: docs/implantacao.md, seção 8).
# DEPLOY_REF=<tag|sha> implanta esse commit em vez da ponta da main. Ele precisa estar na
# origin/main; o workflow "Deploy na VPS" passa aqui a tag da release.
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
# Dois deploys ao mesmo tempo disputam os mesmos contêineres: um de cada vez.
exec 9> /tmp/emptyvariable-deploy.lock
flock -n 9 || {
  echo "erro: já existe um deploy em andamento" >&2
  exit 1
}
COMPOSE=(docker compose -f docker-compose.vps.yml)

valor_env() { sed -n "s/^$1=//p" .env | tail -n 1; }

sincronizar() {
  [ -z "$(git status --porcelain --untracked-files=no)" ] || {
    echo "erro: o clone tem alterações locais; não vou sobrescrevê-las" >&2
    exit 1
  }
  git fetch --tags --prune origin
  local ref="${DEPLOY_REF:-origin/main}" sha
  sha=$(git rev-parse --verify --quiet "${ref}^{commit}") || {
    echo "erro: referência desconhecida: $ref" >&2
    exit 1
  }
  git merge-base --is-ancestor "$sha" origin/main || {
    echo "erro: $ref ($sha) não está na origin/main" >&2
    exit 1
  }
  git checkout -q main
  git reset -q --hard "$sha"
  echo "Código em $ref ($(git rev-parse --short HEAD))"
}

status() {
  "${COMPOSE[@]}" ps
  local porta
  porta=$(valor_env WEB_PORT)
  printf 'saúde da API: '
  curl -fsS -m 5 "http://127.0.0.1:${porta:-4200}/api/saude" || {
    echo "(sem resposta)"
    return 1
  }
  echo
}

deploy() {
  [ -f .env ] || {
    echo "erro: falta o .env em $(pwd); veja .env.vps.example" >&2
    exit 1
  }
  sincronizar
  # As migrations novas rodam quando a API sobe: guarda o estado atual antes (pula no primeiro deploy).
  if [ -n "$("${COMPOSE[@]}" ps -q --status running emptyvariable-backup)" ]; then
    "${COMPOSE[@]}" exec -T emptyvariable-backup sh /scripts/backup.sh
  fi
  "${COMPOSE[@]}" up -d --build --wait --remove-orphans
  status
}

case "${1:-}" in
  deploy) deploy ;;
  status) status ;;
  *)
    sed -n '2,9p' "$0"
    exit 1
    ;;
esac
