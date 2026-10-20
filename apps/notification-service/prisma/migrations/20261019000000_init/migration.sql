-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "producer" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "severity" "EventSeverity" NOT NULL DEFAULT 'INFO',
    "traceId" TEXT,
    "spanId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditLog_eventId_key" ON "AuditLog"("eventId");
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");
CREATE INDEX "AuditLog_traceId_idx" ON "AuditLog"("traceId");
CREATE INDEX "AuditLog_producer_severity_idx" ON "AuditLog"("producer", "severity");
