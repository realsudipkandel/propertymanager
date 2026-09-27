import {
  BOOKING_PLATFORM,
  DEPOSIT_STATUS,
  DOCUMENT_KIND,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  RECONCILIATION_STATUS,
  REFUND_REASON,
  SUPPLIER_BILL_STATUS,
  TAX_CLASSIFICATION,
  USER_ROLE,
  VAT_TREATMENT,
  type BookingPlatform,
  type DepositStatus,
  type DocumentKind,
  type InvoiceStatus,
  type PaymentMethod,
  type ReconciliationStatus,
  type RefundReason,
  type SupplierBillStatus,
  type TaxClassification,
  type UserRole,
  type VatTreatment,
} from "@/domain/constants";

export const ROLE_LABEL: Record<UserRole, string> = {
  [USER_ROLE.OWNER]: "Owner / Director",
  [USER_ROLE.ACCOUNTANT]: "Accountant",
  [USER_ROLE.PROPERTY_MANAGER]: "Property manager",
  [USER_ROLE.CLEANER]: "Cleaner",
  [USER_ROLE.VIEWER]: "Viewer",
};

export const PLATFORM_LABEL: Record<BookingPlatform, string> = {
  [BOOKING_PLATFORM.AIRBNB]: "Airbnb",
  [BOOKING_PLATFORM.BOOKING_COM]: "Booking.com",
  [BOOKING_PLATFORM.VRBO]: "VRBO",
  [BOOKING_PLATFORM.EXPEDIA]: "Expedia",
  [BOOKING_PLATFORM.HOTELS_COM]: "Hotels.com",
  [BOOKING_PLATFORM.AGODA]: "Agoda",
  [BOOKING_PLATFORM.DIRECT_WEBSITE]: "Direct website",
  [BOOKING_PLATFORM.PHONE_BOOKING]: "Phone booking",
  [BOOKING_PLATFORM.CORPORATE_CLIENT]: "Corporate client",
  [BOOKING_PLATFORM.TRAVEL_AGENT]: "Travel agent",
  [BOOKING_PLATFORM.OTHER]: "Other",
};

export const TAX_LABEL: Record<TaxClassification, string> = {
  [TAX_CLASSIFICATION.ALLOWABLE]: "Allowable",
  [TAX_CLASSIFICATION.DISALLOWABLE]: "Disallowable",
  [TAX_CLASSIFICATION.PARTIALLY_ALLOWABLE]: "Partially allowable",
  [TAX_CLASSIFICATION.CAPITAL]: "Capital",
  [TAX_CLASSIFICATION.FINANCE_COST]: "Finance cost",
  [TAX_CLASSIFICATION.UNKNOWN]: "Unknown",
  [TAX_CLASSIFICATION.ACCOUNTANT_REVIEW]: "Accountant review",
};

export const VAT_LABEL: Record<VatTreatment, string> = {
  [VAT_TREATMENT.STANDARD]: "Standard",
  [VAT_TREATMENT.REDUCED]: "Reduced",
  [VAT_TREATMENT.ZERO]: "Zero",
  [VAT_TREATMENT.EXEMPT]: "Exempt",
  [VAT_TREATMENT.OUTSIDE_SCOPE]: "Outside scope",
  [VAT_TREATMENT.REVERSE_CHARGE]: "Reverse charge",
  [VAT_TREATMENT.UNKNOWN]: "Unknown",
};

export const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  [INVOICE_STATUS.DRAFT]: "Draft",
  [INVOICE_STATUS.ISSUED]: "Issued",
  [INVOICE_STATUS.PARTIALLY_PAID]: "Partially paid",
  [INVOICE_STATUS.PAID]: "Paid",
  [INVOICE_STATUS.OVERDUE]: "Overdue",
  [INVOICE_STATUS.VOID]: "Void",
};

export const BILL_LABEL: Record<SupplierBillStatus, string> = {
  [SUPPLIER_BILL_STATUS.DRAFT]: "Draft",
  [SUPPLIER_BILL_STATUS.DUE]: "Due",
  [SUPPLIER_BILL_STATUS.PARTIALLY_PAID]: "Partially paid",
  [SUPPLIER_BILL_STATUS.PAID]: "Paid",
  [SUPPLIER_BILL_STATUS.OVERDUE]: "Overdue",
  [SUPPLIER_BILL_STATUS.DISPUTED]: "Disputed",
  [SUPPLIER_BILL_STATUS.VOID]: "Void",
};

export const RECONCILIATION_LABEL: Record<ReconciliationStatus, string> = {
  [RECONCILIATION_STATUS.UNMATCHED]: "Unmatched",
  [RECONCILIATION_STATUS.PARTIALLY_MATCHED]: "Partially matched",
  [RECONCILIATION_STATUS.MATCHED]: "Matched",
  [RECONCILIATION_STATUS.RECONCILED]: "Reconciled",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  [PAYMENT_METHOD.BANK_TRANSFER]: "Bank transfer",
  [PAYMENT_METHOD.CARD]: "Card",
  [PAYMENT_METHOD.CASH]: "Cash",
  [PAYMENT_METHOD.DIRECT_DEBIT]: "Direct debit",
  [PAYMENT_METHOD.STRIPE]: "Stripe",
  [PAYMENT_METHOD.PAYPAL]: "PayPal",
  [PAYMENT_METHOD.PLATFORM_PAYOUT]: "Platform payout",
  [PAYMENT_METHOD.OTHER]: "Other",
};

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  [DEPOSIT_STATUS.RECEIVED]: "Deposit received",
  [DEPOSIT_STATUS.HELD]: "Deposit held",
  [DEPOSIT_STATUS.RETURNED]: "Deposit returned",
  [DEPOSIT_STATUS.PARTIALLY_RETAINED]: "Partially retained",
  [DEPOSIT_STATUS.RETAINED]: "Deposit retained",
};

export const REFUND_LABEL: Record<RefundReason, string> = {
  [REFUND_REASON.GUEST_CANCELLATION]: "Guest cancellation",
  [REFUND_REASON.COMPLAINT]: "Complaint",
  [REFUND_REASON.CLEANING_ISSUE]: "Cleaning issue",
  [REFUND_REASON.PROPERTY_ISSUE]: "Property issue",
  [REFUND_REASON.HOST_CANCELLATION]: "Host cancellation",
  [REFUND_REASON.DUPLICATE_PAYMENT]: "Duplicate payment",
  [REFUND_REASON.DAMAGE]: "Damage",
  [REFUND_REASON.GOODWILL]: "Goodwill",
  [REFUND_REASON.OTHER]: "Other",
};

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  [DOCUMENT_KIND.CUSTOMER_INVOICE]: "Customer invoice",
  [DOCUMENT_KIND.SUPPLIER_INVOICE]: "Supplier invoice",
  [DOCUMENT_KIND.RECEIPT]: "Receipt",
  [DOCUMENT_KIND.CONTRACT]: "Contract",
  [DOCUMENT_KIND.UTILITY_BILL]: "Utility bill",
  [DOCUMENT_KIND.BANK_STATEMENT]: "Bank statement",
  [DOCUMENT_KIND.INSURANCE]: "Insurance",
  [DOCUMENT_KIND.LICENCE]: "Licence",
  [DOCUMENT_KIND.COMPLIANCE_CERTIFICATE]: "Compliance certificate",
  [DOCUMENT_KIND.LEASE]: "Lease",
  [DOCUMENT_KIND.AIRBNB_STATEMENT]: "Airbnb statement",
  [DOCUMENT_KIND.BOOKING_COM_STATEMENT]: "Booking.com statement",
  [DOCUMENT_KIND.TAX_DOCUMENT]: "Tax document",
  [DOCUMENT_KIND.ACCOUNTANT_DOCUMENT]: "Accountant document",
  [DOCUMENT_KIND.OTHER]: "Other",
};
