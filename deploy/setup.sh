#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# Bloomfield BCCC — Production Setup Script
# ═══════════════════════════════════════════════════
# Run on a fresh Ubuntu/Debian server:
#   chmod +x deploy/setup.sh && sudo ./deploy/setup.sh
# ═══════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/opt/bccc"
APP_USER="bccc"

echo "══════════════════════════════════════"
echo "  Bloomfield BCCC — Server Setup"
echo "══════════════════════════════════════"

# ── 1. System user ──
if ! id "$APP_USER" &>/dev/null; then
    echo "Creating system user: $APP_USER"
    useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" "$APP_USER"
fi

# ── 2. Install Python + Caddy ──
echo "Installing dependencies..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv caddy

# ── 3. Deploy code ──
echo "Setting up application directory..."
mkdir -p "$APP_DIR"
rsync -a --exclude '.git' --exclude '__pycache__' --exclude 'backend/bccc.db' \
    "$(dirname "$(dirname "$(realpath "$0")")")/" "$APP_DIR/"

# ── 4. Python venv ──
echo "Creating Python virtual environment..."
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt" 2>/dev/null || true

# ── 5. Environment file ──
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/deploy/.env.example" "$APP_DIR/.env"
    # Generate random token secret
    TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
    sed -i "s/CHANGE_ME_TO_A_STRONG_RANDOM_STRING_64_CHARS/$TOKEN/" "$APP_DIR/.env"
    echo ""
    echo "  *** IMPORTANT: Edit /opt/bccc/.env ***"
    echo "  Set BCCC_ADMIN_PASSWORD and BCCC_CORS_ORIGINS"
    echo ""
fi

# ── 6. Permissions ──
mkdir -p "$APP_DIR/assets/uploads"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── 7. Systemd services ──
echo "Installing systemd services..."
cp "$APP_DIR/deploy/bccc-api.service" /etc/systemd/system/
cp "$APP_DIR/deploy/bccc-agents.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable bccc-api bccc-agents

# ── 8. Caddy ──
echo "Installing Caddy config..."
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile

echo ""
echo "══════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit /opt/bccc/.env (set admin password, domain, Stripe keys)"
echo "  2. Edit /etc/caddy/Caddyfile (set your domain)"
echo "  3. sudo systemctl restart caddy"
echo "  4. sudo systemctl start bccc-api bccc-agents"
echo "  5. Visit https://your-domain.com/admin.html"
echo "══════════════════════════════════════"
