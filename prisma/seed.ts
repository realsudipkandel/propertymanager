import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma, PrismaClient, type BookingPlatform } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";

import { calculateBookingFinancials } from "../src/domain/accounting";
import { capabilitiesForProvider } from "../src/domain/channels/capabilities";
import { nightsOccupied } from "../src/domain/channels/reservation";
import { accommodationIncomeCode, CATALOG, platformFeeCode } from "../src/domain/catalog";
import { INCOME_CODE } from "../src/domain/constants";
import { addDays, todayIso } from "../src/domain/dates";
import { encryptSecret, encryptionKeyFromHex } from "../src/domain/secrets";

if (existsSync("secrets.env")) {
  loadEnv({ path: "secrets.env" });
}

const prisma = new PrismaClient();

function money(pence: number): Prisma.Decimal {
  return new Prisma.Decimal(pence).div(100);
}

function utc(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

async function clearDatabase(): Promise<void> {
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.supplierBillItem.deleteMany();
  await prisma.supplierBill.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.payoutBooking.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.propertyContract.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.expenseCategory.deleteMany({ where: { parentId: { not: null } } });
  await prisma.expenseCategory.deleteMany();
  await prisma.incomeCategory.deleteMany({ where: { parentId: { not: null } } });
  await prisma.incomeCategory.deleteMany();
  await prisma.vatRate.deleteMany();
  await prisma.taxSetting.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.reservationNightLock.deleteMany();
  await prisma.syncEvent.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.listingMapping.deleteMany();
  await prisma.dailyRate.deleteMany();
  await prisma.channelAccount.deleteMany();
  await prisma.property.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.tenant.deleteMany();
}

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? "director@miraproperties.example";
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "Mira Director";
  const bankKey = process.env.BANK_ENCRYPTION_KEY;
  if (!password || password.length < 16 || !bankKey) {
    throw new Error("Set SEED_ADMIN_PASSWORD and BANK_ENCRYPTION_KEY before seeding.");
  }
  await clearDatabase();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = todayIso(now);
  const onDay = (day: number, monthOffset = 0) => utc(year, month + monthOffset, day);

  const tenant = await prisma.tenant.create({ data: { name: "Mira Properties" } });
  const company = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      legalName: "Mira Properties Ltd",
      tradingName: "Mira Properties",
      slug: "mira-properties",
      logoUrl: "/brand/mira-logo.png",
      companyNumber: "14588231",
      vatRegistered: false,
      addressLine1: "43 Foundry House",
      addressLine2: "Riverview Rental Apartments",
      addressLine3: "Elmsleigh Road",
      city: "Staines",
      postcode: "TW18 4AJ",
      email: "finance@miraproperties.example",
      phone: null,
      financialYearStartMonth: 9,
      financialYearStartDay: 1,
      documentRetentionYears: 7,
    },
  });
  const scope = { tenantId: tenant.id, organizationId: company.id };
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  await prisma.organizationMembership.create({
    data: {
      organizationId: company.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const incomeIds = new Map<string, string>();
  const expenseIds = new Map<string, string>();
  for (const item of CATALOG.filter((entry) => entry.group === "INCOME" && !entry.parentCode)) {
    const row = await prisma.incomeCategory.create({ data: { ...scope, code: item.code, name: item.name } });
    incomeIds.set(item.code, row.id);
  }
  for (const item of CATALOG.filter((entry) => entry.group === "INCOME" && entry.parentCode)) {
    const row = await prisma.incomeCategory.create({
      data: { ...scope, code: item.code, name: item.name, parentId: incomeIds.get(item.parentCode ?? "") },
    });
    incomeIds.set(item.code, row.id);
  }
  for (const item of CATALOG.filter((entry) => entry.group === "EXPENSE" && !entry.parentCode)) {
    const row = await prisma.expenseCategory.create({
      data: {
        ...scope,
        code: item.code,
        name: item.name,
        costBehaviour: item.costBehaviour,
        defaultTaxClassification: item.taxClassification,
      },
    });
    expenseIds.set(item.code, row.id);
  }
  for (const item of CATALOG.filter((entry) => entry.group === "EXPENSE" && entry.parentCode)) {
    const row = await prisma.expenseCategory.create({
      data: {
        ...scope,
        code: item.code,
        name: item.name,
        parentId: expenseIds.get(item.parentCode ?? ""),
        costBehaviour: item.costBehaviour,
        defaultTaxClassification: item.taxClassification,
        defaultExpenseNature: item.expenseNature,
        defaultAccountingClass: item.accountingClassification,
      },
    });
    expenseIds.set(item.code, row.id);
  }

  const riverview = await prisma.property.create({
    data: { ...scope, name: "Riverview Apartment", address: "8 Riverwalk", city: "Staines", postcode: "TW18 4EP", bedrooms: 2 },
  });
  const heathrow = await prisma.property.create({
    data: { ...scope, name: "Heathrow Apartment", address: "21 Bath Road", city: "Hounslow", postcode: "TW6 2AB", bedrooms: 1 },
  });

  const supplierData = [
    ["ABC Property Ltd", "Landlord"],
    ["Heathrow Lets Ltd", "Landlord"],
    ["British Gas", "Utilities"],
    ["Thames Water", "Utilities"],
    ["Sky", "Utilities"],
    ["Sparkle & Stay", "Cleaning"],
    ["Linen Loop", "Laundry"],
    ["Hiscox", "Insurance"],
    ["North & Co", "Accountant"],
  ] as const;
  const suppliers = new Map<string, string>();
  for (const [supplierName, category] of supplierData) {
    const row = await prisma.supplier.create({ data: { ...scope, name: supplierName, category } });
    suppliers.set(supplierName, row.id);
  }
  const john = await prisma.customer.create({ data: { ...scope, name: "John Smith", email: "john.smith@example.com" } });
  const amira = await prisma.customer.create({ data: { ...scope, name: "Amira Khan", email: "amira.khan@example.com" } });
  const northwind = await prisma.customer.create({
    data: { ...scope, name: "Northwind Consulting", companyName: "Northwind Consulting Ltd", email: "accounts@northwind.example" },
  });
  const helen = await prisma.customer.create({ data: { ...scope, name: "Helen Ward", email: "helen.ward@example.com" } });

  await prisma.propertyContract.create({
    data: {
      ...scope,
      propertyId: riverview.id,
      supplierId: suppliers.get("ABC Property Ltd") ?? "",
      monthlyRentPence: 185_000,
      depositPence: 185_000,
      paymentDay: 1,
      leaseStart: utc(year - 1, 8, 1),
      leaseEnd: utc(year + 1, month, 1),
    },
  });
  await prisma.propertyContract.create({
    data: {
      ...scope,
      propertyId: heathrow.id,
      supplierId: suppliers.get("Heathrow Lets Ltd") ?? "",
      monthlyRentPence: 210_000,
      depositPence: 210_000,
      paymentDay: 1,
      leaseStart: utc(year - 1, 3, 1),
      leaseEnd: new Date(`${addDays(today, 40)}T00:00:00.000Z`),
    },
  });

  let expenseSequence = 800;
  const nextExpenseRef = () => {
    expenseSequence += 1;
    return `EXP-${String(expenseSequence).padStart(5, "0")}`;
  };

  async function postExpense(input: {
    propertyId?: string;
    bookingId?: string;
    supplier?: string;
    code: string;
    description: string;
    on: Date;
    netPence: number;
    vatPence?: number;
    monthOffset?: number;
  }): Promise<void> {
    const categoryId = expenseIds.get(input.code);
    const catalogItem = CATALOG.find((item) => item.code === input.code);
    if (!categoryId || !catalogItem) {
      throw new Error(`Missing category ${input.code}`);
    }
    const gross = input.netPence + (input.vatPence ?? 0);
    await prisma.expense.create({
      data: {
        ...scope,
        propertyId: input.propertyId,
        bookingId: input.bookingId,
        supplierId: input.supplier ? suppliers.get(input.supplier) : undefined,
        categoryId,
        reference: nextExpenseRef(),
        description: input.description,
        transactionDate: input.on,
        netAmount: money(input.netPence),
        vatAmount: money(input.vatPence ?? 0),
        grossAmount: money(gross),
        paymentMethod: "BANK_TRANSFER",
        taxClassification: catalogItem.taxClassification,
        vatTreatment: (input.vatPence ?? 0) > 0 ? "STANDARD" : "OUTSIDE_SCOPE",
        vatRecoverable: "UNKNOWN",
        expenseNature: catalogItem.expenseNature,
        accountingClass: catalogItem.accountingClassification ?? undefined,
        isCapitalExpense: catalogItem.taxClassification === "CAPITAL",
        businessPercentage: new Prisma.Decimal(100),
        createdById: user.id,
      },
    });
  }

  type PostedBooking = { id: string; reference: string; netPence: number; group: string; platform: BookingPlatform; paidOn: Date };

  async function postBooking(input: {
    reference: string;
    externalId: string;
    propertyId: string;
    customerId: string;
    platform: BookingPlatform;
    day: number;
    nights: number;
    guests: number;
    monthOffset?: number;
    accommodation: number;
    cleaning?: number;
    extra?: number;
    parking?: number;
    other?: number;
    commission?: number;
    processing?: number;
    refunds?: number;
    group: string;
  }): Promise<PostedBooking> {
    const checkIn = onDay(input.day, input.monthOffset ?? 0);
    const checkOut = utc(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate() + input.nights);
    const financials = calculateBookingFinancials({
      accommodationPence: input.accommodation,
      cleaningFeePence: input.cleaning ?? 0,
      extraGuestPence: input.extra ?? 0,
      parkingPence: input.parking ?? 0,
      otherRevenuePence: input.other ?? 0,
      platformCommissionPence: input.commission ?? 0,
      paymentProcessingFeePence: input.processing ?? 0,
      refundsPence: input.refunds ?? 0,
      adjustmentsPence: 0,
    });
    const booking = await prisma.booking.create({
      data: {
        ...scope,
        propertyId: input.propertyId,
        customerId: input.customerId,
        reference: input.reference,
        platform: input.platform,
        externalBookingId: input.externalId,
        status: "COMPLETED",
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfNights: input.nights,
        numberOfGuests: input.guests,
        accommodationRevenue: money(input.accommodation),
        cleaningRevenue: money(input.cleaning ?? 0),
        extraGuestRevenue: money(input.extra ?? 0),
        parkingRevenue: money(input.parking ?? 0),
        otherRevenue: money(input.other ?? 0),
        grossRevenue: money(financials.grossRevenuePence),
        platformCommission: money(input.commission ?? 0),
        paymentProcessingFee: money(input.processing ?? 0),
        refunds: money(input.refunds ?? 0),
        adjustments: money(0),
        netPayout: money(financials.netPayoutPence),
        vatAmount: money(0),
        payoutDate: utc(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate() + 2),
        reconciliationStatus: input.group === "batch" || input.group === "corporate" ? "UNMATCHED" : "RECONCILED",
        createdById: user.id,
      },
    });
    const parts: Array<[string, number]> = [
      [accommodationIncomeCode(input.platform), input.accommodation],
      [INCOME_CODE.CLEANING_FEE, input.cleaning ?? 0],
      [INCOME_CODE.EXTRA_GUEST_FEE, input.extra ?? 0],
      [INCOME_CODE.PARKING_FEE, input.parking ?? 0],
      [INCOME_CODE.OTHER_GUEST_FEE, input.other ?? 0],
    ];
    for (const [code, amount] of parts) {
      if (amount <= 0) continue;
      await prisma.income.create({
        data: {
          ...scope,
          propertyId: input.propertyId,
          bookingId: booking.id,
          customerId: input.customerId,
          categoryId: incomeIds.get(code) ?? "",
          channel: input.platform,
          grossAmount: money(amount),
          vatAmount: money(0),
          netAmount: money(amount),
          transactionDate: checkOut,
          serviceDate: checkIn,
          paymentStatus: input.group === "corporate" ? "ISSUED" : "PAID",
          createdById: user.id,
        },
      });
    }
    if (financials.platformCostsPence > 0) {
      await postExpense({
        propertyId: input.propertyId,
        bookingId: booking.id,
        code: platformFeeCode(input.platform),
        description: `Platform fee for ${input.reference}`,
        on: checkOut,
        netPence: financials.platformCostsPence,
      });
    }
    if ((input.refunds ?? 0) > 0) {
      await prisma.refund.create({
        data: {
          ...scope,
          bookingId: booking.id,
          customerId: input.customerId,
          propertyId: input.propertyId,
          reference: `REF-${input.reference}`,
          amount: money(input.refunds ?? 0),
          reason: "GOODWILL",
          refundedOn: checkOut,
          method: "PLATFORM_PAYOUT",
        },
      });
    }
    return {
      id: booking.id,
      reference: input.reference,
      netPence: financials.netPayoutPence,
      group: input.group,
      platform: input.platform,
      paidOn: utc(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate() + 2),
    };
  }

  const posted = [
    await postBooking({
      reference: "MIRA-B-00152",
      externalId: "HMABC12345",
      propertyId: riverview.id,
      customerId: john.id,
      platform: "AIRBNB",
      day: 12,
      nights: 3,
      guests: 2,
      accommodation: 50_000,
      cleaning: 7_000,
      parking: 3_000,
      commission: 1_800,
      group: "teach",
    }),
    await postBooking({
      reference: "MIRA-B-00160",
      externalId: "HMBATCH01",
      propertyId: riverview.id,
      customerId: amira.id,
      platform: "AIRBNB",
      day: 2,
      nights: 3,
      guests: 2,
      accommodation: 54_000,
      cleaning: 6_000,
      commission: 2_000,
      group: "batch",
    }),
    await postBooking({
      reference: "MIRA-B-00161",
      externalId: "HMBATCH02",
      propertyId: heathrow.id,
      customerId: helen.id,
      platform: "AIRBNB",
      day: 6,
      nights: 2,
      guests: 1,
      accommodation: 43_000,
      cleaning: 8_000,
      commission: 2_000,
      group: "batch",
    }),
    await postBooking({
      reference: "MIRA-B-00162",
      externalId: "HMBATCH03",
      propertyId: riverview.id,
      customerId: john.id,
      platform: "AIRBNB",
      day: 18,
      nights: 2,
      guests: 2,
      accommodation: 44_000,
      cleaning: 6_000,
      commission: 2_000,
      group: "batch",
    }),
    await postBooking({
      reference: "MIRA-B-00170",
      externalId: "BC998877",
      propertyId: heathrow.id,
      customerId: amira.id,
      platform: "BOOKING_COM",
      day: 8,
      nights: 4,
      guests: 2,
      accommodation: 98_000,
      cleaning: 7_000,
      commission: 15_750,
      group: "booking",
    }),
    await postBooking({
      reference: "MIRA-B-00180",
      externalId: "DIR-2044",
      propertyId: riverview.id,
      customerId: helen.id,
      platform: "DIRECT_WEBSITE",
      day: 20,
      nights: 3,
      guests: 2,
      accommodation: 72_000,
      cleaning: 7_000,
      processing: 1_580,
      refunds: 5_000,
      group: "direct",
    }),
    await postBooking({
      reference: "MIRA-B-00190",
      externalId: "CORP-17",
      propertyId: heathrow.id,
      customerId: northwind.id,
      platform: "CORPORATE_CLIENT",
      day: 4,
      nights: 5,
      guests: 1,
      accommodation: 175_000,
      group: "corporate",
    }),
    await postBooking({
      reference: "MIRA-B-00140",
      externalId: "HMLAST01",
      propertyId: riverview.id,
      customerId: amira.id,
      platform: "AIRBNB",
      day: 10,
      nights: 3,
      guests: 2,
      monthOffset: -1,
      accommodation: 42_000,
      cleaning: 6_000,
      commission: 1_440,
      group: "previous",
    }),
  ];

  const teach = posted.find((booking) => booking.group === "teach");
  if (teach) {
    await postExpense({
      propertyId: riverview.id,
      bookingId: teach.id,
      supplier: "Sparkle & Stay",
      code: "GUEST_TURNOVER_CLEANING",
      description: "Turnover clean for MIRA-B-00152",
      on: onDay(15),
      netPence: 5_500,
    });
    await postExpense({
      propertyId: riverview.id,
      bookingId: teach.id,
      supplier: "Linen Loop",
      code: "LAUNDRY_SERVICE",
      description: "Laundry for MIRA-B-00152",
      on: onDay(15),
      netPence: 1_500,
    });
    await postExpense({
      propertyId: riverview.id,
      bookingId: teach.id,
      code: "CONSUMABLE_SUPPLIES",
      description: "Welcome pack for MIRA-B-00152",
      on: onDay(12),
      netPence: 800,
    });
  }

  await postExpense({ propertyId: riverview.id, supplier: "ABC Property Ltd", code: "LANDLORD_RENT", description: "September rent", on: onDay(1), netPence: 185_000 });
  await postExpense({ propertyId: heathrow.id, supplier: "Heathrow Lets Ltd", code: "LANDLORD_RENT", description: "September rent", on: onDay(1), netPence: 210_000 });
  await postExpense({ propertyId: riverview.id, code: "COUNCIL_TAX", description: "Council tax", on: onDay(3), netPence: 18_000 });
  await postExpense({ propertyId: riverview.id, supplier: "British Gas", code: "GAS", description: "British Gas invoice BG12345", on: onDay(21), netPence: 10_000, vatPence: 2_000 });
  await postExpense({ propertyId: riverview.id, supplier: "Thames Water", code: "WATER", description: "Water", on: onDay(8), netPence: 4_500 });
  await postExpense({ propertyId: riverview.id, supplier: "Sky", code: "BROADBAND", description: "Broadband", on: onDay(5), netPence: 3_500 });
  await postExpense({ propertyId: riverview.id, supplier: "Hiscox", code: "BUILDING_INSURANCE", description: "Contents and buildings cover", on: onDay(1), netPence: 5_000 });
  await postExpense({ propertyId: heathrow.id, code: "COUNCIL_TAX", description: "Council tax", on: onDay(3), netPence: 19_500 });
  await postExpense({ propertyId: heathrow.id, code: "ELECTRICITY", description: "Electricity", on: onDay(11), netPence: 16_000 });
  await postExpense({ propertyId: heathrow.id, supplier: "British Gas", code: "GAS", description: "Gas", on: onDay(11), netPence: 9_000 });
  await postExpense({ propertyId: heathrow.id, code: "WATER", description: "Water", on: onDay(11), netPence: 5_000 });
  await postExpense({ propertyId: heathrow.id, code: "BROADBAND", description: "Internet", on: onDay(5), netPence: 4_000 });
  await postExpense({ propertyId: heathrow.id, supplier: "Hiscox", code: "SHORT_TERM_RENTAL_INSURANCE", description: "Short-term rental insurance", on: onDay(1), netPence: 6_000 });
  await postExpense({ propertyId: riverview.id, monthOffset: -1, code: "GAS", description: "Gas last month", on: onDay(18, -1), netPence: 8_000 });
  await postExpense({ propertyId: riverview.id, code: "FURNITURE_PURCHASE", description: "Replacement sofa", on: onDay(9), netPence: 80_000 });
  await postExpense({ code: "CHANNEL_MANAGER", description: "PriceLabs", on: onDay(2), netPence: 2_900 });
  await postExpense({ code: "GOOGLE_WORKSPACE", description: "Google Workspace", on: onDay(2), netPence: 1_200 });
  await postExpense({ supplier: "North & Co", code: "ACCOUNTANT", description: "Monthly bookkeeping", on: onDay(14), netPence: 18_000 });
  await postExpense({ code: "PROPERTY_PHOTOGRAPHY", description: "Riverview photography", on: onDay(6), netPence: 10_000 });
  await postExpense({ code: "BANK_CHARGES", description: "Bank charges", on: utc(year, month, now.getUTCDate()), netPence: 1_200 });
  await postExpense({ code: "CLIENT_ENTERTAINING", description: "Client dinner", on: onDay(16), netPence: 4_000 });

  await prisma.deposit.create({
    data: {
      ...scope,
      bookingId: posted[0]?.id,
      customerId: john.id,
      propertyId: riverview.id,
      reference: "DEP-00152",
      amount: money(30_000),
      retained: money(5_000),
      status: "PARTIALLY_RETAINED",
      receivedOn: onDay(12),
    },
  });
  await prisma.income.create({
    data: {
      ...scope,
      propertyId: riverview.id,
      bookingId: posted[0]?.id,
      customerId: john.id,
      categoryId: incomeIds.get(INCOME_CODE.DEPOSIT_RETAINED) ?? "",
      channel: "AIRBNB",
      grossAmount: money(5_000),
      vatAmount: money(0),
      netAmount: money(5_000),
      transactionDate: onDay(16),
      serviceDate: onDay(16),
      paymentStatus: "PAID",
      notes: "Damage retained from security deposit. The held balance is not revenue.",
      createdById: user.id,
    },
  });

  const groups = new Map<string, PostedBooking[]>();
  for (const booking of posted) {
    const current = groups.get(booking.group) ?? [];
    current.push(booking);
    groups.set(booking.group, current);
  }

  const key = encryptionKeyFromHex(bankKey);
  const account = await prisma.bankAccount.create({
    data: {
      ...scope,
      bankName: "Starling",
      accountName: "Mira Properties Main",
      accountNumberCipher: encryptSecret("12345678", key),
      sortCodeCipher: encryptSecret("608371", key),
      accountNumberLast4: "5678",
      openingBalance: money(1_800_000),
    },
  });

  async function payoutAndMaybeBank(group: string, reference: string, reconciled: boolean): Promise<void> {
    const members = groups.get(group) ?? [];
    if (members.length === 0 || members.some((member) => member.netPence <= 0)) {
      return;
    }
    const total = members.reduce((sum, member) => sum + member.netPence, 0);
    const payout = await prisma.payout.create({
      data: {
        ...scope,
        platform: members[0]?.platform ?? "AIRBNB",
        reference,
        paidOn: members[0]?.paidOn ?? onDay(20),
        amount: money(total),
        reconciliationStatus: reconciled ? "RECONCILED" : "UNMATCHED",
        allocations: {
          create: members.map((member) => ({ bookingId: member.id, amount: money(member.netPence) })),
        },
      },
    });
    if (reconciled) {
      await prisma.bankTransaction.create({
        data: {
          ...scope,
          bankAccountId: account.id,
          occurredOn: payout.paidOn,
          description: `${payout.platform} payout ${reference}`,
          amount: money(total),
          direction: "CREDIT",
          reference,
          reconciliationStatus: "RECONCILED",
          payoutId: payout.id,
        },
      });
    }
  }

  await payoutAndMaybeBank("teach", "PAYOUT-582", true);
  await payoutAndMaybeBank("batch", "PAYOUT-1550", false);
  await payoutAndMaybeBank("booking", "PAYOUT-BC", true);
  await payoutAndMaybeBank("direct", "PAYOUT-DIR", true);
  await payoutAndMaybeBank("previous", "PAYOUT-AUG", true);

  const batchTotal = (groups.get("batch") ?? []).reduce((sum, member) => sum + member.netPence, 0);
  await prisma.bankTransaction.create({
    data: {
      ...scope,
      bankAccountId: account.id,
      occurredOn: onDay(22),
      description: "AIRBNB PAYOUT",
      amount: money(batchTotal),
      direction: "CREDIT",
      reference: "PAYOUT-1550",
      reconciliationStatus: "UNMATCHED",
    },
  });
  await prisma.bankTransaction.create({
    data: {
      ...scope,
      bankAccountId: account.id,
      occurredOn: onDay(1),
      description: "Rent Riverview ABC Property Ltd",
      amount: money(185_000),
      direction: "DEBIT",
      reference: "RENT-RV",
      reconciliationStatus: "MATCHED",
    },
  });
  await prisma.bankTransaction.create({
    data: {
      ...scope,
      bankAccountId: account.id,
      occurredOn: onDay(1),
      description: "Rent Heathrow Lets Ltd",
      amount: money(210_000),
      direction: "DEBIT",
      reference: "RENT-HW",
      reconciliationStatus: "MATCHED",
    },
  });

  const invoiceDue = new Date(`${addDays(today, -7)}T00:00:00.000Z`);
  await prisma.invoice.create({
    data: {
      ...scope,
      customerId: northwind.id,
      number: "INV-00014",
      status: "OVERDUE",
      issueDate: onDay(4),
      dueDate: invoiceDue,
      netAmount: money(175_000),
      vatAmount: money(0),
      grossAmount: money(175_000),
      notes: "Corporate stay at Heathrow Apartment. Not a VAT invoice.",
      createdById: user.id,
      items: {
        create: {
          description: "Corporate accommodation, 5 nights",
          quantity: new Prisma.Decimal(1),
          unitAmount: money(175_000),
          vatRateBps: 0,
          netAmount: money(175_000),
          vatAmount: money(0),
          grossAmount: money(175_000),
        },
      },
    },
  });
  await prisma.invoice.create({
    data: {
      ...scope,
      customerId: helen.id,
      number: "INV-00015",
      status: "ISSUED",
      issueDate: onDay(20),
      dueDate: new Date(`${addDays(today, 10)}T00:00:00.000Z`),
      netAmount: money(40_000),
      vatAmount: money(0),
      grossAmount: money(40_000),
      createdById: user.id,
      items: {
        create: {
          description: "Additional cleaning and parking",
          quantity: new Prisma.Decimal(1),
          unitAmount: money(40_000),
          vatRateBps: 0,
          netAmount: money(40_000),
          vatAmount: money(0),
          grossAmount: money(40_000),
        },
      },
    },
  });
  const partial = await prisma.invoice.create({
    data: {
      ...scope,
      customerId: amira.id,
      number: "INV-00016",
      status: "PARTIALLY_PAID",
      issueDate: onDay(10),
      dueDate: new Date(`${addDays(today, 5)}T00:00:00.000Z`),
      netAmount: money(100_000),
      vatAmount: money(0),
      grossAmount: money(100_000),
      createdById: user.id,
      items: {
        create: {
          description: "Direct stay balance",
          quantity: new Prisma.Decimal(1),
          unitAmount: money(100_000),
          vatRateBps: 0,
          netAmount: money(100_000),
          vatAmount: money(0),
          grossAmount: money(100_000),
        },
      },
    },
  });
  await prisma.payment.create({
    data: {
      ...scope,
      direction: "RECEIVED",
      method: "BANK_TRANSFER",
      amount: money(40_000),
      paidOn: onDay(18),
      reference: "PAY-0001",
      invoiceId: partial.id,
      createdById: user.id,
    },
  });

  await prisma.supplierBill.create({
    data: {
      ...scope,
      supplierId: suppliers.get("Sparkle & Stay") ?? "",
      propertyId: heathrow.id,
      number: "AC-00981",
      status: "DUE",
      issueDate: onDay(20),
      dueDate: new Date(`${addDays(today, 3)}T00:00:00.000Z`),
      netAmount: money(45_000),
      vatAmount: money(0),
      grossAmount: money(45_000),
      items: { create: { description: "September cleans", netAmount: money(45_000), vatAmount: money(0), grossAmount: money(45_000) } },
    },
  });

  const rentCategory = expenseIds.get("LANDLORD_RENT") ?? "";
  const councilCategory = expenseIds.get("COUNCIL_TAX") ?? "";
  const broadbandCategory = expenseIds.get("BROADBAND") ?? "";
  const softwareCategory = expenseIds.get("CHANNEL_MANAGER") ?? "";
  await prisma.recurringExpense.createMany({
    data: [
      { ...scope, propertyId: riverview.id, supplierId: suppliers.get("ABC Property Ltd"), categoryId: rentCategory, name: "Riverview rent", amount: money(185_000), frequency: "MONTHLY", nextDueOn: utc(year, month + 1, 1) },
      { ...scope, propertyId: heathrow.id, supplierId: suppliers.get("Heathrow Lets Ltd"), categoryId: rentCategory, name: "Heathrow rent", amount: money(210_000), frequency: "MONTHLY", nextDueOn: utc(year, month + 1, 1) },
      { ...scope, propertyId: riverview.id, categoryId: councilCategory, name: "Riverview council tax", amount: money(18_000), frequency: "MONTHLY", nextDueOn: utc(year, month + 1, 3) },
      { ...scope, propertyId: riverview.id, supplierId: suppliers.get("Sky"), categoryId: broadbandCategory, name: "Riverview broadband", amount: money(3_500), frequency: "MONTHLY", nextDueOn: utc(year, month + 1, 5) },
      { ...scope, categoryId: softwareCategory, name: "PriceLabs", amount: money(2_900), frequency: "MONTHLY", nextDueOn: utc(year, month + 1, 2), renewalOn: new Date(`${addDays(today, 12)}T00:00:00.000Z`) },
    ],
  });

  await prisma.taxSetting.createMany({
    data: [
      { ...scope, name: "UK VAT registration threshold", thresholdAmount: money(8_500_000), effectiveFrom: utc(2024, 3, 1), effectiveTo: utc(2026, 2, 31), notes: "Historical threshold kept so later changes do not rewrite old periods." },
      { ...scope, name: "UK VAT registration threshold", thresholdAmount: money(9_000_000), effectiveFrom: utc(2026, 3, 1), scheme: "Not registered", period: "Quarterly", notes: "Stored as configuration. Do not hard-code this figure in reports." },
    ],
  });
  await prisma.vatRate.createMany({
    data: [
      { ...scope, treatment: "STANDARD", name: "Standard", rateBps: 2000, effectiveFrom: utc(2011, 0, 4) },
      { ...scope, treatment: "REDUCED", name: "Reduced", rateBps: 500, effectiveFrom: utc(2011, 0, 4) },
      { ...scope, treatment: "ZERO", name: "Zero", rateBps: 0, effectiveFrom: utc(2011, 0, 4) },
    ],
  });
  await prisma.budget.createMany({
    data: [
      { ...scope, propertyId: riverview.id, periodStart: utc(year, month, 1), categoryCode: "REVENUE", label: "Expected revenue", amount: money(700_000) },
      { ...scope, propertyId: riverview.id, periodStart: utc(year, month, 1), categoryCode: "LANDLORD_RENT", label: "Rent", amount: money(185_000) },
      { ...scope, propertyId: riverview.id, periodStart: utc(year, month, 1), categoryCode: "UTILITIES", label: "Utilities", amount: money(45_000) },
      { ...scope, propertyId: riverview.id, periodStart: utc(year, month, 1), categoryCode: "CLEANING", label: "Cleaning", amount: money(65_000) },
    ],
  });

  const storageKey = `${company.id}/gas-safety.txt`;
  const absolute = path.join(process.cwd(), "storage", storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, "Gas safety certificate placeholder for Riverview Apartment.\n");
  await prisma.document.create({
    data: {
      ...scope,
      propertyId: riverview.id,
      kind: "COMPLIANCE_CERTIFICATE",
      title: "Gas safety certificate",
      storageKey,
      mimeType: "text/plain",
      byteSize: 64,
      expiresOn: new Date(`${addDays(today, 18)}T00:00:00.000Z`),
      createdById: user.id,
    },
  });
  await prisma.document.create({
    data: {
      ...scope,
      propertyId: riverview.id,
      kind: "INSURANCE",
      title: "Hiscox policy",
      storageKey,
      mimeType: "text/plain",
      byteSize: 64,
      expiresOn: new Date(`${addDays(today, 20)}T00:00:00.000Z`),
      createdById: user.id,
    },
  });
  await prisma.asset.create({
    data: {
      ...scope,
      propertyId: riverview.id,
      name: "Sofa",
      accountingClass: "CAPITAL_ASSET",
      purchasedOn: onDay(9),
      cost: money(80_000),
      notes: "Capital item. Not charged to operating profit.",
    },
  });
  const directAccount = await prisma.channelAccount.create({
    data: {
      ...scope,
      provider: "DIRECT",
      displayName: "Mira Direct",
      status: "ACTIVE",
      capabilities: capabilitiesForProvider("DIRECT"),
      lastSyncAt: now,
    },
  });
  const airbnbAccount = await prisma.channelAccount.create({
    data: {
      ...scope,
      provider: "MOCK_AIRBNB",
      displayName: "Mira Properties main account",
      status: "ACTIVE",
      capabilities: capabilitiesForProvider("MOCK_AIRBNB"),
      lastSyncAt: now,
    },
  });
  await prisma.listingMapping.create({
    data: {
      ...scope,
      channelAccountId: airbnbAccount.id,
      propertyId: riverview.id,
      externalListingId: "MOCK_AIRBNB-demo-1",
      syncMode: "ARI_ONLY",
      markupBps: 1_500,
    },
  });
  await prisma.listingMapping.create({
    data: {
      ...scope,
      channelAccountId: directAccount.id,
      propertyId: riverview.id,
      externalListingId: "DIRECT-riverview",
      syncMode: "FULL_SYNC",
      markupBps: -500,
    },
  });
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + offset);
    date.setUTCHours(0, 0, 0, 0);
    await prisma.dailyRate.create({
      data: {
        ...scope,
        propertyId: riverview.id,
        date,
        basePricePence: 12_000,
        minStay: 2,
      },
    });
  }
  const seedCheckIn = addDays(today, 5);
  const seedCheckOut = addDays(seedCheckIn, 3);
  const seedNights = nightsOccupied(seedCheckIn, seedCheckOut);
  const seedAccommodationPence = 27_000;
  const seedCleaningPence = 5_500;
  const seedCommissionPence = Math.round(seedAccommodationPence * 0.15);
  const seedReservation = await prisma.reservation.create({
    data: {
      ...scope,
      propertyId: riverview.id,
      channelAccountId: airbnbAccount.id,
      provider: "MOCK_AIRBNB",
      externalReservationId: "SEED-RES-1",
      status: "CONFIRMED",
      guestName: "Priya Nair",
      guestEmail: "priya.nair@example.com",
      checkInDate: new Date(`${seedCheckIn}T00:00:00.000Z`),
      checkOutDate: new Date(`${seedCheckOut}T00:00:00.000Z`),
      nights: seedNights.length,
      guests: 2,
      accommodationPence: seedAccommodationPence,
      cleaningPence: seedCleaningPence,
      otherPence: 0,
      grossPence: seedAccommodationPence + seedCleaningPence,
      commissionPence: seedCommissionPence,
      currency: "GBP",
    },
  });
  await prisma.reservationNightLock.createMany({
    data: seedNights.map((date) => ({
      organizationId: company.id,
      propertyId: riverview.id,
      date: new Date(`${date}T00:00:00.000Z`),
      reservationId: seedReservation.id,
    })),
  });
  await prisma.syncEvent.create({
    data: {
      tenantId: tenant.id,
      organizationId: company.id,
      channelAccountId: airbnbAccount.id,
      provider: "MOCK_AIRBNB",
      externalEventId: "SEED-RES-1-EVT-1",
      eventType: "RESERVATION_CREATED",
      payload: { seeded: true, externalReservationId: "SEED-RES-1" },
      processedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      ...scope,
      actorId: user.id,
      actorName: name,
      action: "LEDGER_SEEDED",
      entityType: "company",
      entityId: company.id,
      summary: "Opening ledger posted for the current month.",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    await prisma.$disconnect();
    process.exit(1);
  });
