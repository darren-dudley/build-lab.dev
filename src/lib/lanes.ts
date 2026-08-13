import type { DeliveryLane } from "@prisma/client";

export const LANE_LABELS: Record<DeliveryLane, string> = {
  RAPID_DEPLOYMENT: "Rapid Deployment",
  EXTERNAL_FDE_POD: "External FDE Pod",
  CORE_TRANSFORMATION: "Core Transformation",
};

export const LANES = Object.keys(LANE_LABELS) as DeliveryLane[];
