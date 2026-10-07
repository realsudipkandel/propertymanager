import { Prisma, type PrismaClient } from "@prisma/client";

import { CATALOG } from "@/domain/catalog";
import { slugFromName } from "@/domain/organization";
import type { UserRole } from "@/domain/constants";

type Writer = Prisma.TransactionClient | PrismaClient;

function pounds(pence: number): Prisma.Decimal {
  return new Prisma.Decimal(pence).div(100);
}

export async function uniqueSlug(client: Writer, name: string): Promise<string> {
  const base = slugFromName(name);
  const root = base.length >= 2 ? base : "organisation";
  const taken = await client.organization.findMany({
    where: { slug: { startsWith: root } },
    select: { slug: true },
  });
  const used = new Set(taken.map((row) => row.slug));
  if (!used.has(root)) {
    return root;
  }
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `${root}-${Date.now()}`;
}

export async function copyCatalog(client: Writer, scope: { tenantId: string; organizationId: string }): Promise<void> {
  const incomeIds = new Map<string, string>();
  const expenseIds = new Map<string, string>();
  for (const item of CATALOG.filter((entry) => entry.group === "INCOME" && !entry.parentCode)) {
    const row = await client.incomeCategory.create({ data: { ...scope, code: item.code, name: item.name } });
    incomeIds.set(item.code, row.id);
  }
  for (const item of CATALOG.filter((entry) => entry.group === "INCOME" && entry.parentCode)) {
    const row = await client.incomeCategory.create({
      data: { ...scope, code: item.code, name: item.name, parentId: incomeIds.get(item.parentCode ?? "") },
    });
    incomeIds.set(item.code, row.id);
  }
  for (const item of CATALOG.filter((entry) => entry.group === "EXPENSE" && !entry.parentCode)) {
    const row = await client.expenseCategory.create({
      data: {
        ...scope,
        code: item.code,
        name: item.name,
        costBehaviour: item.costBehaviour,
        defaultTaxClassification: item.taxClassification,
        defaultAccountingClass: item.accountingClassification,
      },
    });
    expenseIds.set(item.code, row.id);
  }
  for (const item of CATALOG.filter((entry) => entry.group === "EXPENSE" && entry.parentCode)) {
    const row = await client.expenseCategory.create({
      data: {
        ...scope,
        code: item.code,
        name: item.name,
        parentId: expenseIds.get(item.parentCode ?? ""),
        costBehaviour: item.costBehaviour,
        defaultTaxClassification: item.taxClassification,
        defaultAccountingClass: item.accountingClassification,
        defaultExpenseNature: item.expenseNature,
      },
    });
    expenseIds.set(item.code, row.id);
  }
  await client.taxSetting.createMany({
    data: [
      {
        ...scope,
        name: "UK VAT registration threshold",
        thresholdAmount: pounds(8_500_000),
        effectiveFrom: new Date(Date.UTC(2024, 3, 1)),
        effectiveTo: new Date(Date.UTC(2026, 2, 31)),
      },
      {
        ...scope,
        name: "UK VAT registration threshold",
        thresholdAmount: pounds(9_000_000),
        effectiveFrom: new Date(Date.UTC(2026, 3, 1)),
        scheme: "Not registered",
        period: "Quarterly",
      },
    ],
  });
  await client.vatRate.createMany({
    data: [
      { ...scope, treatment: "STANDARD", name: "Standard", rateBps: 2000, effectiveFrom: new Date(Date.UTC(2011, 0, 4)) },
      { ...scope, treatment: "REDUCED", name: "Reduced", rateBps: 500, effectiveFrom: new Date(Date.UTC(2011, 0, 4)) },
      { ...scope, treatment: "ZERO", name: "Zero", rateBps: 0, effectiveFrom: new Date(Date.UTC(2011, 0, 4)) },
    ],
  });
}

export async function createOrganizationWithOwner(
  client: PrismaClient,
  input: {
    userId: string;
    tradingName: string;
    legalName: string;
    email: string;
    addressLine1: string;
    city: string;
    postcode: string;
    role: UserRole;
  },
): Promise<{ slug: string; organizationId: string }> {
  return client.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: input.tradingName } });
    const slug = await uniqueSlug(tx, input.tradingName);
    const organization = await tx.organization.create({
      data: {
        tenantId: tenant.id,
        slug,
        legalName: input.legalName,
        tradingName: input.tradingName,
        addressLine1: input.addressLine1,
        city: input.city,
        postcode: input.postcode,
        email: input.email,
        financialYearStartMonth: 4,
        financialYearStartDay: 1,
        documentRetentionYears: 7,
      },
    });
    await tx.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: input.userId,
        role: input.role,
      },
    });
    await copyCatalog(tx, { tenantId: tenant.id, organizationId: organization.id });
    return { slug, organizationId: organization.id };
  });
}
