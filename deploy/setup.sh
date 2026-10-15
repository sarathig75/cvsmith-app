#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server (any provider) for CVSmith. Run from the cloned repo:
#   sudo ./deploy/setup.sh
# Safe to run again: it keeps an existing deploy/.env.prod and only (re)starts the services.
set -euo pipefail
cd "$(dirname "$0")"

if [ "$(id -u)" -ne 0 ]; then echo "Please run with sudo."; exit 1; fi

echo "== 1/4 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "== 2/4 Firewall: only SSH, HTTP and HTTPS"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

echo "== 3/4 Memory: 2 GB swap (helps while building and making PDFs)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 4/4 Settings (deploy/.env.prod)"
if [ ! -f .env.prod ]; then
  cp .env.prod.example .env.prod
  chmod 600 .env.prod
  ask() {  # ask KEY "question" [secret]
    local value
    if [ "${3:-}" = secret ]; then read -rsp "$2: " value; echo; else read -rp "$2: " value; fi
    # Replace the line KEY=... (values are written as given; avoid the | character).
    sed -i "s|^$1=.*|$1=${value}|" .env.prod
  }
  ask DOMAIN "Domain (e.g. cvsmith.in, no https://)"
  domain=$(grep '^DOMAIN=' .env.prod | cut -d= -f2-)
  sed -i "s|^EMAIL_FROM=.*|EMAIL_FROM=CVSmith <login@${domain}>|" .env.prod
  ask SMTP_PASSWORD "Resend API key (input hidden)" secret
  ask ANTHROPIC_API_KEY "Claude API key (input hidden)" secret
  ask GOOGLE_OAUTH_CLIENT_ID "Google OAuth client ID (Enter to skip)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env.prod
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env.prod
  echo "Saved deploy/.env.prod (readable by root only). Edit it later with: sudo nano deploy/.env.prod"
else
  echo "Keeping the existing deploy/.env.prod"
fi

mkdir -p backups
./dc up -d --build
./dc ps
domain=$(grep '^DOMAIN=' .env.prod | cut -d= -f2-)
cat <<MSG

CVSmith is starting. In a minute, open https://${domain}
(the HTTPS certificate is issued on the first visit; the domain's DNS must point here).

Invite pilot testers:
  sudo ./deploy/dc exec backend python -m app.cli invites add someone@example.com
MSG
