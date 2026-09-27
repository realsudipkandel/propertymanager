import { Prisma } from "@prisma/client";

export function toPence(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }
  return value.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

export function fromPence(pence: number): Prisma.Decimal {
  return new Prisma.Decimal(pence).div(100);
}

export function percentToBasisPoints(value: Prisma.Decimal): number {
  return value.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}
