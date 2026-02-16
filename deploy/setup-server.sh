#!/bin/bash
# Setup Hetzner server: Docker, UFW, Git
set -e

echo "[1/4] Updating packages..."
apt-get update -qq
apt-get upgrade -y -qq

echo "[2/4] Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "[3/4] Installing Git..."
apt-get install -y -qq git

echo "[4/4] Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo "Setup complete! Docker, Git, and UFW are ready."
