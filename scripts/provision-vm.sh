#!/usr/bin/env bash
# One-time provisioning for a fresh Rocky Linux 10.x VM hosting the Nexus Portal.
#
# Run on the VM (as a sudo-capable user) before the first ../deploy.sh:
#   curl -fsSL https://raw.example/.../provision-vm.sh | bash
# or
#   scp this script to the VM and: sudo bash provision-vm.sh
#
# Idempotent: re-running is safe but does nothing if everything is already installed.

set -euo pipefail

DOMAIN="${NEXUS_DOMAIN:-nexus.devportal.cybershuttle.org}"
APP_USER="${NEXUS_APP_USER:-exouser}"
APP_DIR="${NEXUS_APP_DIR:-/opt/nexus-portal}"
LE_EMAIL="${NEXUS_LE_EMAIL:-lahirujayathilake@gmail.com}"

echo "==> Install base packages"
sudo dnf install -y curl ca-certificates rsync git tar

echo "==> Install Node.js 22 (NodeSource)"
if ! command -v node >/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
  sudo dnf install -y nodejs
fi

echo "==> Install pnpm"
if ! command -v pnpm >/dev/null; then
  sudo npm install -g pnpm
fi

echo "==> Install nginx + certbot"
sudo dnf install -y nginx certbot python3-certbot-nginx

echo "==> Firewall: open http + https"
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

echo "==> SELinux: allow nginx to reverse-proxy to localhost"
sudo setsebool -P httpd_can_network_connect 1

echo "==> App dir ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> systemd unit /etc/systemd/system/nexus-portal.service"
sudo tee /etc/systemd/system/nexus-portal.service > /dev/null <<UNIT
[Unit]
Description=Nexus Portal (Next.js)
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload

echo "==> nginx site /etc/nginx/conf.d/nexus-portal.conf"
sudo tee /etc/nginx/conf.d/nexus-portal.conf > /dev/null <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }
}
NGX
sudo nginx -t
sudo systemctl enable --now nginx

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "==> Generate ${APP_DIR}/.env"
  SECRET=$(openssl rand -base64 32)
  # OIDC vars are emitted as commented placeholders. To switch the VM to real
  # Keycloak/CILogon sign-in: flip PORTAL_AUTH_MODE + NEXT_PUBLIC_PORTAL_AUTH_MODE
  # to 'oidc', uncomment + fill the four OIDC_*/NEXUS_ALLOWED_EMAILS lines, then
  # `sudo systemctl restart nexus-portal`. Server boot will fail-fast if any
  # required OIDC var is missing.
  sudo -u "${APP_USER}" tee "${APP_DIR}/.env" > /dev/null <<ENV
PORT=3000
HOSTNAME=127.0.0.1
PORTAL_AUTH_MODE=dev   # set to 'oidc' to require Keycloak/CILogon sign-in
NEXT_PUBLIC_PORTAL_AUTH_MODE=dev   # mirrors the above; must match
NEXT_PUBLIC_PORTAL_USE_MSW=true
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${SECRET}
NODE_ENV=production
# OIDC_ISSUER_URL=https://auth.dev.cybershuttle.org/realms/default
# OIDC_CLIENT_ID=
# OIDC_CLIENT_SECRET=
# NEXUS_ALLOWED_EMAILS=
# Feedback widget — required in production. Fine-grained PAT scoped to
# FEEDBACK_GITHUB_REPO with issues:write + contents:write. Server boot will
# fail-fast if NODE_ENV=production and FEEDBACK_GITHUB_TOKEN is missing.
# FEEDBACK_GITHUB_TOKEN=
# FEEDBACK_GITHUB_REPO=lahirujayathilake/nexus-portal
# FEEDBACK_LABEL=suggestion
# Optional: keep screenshot commits off main by routing them to a dedicated
# pre-existing branch (must be created on the remote first). Recommended.
# FEEDBACK_IMAGES_BRANCH=feedback-images
# GitHub OAuth — when both vars are set, "Continue with GitHub" appears on
# the sign-in page so suggestions are attributed to the submitter rather than
# the bot. Register the OAuth app at https://github.com/settings/developers
# with callback URL https://${DOMAIN}/api/auth/callback/github.
# GITHUB_OAUTH_CLIENT_ID=
# GITHUB_OAUTH_CLIENT_SECRET=
ENV
  sudo chmod 600 "${APP_DIR}/.env"
fi

echo "==> Issue/renew TLS cert via certbot (--nginx)"
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${LE_EMAIL}" --redirect --keep-until-expiring

echo "==> Renewal deploy-hook (reload nginx after renew)"
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<HK
#!/usr/bin/env bash
set -euo pipefail
systemctl reload nginx
HK
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo "==> Done. Now sync the source from your dev box and run scripts/server-deploy.sh."
