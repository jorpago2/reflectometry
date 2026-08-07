import { Button, OverflowMenu, OverflowMenuItem } from "@carbon/react";
import { Download } from "@carbon/react/icons";
import { useSyncExternalStore } from "react";
import { workbenchBridge } from "../scientific/workbench-bridge.ts";

function syncExportMenu() {
  window.requestAnimationFrame(() => document.querySelectorAll<HTMLButtonElement>("[data-export-target]").forEach((item) => {
    item.disabled = Boolean(document.getElementById(item.dataset.exportTarget ?? "")?.getAttribute("disabled") !== null);
  }));
}

function runExport(id: string) { document.getElementById(id)?.click(); }
const subscribe = workbenchBridge.subscribe.bind(workbenchBridge);

export default function ResultsStatusBar() {
  const state = useSyncExternalStore(subscribe, () => workbenchBridge.getState(), () => workbenchBridge.getState());
  return <div className="status-row"><span id="status-indicator" className="status-indicator" aria-hidden="true" data-status={state.status} /><p id="status" role="status" aria-live="polite">{state.message}</p><progress id="fit-progress" max="100" defaultValue="0" hidden aria-label="Fit progress" /><Button id="cancel-operation" className="cancel-action" kind="ghost" size="sm" type="button" hidden aria-controls="fit-progress">Cancel</Button><div hidden><button id="print-report" disabled type="button" /><button id="download-json" disabled type="button" /><button id="download-csv" disabled type="button" /><button id="download-nk" disabled type="button" /></div><OverflowMenu className="export-menu" renderIcon={Download} iconDescription="Export results" size="sm" direction="bottom" onOpen={syncExportMenu}><OverflowMenuItem data-export-target="print-report" disabled itemText="Print report" onClick={() => runExport("print-report")} /><OverflowMenuItem data-export-target="download-json" disabled itemText="Project JSON" onClick={() => runExport("download-json")} /><OverflowMenuItem data-export-target="download-csv" disabled itemText="Spectra CSV" onClick={() => runExport("download-csv")} /><OverflowMenuItem data-export-target="download-nk" disabled itemText="Layers n,k" onClick={() => runExport("download-nk")} /></OverflowMenu></div>;
}
