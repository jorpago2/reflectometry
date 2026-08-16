import { Layers, SettingsAdjust, Upload } from "@carbon/react/icons";
import { Button } from "@carbon/react";

export type WorkflowSection = "measurement" | "layers" | "fit";

type Props = {
  activeSection: WorkflowSection | null;
  onToggle: (section: WorkflowSection, trigger: HTMLButtonElement) => void;
};

const workflowItems = [
  { id: "measurement", label: "Data", icon: Upload },
  { id: "layers", label: "Layer stack", icon: Layers },
  { id: "fit", label: "Fit", icon: SettingsAdjust },
] as const;

export default function WorkspaceNavigation({ activeSection, onToggle }: Props) {
  return (
    <nav className="workflow-navigation" aria-label="Configuration tools">
      <ul>{workflowItems.map(({ id, label, icon }) => <li key={id}>
        <Button
          id={`workflow-${id}`}
          className={activeSection === id ? "is-active" : undefined}
          kind="ghost"
          size="lg"
          renderIcon={icon}
          type="button"
          aria-expanded={activeSection === id}
          aria-controls="configuration-panel"
          onClick={(event) => onToggle(id, event.currentTarget)}
        >{label}</Button>
      </li>)}</ul>
    </nav>
  );
}
