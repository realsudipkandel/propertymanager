"use client";

import {
  CalendarRange,
  ChartColumn,
  Coins,
  FileText,
  FolderOpen,
  Globe,
  Home,
  Landmark,
  LayoutDashboard,
  Percent,
  Receipt,
  Scale,
  Settings,
  TrendingUp,
  Truck,
  Users,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { NavItem } from "@/domain/navigation";
import { logoutAction } from "@/server/mutations";

const ICONS: Record<string, LucideIcon> = {
  layout: LayoutDashboard,
  globe: Globe,
  calendar: CalendarRange,
  trending: TrendingUp,
  receipt: Receipt,
  file: FileText,
  coins: Coins,
  home: Home,
  users: Users,
  team: MessagesSquare,
  truck: Truck,
  landmark: Landmark,
  scale: Scale,
  folder: FolderOpen,
  chart: ChartColumn,
  percent: Percent,
  settings: Settings,
};

export function AppShell({
  companyName,
  logoUrl,
  userName,
  orgBase,
  items,
  memberships,
  canCreateOrganization,
  children,
}: {
  companyName: string;
  logoUrl: string | null;
  userName: string;
  orgBase: string;
  items: NavItem[];
  memberships: { slug: string; name: string }[];
  canCreateOrganization: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function toggleMenu(): void {
    setOpen((current) => !current);
  }

  function closeMenu(): void {
    setOpen(false);
  }

  function renderMembership(membership: { slug: string; name: string }) {
    const href = `/org/${membership.slug}`;
    return (
      <li key={membership.slug}>
        <Link className={href === orgBase ? "text-blue-500" : "text-muted"} href={href} data-testid={`org-${membership.slug}`}>
          {membership.name}
        </Link>
      </li>
    );
  }

  function renderNavItem(item: NavItem) {
    const Icon = ICONS[item.icon] ?? LayoutDashboard;
    const active = item.href === orgBase ? pathname === orgBase : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMenu}
        data-testid={`nav-${item.label.toLowerCase().replaceAll(" ", "-").replace("&", "")}`}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-300 ${active ? "bg-blue-500/15 text-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.18)]" : "text-muted hover:bg-[var(--hover)] hover:text-ink"}`}
      >
        <Icon size={20} />
        {item.label}
      </Link>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className={`${open ? "block" : "hidden"} border-r border-line bg-card/80 backdrop-blur-xl lg:block`}>
        <div className="flex h-full flex-col px-4 py-6">
          <div className="rounded-2xl bg-[#050505] px-4 py-3">
            {logoUrl ? <BrandLogo className="h-auto w-full" priority /> : <p className="text-sm font-semibold text-white">{companyName}</p>}
            <p className="sr-only">{companyName}</p>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary">
            {items.map(renderNavItem)}
          </nav>
          <form action={logoutAction} className="px-3">
            <p className="mb-2 text-sm text-muted">{userName}</p>
            <button className="text-sm text-blue-500" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div>
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 lg:px-8">
          <button className="rounded-xl border border-line px-3 py-2 text-sm lg:hidden" type="button" onClick={toggleMenu}>
            Menu
          </button>
          <div className="min-w-0" data-testid="organisation-switcher">
            <p className="text-sm font-semibold">{companyName}</p>
            <ul className="flex flex-wrap gap-3 text-xs">
              {memberships.map(renderMembership)}
              {canCreateOrganization ? <li><Link className="text-blue-500" href="/organisations/new" data-testid="create-organisation-link">Create organisation</Link></li> : null}
            </ul>
          </div>
          <div className="ml-auto flex w-full max-w-xl items-center gap-3">
            <ThemeToggle />
            <form action={`${orgBase}/search`} className="w-full">
            <label className="sr-only" htmlFor="global-search">
              Search {companyName}
            </label>
            <input id="global-search" name="q" className="glass-input" placeholder={`Search ${companyName}`} />
          </form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
