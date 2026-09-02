CREATE TYPE "CustomerRole" AS ENUM ('ADMIN', 'CASHIER', 'CLIENT');
CREATE TYPE "CustomerStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'BLOCKED');

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "fullName" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "birthDate" DATE NOT NULL,
  "address" TEXT NOT NULL,
  "identityPhotoData" BYTEA,
  "identityPhotoMimeType" TEXT,
  "identityPhotoChecksum" TEXT,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "CustomerRole" NOT NULL DEFAULT 'CLIENT',
  "status" "CustomerStatus" NOT NULL DEFAULT 'INACTIVE',
  "activationTokenHash" TEXT,
  "activationTokenExpiresAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Customer_document_key" ON "Customer"("document");
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE UNIQUE INDEX "Customer_username_key" ON "Customer"("username");
CREATE UNIQUE INDEX "Customer_activationTokenHash_key" ON "Customer"("activationTokenHash");

CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutboxEvent_publishedAt_nextAttemptAt_idx" ON "OutboxEvent"("publishedAt", "nextAttemptAt");

CREATE TABLE "IdempotencyRecord" (
  "key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "customerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);
