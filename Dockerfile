# ---------- base: Node + pnpm (version pinned by "packageManager" in package.json) ----------
# Debian slim, not Alpine: avoids Prisma engine and OpenSSL problems.
FROM node:20-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

# ---------- deps: every dependency (cached until a manifest or the lockfile changes) ----------
FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- build: Prisma client, React app, server ----------
FROM deps AS build
COPY . .
RUN pnpm --filter server exec prisma generate
RUN pnpm --filter web build
# No source maps in the image.
RUN pnpm --filter server exec tsc -p tsconfig.build.json --sourceMap false

# ---------- tools: full toolchain for the one-off migrate/seed job ----------
FROM build AS tools
WORKDIR /app

# ---------- prod-deps: the server's runtime dependencies only ----------
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter server

# ---------- runtime: small final image, no compilers, CLIs or dev dependencies ----------
# The app reaches Postgres through the `pg` driver adapter, so no Prisma engine or OpenSSL is needed here.
FROM node:20-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
# Owned by root and only readable by the app user, so the app cannot modify its own code.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
WORKDIR /app/apps/server
EXPOSE 3000
# Node's fetch: the slim image has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/start.js"]
