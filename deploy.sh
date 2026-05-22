#!/usr/bin/env bash
# Deploy the Nexus Portal to nexus.devportal.cybershuttle.org.
#
# Usage:
#   ./deploy.sh                                       # default host/dir
#   NEXUS_DEPLOY_HOST=user@host ./deploy.sh           # override host
#   NEXUS_DEPLOY_DIR=/opt/foo  ./deploy.sh            # override target dir
#
# What it does:
#   1. rsyncs the local source tree to the VM (excludes node_modules, .next, .env, .git)
#   2. SSHes to the VM and runs scripts/server-deploy.sh which installs deps, builds, restarts the service
#
# Initial VM provisioning is handled separately by scripts/provision-vm.sh.
# This script assumes the VM already has Node 22, pnpm, nginx, certbot, the systemd unit,
# and a TLS-enabled nginx site for the domain.

set -euo pipefail

HOST="${NEXUS_DEPLOY_HOST:-exouser@149.165.173.110}"
REMOTE_DIR="${NEXUS_DEPLOY_DIR:-/opt/nexus-portal}"

cd "$(dirname "$0")"

echo "==> Rsync source to ${HOST}:${REMOTE_DIR}"
rsync -avz --delete \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=.env \
  --exclude=.env.local \
  --exclude=playwright-report \
  --exclude=test-results \
  --exclude=coverage \
  --exclude=.DS_Store \
  ./ "${HOST}:${REMOTE_DIR}/"

echo "==> Run server-side deploy on ${HOST}"
ssh "${HOST}" "cd ${REMOTE_DIR} && bash scripts/server-deploy.sh"

echo
echo "Done. Live at https://nexus.devportal.cybershuttle.org"
