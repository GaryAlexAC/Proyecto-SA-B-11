FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /workspace
COPY . .
RUN npm ci --workspace=apps/customer-service --include-workspace-root
RUN npx prisma generate --schema=apps/customer-service/prisma/schema.prisma
RUN npm run build --workspace=apps/customer-service

WORKDIR /workspace/apps/customer-service
EXPOSE 3001
CMD ["sh", "-c", "npm run prisma:deploy && npm run prisma:seed && npm run start:prod"]
