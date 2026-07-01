FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/finops-sdk/package.json packages/finops-sdk/
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY packages/finops-sdk packages/finops-sdk
RUN pnpm --filter sdk build && pnpm --filter web build

FROM nginx:alpine
COPY apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
