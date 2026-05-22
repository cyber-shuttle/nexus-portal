# Deploy scripts

## First-time setup (fresh VM)

```
scp scripts/provision-vm.sh exouser@<vm>:~
ssh exouser@<vm> 'bash provision-vm.sh'
./deploy.sh
```

`provision-vm.sh` installs Node 22, pnpm, nginx, certbot, opens the firewall, sets the SELinux boolean for the reverse proxy, writes the systemd unit + nginx site, generates `/opt/nexus-portal/.env` with a fresh `NEXTAUTH_SECRET`, and obtains the TLS cert. Idempotent.

## Repeated deploys (after code changes)

From the repo root on your dev machine:

```
./deploy.sh
```

That:
1. rsyncs the source to the VM (excludes `node_modules`, `.next`, `.git`, `.env`)
2. runs `scripts/server-deploy.sh` on the VM, which `pnpm install --frozen-lockfile`s, builds, restarts the systemd service, then reloads nginx

Override host or path:

```
NEXUS_DEPLOY_HOST=user@host NEXUS_DEPLOY_DIR=/srv/portal ./deploy.sh
```

## What lives where

- Local repo: `deploy.sh`, `scripts/server-deploy.sh`, `scripts/provision-vm.sh`.
- On the VM:
  - `/opt/nexus-portal/` — synced source + `.env` + built `.next/`
  - `/etc/systemd/system/nexus-portal.service`
  - `/etc/nginx/conf.d/nexus-portal.conf` (auto-edited by certbot to add HTTPS + redirect)
  - `/etc/letsencrypt/live/<domain>/` — certs
  - `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` — reload after each renewal

## Useful one-liners

Tail app logs:
```
ssh exouser@149.165.173.110 'sudo journalctl -u nexus-portal -f'
```

Force a TLS renewal dry-run:
```
ssh exouser@149.165.173.110 'sudo certbot renew --dry-run'
```

Restart just the app (without redeploying):
```
ssh exouser@149.165.173.110 'sudo systemctl restart nexus-portal'
```
