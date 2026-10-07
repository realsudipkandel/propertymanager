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

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
};

export function extensionAllowed(filename: string, allowed: readonly string[]): boolean {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return allowed.includes(extension) && filename.includes(".");
}

export function contentTypeForStorageKey(storageKey: string): string | null {
  const extension = storageKey.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? null;
}

export function attachmentDisposition(filename: string): string {
  const cleaned = filename.replace(/[^\w.\- ]+/g, "_").replace(/_+/g, "_").trim().slice(0, 120);
  const safeName = cleaned.length > 0 ? cleaned : "download";
  return `attachment; filename="${safeName}"`;
}
