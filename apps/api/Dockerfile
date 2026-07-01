FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/finops-sdk/package.json packages/finops-sdk/

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages/finops-sdk packages/finops-sdk
RUN pnpm --filter api build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/finops-sdk/package.json packages/finops-sdk/
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json

ENV PORT=8000
EXPOSE 8000
CMD ["node", "apps/api/dist/app.js"]
