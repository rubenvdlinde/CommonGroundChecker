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
# Pinned analysis tools for the complexity and maintainability checks; installing at runtime is disabled.
ENV HYDRA_GATE_TOOLS_DIR=/opt/analysis-tools
ENV HYDRA_GATE_SIG_NO_INSTALL=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates python3 python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --no-cache-dir --break-system-packages lizard==1.24.3 \
  && npm install --silent --no-audit --no-fund --ignore-scripts --prefix /opt/analysis-tools/jscpd-4.0.5 jscpd@4.0.5

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/scripts/maintainability ./scripts/maintainability
COPY --from=builder /app/scripts/open-source-health ./scripts/open-source-health

EXPOSE 3000
CMD ["npm", "run", "start"]
