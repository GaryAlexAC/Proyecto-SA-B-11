-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING_KYC', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'COMPENSATING');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "initiatorRole" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "operation" TEXT NOT NULL DEFAULT 'TRANSFER',
    "requestHash" TEXT NOT NULL DEFAULT '',
    "sourceAccountId" TEXT NOT NULL,
    "targetAccountId" TEXT,
    "companyId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "producer" TEXT NOT NULL DEFAULT 'transaction-service',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_correlationId_key" ON "Transaction"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_key" ON "ProcessedEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_failedAt_nextAttemptAt_idx" ON "OutboxEvent"("publishedAt", "failedAt", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "ProcessedEvent" ADD CONSTRAINT "ProcessedEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;