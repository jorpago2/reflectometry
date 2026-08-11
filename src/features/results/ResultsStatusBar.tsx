import { Button, OverflowMenu, OverflowMenuItem } from "@carbon/react";
import { Download } from "@carbon/react/icons";
import { ScientificStatusBar, type ScientificState } from "@jorpago2/scientific-ui";
import { useEffect, useState } from "react";

interface OperationStatus {
  busy: boolean;
  kind: "neutral" | "running" | "success" | "error";
  message: string;
  progress?: number;
}

const initialStatus: OperationStatus = {
  busy: false,
  kind: "neutral",
  message: "Waiting for measurement data.",
};

function syncExportMenu() {
  window.requestAnimationFrame(() => document.querySelectorAll<HTMLButtonElement>("[data-export-target]").forEach((item) => {
    item.disabled = Boolean(document.getElementById(item.dataset.exportTarget ?? "")?.getAttribute("disabled") !== null);
  }));
}

function runExport(id: string) { document.getElementById(id)?.click(); }

export default function ResultsStatusBar() {
  const [operation, setOperation] = useState<OperationStatus>(initialStatus);

  useEffect(() => {
    const updateOperationStatus = (event: Event) => {
      const detail = (event as CustomEvent<OperationStatus>).detail;
      if (detail) setOperation(detail);
    };
    window.addEventListener("reflectometry:operation-status", updateOperationStatus);
    return () => window.removeEventListener("reflectometry:operation-status", updateOperationStatus);
  }, []);

  const scientificState: ScientificState = operation.busy
    ? "running"
    : operation.kind === "error"
      ? "failed"
      : operation.kind === "success"
        ? "up-to-date"
        : /stale|changed/i.test(operation.message)
          ? "modified"
          : /load|waiting/i.test(operation.message)
            ? "needs-input"
            : "ready";

  return (
    <ScientificStatusBar
      className="status-row"
      aria-label="Fit status"
      status={{
        state: scientificState,
        label: operation.message,
        progress: operation.progress,
      }}
      actions={<>
        <span id="status-indicator" hidden aria-hidden="true" data-status={scientificState} />
        <p id="status" className="visually-hidden" aria-hidden="true">{operation.message}</p>
        <progress id="fit-progress" className="visually-hidden" max="100" defaultValue="0" hidden aria-label="Fit progress" />
        <Button id="cancel-operation" kind="ghost" size="sm" type="button" hidden={!operation.busy} aria-controls="fit-progress">Cancel</Button>
        <div hidden><button id="print-report" disabled type="button" /><button id="download-json" disabled type="button" /><button id="download-csv" disabled type="button" /><button id="download-nk" disabled type="button" /></div>
        <OverflowMenu hidden={operation.busy} renderIcon={Download} iconDescription="Export results" size="md" direction="top" flipped onOpen={syncExportMenu}>
          <OverflowMenuItem data-export-target="print-report" disabled itemText="Print report" onClick={() => runExport("print-report")} />
          <OverflowMenuItem data-export-target="download-json" disabled itemText="Project JSON" onClick={() => runExport("download-json")} />
          <OverflowMenuItem data-export-target="download-csv" disabled itemText="Spectra CSV" onClick={() => runExport("download-csv")} />
          <OverflowMenuItem data-export-target="download-nk" disabled itemText="Layers n,k" onClick={() => runExport("download-nk")} />
        </OverflowMenu>
      </>}
    />
  );
}
