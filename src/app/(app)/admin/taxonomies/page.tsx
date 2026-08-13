import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { hasPermission } from "@/server/rbac/permissions";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export const metadata = { title: "Taxonomies" };

const KINDS = [
  { kind: "FUNCTION", title: "Functions" },
  { kind: "SPECIALIST_WORKFLOW", title: "Specialist Workflows" },
  { kind: "SYSTEM", title: "Systems" },
  { kind: "VALUE_LEVER", title: "Value Levers" },
  { kind: "TAG", title: "Tags" },
] as const;

export default async function TaxonomiesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.taxonomies")) redirect("/home");

  const items = await db.taxonomyItem.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Taxonomies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The controlled vocabularies behind intake and categorization. Click an
          item to deactivate it (existing records keep it; new submissions won&apos;t see it).
        </p>
      </div>
      {KINDS.map((k) => (
        <TaxonomyManager
          key={k.kind}
          kind={k.kind}
          title={k.title}
          items={items.filter((i) => i.kind === k.kind).map((i) => ({ id: i.id, label: i.label, isActive: i.isActive }))}
        />
      ))}
    </div>
  );
}
