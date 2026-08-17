import { ContentSwitcher, Switch } from "@carbon/react";
import {
  ScientificAppShell,
  ScientificAutosaveStatus,
  ScientificRecoveryNotice,
  ScientificTaskPanel,
  useScientificAutosave,
} from "@jorpago2/scientific-ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import AppHeader from "../../app/AppHeader.tsx";
import { useReflectometry } from "../../app/reflectometry-context.ts";
import FitPanel from "../fit/FitPanel.tsx";
import LayerStackEditor from "../layer-stack/LayerStackEditor.tsx";
import ResultsStatusBar from "../results/ResultsStatusBar.tsx";
import ResultsWorkspace from "../results/ResultsWorkspace.tsx";
import WorkspaceNavigation, { type WorkflowSection } from "../../shared/carbon/WorkspaceNavigation.tsx";
import MeasurementPanel from "./MeasurementPanel.tsx";

type ConfigurationMode = "basic" | "advanced";

const OVERLAY_LAYOUT_QUERY = "(max-width: 65.99rem)";
const PANEL_COPY: Record<WorkflowSection, { title: string; description: string }> = {
  measurement: { title: "Measurement", description: "Choose the data source and processing." },
  layers: { title: "Layer stack", description: "Set geometry, optical models and substrate." },
  fit: { title: "Fit", description: "Choose channels, optimizer and uncertainty settings." },
};

function isSessionSnapshot(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ConfigurationModeControl({ mode, onChange }: { mode: ConfigurationMode; onChange: (mode: ConfigurationMode) => void }) {
  return (
    <div className="configuration-mode">
      <span>Configuration detail</span>
      <ContentSwitcher className="scientific-content-switcher scientific-content-switcher--sm" aria-label="Configuration detail" selectedIndex={mode === "basic" ? 0 : 1} size="sm" onChange={({ name }) => onChange(name === "advanced" ? "advanced" : "basic")}>
        <Switch name="basic" text="Basic" />
        <Switch name="advanced" text="Advanced" />
      </ContentSwitcher>
      <p>{mode === "basic" ? "Core workflow and parameter values." : "Bounds, processing, optimizer and model guidance."}</p>
    </div>
  );
}

export default function WorkspaceView() {
  const [state, actions] = useReflectometry();
  const [activeSection, setActiveSection] = useState<WorkflowSection | null>(null);
  const [configurationMode, setConfigurationMode] = useState<ConfigurationMode>("basic");
  const [isOverlayLayout, setIsOverlayLayout] = useState(() => typeof window !== "undefined" && window.matchMedia(OVERLAY_LAYOUT_QUERY).matches);
  const panelRef = useRef<HTMLElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const overlayPanelOpen = Boolean(activeSection && isOverlayLayout);
  const panelCopy = activeSection ? PANEL_COPY[activeSection] : PANEL_COPY.measurement;

  const closePanel = () => {
    setActiveSection(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const togglePanel = (section: WorkflowSection | null, trigger: HTMLButtonElement | null) => {
    if (trigger) lastTriggerRef.current = trigger;
    if (!section) {
      closePanel();
      return;
    }
    const opening = activeSection !== section;
    setActiveSection(opening ? section : null);
    if (opening && isOverlayLayout) window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>(".scientific-task-panel__heading h2")?.focus());
  };

  useEffect(() => {
    const query = window.matchMedia(OVERLAY_LAYOUT_QUERY);
    const updateLayout = () => setIsOverlayLayout(query.matches);
    updateLayout();
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, []);

  useLayoutEffect(() => {
    if (!activeSection) return;
    const body = panelRef.current?.querySelector<HTMLElement>(".configuration-panel-body");
    if (body) body.scrollTop = 0;
  }, [activeSection]);

  const autosave = useScientificAutosave({
    storageKey: "reflectometry:session",
    value: state.autosaveSnapshot,
    schemaVersion: 1,
    maxBytes: 3_000_000,
    shouldSave: isSessionSnapshot,
    validate: isSessionSnapshot,
    onRestore: actions.restoreAutosave,
  });

  return (
    <ScientificAppShell
      className="reflectometry-shell"
      recovery={autosave.recovery && <ScientificRecoveryNotice savedAt={autosave.recovery.savedAt} onRestore={autosave.restore} onDiscard={autosave.discard} />}
      panelOpen={Boolean(activeSection)}
      header={<><h1 className="visually-hidden">Reflectometry</h1><AppHeader /></>}
      navigation={<WorkspaceNavigation activeSection={activeSection} onToggle={togglePanel} />}
      panel={(
        <ScientificTaskPanel
          ref={panelRef}
          id="configuration-panel"
          className="configuration-panel-shell"
          hidden={!activeSection}
          title={panelCopy.title}
          titleId={activeSection ? `configuration-panel-title-${activeSection}` : undefined}
          eyebrow="Configuration"
          onClose={closePanel}
          closeLabel="Close"
          bodyClassName="configuration-panel-body"
          tabIndex={-1}
          aria-busy={state.operation.busy}
          onKeyDown={(event: React.KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (event.key === "Escape" && (state.operation.busy || target?.closest('[role="dialog"]'))) {
              event.preventDefault();
            }
          }}
        >
          <p className="configuration-panel-description">{panelCopy.description}</p>
          <ConfigurationModeControl mode={configurationMode} onChange={setConfigurationMode} />
          <div className="configuration-panel-content" inert={state.operation.busy}>
            <div hidden={activeSection !== "measurement"}>
              <MeasurementPanel advanced={configurationMode === "advanced"} />
            </div>
            {activeSection === "layers" && <LayerStackEditor advanced={configurationMode === "advanced"} />}
            {activeSection === "fit" && <FitPanel advanced={configurationMode === "advanced"} onRun={overlayPanelOpen ? closePanel : undefined} />}
          </div>
        </ScientificTaskPanel>
      )}
      statusBar={<ResultsStatusBar metadata={<ScientificAutosaveStatus status={autosave.status} savedAt={autosave.lastSavedAt} />} />}
    >
      <div id="reflectometry-workspace" className="reflectometry-workspace" tabIndex={-1}>
        <section className="results scientific-stage" aria-label="Fit results" aria-hidden={overlayPanelOpen || undefined} inert={overlayPanelOpen}>
          <ResultsWorkspace />
        </section>
      </div>
    </ScientificAppShell>
  );
}
