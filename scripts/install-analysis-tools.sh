#!/bin/sh
# Installs the pinned analysis tools of the Dockerfile's runner stage, for a
# scan outside the checker image (the static site workflow). Run as root on
# Debian bookworm, as in node:20-bookworm-slim. Keep the versions and checksums
# equal to the Dockerfile.
set -eu
TOOLS_DIR="${HYDRA_GATE_TOOLS_DIR:-/opt/analysis-tools}"
PDEPEND_SHA256=6b562a6ad2706c018c1673f389e77d683a55744c6b9654a737bacc9d2ddca6df
GITLEAKS_VERSION=8.30.1
SIMIAN_SHA256=b93b79c527476812b975b3dc322a967b6c47eab7c8bae5a9e2c56afdd562b423

mkdir -p /usr/share/man/man1
apt-get update
apt-get install -y --no-install-recommends git ca-certificates python3 python3-pip curl openjdk-17-jre-headless php-cli php-xml
rm -rf /var/lib/apt/lists/*

pip3 install --no-cache-dir --break-system-packages lizard==1.24.3 grimp==3.18 import-linter==2.15
npm install --silent --no-audit --no-fund --ignore-scripts --prefix "$TOOLS_DIR/jscpd-4.0.5" jscpd@4.0.5
npm install --silent --no-audit --no-fund --ignore-scripts --prefix "$TOOLS_DIR/jscpd-5.4.2" jscpd@5.4.2
npm install --silent --no-audit --no-fund --ignore-scripts --prefix "$TOOLS_DIR/dependency-cruiser-17.4.3" \
  dependency-cruiser@17.4.3 typescript@5.9.3 @vue/compiler-sfc@3.5.44

mkdir -p "$TOOLS_DIR/pdepend-3.0.0"
curl -fsSL -o "$TOOLS_DIR/pdepend-3.0.0/pdepend.phar" https://github.com/pdepend/pdepend/releases/download/3.0.0/pdepend.phar
echo "${PDEPEND_SHA256}  $TOOLS_DIR/pdepend-3.0.0/pdepend.phar" | sha256sum -c -

mkdir -p "$TOOLS_DIR/simian-4.2.1"
curl -fsSL -o "$TOOLS_DIR/simian-4.2.1/simian-4.2.1.jar" \
  https://github.com/quandarypeak/simian/releases/download/v4.2.1/simian-4.2.1.jar
echo "${SIMIAN_SHA256}  $TOOLS_DIR/simian-4.2.1/simian-4.2.1.jar" | sha256sum -c -

work=$(mktemp -d)
case "$(dpkg --print-architecture)" in
  amd64) gl_arch=x64; scc_asset=scc_Linux_x86_64.tar.gz; scc_sum=c7328436d3027f4357d3d7853f7dc3ac2bbcb4ca08f1adad91a27c593884079b ;;
  arm64) gl_arch=arm64; scc_asset=scc_Linux_arm64.tar.gz; scc_sum=6e0d2a1f8d3540ba7df185477dec40bb7340f1b214bfd303147de5cad2bd7b8b ;;
  *) echo "unsupported architecture for gitleaks and scc" >&2; exit 1 ;;
esac

gl_tarball="gitleaks_${GITLEAKS_VERSION}_linux_${gl_arch}.tar.gz"
gl_sums="gitleaks_${GITLEAKS_VERSION}_checksums.txt"
gl_base="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"
curl -fsSL -o "$work/$gl_tarball" "$gl_base/$gl_tarball"
curl -fsSL -o "$work/$gl_sums" "$gl_base/$gl_sums"
(cd "$work" && grep " ${gl_tarball}\$" "$gl_sums" | sha256sum -c -)
tar -xzf "$work/$gl_tarball" --no-same-owner -C /usr/local/bin gitleaks
gitleaks version

curl -fsSL -o "$work/scc.tar.gz" "https://github.com/boyter/scc/releases/download/v4.1.0/${scc_asset}"
echo "${scc_sum}  $work/scc.tar.gz" | sha256sum -c -
tar -xzf "$work/scc.tar.gz" -C /usr/local/bin scc
scc --version

rm -rf "$work"
