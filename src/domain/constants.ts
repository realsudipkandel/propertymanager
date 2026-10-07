export const CURRENCY_GBP = "GBP";

export const USER_ROLE = {
  OWNER: "OWNER",
  ORGANIZATION_ADMIN: "ORGANIZATION_ADMIN",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  ACCOUNTANT: "ACCOUNTANT",
  PROPERTY_MANAGER: "PROPERTY_MANAGER",
  OPERATIONS: "OPERATIONS",
  CLEANER: "CLEANER",
  VIEWER: "VIEWER",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const BOOKING_PLATFORM = {
  AIRBNB: "AIRBNB",
  BOOKING_COM: "BOOKING_COM",
  VRBO: "VRBO",
  EXPEDIA: "EXPEDIA",
  HOTELS_COM: "HOTELS_COM",
  AGODA: "AGODA",
  DIRECT_WEBSITE: "DIRECT_WEBSITE",
  PHONE_BOOKING: "PHONE_BOOKING",
  CORPORATE_CLIENT: "CORPORATE_CLIENT",
  TRAVEL_AGENT: "TRAVEL_AGENT",
  OTHER: "OTHER",
} as const;

export type BookingPlatform =
  (typeof BOOKING_PLATFORM)[keyof typeof BOOKING_PLATFORM];

export const TAX_CLASSIFICATION = {
  ALLOWABLE: "ALLOWABLE",
  DISALLOWABLE: "DISALLOWABLE",
  PARTIALLY_ALLOWABLE: "PARTIALLY_ALLOWABLE",
  CAPITAL: "CAPITAL",
  FINANCE_COST: "FINANCE_COST",
  UNKNOWN: "UNKNOWN",
  ACCOUNTANT_REVIEW: "ACCOUNTANT_REVIEW",
} as const;

export type TaxClassification =
  (typeof TAX_CLASSIFICATION)[keyof typeof TAX_CLASSIFICATION];

export const VAT_TREATMENT = {
  STANDARD: "STANDARD",
  REDUCED: "REDUCED",
  ZERO: "ZERO",
  EXEMPT: "EXEMPT",
  OUTSIDE_SCOPE: "OUTSIDE_SCOPE",
  REVERSE_CHARGE: "REVERSE_CHARGE",
  UNKNOWN: "UNKNOWN",
} as const;

export type VatTreatment = (typeof VAT_TREATMENT)[keyof typeof VAT_TREATMENT];

export const VAT_RECOVERABLE = {
  YES: "YES",
  NO: "NO",
  PARTIAL: "PARTIAL",
  UNKNOWN: "UNKNOWN",
} as const;

export type VatRecoverable =
  (typeof VAT_RECOVERABLE)[keyof typeof VAT_RECOVERABLE];

export const EXPENSE_NATURE = {
  REPAIR: "REPAIR",
  MAINTENANCE: "MAINTENANCE",
  IMPROVEMENT: "IMPROVEMENT",
  CAPITAL_EXPENDITURE: "CAPITAL_EXPENDITURE",
  UNKNOWN: "UNKNOWN",
  ACCOUNTANT_REVIEW: "ACCOUNTANT_REVIEW",
} as const;

export type ExpenseNature = (typeof EXPENSE_NATURE)[keyof typeof EXPENSE_NATURE];

export const ACCOUNTING_CLASSIFICATION = {
  REVENUE_EXPENSE: "REVENUE_EXPENSE",
  REPLACEMENT_DOMESTIC_ITEM: "REPLACEMENT_DOMESTIC_ITEM",
  CAPITAL_ASSET: "CAPITAL_ASSET",
  UNKNOWN: "UNKNOWN",
  ACCOUNTANT_REVIEW: "ACCOUNTANT_REVIEW",
} as const;

export type AccountingClassification =
  (typeof ACCOUNTING_CLASSIFICATION)[keyof typeof ACCOUNTING_CLASSIFICATION];

export const COST_BEHAVIOUR = {
  VARIABLE: "VARIABLE",
  FIXED: "FIXED",
  COMPANY: "COMPANY",
  NONE: "NONE",
} as const;

export type CostBehaviour = (typeof COST_BEHAVIOUR)[keyof typeof COST_BEHAVIOUR];

export const PAYMENT_METHOD = {
  BANK_TRANSFER: "BANK_TRANSFER",
  CARD: "CARD",
  CASH: "CASH",
  DIRECT_DEBIT: "DIRECT_DEBIT",
  STRIPE: "STRIPE",
  PAYPAL: "PAYPAL",
  PLATFORM_PAYOUT: "PLATFORM_PAYOUT",
  OTHER: "OTHER",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_DIRECTION = {
  RECEIVED: "RECEIVED",
  MADE: "MADE",
} as const;

export type PaymentDirection =
  (typeof PAYMENT_DIRECTION)[keyof typeof PAYMENT_DIRECTION];

export const RECONCILIATION_STATUS = {
  UNMATCHED: "UNMATCHED",
  PARTIALLY_MATCHED: "PARTIALLY_MATCHED",
  MATCHED: "MATCHED",
  RECONCILED: "RECONCILED",
} as const;

export type ReconciliationStatus =
  (typeof RECONCILIATION_STATUS)[keyof typeof RECONCILIATION_STATUS];

export const BANK_DIRECTION = {
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
} as const;

export type BankDirection = (typeof BANK_DIRECTION)[keyof typeof BANK_DIRECTION];

export const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  VOID: "VOID",
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const SUPPLIER_BILL_STATUS = {
  DRAFT: "DRAFT",
  DUE: "DUE",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  DISPUTED: "DISPUTED",
  VOID: "VOID",
} as const;

export type SupplierBillStatus =
  (typeof SUPPLIER_BILL_STATUS)[keyof typeof SUPPLIER_BILL_STATUS];

export const DEPOSIT_STATUS = {
  RECEIVED: "RECEIVED",
  HELD: "HELD",
  RETURNED: "RETURNED",
  PARTIALLY_RETAINED: "PARTIALLY_RETAINED",
  RETAINED: "RETAINED",
} as const;

export type DepositStatus = (typeof DEPOSIT_STATUS)[keyof typeof DEPOSIT_STATUS];

export const REFUND_REASON = {
  GUEST_CANCELLATION: "GUEST_CANCELLATION",
  COMPLAINT: "COMPLAINT",
  CLEANING_ISSUE: "CLEANING_ISSUE",
  PROPERTY_ISSUE: "PROPERTY_ISSUE",
  HOST_CANCELLATION: "HOST_CANCELLATION",
  DUPLICATE_PAYMENT: "DUPLICATE_PAYMENT",
  DAMAGE: "DAMAGE",
  GOODWILL: "GOODWILL",
  OTHER: "OTHER",
} as const;

export type RefundReason = (typeof REFUND_REASON)[keyof typeof REFUND_REASON];

export const RECURRENCE = {
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  ANNUALLY: "ANNUALLY",
  CUSTOM: "CUSTOM",
} as const;

export type Recurrence = (typeof RECURRENCE)[keyof typeof RECURRENCE];

export const DOCUMENT_KIND = {
  CUSTOMER_INVOICE: "CUSTOMER_INVOICE",
  SUPPLIER_INVOICE: "SUPPLIER_INVOICE",
  RECEIPT: "RECEIPT",
  CONTRACT: "CONTRACT",
  UTILITY_BILL: "UTILITY_BILL",
  BANK_STATEMENT: "BANK_STATEMENT",
  INSURANCE: "INSURANCE",
  LICENCE: "LICENCE",
  COMPLIANCE_CERTIFICATE: "COMPLIANCE_CERTIFICATE",
  LEASE: "LEASE",
  AIRBNB_STATEMENT: "AIRBNB_STATEMENT",
  BOOKING_COM_STATEMENT: "BOOKING_COM_STATEMENT",
  TAX_DOCUMENT: "TAX_DOCUMENT",
  ACCOUNTANT_DOCUMENT: "ACCOUNTANT_DOCUMENT",
  OTHER: "OTHER",
} as const;

export type DocumentKind = (typeof DOCUMENT_KIND)[keyof typeof DOCUMENT_KIND];

export const ALERT_KIND = {
  INVOICE_OVERDUE: "INVOICE_OVERDUE",
  SUPPLIER_BILL_DUE: "SUPPLIER_BILL_DUE",
  RENT_DUE: "RENT_DUE",
  VAT_THRESHOLD_APPROACHING: "VAT_THRESHOLD_APPROACHING",
  VAT_THRESHOLD_EXCEEDED: "VAT_THRESHOLD_EXCEEDED",
  UTILITY_INCREASE: "UTILITY_INCREASE",
  INSURANCE_EXPIRING: "INSURANCE_EXPIRING",
  CERTIFICATE_EXPIRING: "CERTIFICATE_EXPIRING",
  LEASE_EXPIRING: "LEASE_EXPIRING",
  SUBSCRIPTION_RENEWAL: "SUBSCRIPTION_RENEWAL",
  BANK_UNMATCHED: "BANK_UNMATCHED",
  PAYOUT_UNMATCHED: "PAYOUT_UNMATCHED",
} as const;

export type AlertKind = (typeof ALERT_KIND)[keyof typeof ALERT_KIND];

export const LEDGER_KIND = {
  INCOME: "INCOME",
  REFUND: "REFUND",
  EXPENSE: "EXPENSE",
} as const;

export type LedgerKind = (typeof LEDGER_KIND)[keyof typeof LEDGER_KIND];

export const CATEGORY_GROUP = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export const FULL_BUSINESS_USE_BPS = 10_000;
export const VAT_WARNING_UTILISATION_BPS = 8_000;
export const DEFAULT_DOCUMENT_RETENTION_YEARS = 7;
export const UTILITY_INCREASE_BPS = 12_500;
export const CERTIFICATE_WARNING_DAYS = 30;
export const LEASE_WARNING_DAYS = 60;
export const RENEWAL_WARNING_DAYS = 30;
export const BILL_HORIZON_DAYS = 30;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 120;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_PASSWORD_LENGTH = 12;
export const INVITE_LIFETIME_DAYS = 7;

export const PARENT_CATEGORY = {
  ACCOMMODATION: "ACCOMMODATION",
  GUEST_FEES: "GUEST_FEES",
  ADDITIONAL_INCOME: "ADDITIONAL_INCOME",
  PROPERTY_RENT: "PROPERTY_RENT",
  UTILITIES: "UTILITIES",
  CLEANING: "CLEANING",
  LAUNDRY_LINEN: "LAUNDRY_LINEN",
  GUEST_CONSUMABLES: "GUEST_CONSUMABLES",
  MAINTENANCE: "MAINTENANCE",
  FURNITURE: "FURNITURE",
  PLATFORM_FEES: "PLATFORM_FEES",
  INSURANCE: "INSURANCE",
  COMPLIANCE: "COMPLIANCE",
  SOFTWARE: "SOFTWARE",
  MARKETING: "MARKETING",
  PROFESSIONAL_FEES: "PROFESSIONAL_FEES",
  TRAVEL: "TRAVEL",
  STAFF: "STAFF",
  COMPANY_GENERAL: "COMPANY_GENERAL",
  ENTERTAINMENT: "ENTERTAINMENT",
} as const;

export const INCOME_CODE = {
  AIRBNB_BOOKING: "AIRBNB_BOOKING",
  BOOKING_COM_BOOKING: "BOOKING_COM_BOOKING",
  VRBO_BOOKING: "VRBO_BOOKING",
  EXPEDIA_BOOKING: "EXPEDIA_BOOKING",
  OTHER_OTA_BOOKING: "OTHER_OTA_BOOKING",
  DIRECT_BOOKING: "DIRECT_BOOKING",
  CORPORATE_ACCOMMODATION: "CORPORATE_ACCOMMODATION",
  CLEANING_FEE: "CLEANING_FEE",
  EXTRA_GUEST_FEE: "EXTRA_GUEST_FEE",
  PARKING_FEE: "PARKING_FEE",
  OTHER_GUEST_FEE: "OTHER_GUEST_FEE",
  DEPOSIT_RETAINED: "DEPOSIT_RETAINED",
} as const;

export const EXPENSE_CODE = {
  AIRBNB_HOST_FEE: "AIRBNB_HOST_FEE",
  BOOKING_COM_COMMISSION: "BOOKING_COM_COMMISSION",
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING",
  OTHER_OTA_FEE: "OTHER_OTA_FEE",
  GUEST_TURNOVER_CLEANING: "GUEST_TURNOVER_CLEANING",
  LAUNDRY_SERVICE: "LAUNDRY_SERVICE",
  GUEST_CONSUMABLES: "CONSUMABLE_SUPPLIES",
  LANDLORD_RENT: "LANDLORD_RENT",
  COUNCIL_TAX: "COUNCIL_TAX",
  ELECTRICITY: "ELECTRICITY",
  GAS: "GAS",
  WATER: "WATER",
  BROADBAND: "BROADBAND",
  BUILDING_INSURANCE: "BUILDING_INSURANCE",
} as const;

export const ALLOWED_UPLOAD_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "heic"] as const;

export const MESSAGE = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  LOGIN_LIMITED: "Too many sign-in attempts. Wait 15 minutes and try again.",
  UNAUTHORISED: "You do not have permission to do that.",
  ORGANISATION_CREATE_DENIED: "Only an owner or organisation admin can create an organisation.",
  NOT_FOUND: "That record was not found.",
  VALIDATION: "Check the highlighted fields.",
  PAYMENT_EXCEEDS_BALANCE: "Payment is greater than the outstanding balance.",
  PAYMENT_NOT_POSITIVE: "Payment amount must be greater than zero.",
  NEGATIVE_MONEY: "Amounts cannot be negative.",
  STAY_DATES: "Check-out must be after check-in.",
  PAYOUT_MISMATCH: "Payout total does not equal the linked bookings.",
  AMBIGUOUS_MATCH: "More than one record has this amount. Match it manually.",
  FILE_TYPE: "Upload a PDF, JPG, JPEG, PNG, or HEIC file.",
  FILE_SIZE: "File is larger than 10 MB.",
  CSV_REJECTED: "The file was not imported. Fix the listed rows and try again.",
  SAVED: "Saved.",
  RECONCILED: "Bank transaction reconciled.",
  EMAIL_IN_USE: "That person already belongs to this organisation.",
  ALREADY_MEMBER: "That person already belongs to this organisation.",
  USER_CREATED: "User created. They can sign in with that email and password.",
  USER_ADDED: "Added to this organisation. They sign in with their existing password.",
  ACCOUNT_DISABLED: "That account is disabled and cannot be added.",
  LAST_OWNER: "The company needs at least one active owner.",
  OWN_ACCESS: "You cannot change your own access.",
  INVITE_CLOSED: "This invite is no longer valid. Ask an owner for a new link.",
  PASSWORD_SHORT: "Use at least 12 characters.",
  PASSWORD_MISMATCH: "The passwords do not match.",
  PROPERTY_EXISTS: "This address is already a property in this organisation.",
  PROPERTY_POSTCODE_UNKNOWN: "That is not a UK postcode.",
  PROPERTY_SEARCH_SHORT: "Enter a street or a postcode.",
  PROPERTY_SEARCH_LONG: "Shorten the address and try again.",
  PROPERTY_SEARCH_NONE: "No matching UK address. Enter the property details.",
  PROPERTY_SEARCH_UNAVAILABLE: "Address search is unavailable. Check the details below.",
} as const;
