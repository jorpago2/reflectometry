import { Layers, SettingsAdjust, Upload } from "@carbon/react/icons";
import { ScientificToolRail } from "@jorpago2/scientific-ui";
import { useRef } from "react";

export type WorkflowSection = "measurement" | "layers" | "fit";

type Props = {
  activeSection: WorkflowSection | null;
  onToggle: (section: WorkflowSection | null, trigger: HTMLButtonElement | null) => void;
};

const workflowItems = [
  { id: "measurement", label: "Data", icon: <Upload size={20} />, controlsId: "configuration-panel" },
  { id: "layers", label: "Layer stack", icon: <Layers size={20} />, controlsId: "configuration-panel" },
  { id: "fit", label: "Fit", icon: <SettingsAdjust size={20} />, controlsId: "configuration-panel" },
] as const;

export default function WorkspaceNavigation({ activeSection, onToggle }: Props) {
  const triggers = useRef<Partial<Record<WorkflowSection, HTMLButtonElement | null>>>({});
  return (
    <ScientificToolRail
      className="workflow-navigation"
      label="Configuration tools"
      items={[...workflowItems]}
      activeId={activeSection}
      expandedId={activeSection}
      registerItemRef={(id, node) => { triggers.current[id as WorkflowSection] = node; }}
      onChange={(id) => {
        const section = id as WorkflowSection | null;
        onToggle(section, triggers.current[section ?? activeSection ?? "measurement"] ?? null);
      }}
    />
  );
}
