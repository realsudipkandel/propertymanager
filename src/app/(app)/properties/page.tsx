import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { countLabel } from "@/domain/labels";
import { listProperties } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function PropertiesPage() {
  const session = await requireSession();
  const properties = await listProperties(session);
  return (
    <div>
      <PageHeader eyebrow="Properties" title="This month by property" />
      <div className="grid gap-4 md:grid-cols-2">
        {properties.map((property) => (
          <Link key={property.id} href={`/properties/${property.id}`} className="glass-card p-6">
            <h2 className="text-xl font-semibold">{property.name}</h2>
            <p className="mt-1 text-sm text-muted">{property.address} · {countLabel(property.bedrooms, "bedroom", "bedrooms")}</p>
            <p className="mt-4 text-sm">Revenue <Money pence={property.revenuePence} /></p>
            <p className="text-sm">Profit <Money pence={property.profitPence} /> · {property.marginLabel}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
