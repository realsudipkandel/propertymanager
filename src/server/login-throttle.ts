import {
  LOGIN_ACCOUNT_FAILURE_LIMIT,
  LOGIN_ADDRESS_FAILURE_LIMIT,
  loginIsLimited,
  retainedLoginFailures,
} from "@/domain/login-limit";

const failuresByKey = new Map<string, number[]>();

function accountKey(email: string): string {
  return `account:${email}`;
}

function addressKey(address: string): string {
  return `address:${address}`;
}

export function loginAttemptBlocked(email: string, address: string, now: number): boolean {
  const accountFailures = failuresByKey.get(accountKey(email)) ?? [];
  const addressFailures = failuresByKey.get(addressKey(address)) ?? [];
  return loginIsLimited(accountFailures, now, LOGIN_ACCOUNT_FAILURE_LIMIT) || loginIsLimited(addressFailures, now, LOGIN_ADDRESS_FAILURE_LIMIT);
}

export function recordLoginFailure(email: string, address: string, now: number): void {
  rememberFailure(accountKey(email), now);
  rememberFailure(addressKey(address), now);
}

export function clearLoginFailures(email: string, address: string): void {
  failuresByKey.delete(accountKey(email));
  failuresByKey.delete(addressKey(address));
}

function rememberFailure(key: string, now: number): void {
  const retained = retainedLoginFailures(failuresByKey.get(key) ?? [], now);
  retained.push(now);
  failuresByKey.set(key, retained);
}
