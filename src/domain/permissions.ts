import { USER_ROLE, type UserRole } from "@/domain/constants";

const OWNER_ROLES: readonly UserRole[] = [USER_ROLE.OWNER, USER_ROLE.ORGANIZATION_ADMIN];
const FINANCE_ROLES: readonly UserRole[] = [
  USER_ROLE.OWNER,
  USER_ROLE.ORGANIZATION_ADMIN,
  USER_ROLE.FINANCE_MANAGER,
  USER_ROLE.ACCOUNTANT,
];
const MUTATE_ROLES: readonly UserRole[] = [
  ...FINANCE_ROLES,
  USER_ROLE.PROPERTY_MANAGER,
  USER_ROLE.OPERATIONS,
];
const OPERATIONS_ROLES: readonly UserRole[] = [
  ...MUTATE_ROLES,
  USER_ROLE.VIEWER,
];

export function canViewFinance(role: UserRole): boolean {
  return role !== USER_ROLE.CLEANER;
}

export function canMutateFinance(role: UserRole): boolean {
  return MUTATE_ROLES.includes(role);
}

export function canManageSettings(role: UserRole): boolean {
  return OWNER_ROLES.includes(role);
}

export function canCreateOrganization(role: UserRole): boolean {
  return OWNER_ROLES.includes(role);
}

export function canViewTax(role: UserRole): boolean {
  return FINANCE_ROLES.includes(role);
}

export function canConfigureBank(role: UserRole): boolean {
  return OWNER_ROLES.includes(role);
}

export function canUploadReceipt(role: UserRole): boolean {
  return canMutateFinance(role) || role === USER_ROLE.CLEANER;
}

export function canViewOperations(role: UserRole): boolean {
  return OPERATIONS_ROLES.includes(role) || role === USER_ROLE.VIEWER;
}

export function canPostExpense(role: UserRole, parentCategoryCode: string | null): boolean {
  if (role === USER_ROLE.VIEWER || role === USER_ROLE.CLEANER) {
    return role === USER_ROLE.CLEANER && parentCategoryCode === "CLEANING";
  }
  return canMutateFinance(role);
}
