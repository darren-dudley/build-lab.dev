import { InitiativeStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { externalStatusLabel, statusLabel } from "@/server/workflow/transitions";

const TONE: Record<InitiativeStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  NEEDS_INFORMATION: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  TRIAGE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  READY_FOR_GOVERNANCE: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  GOVERNANCE_REVIEW: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  APPROVED_AWAITING_CAPACITY: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  APPROVED_SCHEDULED: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  IN_DELIVERY: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  DEPLOYED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  MEASURING_IMPACT: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  COMPLETED: "bg-muted text-foreground",
  DEFERRED: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  status,
  external = false,
  className,
}: {
  status: InitiativeStatus;
  external?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      {external ? externalStatusLabel(status) : statusLabel(status)}
    </span>
  );
}
