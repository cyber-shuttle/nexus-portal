#!/usr/bin/env bash
# Server-side deploy for the Nexus Portal.
#
# Invoked by ../deploy.sh on the target VM after a fresh rsync.
# Safe to re-run; every step is idempotent.
#
# Assumes the host has already been provisioned (Node 22, pnpm, nginx, certbot,
# nexus-portal.service systemd unit, nginx site, TLS cert). See provision-vm.sh
# for the one-time bootstrap.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

echo "==> pnpm build"
pnpm build

echo "==> Restart nexus-portal service"
sudo systemctl restart nexus-portal

echo "==> Wait for app to answer on :3000"
for i in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:3000/sign-in > /dev/null; then
    echo "    ready after ${i}s"
    break
  fi
  if [ "$i" = 30 ]; then
    echo "    timed out waiting for app; recent logs:" >&2
    sudo journalctl -u nexus-portal -n 40 --no-pager >&2 || true
    exit 1
  fi
  sleep 1
done

echo "==> nginx -t + reload"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Deploy complete"
