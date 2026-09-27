import { PageHeader } from "@/components/PageHeader";
import { DOCUMENT_LABEL } from "@/domain/labels";
import type { DocumentKind } from "@/domain/constants";
import { listDocuments } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function DocumentsPage() {
  const session = await requireSession();
  const documents = await listDocuments(session);
  return (
    <div>
      <PageHeader eyebrow="Documents" title="Receipts, certificates, and policies" detail="Files are stored outside PostgreSQL and downloaded only for this company." />
      <ul className="space-y-3">
        {documents.map((document) => (
          <li key={document.id} className="glass-card flex items-center justify-between px-4 py-3">
            <div>
              <a className="font-medium text-blue-500" href={`/api/documents/${document.id}`}>{document.title}</a>
              <p className="text-sm text-muted">{DOCUMENT_LABEL[document.kind as DocumentKind]} · {document.property}</p>
            </div>
            <p className="text-sm text-muted">Expires {document.expires}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
