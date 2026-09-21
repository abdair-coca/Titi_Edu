CREATE TYPE "ProveedorIa" AS ENUM ('GROQ');
CREATE TYPE "EstadoCredencialIa" AS ENUM ('VALID', 'INVALID');
CREATE TYPE "RagQuotaScope" AS ENUM ('CHAT_MINUTE', 'CHAT_DAY', 'CREDENTIAL_VALIDATE');
CREATE TYPE "RagIndexJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "CredencialIa" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "proveedor" "ProveedorIa" NOT NULL DEFAULT 'GROQ',
  "ciphertext" BYTEA NOT NULL, "iv" BYTEA NOT NULL, "authTag" BYTEA NOT NULL,
  "keyVersion" TEXT NOT NULL, "last4" TEXT NOT NULL,
  "status" "EstadoCredencialIa" NOT NULL DEFAULT 'VALID',
  "validatedAt" TIMESTAMP(3) NOT NULL, "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CredencialIa_usuarioId_proveedor_key" ON "CredencialIa"("usuarioId", "proveedor");

CREATE TABLE "RagQuotaWindow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "scope" "RagQuotaScope" NOT NULL, "bucketStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "RagQuotaWindow_usuarioId_scope_bucketStart_key" ON "RagQuotaWindow"("usuarioId", "scope", "bucketStart");
CREATE INDEX "RagQuotaWindow_bucketStart_idx" ON "RagQuotaWindow"("bucketStart");

CREATE TABLE "RagIndexJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leccionId" TEXT NOT NULL REFERENCES "Leccion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" "RagIndexJobStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3), "lockedAt" TIMESTAMP(3), "lockToken" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "attempts" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT
);
CREATE UNIQUE INDEX "RagIndexJob_leccionId_key" ON "RagIndexJob"("leccionId");
CREATE INDEX "RagIndexJob_status_nextAttemptAt_idx" ON "RagIndexJob"("status", "nextAttemptAt");
