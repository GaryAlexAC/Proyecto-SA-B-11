FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /workspace
COPY . .
RUN npm ci --workspace=apps/account-service --include-workspace-root
RUN npx prisma generate --schema=apps/account-service/prisma/schema.prisma
RUN npm run build --workspace=apps/account-service

WORKDIR /workspace/apps/account-service
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --skip-generate && npm run start:prod"]
