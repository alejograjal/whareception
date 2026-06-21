-- AlterTable: per-tenant default language for bot replies and summaries.
ALTER TABLE "Tenant" ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'es';
