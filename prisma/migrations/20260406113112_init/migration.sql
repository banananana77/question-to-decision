-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastRequestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "inputHash" TEXT,
    "resultType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usage_fingerprint_key" ON "Usage"("fingerprint");

-- CreateIndex
CREATE INDEX "Usage_fingerprint_idx" ON "Usage"("fingerprint");

-- CreateIndex
CREATE INDEX "Usage_lastRequestAt_idx" ON "Usage"("lastRequestAt");

-- CreateIndex
CREATE INDEX "AuditLog_fingerprint_idx" ON "AuditLog"("fingerprint");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
