CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "Customer"
ADD COLUMN "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING';

CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedEvent_eventId_key"
ON "ProcessedEvent"("eventId");
