ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ORGANIZATION_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OPERATIONS';

ALTER TABLE "companies" RENAME TO "organizations";

ALTER TABLE "organizations" ADD COLUMN "slug" TEXT;
ALTER TABLE "organizations" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'GB';
ALTER TABLE "organizations" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/London';
ALTER TABLE "organizations" ADD COLUMN "website" TEXT;
ALTER TABLE "organizations" ADD COLUMN "logoUrl" TEXT;

UPDATE "organizations"
SET "slug" = 'mira-properties', "logoUrl" = '/brand/mira-logo.png'
WHERE "tradingName" = 'Mira Properties';

UPDATE "organizations"
SET "slug" = replace("id", '-', '')
WHERE "slug" IS NULL;

ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'users',
    'invitations',
    'properties',
    'property_contracts',
    'customers',
    'suppliers',
    'income_categories',
    'expense_categories',
    'bookings',
    'income',
    'expenses',
    'invoices',
    'supplier_bills',
    'payments',
    'bank_accounts',
    'bank_transactions',
    'payouts',
    'refunds',
    'deposits',
    'documents',
    'recurring_expenses',
    'tax_settings',
    'vat_rates',
    'budgets',
    'notifications',
    'audit_logs',
    'assets'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I RENAME COLUMN "companyId" TO "organizationId"', tenant_table);
  END LOOP;
END $$;

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedById" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

INSERT INTO "organization_memberships" (
    "id",
    "organizationId",
    "userId",
    "role",
    "status",
    "joinedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "organizationId",
    "id",
    "role",
    'ACTIVE',
    "createdAt",
    "createdAt",
    "updatedAt"
FROM "users";

CREATE UNIQUE INDEX "organization_memberships_organizationId_userId_key"
ON "organization_memberships"("organizationId", "userId");

CREATE INDEX "organization_memberships_userId_idx"
ON "organization_memberships"("userId");

ALTER TABLE "organization_memberships"
ADD CONSTRAINT "organization_memberships_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_memberships"
ADD CONSTRAINT "organization_memberships_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" DROP CONSTRAINT "users_companyId_fkey";
DROP INDEX "users_tenantId_companyId_idx";
ALTER TABLE "users" DROP COLUMN "tenantId";
ALTER TABLE "users" DROP COLUMN "organizationId";
ALTER TABLE "users" DROP COLUMN "role";
