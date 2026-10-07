const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug;
}

export function isOrganizationSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 48 && SLUG_PATTERN.test(value);
}

export function organizationPath(slug: string, path = "/"): string {
  const suffix = path === "/" ? "" : path;
  return `/org/${slug}${suffix}`;
}

export function pathWithinOrganization(pathname: string): string | null {
  const match = /^\/org\/[^/]+(\/.*)?$/.exec(pathname);
  if (!match) {
    return null;
  }
  if (!match[1] || match[1] === "/") {
    return "/";
  }
  return match[1];
}

export function sameOrganization(leftOrganizationId: string, rightOrganizationId: string): boolean {
  return leftOrganizationId.length > 0 && leftOrganizationId === rightOrganizationId;
}
