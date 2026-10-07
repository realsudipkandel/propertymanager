import { headers } from "next/headers";

import { organizationPath } from "@/domain/organization";

export async function currentOrganizationBase(): Promise<string> {
  const slug = (await headers()).get("x-org-slug") ?? "";
  if (!slug) {
    return "";
  }
  return organizationPath(slug);
}

export async function currentOrganizationSlug(): Promise<string> {
  return (await headers()).get("x-org-slug") ?? "";
}
