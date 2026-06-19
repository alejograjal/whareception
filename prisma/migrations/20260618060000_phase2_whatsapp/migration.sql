-- AlterTable: Tenant gets the Meta phone number id used for inbound routing.
ALTER TABLE "Tenant" ADD COLUMN "whatsappPhoneNumberId" TEXT;

-- AlterTable: Message tracks the provider message id (wamid) for tracing/dedup.
ALTER TABLE "Message" ADD COLUMN "providerMessageId" TEXT;

-- Indexes
CREATE UNIQUE INDEX "Tenant_whatsappPhoneNumberId_key" ON "Tenant"("whatsappPhoneNumberId");
CREATE INDEX "Message_providerMessageId_idx" ON "Message"("providerMessageId");
