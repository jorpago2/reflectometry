import { Button, OverflowMenu, OverflowMenuItem } from "@carbon/react";
import { Download } from "@carbon/react/icons";
import { ScientificStatusBar } from "@jorpago2/scientific-ui";
import { useEffect, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { operationLabel, operationScientificState } from "../../app/operation-status.ts";
import { useReflectometry } from "../../app/reflectometry-context.ts";

type ExportLinks = Record<"json" | "spectra" | "nk", { href: string; name: string }>;
type DownloadMenuItemProps = ComponentProps<typeof OverflowMenuItem> & { download?: string };
const DownloadMenuItem = OverflowMenuItem as ComponentType<DownloadMenuItemProps>;

export default function ResultsStatusBar({ metadata }: { metadata?: ReactNode }) {
  const [state, actions] = useReflectometry();
  const [exportState, setExportState] = useState<{ result: unknown; links: ExportLinks } | null>(null);

  useEffect(() => {
    if (!state.canExport) return;
    let active = true;
    const urls = Object.fromEntries((["json", "spectra", "nk"] as const).map((kind) => {
      const file = actions.createExport(kind);
      return [kind, { href: URL.createObjectURL(new Blob([file.content], { type: file.type })), name: file.name }];
    })) as ExportLinks;
    queueMicrotask(() => {
      if (active) setExportState({ result: state.fitResult, links: urls });
    });
    return () => {
      active = false;
      Object.values(urls).forEach((file) => URL.revokeObjectURL(file.href));
    };
  }, [actions, state.canExport, state.fitResult]);
  const exports = state.canExport && exportState?.result === state.fitResult ? exportState.links : null;

  const scientificState = operationScientificState(state.operation, state.hasMeasurement);

  return (
    <ScientificStatusBar
      className="status-row"
      aria-label="Fit status"
      title={state.operation.message}
      status={{
        state: scientificState,
        label: operationLabel(state.operation, state.hasMeasurement),
        progress: state.operation.progress,
      }}
      metadata={metadata}
      actions={<>
        {state.operation.busy && <Button kind="ghost" size="sm" type="button" onClick={actions.cancel}>Cancel</Button>}
        <OverflowMenu renderIcon={Download} iconDescription="Export results" size="md" direction="top" flipped disabled={!state.canExport}>
          <OverflowMenuItem disabled={!state.canExport} itemText="Print report" onClick={() => window.print()} />
          <DownloadMenuItem disabled={!exports} href={exports?.json.href} download={exports?.json.name} itemText="Project JSON" />
          <DownloadMenuItem disabled={!exports} href={exports?.spectra.href} download={exports?.spectra.name} itemText="Spectra CSV" />
          <DownloadMenuItem disabled={!exports} href={exports?.nk.href} download={exports?.nk.name} itemText="Layers n,k" />
        </OverflowMenu>
      </>}
    />
  );
}
