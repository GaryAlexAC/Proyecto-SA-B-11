FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /workspace
COPY . .
RUN npm ci --workspace=apps/notification-service --include-workspace-root
RUN npm run build --workspace=packages/observability
RUN npx prisma generate --schema=apps/notification-service/prisma/schema.prisma
RUN npm run build --workspace=apps/notification-service

WORKDIR /workspace/apps/notification-service
CMD ["sh", "-c", "npm run prisma:deploy && npm run start:prod"]
