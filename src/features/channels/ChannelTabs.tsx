import Link from "next/link";

const TABS: Array<{ href: string; label: string }> = [
  { href: "/channels", label: "Overview" },
  { href: "/channels/connections", label: "Connections" },
  { href: "/channels/mapping", label: "Listings & mapping" },
  { href: "/channels/calendar", label: "Multi-calendar" },
  { href: "/channels/rates", label: "Rates & inventory" },
  { href: "/channels/reservations", label: "Reservations" },
];

export function ChannelTabs({ base, active }: { base: string; active: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" data-testid="channel-tabs">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={`${base}${tab.href}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              isActive ? "bg-white/15 text-foreground" : "text-muted hover:text-foreground"
            }`}
            data-testid={`channel-tab-${tab.label.toLowerCase().replaceAll(" ", "-").replace("&", "")}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
