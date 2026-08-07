import { ContentSwitcher, Switch } from "@carbon/react";

export default function WorkspaceNavigation() {
  return <><ContentSwitcher className="mobile-view-switcher" selectedIndex={0} size="sm" onChange={({ index }) => { const workspace = document.getElementById("reflectometry-workspace"); if (!workspace) return; workspace.dataset.mobileView = index === 1 ? "results" : "configuration"; workspace.scrollIntoView({ block: "start" }); window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))); }}><Switch name="configuration" text="Configuration" /><Switch name="results" text="Results" /></ContentSwitcher><nav className="workspace-jump" aria-label="Workspace areas"><a href="#configuration-panel">Configuration</a><a href="#results-panel">Results</a></nav></>;
}
