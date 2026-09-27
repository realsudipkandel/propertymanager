import path from "node:path";

export function resolveStoragePath(root: string, storageKey: string): string | null {
  if (!storageKey || storageKey.includes("\0")) {
    return null;
  }
  if (storageKey.startsWith("/") || storageKey.includes("\\") || storageKey.split("/").includes("..")) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, storageKey);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return resolved;
}

export function extensionAllowed(filename: string, allowed: readonly string[]): boolean {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return allowed.includes(extension) && filename.includes(".");
}
