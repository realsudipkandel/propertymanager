import { PageHeader } from "@/components/PageHeader";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from "@/domain/constants";
import { searchLedger } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const session = await requireSession();
  const tooShort = query.length > 0 && query.length < SEARCH_MIN_LENGTH;
  const tooLong = query.length > SEARCH_MAX_LENGTH;
  const groups = !tooShort && !tooLong && query.length > 0 ? await searchLedger(session, query.slice(0, SEARCH_MAX_LENGTH)) : [];
  return (
    <div>
      <PageHeader eyebrow="Search" title={query ? `Results for “${query}”` : "Search the books"} />
      {tooShort ? <p className="text-sm text-muted">Type at least two characters.</p> : null}
      {tooLong ? <p className="text-sm text-muted">That search is too long.</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.label} className="glass-card p-5">
            <h2 className="font-semibold">{group.label} · {group.count}</h2>
            <ul className="mt-2 text-sm text-muted">
              {group.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
