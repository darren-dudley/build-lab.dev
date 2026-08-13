import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/rbac/permissions";
import { getProjects } from "@/server/projects";
import { ProjectTable } from "@/components/project/project-table";

export const metadata = { title: "All Projects" };

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.roles, "project.view")) redirect("/home");

  const projects = await getProjects();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">All Projects</h1>
      <ProjectTable projects={projects} />
    </div>
  );
}
