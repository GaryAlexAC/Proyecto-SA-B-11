FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /workspace
COPY . .
RUN npm ci --workspace=apps/notification-service --include-workspace-root
RUN npx prisma generate --schema=apps/notification-service/prisma/schema.prisma
RUN npm run build --workspace=apps/notification-service

WORKDIR /workspace/apps/notification-service
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --skip-generate && npm run start:prod"]
