#!/bin/sh
# Installs the pinned analysis tools of the Dockerfile's runner stage, for a
# scan outside the checker image (the static site workflow). Run as root on
# Debian bookworm, as in node:20-bookworm-slim. Keep the versions equal to
# the Dockerfile.
set -eu
TOOLS_DIR="${HYDRA_GATE_TOOLS_DIR:-/opt/analysis-tools}"
apt-get update
apt-get install -y --no-install-recommends git ca-certificates python3 python3-pip
rm -rf /var/lib/apt/lists/*
pip3 install --no-cache-dir --break-system-packages lizard==1.24.3
npm install --silent --no-audit --no-fund --ignore-scripts --prefix "$TOOLS_DIR/jscpd-4.0.5" jscpd@4.0.5
