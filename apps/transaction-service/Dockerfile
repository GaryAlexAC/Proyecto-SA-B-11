FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /workspace
COPY . .
RUN npm ci --workspace=apps/transaction-service --include-workspace-root
RUN npm run build --workspace=packages/observability
RUN npx prisma generate --schema=apps/transaction-service/prisma/schema.prisma
RUN npm run build --workspace=apps/transaction-service

WORKDIR /workspace/apps/transaction-service
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --skip-generate && npm run start:prod"]
