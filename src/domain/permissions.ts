import { USER_ROLE, type UserRole } from "@/domain/constants";

const FINANCE_ROLES: readonly UserRole[] = [USER_ROLE.OWNER, USER_ROLE.ACCOUNTANT];
const OPERATIONS_ROLES: readonly UserRole[] = [
  USER_ROLE.OWNER,
  USER_ROLE.ACCOUNTANT,
  USER_ROLE.PROPERTY_MANAGER,
];

export function canViewFinance(role: UserRole): boolean {
  return role !== USER_ROLE.CLEANER;
}

export function canMutateFinance(role: UserRole): boolean {
  return role === USER_ROLE.OWNER || role === USER_ROLE.ACCOUNTANT || role === USER_ROLE.PROPERTY_MANAGER;
}

export function canManageSettings(role: UserRole): boolean {
  return role === USER_ROLE.OWNER;
}

export function canViewTax(role: UserRole): boolean {
  return FINANCE_ROLES.includes(role);
}

export function canConfigureBank(role: UserRole): boolean {
  return role === USER_ROLE.OWNER;
}

export function canUploadReceipt(role: UserRole): boolean {
  return canMutateFinance(role) || role === USER_ROLE.CLEANER;
}

export function canViewOperations(role: UserRole): boolean {
  return OPERATIONS_ROLES.includes(role) || role === USER_ROLE.VIEWER;
}

export function visibleNavHrefs(role: UserRole): string[] {
  const hrefs = ["/"];
  if (canViewOperations(role)) {
    hrefs.push("/bookings", "/properties");
  }
  if (canViewFinance(role)) {
    hrefs.push(
      "/income",
      "/expenses",
      "/invoices",
      "/payments",
      "/customers",
      "/suppliers",
      "/banking",
      "/reconciliation",
      "/documents",
      "/reports",
    );
  }
  if (canViewTax(role)) {
    hrefs.push("/tax");
  }
  if (role === USER_ROLE.CLEANER) {
    hrefs.push("/expenses", "/documents");
  }
  hrefs.push("/settings");
  return hrefs;
}
