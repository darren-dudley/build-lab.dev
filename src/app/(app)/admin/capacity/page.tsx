import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/rbac/permissions";
import { getCapacity } from "@/server/governance";
import { CapacityEditor } from "@/components/admin/capacity-editor";

export const metadata = { title: "Capacity" };

export default async function CapacityAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "admin.capacity")) redirect("/home");

  const capacity = await getCapacity();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Delivery Capacity</h1>
      <CapacityEditor rows={capacity} />
    </div>
  );
}
