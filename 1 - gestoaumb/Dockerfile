# ==============================================================================
# Dockerfile - Painel de Gestão UMB (Frontend React + Backend Express)
# Desenvolvido para: EMBASA - Unidade Metropolitana de Salvador / Buraquinho
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY backend ./backend
COPY tsconfig*.json ./
COPY database.sqlite* ./

EXPOSE 3001

CMD ["npx", "tsx", "backend/server.ts"]
