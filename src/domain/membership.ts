import { INVITE_LIFETIME_DAYS, MESSAGE, MIN_PASSWORD_LENGTH, USER_ROLE, type UserRole } from "@/domain/constants";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isUserRole(value: string): value is UserRole {
  return Object.values(USER_ROLE).includes(value as UserRole);
}

export function normaliseEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !email.includes("@")) {
    return null;
  }
  const [local, domain, extra] = email.split("@");
  if (!local || !domain || extra || !domain.includes(".")) {
    return null;
  }
  return email;
}

export function inviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITE_LIFETIME_DAYS * DAY_MS);
}

export function inviteIsOpen(input: {
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  now: Date;
}): boolean {
  return input.acceptedAt === null && input.revokedAt === null && input.expiresAt.getTime() > input.now.getTime();
}

export function memberCreateErrors(input: {
  name: string;
  email: string | null;
  role: string;
  password: string;
  confirmPassword: string;
  accountExists: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.accountExists && (input.name.length < NAME_MIN_LENGTH || input.name.length > NAME_MAX_LENGTH)) {
    errors.name = "Enter their name.";
  }
  if (!input.email) {
    errors.email = "Enter a valid email address.";
  }
  if (!isUserRole(input.role)) {
    errors.role = "Choose a role.";
  }
  if (!input.accountExists && input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = MESSAGE.PASSWORD_SHORT;
  }
  if (!input.accountExists && input.password.length >= MIN_PASSWORD_LENGTH && input.password !== input.confirmPassword) {
    errors.confirmPassword = MESSAGE.PASSWORD_MISMATCH;
  }
  return errors;
}

export function membershipChangeBlock(input: {
  actorUserId: string;
  targetUserId: string;
  nextActive: boolean;
  nextRole: UserRole;
  activeOwnerIds: readonly string[];
}): string | null {
  if (input.actorUserId === input.targetUserId) {
    return "OWN_ACCESS";
  }
  const targetIsOnlyOwner = input.activeOwnerIds.length === 1 && input.activeOwnerIds[0] === input.targetUserId;
  const removesOnlyOwner = targetIsOnlyOwner && (!input.nextActive || input.nextRole !== USER_ROLE.OWNER);
  if (removesOnlyOwner) {
    return "LAST_OWNER";
  }
  return null;
}
