import {
  ALERT_KIND,
  CERTIFICATE_WARNING_DAYS,
  LEASE_WARNING_DAYS,
  RENEWAL_WARNING_DAYS,
  UTILITY_INCREASE_BPS,
  VAT_WARNING,
  type AlertKind,
} from "@/domain/constants";
import { addDays, daysBetween, type IsoDate } from "@/domain/dates";
import type { VatWarning } from "@/domain/vat";

export type AlertItem = {
  kind: AlertKind;
  title: string;
  detail: string;
};

export type AlertInput = {
  today: IsoDate;
  overdueInvoices: number;
  supplierBillsDue: number;
  rentDue: number;
  unmatchedBankTransactions: number;
  unmatchedPayouts: number;
  vatWarning: VatWarning;
  certificateExpiries: Array<{ name: string; propertyName: string; expiresOn: IsoDate }>;
  leaseEnds: Array<{ propertyName: string; endsOn: IsoDate }>;
  renewals: Array<{ name: string; renewsOn: IsoDate }>;
  insuranceExpiries: Array<{ name: string; expiresOn: IsoDate }>;
  utilityThisMonthPence: number;
  utilityPreviousMonthPence: number;
};

function withinDays(today: IsoDate, target: IsoDate, days: number): boolean {
  const difference = daysBetween(today, target);
  return difference >= 0 && difference <= days;
}

export function buildAlerts(input: AlertInput): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (input.overdueInvoices > 0) {
    alerts.push({
      kind: ALERT_KIND.INVOICE_OVERDUE,
      title: "Invoice overdue",
      detail: `${input.overdueInvoices} customer invoice${input.overdueInvoices === 1 ? "" : "s"} past the due date.`,
    });
  }
  if (input.supplierBillsDue > 0) {
    alerts.push({
      kind: ALERT_KIND.SUPPLIER_BILL_DUE,
      title: "Supplier bill due",
      detail: `${input.supplierBillsDue} supplier bill${input.supplierBillsDue === 1 ? "" : "s"} due soon or overdue.`,
    });
  }
  if (input.rentDue > 0) {
    alerts.push({
      kind: ALERT_KIND.RENT_DUE,
      title: "Property rent due",
      detail: `${input.rentDue} rent payment${input.rentDue === 1 ? "" : "s"} coming up.`,
    });
  }
  if (input.vatWarning === VAT_WARNING.EXCEEDED) {
    alerts.push({
      kind: ALERT_KIND.VAT_THRESHOLD_EXCEEDED,
      title: "VAT registration threshold exceeded",
      detail: "Rolling taxable turnover is over the configured threshold. Review VAT registration.",
    });
  } else if (input.vatWarning === VAT_WARNING.APPROACHING) {
    alerts.push({
      kind: ALERT_KIND.VAT_THRESHOLD_APPROACHING,
      title: "VAT threshold approaching",
      detail: "Turnover has reached 80% of the configured VAT registration threshold.",
    });
  }
  if (
    input.utilityPreviousMonthPence > 0 &&
    input.utilityThisMonthPence * 10_000 >= input.utilityPreviousMonthPence * UTILITY_INCREASE_BPS
  ) {
    alerts.push({
      kind: ALERT_KIND.UTILITY_INCREASE,
      title: "Unexpected utility increase",
      detail: "Utilities this month are at least 25% higher than last month.",
    });
  }
  for (const certificate of input.certificateExpiries) {
    if (withinDays(input.today, certificate.expiresOn, CERTIFICATE_WARNING_DAYS)) {
      alerts.push({
        kind: ALERT_KIND.CERTIFICATE_EXPIRING,
        title: `${certificate.name} expiring`,
        detail: `${certificate.propertyName} expires on ${certificate.expiresOn}.`,
      });
    }
  }
  for (const lease of input.leaseEnds) {
    if (withinDays(input.today, lease.endsOn, LEASE_WARNING_DAYS)) {
      alerts.push({
        kind: ALERT_KIND.LEASE_EXPIRING,
        title: "Lease expiring",
        detail: `${lease.propertyName} lease ends on ${lease.endsOn}.`,
      });
    }
  }
  for (const renewal of input.renewals) {
    if (withinDays(input.today, renewal.renewsOn, RENEWAL_WARNING_DAYS)) {
      alerts.push({
        kind: ALERT_KIND.SUBSCRIPTION_RENEWAL,
        title: "Subscription renewal",
        detail: `${renewal.name} renews on ${renewal.renewsOn}.`,
      });
    }
  }
  for (const insurance of input.insuranceExpiries) {
    if (withinDays(input.today, insurance.expiresOn, RENEWAL_WARNING_DAYS)) {
      alerts.push({
        kind: ALERT_KIND.INSURANCE_EXPIRING,
        title: "Insurance expiring",
        detail: `${insurance.name} expires on ${insurance.expiresOn}.`,
      });
    }
  }
  if (input.unmatchedBankTransactions > 0) {
    alerts.push({
      kind: ALERT_KIND.BANK_UNMATCHED,
      title: "Bank transaction unmatched",
      detail: `${input.unmatchedBankTransactions} bank transaction${input.unmatchedBankTransactions === 1 ? "" : "s"} still unmatched.`,
    });
  }
  if (input.unmatchedPayouts > 0) {
    alerts.push({
      kind: ALERT_KIND.PAYOUT_UNMATCHED,
      title: "Airbnb payout unmatched",
      detail: `${input.unmatchedPayouts} payout${input.unmatchedPayouts === 1 ? "" : "s"} not reconciled to the bank.`,
    });
  }
  return alerts;
}

export function horizonEnd(today: IsoDate, days: number): IsoDate {
  return addDays(today, days);
}
