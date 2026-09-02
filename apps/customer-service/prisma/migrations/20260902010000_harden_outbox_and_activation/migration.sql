ALTER TABLE "OutboxEvent" ADD COLUMN "failedAt" TIMESTAMP(3);

DROP INDEX "OutboxEvent_publishedAt_nextAttemptAt_idx";
CREATE INDEX "OutboxEvent_publishedAt_failedAt_nextAttemptAt_idx" ON "OutboxEvent"("publishedAt", "failedAt", "nextAttemptAt");

UPDATE "Customer"
SET "activationTokenHash" = NULL, "activationTokenExpiresAt" = NULL
WHERE "role" = 'CLIENT' AND "status" = 'INACTIVE' AND "activationTokenHash" IS NOT NULL;
