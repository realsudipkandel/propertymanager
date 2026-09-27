import { DomainError } from "@/domain/money";
import { MESSAGE } from "@/domain/constants";

export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function assertIsoDate(value: string): IsoDate {
  if (!parseIsoDate(value)) {
    throw new DomainError(`Invalid date: ${value}`);
  }
  return value;
}

export function dateToIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function todayIso(now: Date = new Date()): IsoDate {
  return dateToIso(now);
}

export function addDays(isoDate: IsoDate, days: number): IsoDate {
  const parsed = parseIsoDate(isoDate);
  if (!parsed || !Number.isInteger(days)) {
    throw new DomainError("Cannot move an invalid date.");
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return dateToIso(parsed);
}

export function daysBetween(start: IsoDate, end: IsoDate): number {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate) {
    throw new DomainError("Cannot compare invalid dates.");
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): number {
  const nights = daysBetween(checkIn, checkOut);
  if (nights < 1) {
    throw new DomainError(MESSAGE.STAY_DATES);
  }
  return nights;
}

export function inPeriod(isoDate: IsoDate, start: IsoDate, endExclusive: IsoDate): boolean {
  return isoDate >= start && isoDate < endExclusive;
}

export type DatePeriod = {
  start: IsoDate;
  endExclusive: IsoDate;
  label: string;
};

export function calendarMonthContaining(isoDate: IsoDate): DatePeriod {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    throw new DomainError("Invalid month date.");
  }
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const start = dateToIso(new Date(Date.UTC(year, month, 1)));
  const endExclusive = dateToIso(new Date(Date.UTC(year, month + 1, 1)));
  const label = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
  return { start, endExclusive, label };
}

export function trailingMonths(anchor: IsoDate, count: number): DatePeriod[] {
  if (count < 1) {
    throw new DomainError("Month count must be positive.");
  }
  const parsed = parseIsoDate(anchor);
  if (!parsed) {
    throw new DomainError("Invalid anchor date.");
  }
  const periods: DatePeriod[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() - offset, 1),
    );
    periods.push(calendarMonthContaining(dateToIso(cursor)));
  }
  return periods;
}

export function ukTaxYearContaining(isoDate: IsoDate): DatePeriod {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    throw new DomainError("Invalid tax year date.");
  }
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  const startsThisCalendarYear = month > 4 || (month === 4 && day >= 6);
  const startYear = startsThisCalendarYear ? year : year - 1;
  const start = `${startYear}-04-06`;
  const endExclusive = `${startYear + 1}-04-06`;
  return {
    start,
    endExclusive,
    label: `${startYear}/${String(startYear + 1).slice(2)} tax year`,
  };
}

export function companyFinancialYearContaining(
  isoDate: IsoDate,
  startMonth: number,
  startDay: number,
): DatePeriod {
  if (startMonth < 1 || startMonth > 12 || startDay < 1 || startDay > 31) {
    throw new DomainError("Financial year start is not a real date.");
  }
  const probe = parseIsoDate(
    `${2000}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
  );
  if (!probe || probe.getUTCMonth() + 1 !== startMonth || probe.getUTCDate() !== startDay) {
    throw new DomainError("Financial year start is not a real date.");
  }
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    throw new DomainError("Invalid financial year date.");
  }
  const year = parsed.getUTCFullYear();
  const thisStart = dateToIso(new Date(Date.UTC(year, startMonth - 1, startDay)));
  const start = isoDate >= thisStart
    ? thisStart
    : dateToIso(new Date(Date.UTC(year - 1, startMonth - 1, startDay)));
  const startDate = parseIsoDate(start);
  if (!startDate) {
    throw new DomainError("Could not resolve financial year.");
  }
  const endExclusive = dateToIso(
    new Date(Date.UTC(startDate.getUTCFullYear() + 1, startDate.getUTCMonth(), startDate.getUTCDate())),
  );
  const inclusiveEnd = addDays(endExclusive, -1);
  return {
    start,
    endExclusive,
    label: `${formatDisplayDate(start)} – ${formatDisplayDate(inclusiveEnd)}`,
  };
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function formatDisplayDate(isoDate: IsoDate): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    throw new DomainError("Invalid display date.");
  }
  const day = parsed.getUTCDate();
  const month = SHORT_MONTHS[parsed.getUTCMonth()];
  const year = parsed.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function daysInPeriod(period: DatePeriod): number {
  return daysBetween(period.start, period.endExclusive);
}
