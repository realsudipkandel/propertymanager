import Link from "next/link";

import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { countLabel } from "@/domain/labels";
import { organizationPath } from "@/domain/organization";
import { canMutateFinance } from "@/domain/permissions";
import { CreateProperty } from "@/features/properties/CreateProperty";
import { listProperties } from "@/server/queries";
import { requireSession } from "@/server/session";

function renderProperty(property: {
  id: string;
  name: string;
  address: string;
  bedrooms: number;
  revenuePence: number;
  profitPence: number;
  marginLabel: string;
}, base: string) {
  return (
    <Link key={property.id} href={`${base}/properties/${property.id}`} className="glass-card p-6" data-testid={`property-${property.id}`}>
      <h2 className="text-xl font-semibold">{property.name}</h2>
      <p className="mt-1 text-sm text-muted">{property.address} · {countLabel(property.bedrooms, "bedroom", "bedrooms")}</p>
      <p className="mt-4 text-sm">Revenue <Money pence={property.revenuePence} /></p>
      <p className="text-sm">Profit <Money pence={property.profitPence} /> · {property.marginLabel}</p>
    </Link>
  );
}

export default async function PropertiesPage() {
  const session = await requireSession();
  const base = organizationPath(session.organizationSlug);
  const properties = await listProperties(session);
  const canCreate = canMutateFinance(session.role);
  function renderPropertyCard(property: {
    id: string;
    name: string;
    address: string;
    bedrooms: number;
    revenuePence: number;
    profitPence: number;
    marginLabel: string;
  }) {
    return renderProperty(property, base);
  }
  return (
    <div className="grid gap-6">
      {canCreate ? <CreateProperty /> : null}
      <div>
        <PageHeader eyebrow="Properties" title="This month by property" />
        {properties.length === 0 ? <p className="text-sm text-muted">No properties in this organisation yet.</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {properties.map(renderPropertyCard)}
        </div>
      </div>
    </div>
  );
}
