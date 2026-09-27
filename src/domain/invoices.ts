import { INVOICE_STATUS, MESSAGE, SUPPLIER_BILL_STATUS, type InvoiceStatus, type SupplierBillStatus } from "@/domain/constants";
import type { IsoDate } from "@/domain/dates";
import { DomainError } from "@/domain/money";

export function outstandingBalance(totalPence: number, paidPence: number): number {
  if (paidPence < 0 || totalPence < 0) {
    throw new DomainError(MESSAGE.NEGATIVE_MONEY);
  }
  if (paidPence > totalPence) {
    throw new DomainError(MESSAGE.PAYMENT_EXCEEDS_BALANCE);
  }
  return totalPence - paidPence;
}

export function applyPayment(balancePence: number, paymentPence: number): number {
  if (paymentPence <= 0) {
    throw new DomainError(MESSAGE.PAYMENT_NOT_POSITIVE);
  }
  if (paymentPence > balancePence) {
    throw new DomainError(MESSAGE.PAYMENT_EXCEEDS_BALANCE);
  }
  return balancePence - paymentPence;
}

export function invoiceCollectionStatus(input: {
  totalPence: number;
  paidPence: number;
  dueOn: IsoDate;
  today: IsoDate;
  isVoid: boolean;
  isDraft: boolean;
}): InvoiceStatus {
  if (input.isVoid) {
    return INVOICE_STATUS.VOID;
  }
  if (input.isDraft) {
    return INVOICE_STATUS.DRAFT;
  }
  const balance = outstandingBalance(input.totalPence, input.paidPence);
  if (balance === 0) {
    return INVOICE_STATUS.PAID;
  }
  if (input.dueOn < input.today) {
    return INVOICE_STATUS.OVERDUE;
  }
  if (input.paidPence > 0) {
    return INVOICE_STATUS.PARTIALLY_PAID;
  }
  return INVOICE_STATUS.ISSUED;
}

export function supplierBillStatus(input: {
  totalPence: number;
  paidPence: number;
  dueOn: IsoDate;
  today: IsoDate;
  isVoid: boolean;
  isDraft: boolean;
  isDisputed: boolean;
}): SupplierBillStatus {
  if (input.isVoid) {
    return SUPPLIER_BILL_STATUS.VOID;
  }
  if (input.isDisputed) {
    return SUPPLIER_BILL_STATUS.DISPUTED;
  }
  if (input.isDraft) {
    return SUPPLIER_BILL_STATUS.DRAFT;
  }
  const balance = outstandingBalance(input.totalPence, input.paidPence);
  if (balance === 0) {
    return SUPPLIER_BILL_STATUS.PAID;
  }
  if (input.dueOn < input.today) {
    return SUPPLIER_BILL_STATUS.OVERDUE;
  }
  if (input.paidPence > 0) {
    return SUPPLIER_BILL_STATUS.PARTIALLY_PAID;
  }
  return SUPPLIER_BILL_STATUS.DUE;
}

export type AgeingBucket = "current" | "days1to30" | "days31to60" | "days61plus";

export function ageingBucket(dueOn: IsoDate, today: IsoDate, balancePence: number): AgeingBucket | null {
  if (balancePence <= 0) {
    return null;
  }
  if (dueOn >= today) {
    return "current";
  }
  const due = Date.parse(`${dueOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  const days = Math.floor((now - due) / 86_400_000);
  if (days <= 30) {
    return "days1to30";
  }
  if (days <= 60) {
    return "days31to60";
  }
  return "days61plus";
}
