-- AlterTable
ALTER TABLE "organizations" RENAME CONSTRAINT "companies_pkey" TO "organizations_pkey";

-- RenameForeignKey
ALTER TABLE "assets" RENAME CONSTRAINT "assets_companyId_fkey" TO "assets_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "audit_logs" RENAME CONSTRAINT "audit_logs_companyId_fkey" TO "audit_logs_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "bank_accounts" RENAME CONSTRAINT "bank_accounts_companyId_fkey" TO "bank_accounts_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "bookings" RENAME CONSTRAINT "bookings_companyId_fkey" TO "bookings_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "budgets" RENAME CONSTRAINT "budgets_companyId_fkey" TO "budgets_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "customers" RENAME CONSTRAINT "customers_companyId_fkey" TO "customers_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "deposits" RENAME CONSTRAINT "deposits_companyId_fkey" TO "deposits_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "documents" RENAME CONSTRAINT "documents_companyId_fkey" TO "documents_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "expense_categories" RENAME CONSTRAINT "expense_categories_companyId_fkey" TO "expense_categories_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "expenses" RENAME CONSTRAINT "expenses_companyId_fkey" TO "expenses_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "income" RENAME CONSTRAINT "income_companyId_fkey" TO "income_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "income_categories" RENAME CONSTRAINT "income_categories_companyId_fkey" TO "income_categories_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "invitations" RENAME CONSTRAINT "invitations_companyId_fkey" TO "invitations_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "invoices" RENAME CONSTRAINT "invoices_companyId_fkey" TO "invoices_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "notifications" RENAME CONSTRAINT "notifications_companyId_fkey" TO "notifications_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "organizations" RENAME CONSTRAINT "companies_tenantId_fkey" TO "organizations_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "payments" RENAME CONSTRAINT "payments_companyId_fkey" TO "payments_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "payouts" RENAME CONSTRAINT "payouts_companyId_fkey" TO "payouts_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "properties" RENAME CONSTRAINT "properties_companyId_fkey" TO "properties_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "recurring_expenses" RENAME CONSTRAINT "recurring_expenses_companyId_fkey" TO "recurring_expenses_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "refunds" RENAME CONSTRAINT "refunds_companyId_fkey" TO "refunds_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "supplier_bills" RENAME CONSTRAINT "supplier_bills_companyId_fkey" TO "supplier_bills_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "suppliers" RENAME CONSTRAINT "suppliers_companyId_fkey" TO "suppliers_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "tax_settings" RENAME CONSTRAINT "tax_settings_companyId_fkey" TO "tax_settings_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "vat_rates" RENAME CONSTRAINT "vat_rates_companyId_fkey" TO "vat_rates_organizationId_fkey";

-- RenameIndex
ALTER INDEX "assets_tenantId_companyId_idx" RENAME TO "assets_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "audit_logs_tenantId_companyId_createdAt_idx" RENAME TO "audit_logs_tenantId_organizationId_createdAt_idx";

-- RenameIndex
ALTER INDEX "bank_accounts_tenantId_companyId_idx" RENAME TO "bank_accounts_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "bank_transactions_tenantId_companyId_occurredOn_idx" RENAME TO "bank_transactions_tenantId_organizationId_occurredOn_idx";

-- RenameIndex
ALTER INDEX "bookings_companyId_platform_externalBookingId_key" RENAME TO "bookings_organizationId_platform_externalBookingId_key";

-- RenameIndex
ALTER INDEX "bookings_companyId_reference_key" RENAME TO "bookings_organizationId_reference_key";

-- RenameIndex
ALTER INDEX "bookings_tenantId_companyId_idx" RENAME TO "bookings_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "budgets_tenantId_companyId_propertyId_idx" RENAME TO "budgets_tenantId_organizationId_propertyId_idx";

-- RenameIndex
ALTER INDEX "customers_tenantId_companyId_idx" RENAME TO "customers_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "deposits_tenantId_companyId_idx" RENAME TO "deposits_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "documents_tenantId_companyId_idx" RENAME TO "documents_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "expense_categories_companyId_code_key" RENAME TO "expense_categories_organizationId_code_key";

-- RenameIndex
ALTER INDEX "expense_categories_tenantId_companyId_idx" RENAME TO "expense_categories_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "expenses_companyId_reference_key" RENAME TO "expenses_organizationId_reference_key";

-- RenameIndex
ALTER INDEX "expenses_tenantId_companyId_transactionDate_idx" RENAME TO "expenses_tenantId_organizationId_transactionDate_idx";

-- RenameIndex
ALTER INDEX "income_tenantId_companyId_serviceDate_idx" RENAME TO "income_tenantId_organizationId_serviceDate_idx";

-- RenameIndex
ALTER INDEX "income_categories_companyId_code_key" RENAME TO "income_categories_organizationId_code_key";

-- RenameIndex
ALTER INDEX "income_categories_tenantId_companyId_idx" RENAME TO "income_categories_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "invitations_tenantId_companyId_email_idx" RENAME TO "invitations_tenantId_organizationId_email_idx";

-- RenameIndex
ALTER INDEX "invoices_companyId_number_key" RENAME TO "invoices_organizationId_number_key";

-- RenameIndex
ALTER INDEX "invoices_tenantId_companyId_idx" RENAME TO "invoices_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "notifications_tenantId_companyId_idx" RENAME TO "notifications_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "companies_tenantId_idx" RENAME TO "organizations_tenantId_idx";

-- RenameIndex
ALTER INDEX "payments_tenantId_companyId_idx" RENAME TO "payments_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "payouts_companyId_reference_key" RENAME TO "payouts_organizationId_reference_key";

-- RenameIndex
ALTER INDEX "payouts_tenantId_companyId_idx" RENAME TO "payouts_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "properties_tenantId_companyId_idx" RENAME TO "properties_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "property_contracts_tenantId_companyId_idx" RENAME TO "property_contracts_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "recurring_expenses_tenantId_companyId_idx" RENAME TO "recurring_expenses_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "refunds_tenantId_companyId_idx" RENAME TO "refunds_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "supplier_bills_companyId_number_key" RENAME TO "supplier_bills_organizationId_number_key";

-- RenameIndex
ALTER INDEX "supplier_bills_tenantId_companyId_idx" RENAME TO "supplier_bills_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "suppliers_tenantId_companyId_idx" RENAME TO "suppliers_tenantId_organizationId_idx";

-- RenameIndex
ALTER INDEX "tax_settings_tenantId_companyId_effectiveFrom_idx" RENAME TO "tax_settings_tenantId_organizationId_effectiveFrom_idx";

-- RenameIndex
ALTER INDEX "vat_rates_tenantId_companyId_idx" RENAME TO "vat_rates_tenantId_organizationId_idx";

