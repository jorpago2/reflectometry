import type { ScientificState } from "@jorpago2/scientific-ui";

export type ReflectometryPhase = "needs-input" | "ready" | "preview" | "fitting" | "fit-success" | "bootstrap-success" | "stale" | "error";

export interface OperationStatus {
  phase: ReflectometryPhase;
  busy: boolean;
  message: string;
  progress?: number;
}

export function operationScientificState(operation: OperationStatus, sourceReady = true): ScientificState {
  if (operation.busy || operation.phase === "fitting") return "running";
  if (operation.phase === "error") return "failed";
  if (operation.phase === "stale") return "modified";
  if (operation.phase === "fit-success" || operation.phase === "bootstrap-success") return "up-to-date";
  if (!sourceReady || operation.phase === "needs-input") return "needs-input";
  return "ready";
}

export function operationLabel(operation: OperationStatus, sourceReady = true): string {
  if (operation.busy) return operation.message;
  switch (operation.phase) {
    case "error": return "Error";
    case "stale": return "Modified";
    case "fit-success": return "Fit converged · review validation";
    case "bootstrap-success": return "Fit and bootstrap current";
    case "preview": return "Preview current · not fitted";
    case "needs-input": return sourceReady ? "Ready" : "Needs input";
    default: return sourceReady ? "Ready" : "Needs input";
  }
}
