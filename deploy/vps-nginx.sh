#!/usr/bin/env bash
# Publica o Empty Variable numa sub-rota de um site que já existe no nginx do host.
# Rode na VPS, de dentro do clone, depois do primeiro deploy:
#
#   deploy/vps-nginx.sh <arquivo-do-site>      ex.: deploy/vps-nginx.sh /etc/nginx/sites-enabled/nag4eyes
#
# Instala deploy/nginx/emptyvariable.conf em /etc/nginx/snippets/ (com APP_BASE_PATH e WEB_PORT do .env)
# e acrescenta um "include" no bloco server 443 do site. Se o nginx recusar a configuração, desfaz tudo.
# Se o dono do site reinstalar o arquivo dele, o include some: rode este script de novo.
set -euo pipefail
SITE=${1:?informe o arquivo do site no nginx, ex.: /etc/nginx/sites-enabled/nag4eyes}
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SNIPPET=/etc/nginx/snippets/emptyvariable.conf
INCLUDE="include $SNIPPET;"

valor_env() { sed -n "s/^$1=//p" .env | tail -n 1; }
caminho=$(valor_env APP_BASE_PATH)
porta=$(valor_env WEB_PORT)
[[ "$caminho" =~ ^(/[A-Za-z0-9._~-]+)+$ ]] || {
  echo "erro: APP_BASE_PATH no .env precisa ser um caminho como /emptyvariable" >&2
  exit 1
}
[[ "${porta:=4200}" =~ ^[0-9]+$ ]] || {
  echo "erro: WEB_PORT no .env precisa ser um número" >&2
  exit 1
}
sudo test -f "$SITE" || {
  echo "erro: $SITE não existe" >&2
  exit 1
}

tmp=$(mktemp)
copia=$(mktemp)
trap 'rm -f "$tmp" "$copia"' EXIT
sed -e "s#/emptyvariable#$caminho#g" -e "s#127\.0\.0\.1:4200#127.0.0.1:$porta#" deploy/nginx/emptyvariable.conf > "$tmp"
sudo cat "$SITE" > "$copia"
tinha_snippet=0
if sudo test -f "$SNIPPET"; then
  tinha_snippet=1
  sudo cp "$SNIPPET" "$SNIPPET.anterior"
fi

desfazer() {
  echo "erro: o nginx recusou a configuração; desfazendo" >&2
  sudo cp "$copia" "$SITE"
  if [ "$tinha_snippet" = 1 ]; then sudo mv "$SNIPPET.anterior" "$SNIPPET"; else sudo rm -f "$SNIPPET"; fi
  exit 1
}

sudo install -m 644 "$tmp" "$SNIPPET"
if ! sudo grep -qF "$INCLUDE" "$SITE"; then
  # Depois do primeiro server_name: é o bloco 443 nos sites que o certbot ajustou.
  sudo sed -i "0,/^\(\s*\)server_name .*;/s||&\n\1$INCLUDE|" "$SITE"
fi
sudo nginx -t || desfazer
sudo systemctl reload nginx
sudo rm -f "$SNIPPET.anterior"
echo "Sub-rota $caminho publicada em $SITE (→ 127.0.0.1:$porta)"
