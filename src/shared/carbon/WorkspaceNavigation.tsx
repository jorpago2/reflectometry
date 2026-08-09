import { Layers, SettingsAdjust, Upload } from "@carbon/react/icons";
import { ScientificToolRail } from "@jorpago2/scientific-ui";

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
    <ScientificToolRail
      className="workflow-navigation"
      label="Configuration tools"
      activeId={activeSection}
      onChange={(id) => {
        if (id === null) {
          if (activeSection) onToggle(activeSection);
          return;
        }
        onToggle(id as WorkflowSection);
      }}
      items={workflowItems.map(({ id, label, icon: Icon }) => ({
        id,
        label,
        icon: <Icon size={20} />,
        controlsId: "configuration-panel",
      }))}
    />
  );
}
