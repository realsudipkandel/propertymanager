const ORIGIN_PATTERN = /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i;

export function appOrigin(): string {
  const configured = process.env.APP_ORIGIN?.replace(/\/$/, "") ?? "";
  if (ORIGIN_PATTERN.test(configured)) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN must be an http(s) origin with no path.");
  }
  return "http://localhost:3000";
}
