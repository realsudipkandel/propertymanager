import { USER_ROLE, type UserRole } from "@/domain/constants";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: readonly UserRole[];
};

const ALL_ROLES: readonly UserRole[] = [
  USER_ROLE.OWNER,
  USER_ROLE.ACCOUNTANT,
  USER_ROLE.PROPERTY_MANAGER,
  USER_ROLE.VIEWER,
];

const FINANCE: readonly UserRole[] = [USER_ROLE.OWNER, USER_ROLE.ACCOUNTANT, USER_ROLE.VIEWER];
const OPERATIONS: readonly UserRole[] = [
  USER_ROLE.OWNER,
  USER_ROLE.ACCOUNTANT,
  USER_ROLE.PROPERTY_MANAGER,
  USER_ROLE.VIEWER,
];

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: "layout", roles: ALL_ROLES },
  { href: "/bookings", label: "Bookings", icon: "calendar", roles: OPERATIONS },
  { href: "/income", label: "Income", icon: "trending", roles: FINANCE },
  { href: "/expenses", label: "Expenses", icon: "receipt", roles: [...FINANCE, USER_ROLE.PROPERTY_MANAGER, USER_ROLE.CLEANER] },
  { href: "/invoices", label: "Invoices", icon: "file", roles: FINANCE },
  { href: "/payments", label: "Payments", icon: "coins", roles: FINANCE },
  { href: "/properties", label: "Properties", icon: "home", roles: OPERATIONS },
  { href: "/customers", label: "Customers", icon: "users", roles: FINANCE },
  { href: "/suppliers", label: "Suppliers", icon: "truck", roles: FINANCE },
  { href: "/banking", label: "Banking", icon: "landmark", roles: FINANCE },
  { href: "/reconciliation", label: "Reconciliation", icon: "scale", roles: FINANCE },
  { href: "/documents", label: "Documents", icon: "folder", roles: [...FINANCE, USER_ROLE.PROPERTY_MANAGER, USER_ROLE.CLEANER] },
  { href: "/reports", label: "Reports", icon: "chart", roles: [...FINANCE, USER_ROLE.PROPERTY_MANAGER] },
  { href: "/tax", label: "Tax & VAT", icon: "percent", roles: [USER_ROLE.OWNER, USER_ROLE.ACCOUNTANT] },
  { href: "/settings", label: "Settings", icon: "settings", roles: [...ALL_ROLES, USER_ROLE.CLEANER] },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
