import { ContentSwitcher, Switch } from "@carbon/react";

type Props = { view: "configuration" | "results"; onViewChange: (view: "configuration" | "results") => void };

export default function WorkspaceNavigation({ view, onViewChange }: Props) {
  return <><ContentSwitcher className="mobile-view-switcher" selectedIndex={view === "results" ? 1 : 0} size="sm" onChange={({ index }) => { onViewChange(index === 1 ? "results" : "configuration"); window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))); }}><Switch name="configuration" text="Configuration" /><Switch name="results" text="Results" /></ContentSwitcher><nav className="workspace-jump" aria-label="Workspace areas"><a href="#configuration-panel">Configuration</a><a href="#results-panel">Results</a></nav></>;
}
