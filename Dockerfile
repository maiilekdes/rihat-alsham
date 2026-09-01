# Builds the API out of the npm-workspaces monorepo. Railway/Render build from
# the repo root so the workspace links (@rihasham/shared) resolve.
FROM node:20-alpine AS build
WORKDIR /app

# Manifests first, so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY apps/mobile/package.json apps/mobile/
COPY apps/admin/package.json apps/admin/

# --ignore-scripts skips the root postinstall, which builds shared before its
# source has been copied in. We build it explicitly below instead.
RUN npm ci --ignore-scripts --workspace=@rihasham/shared --workspace=@rihasham/api --include-workspace-root

COPY packages/shared packages/shared
COPY packages/api packages/api
RUN npm run build --workspace=@rihasham/shared \
 && npm run build --workspace=@rihasham/api

# Drop dev dependencies from the shipped image.
RUN npm prune --omit=dev --workspace=@rihasham/shared --workspace=@rihasham/api --include-workspace-root

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/api/package.json packages/api/package.json
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/scripts packages/api/scripts
COPY db db

# Railway/Render inject PORT; server.ts already honours it.
EXPOSE 4000
CMD ["node", "packages/api/dist/server.js"]
