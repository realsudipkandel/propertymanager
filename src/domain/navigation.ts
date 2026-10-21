import { USER_ROLE, type UserRole } from "@/domain/constants";
import { pathWithinOrganization } from "@/domain/organization";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: readonly UserRole[];
};

const ALL_ROLES: readonly UserRole[] = [
  USER_ROLE.OWNER,
  USER_ROLE.ORGANIZATION_ADMIN,
  USER_ROLE.FINANCE_MANAGER,
  USER_ROLE.ACCOUNTANT,
  USER_ROLE.PROPERTY_MANAGER,
  USER_ROLE.OPERATIONS,
  USER_ROLE.VIEWER,
];

const FINANCE: readonly UserRole[] = [
  USER_ROLE.OWNER,
  USER_ROLE.ORGANIZATION_ADMIN,
  USER_ROLE.FINANCE_MANAGER,
  USER_ROLE.ACCOUNTANT,
  USER_ROLE.VIEWER,
];
const OPERATIONS: readonly UserRole[] = [
  USER_ROLE.OWNER,
  USER_ROLE.ORGANIZATION_ADMIN,
  USER_ROLE.FINANCE_MANAGER,
  USER_ROLE.ACCOUNTANT,
  USER_ROLE.PROPERTY_MANAGER,
  USER_ROLE.OPERATIONS,
  USER_ROLE.VIEWER,
];

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: "layout", roles: ALL_ROLES },
  { href: "/channels", label: "Channels", icon: "globe", roles: OPERATIONS },
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
  { href: "/team", label: "Team", icon: "team", roles: [...ALL_ROLES, USER_ROLE.CLEANER] },
  { href: "/settings", label: "Settings", icon: "settings", roles: [...ALL_ROLES, USER_ROLE.CLEANER] },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const within = pathWithinOrganization(pathname) ?? pathname;
  const path = within.length > 1 && within.endsWith("/") ? within.slice(0, -1) : within;
  if (path === "/search" || path.startsWith("/search?")) {
    return true;
  }
  const matches = NAV_ITEMS.filter((item) => {
    if (item.href === "/") {
      return path === "/";
    }
    return path === item.href || path.startsWith(`${item.href}/`);
  });
  const longest = matches.reduce<NavItem | null>((best, item) => {
    if (!best || item.href.length > best.href.length) {
      return item;
    }
    return best;
  }, null);
  if (!longest) {
    return false;
  }
  return longest.roles.includes(role);
}

export function homeForRole(role: UserRole): string {
  const landing = navForRole(role)[0];
  return landing ? landing.href : "/settings";
}
