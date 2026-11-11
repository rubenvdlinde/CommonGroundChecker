FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# gitleaks for the secret scanning check, pinned and verified against the release checksums.
ARG GITLEAKS_VERSION=8.30.1
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    case "$(dpkg --print-architecture)" in \
      amd64) gl_arch=x64 ;; \
      arm64) gl_arch=arm64 ;; \
      *) echo "unsupported architecture for gitleaks" >&2; exit 1 ;; \
    esac; \
    gl_tarball="gitleaks_${GITLEAKS_VERSION}_linux_${gl_arch}.tar.gz"; \
    gl_base="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"; \
    cd /tmp; \
    curl -fsSLO "${gl_base}/${gl_tarball}"; \
    curl -fsSLO "${gl_base}/gitleaks_${GITLEAKS_VERSION}_checksums.txt"; \
    grep " ${gl_tarball}\$" "gitleaks_${GITLEAKS_VERSION}_checksums.txt" | sha256sum -c -; \
    tar -xzf "${gl_tarball}" --no-same-owner -C /usr/local/bin gitleaks; \
    rm -f "${gl_tarball}" "gitleaks_${GITLEAKS_VERSION}_checksums.txt"; \
    apt-get purge -y --auto-remove curl; \
    rm -rf /var/lib/apt/lists/*; \
    gitleaks version

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
CMD ["npm", "run", "start"]
