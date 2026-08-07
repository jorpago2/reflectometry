import { Button } from "@carbon/react";
import { Layers, SettingsAdjust, Upload } from "@carbon/react/icons";

export type WorkflowSection = "measurement" | "layers" | "fit";

type Props = {
  activeSection: WorkflowSection | null;
  onToggle: (section: WorkflowSection) => void;
};

const workflowItems = [
  { id: "measurement", label: "Data", icon: Upload },
  { id: "layers", label: "Layer stack", icon: Layers },
  { id: "fit", label: "Fit", icon: SettingsAdjust },
] as const;

export default function WorkspaceNavigation({ activeSection, onToggle }: Props) {
  return (
    <nav className="workflow-navigation" aria-label="Configuration tools">
      {workflowItems.map(({ id, label, icon: Icon }) => {
        const expanded = activeSection === id;
        return (
          <Button
            id={`workflow-${id}`}
            className="workflow-nav-item"
            kind={expanded ? "primary" : "ghost"}
            type="button"
            aria-controls="configuration-panel"
            aria-expanded={expanded}
            onClick={() => onToggle(id)}
            key={id}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
