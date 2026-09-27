import {
  ACCOUNTING_CLASSIFICATION,
  BOOKING_PLATFORM,
  CATEGORY_GROUP,
  COST_BEHAVIOUR,
  EXPENSE_NATURE,
  PARENT_CATEGORY,
  TAX_CLASSIFICATION,
  type AccountingClassification,
  type BookingPlatform,
  type CostBehaviour,
  type ExpenseNature,
  type TaxClassification,
  INCOME_CODE,
  EXPENSE_CODE,
} from "@/domain/constants";

export type CatalogItem = {
  code: string;
  name: string;
  group: "INCOME" | "EXPENSE";
  parentCode: string | null;
  costBehaviour: CostBehaviour;
  taxClassification: TaxClassification;
  expenseNature: ExpenseNature | null;
  accountingClassification: AccountingClassification | null;
};

function income(code: string, name: string, parentCode: string): CatalogItem {
  return {
    code,
    name,
    group: CATEGORY_GROUP.INCOME,
    parentCode,
    costBehaviour: COST_BEHAVIOUR.NONE,
    taxClassification: TAX_CLASSIFICATION.ALLOWABLE,
    expenseNature: null,
    accountingClassification: null,
  };
}

function expense(
  code: string,
  name: string,
  parentCode: string,
  costBehaviour: CostBehaviour,
  taxClassification: TaxClassification = TAX_CLASSIFICATION.ALLOWABLE,
  expenseNature: ExpenseNature | null = null,
  accountingClassification: AccountingClassification | null = ACCOUNTING_CLASSIFICATION.REVENUE_EXPENSE,
): CatalogItem {
  return {
    code,
    name,
    group: CATEGORY_GROUP.EXPENSE,
    parentCode,
    costBehaviour,
    taxClassification,
    expenseNature,
    accountingClassification,
  };
}

function parent(code: string, name: string, group: "INCOME" | "EXPENSE"): CatalogItem {
  return {
    code,
    name,
    group,
    parentCode: null,
    costBehaviour: group === "EXPENSE" ? COST_BEHAVIOUR.FIXED : COST_BEHAVIOUR.NONE,
    taxClassification: TAX_CLASSIFICATION.ALLOWABLE,
    expenseNature: null,
    accountingClassification: null,
  };
}

const variable = COST_BEHAVIOUR.VARIABLE;
const fixed = COST_BEHAVIOUR.FIXED;
const company = COST_BEHAVIOUR.COMPANY;

export const CATALOG: readonly CatalogItem[] = [
  parent(PARENT_CATEGORY.ACCOMMODATION, "Accommodation", "INCOME"),
  income("NIGHTLY_ACCOMMODATION", "Nightly accommodation", PARENT_CATEGORY.ACCOMMODATION),
  income("WEEKLY_ACCOMMODATION", "Weekly accommodation", PARENT_CATEGORY.ACCOMMODATION),
  income("MONTHLY_ACCOMMODATION", "Monthly accommodation", PARENT_CATEGORY.ACCOMMODATION),
  income(INCOME_CODE.CORPORATE_ACCOMMODATION, "Corporate accommodation", PARENT_CATEGORY.ACCOMMODATION),
  income(INCOME_CODE.DIRECT_BOOKING, "Direct booking", PARENT_CATEGORY.ACCOMMODATION),
  income(INCOME_CODE.AIRBNB_BOOKING, "Airbnb booking", PARENT_CATEGORY.ACCOMMODATION),
  income(INCOME_CODE.BOOKING_COM_BOOKING, "Booking.com booking", PARENT_CATEGORY.ACCOMMODATION),
  income(INCOME_CODE.VRBO_BOOKING, "VRBO booking", PARENT_CATEGORY.ACCOMMODATION),
  income(INCOME_CODE.EXPEDIA_BOOKING, "Expedia booking", PARENT_CATEGORY.ACCOMMODATION),
  income(INCOME_CODE.OTHER_OTA_BOOKING, "Other OTA booking", PARENT_CATEGORY.ACCOMMODATION),
  parent(PARENT_CATEGORY.GUEST_FEES, "Guest fees", "INCOME"),
  income(INCOME_CODE.CLEANING_FEE, "Cleaning fee", PARENT_CATEGORY.GUEST_FEES),
  income(INCOME_CODE.EXTRA_GUEST_FEE, "Extra guest fee", PARENT_CATEGORY.GUEST_FEES),
  income("PET_FEE", "Pet fee", PARENT_CATEGORY.GUEST_FEES),
  income(INCOME_CODE.PARKING_FEE, "Parking fee", PARENT_CATEGORY.GUEST_FEES),
  income("EARLY_CHECK_IN_FEE", "Early check-in fee", PARENT_CATEGORY.GUEST_FEES),
  income("LATE_CHECK_OUT_FEE", "Late check-out fee", PARENT_CATEGORY.GUEST_FEES),
  income("LATE_CHECK_IN_FEE", "Late check-in fee", PARENT_CATEGORY.GUEST_FEES),
  income("ADDITIONAL_CLEANING_FEE", "Additional cleaning fee", PARENT_CATEGORY.GUEST_FEES),
  income("LINEN_FEE", "Linen fee", PARENT_CATEGORY.GUEST_FEES),
  income("SERVICE_FEE", "Service fee", PARENT_CATEGORY.GUEST_FEES),
  income("AMENITY_FEE", "Amenity fee", PARENT_CATEGORY.GUEST_FEES),
  income("ADMINISTRATION_FEE", "Administration fee", PARENT_CATEGORY.GUEST_FEES),
  income(INCOME_CODE.OTHER_GUEST_FEE, "Other guest fee", PARENT_CATEGORY.GUEST_FEES),
  parent(PARENT_CATEGORY.ADDITIONAL_INCOME, "Additional income", "INCOME"),
  income("CANCELLATION_INCOME", "Cancellation income", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("NO_SHOW_INCOME", "No-show income", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("DAMAGE_REIMBURSEMENT", "Damage reimbursement", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income(INCOME_CODE.DEPOSIT_RETAINED, "Deposit retained", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("LOST_KEY_CHARGE", "Lost key charge", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("LATE_DEPARTURE_CHARGE", "Late departure charge", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("REPLACEMENT_ITEM_CHARGE", "Replacement item charge", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("ADDITIONAL_SERVICES", "Additional services", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("PROPERTY_MANAGEMENT_FEES", "Property management fees", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("COMMISSION_INCOME", "Commission income", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("REFERRAL_INCOME", "Referral income", PARENT_CATEGORY.ADDITIONAL_INCOME),
  income("OTHER_INCOME", "Other income", PARENT_CATEGORY.ADDITIONAL_INCOME),
  parent(PARENT_CATEGORY.PROPERTY_RENT, "Property rent", "EXPENSE"),
  expense(EXPENSE_CODE.LANDLORD_RENT, "Landlord rent", PARENT_CATEGORY.PROPERTY_RENT, fixed),
  expense("PROPERTY_LEASE", "Property lease", PARENT_CATEGORY.PROPERTY_RENT, fixed),
  expense("GUARANTEED_RENT", "Guaranteed rent", PARENT_CATEGORY.PROPERTY_RENT, fixed),
  expense("GROUND_RENT", "Ground rent", PARENT_CATEGORY.PROPERTY_RENT, fixed),
  expense("SERVICE_CHARGE", "Service charge", PARENT_CATEGORY.PROPERTY_RENT, fixed),
  expense("PROPERTY_MANAGEMENT_CHARGE", "Property management charge", PARENT_CATEGORY.PROPERTY_RENT, fixed),
  parent(PARENT_CATEGORY.UTILITIES, "Utilities", "EXPENSE"),
  expense(EXPENSE_CODE.ELECTRICITY, "Electricity", PARENT_CATEGORY.UTILITIES, fixed),
  expense(EXPENSE_CODE.GAS, "Gas", PARENT_CATEGORY.UTILITIES, fixed),
  expense(EXPENSE_CODE.WATER, "Water", PARENT_CATEGORY.UTILITIES, fixed),
  expense(EXPENSE_CODE.BROADBAND, "Broadband", PARENT_CATEGORY.UTILITIES, fixed),
  expense("WI_FI", "Wi-Fi", PARENT_CATEGORY.UTILITIES, fixed),
  expense("TELEPHONE", "Telephone", PARENT_CATEGORY.UTILITIES, fixed),
  expense(EXPENSE_CODE.COUNCIL_TAX, "Council tax", PARENT_CATEGORY.UTILITIES, fixed),
  expense("TV_LICENCE", "TV licence", PARENT_CATEGORY.UTILITIES, fixed),
  expense("WASTE_DISPOSAL", "Waste disposal", PARENT_CATEGORY.UTILITIES, fixed),
  expense("OTHER_UTILITIES", "Other utilities", PARENT_CATEGORY.UTILITIES, fixed),
  parent(PARENT_CATEGORY.CLEANING, "Cleaning", "EXPENSE"),
  expense(EXPENSE_CODE.GUEST_TURNOVER_CLEANING, "Guest turnover cleaning", PARENT_CATEGORY.CLEANING, variable),
  expense("DEEP_CLEANING", "Deep cleaning", PARENT_CATEGORY.CLEANING, variable),
  expense("CARPET_CLEANING", "Carpet cleaning", PARENT_CATEGORY.CLEANING, variable),
  expense("WINDOW_CLEANING", "Window cleaning", PARENT_CATEGORY.CLEANING, variable),
  expense("OVEN_CLEANING", "Oven cleaning", PARENT_CATEGORY.CLEANING, variable),
  expense("EMERGENCY_CLEANING", "Emergency cleaning", PARENT_CATEGORY.CLEANING, variable),
  expense("CLEANING_CONTRACTOR", "Cleaning contractor", PARENT_CATEGORY.CLEANING, variable),
  expense("CLEANING_SUPPLIES", "Cleaning supplies", PARENT_CATEGORY.CLEANING, variable),
  parent(PARENT_CATEGORY.LAUNDRY_LINEN, "Laundry and linen", "EXPENSE"),
  expense(EXPENSE_CODE.LAUNDRY_SERVICE, "Laundry service", PARENT_CATEGORY.LAUNDRY_LINEN, variable),
  expense("BED_SHEETS", "Bed sheets", PARENT_CATEGORY.LAUNDRY_LINEN, variable, TAX_CLASSIFICATION.ACCOUNTANT_REVIEW, null, ACCOUNTING_CLASSIFICATION.REPLACEMENT_DOMESTIC_ITEM),
  expense("TOWELS", "Towels", PARENT_CATEGORY.LAUNDRY_LINEN, variable, TAX_CLASSIFICATION.ACCOUNTANT_REVIEW, null, ACCOUNTING_CLASSIFICATION.REPLACEMENT_DOMESTIC_ITEM),
  expense("REPLACEMENT_LINEN", "Replacement linen", PARENT_CATEGORY.LAUNDRY_LINEN, variable, TAX_CLASSIFICATION.ACCOUNTANT_REVIEW, null, ACCOUNTING_CLASSIFICATION.REPLACEMENT_DOMESTIC_ITEM),
  parent(PARENT_CATEGORY.GUEST_CONSUMABLES, "Guest consumables", "EXPENSE"),
  expense(EXPENSE_CODE.GUEST_CONSUMABLES, "Guest consumables", PARENT_CATEGORY.GUEST_CONSUMABLES, variable),
  expense("WELCOME_PACKS", "Guest welcome packs", PARENT_CATEGORY.GUEST_CONSUMABLES, variable),
  parent(PARENT_CATEGORY.MAINTENANCE, "Maintenance and repairs", "EXPENSE"),
  expense("PLUMBING", "Plumbing", PARENT_CATEGORY.MAINTENANCE, variable, TAX_CLASSIFICATION.ALLOWABLE, EXPENSE_NATURE.REPAIR),
  expense("ELECTRICAL", "Electrical", PARENT_CATEGORY.MAINTENANCE, variable, TAX_CLASSIFICATION.ALLOWABLE, EXPENSE_NATURE.REPAIR),
  expense("HEATING", "Heating", PARENT_CATEGORY.MAINTENANCE, variable, TAX_CLASSIFICATION.ALLOWABLE, EXPENSE_NATURE.REPAIR),
  expense("GENERAL_REPAIR", "General repair", PARENT_CATEGORY.MAINTENANCE, variable, TAX_CLASSIFICATION.ALLOWABLE, EXPENSE_NATURE.REPAIR),
  expense("IMPROVEMENT", "Improvement", PARENT_CATEGORY.MAINTENANCE, fixed, TAX_CLASSIFICATION.CAPITAL, EXPENSE_NATURE.IMPROVEMENT, ACCOUNTING_CLASSIFICATION.CAPITAL_ASSET),
  parent(PARENT_CATEGORY.FURNITURE, "Furniture and equipment", "EXPENSE"),
  expense("FURNITURE_PURCHASE", "Furniture purchase", PARENT_CATEGORY.FURNITURE, fixed, TAX_CLASSIFICATION.CAPITAL, EXPENSE_NATURE.CAPITAL_EXPENDITURE, ACCOUNTING_CLASSIFICATION.CAPITAL_ASSET),
  expense("APPLIANCE_PURCHASE", "Appliance purchase", PARENT_CATEGORY.FURNITURE, fixed, TAX_CLASSIFICATION.CAPITAL, EXPENSE_NATURE.CAPITAL_EXPENDITURE, ACCOUNTING_CLASSIFICATION.CAPITAL_ASSET),
  parent(PARENT_CATEGORY.PLATFORM_FEES, "Booking platform fees", "EXPENSE"),
  expense(EXPENSE_CODE.AIRBNB_HOST_FEE, "Airbnb host fee", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense("AIRBNB_SERVICE_FEE", "Airbnb service fee", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense(EXPENSE_CODE.BOOKING_COM_COMMISSION, "Booking.com commission", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense("BOOKING_COM_PAYMENT_FEE", "Booking.com payment fee", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense("VRBO_COMMISSION", "VRBO commission", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense("EXPEDIA_COMMISSION", "Expedia commission", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense(EXPENSE_CODE.PAYMENT_PROCESSING, "Payment processing", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense("STRIPE_FEE", "Stripe fee", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense("PAYPAL_FEE", "PayPal fee", PARENT_CATEGORY.PLATFORM_FEES, variable),
  expense(EXPENSE_CODE.OTHER_OTA_FEE, "Other OTA fee", PARENT_CATEGORY.PLATFORM_FEES, variable),
  parent(PARENT_CATEGORY.INSURANCE, "Insurance", "EXPENSE"),
  expense(EXPENSE_CODE.BUILDING_INSURANCE, "Building insurance", PARENT_CATEGORY.INSURANCE, fixed),
  expense("CONTENTS_INSURANCE", "Contents insurance", PARENT_CATEGORY.INSURANCE, fixed),
  expense("PUBLIC_LIABILITY", "Public liability insurance", PARENT_CATEGORY.INSURANCE, fixed),
  expense("SHORT_TERM_RENTAL_INSURANCE", "Short-term rental insurance", PARENT_CATEGORY.INSURANCE, fixed),
  parent(PARENT_CATEGORY.COMPLIANCE, "Compliance", "EXPENSE"),
  expense("GAS_SAFETY", "Gas safety certificate", PARENT_CATEGORY.COMPLIANCE, fixed),
  expense("EICR", "Electrical safety / EICR", PARENT_CATEGORY.COMPLIANCE, fixed),
  expense("EPC", "EPC", PARENT_CATEGORY.COMPLIANCE, fixed),
  expense("HMO_LICENCE", "HMO licence", PARENT_CATEGORY.COMPLIANCE, fixed),
  parent(PARENT_CATEGORY.SOFTWARE, "Software and subscriptions", "EXPENSE"),
  expense("CHANNEL_MANAGER", "Channel manager", PARENT_CATEGORY.SOFTWARE, company),
  expense("ACCOUNTING_SOFTWARE", "Accounting software", PARENT_CATEGORY.SOFTWARE, company),
  expense("GOOGLE_WORKSPACE", "Google Workspace", PARENT_CATEGORY.SOFTWARE, company),
  expense("OTHER_SAAS", "Other SaaS", PARENT_CATEGORY.SOFTWARE, company),
  parent(PARENT_CATEGORY.MARKETING, "Marketing", "EXPENSE"),
  expense("PROPERTY_PHOTOGRAPHY", "Property photography", PARENT_CATEGORY.MARKETING, company),
  expense("GOOGLE_ADS", "Google Ads", PARENT_CATEGORY.MARKETING, company),
  expense("WEBSITE", "Website", PARENT_CATEGORY.MARKETING, company),
  parent(PARENT_CATEGORY.PROFESSIONAL_FEES, "Professional fees", "EXPENSE"),
  expense("ACCOUNTANT", "Accountant", PARENT_CATEGORY.PROFESSIONAL_FEES, company),
  expense("SOLICITOR", "Solicitor", PARENT_CATEGORY.PROFESSIONAL_FEES, company),
  expense("COMPANIES_HOUSE", "Companies House fees", PARENT_CATEGORY.PROFESSIONAL_FEES, company),
  parent(PARENT_CATEGORY.TRAVEL, "Travel and vehicle", "EXPENSE"),
  expense("BUSINESS_MILEAGE", "Business mileage", PARENT_CATEGORY.TRAVEL, company, TAX_CLASSIFICATION.PARTIALLY_ALLOWABLE),
  expense("TRAIN", "Train", PARENT_CATEGORY.TRAVEL, company),
  expense("TAXI", "Taxi", PARENT_CATEGORY.TRAVEL, company),
  parent(PARENT_CATEGORY.STAFF, "Staff and contractors", "EXPENSE"),
  expense("CLEANER", "Cleaner", PARENT_CATEGORY.STAFF, variable),
  expense("MAINTENANCE_CONTRACTOR", "Maintenance contractor", PARENT_CATEGORY.STAFF, variable),
  expense("VIRTUAL_ASSISTANT", "Virtual assistant", PARENT_CATEGORY.STAFF, company),
  parent(PARENT_CATEGORY.COMPANY_GENERAL, "Company general", "EXPENSE"),
  expense("BANK_CHARGES", "Bank charges", PARENT_CATEGORY.COMPANY_GENERAL, company, TAX_CLASSIFICATION.FINANCE_COST),
  expense("OFFICE_EQUIPMENT", "Office equipment", PARENT_CATEGORY.COMPANY_GENERAL, company),
  parent(PARENT_CATEGORY.ENTERTAINMENT, "Entertainment", "EXPENSE"),
  expense("CLIENT_ENTERTAINING", "Client entertaining", PARENT_CATEGORY.ENTERTAINMENT, company, TAX_CLASSIFICATION.DISALLOWABLE, null, null),
];

export function catalogByCode(code: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.code === code);
}

export function accommodationIncomeCode(platform: BookingPlatform): string {
  switch (platform) {
    case BOOKING_PLATFORM.AIRBNB:
      return INCOME_CODE.AIRBNB_BOOKING;
    case BOOKING_PLATFORM.BOOKING_COM:
      return INCOME_CODE.BOOKING_COM_BOOKING;
    case BOOKING_PLATFORM.VRBO:
      return INCOME_CODE.VRBO_BOOKING;
    case BOOKING_PLATFORM.EXPEDIA:
    case BOOKING_PLATFORM.HOTELS_COM:
      return INCOME_CODE.EXPEDIA_BOOKING;
    case BOOKING_PLATFORM.CORPORATE_CLIENT:
      return INCOME_CODE.CORPORATE_ACCOMMODATION;
    case BOOKING_PLATFORM.DIRECT_WEBSITE:
    case BOOKING_PLATFORM.PHONE_BOOKING:
      return INCOME_CODE.DIRECT_BOOKING;
    default:
      return INCOME_CODE.OTHER_OTA_BOOKING;
  }
}

export function platformFeeCode(platform: BookingPlatform): string {
  switch (platform) {
    case BOOKING_PLATFORM.AIRBNB:
      return EXPENSE_CODE.AIRBNB_HOST_FEE;
    case BOOKING_PLATFORM.BOOKING_COM:
      return EXPENSE_CODE.BOOKING_COM_COMMISSION;
    case BOOKING_PLATFORM.DIRECT_WEBSITE:
    case BOOKING_PLATFORM.PHONE_BOOKING:
    case BOOKING_PLATFORM.CORPORATE_CLIENT:
      return EXPENSE_CODE.PAYMENT_PROCESSING;
    default:
      return EXPENSE_CODE.OTHER_OTA_FEE;
  }
}
