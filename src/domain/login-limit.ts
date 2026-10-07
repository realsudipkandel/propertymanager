export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_ACCOUNT_FAILURE_LIMIT = 8;
export const LOGIN_ADDRESS_FAILURE_LIMIT = 40;

export function retainedLoginFailures(failures: readonly number[], now: number): number[] {
  return failures.filter((attemptedAt) => now - attemptedAt < LOGIN_WINDOW_MS);
}

export function loginIsLimited(failures: readonly number[], now: number, limit: number): boolean {
  return retainedLoginFailures(failures, now).length >= limit;
}
