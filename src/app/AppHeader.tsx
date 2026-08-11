import { SkipToContent } from "@carbon/react";
import { ScientificHeader } from "@jorpago2/scientific-ui";
import { useEffect, useState } from "react";

export default function AppHeader() {
  const [sourceReady, setSourceReady] = useState(false);

  useEffect(() => {
    const updateSourceStatus = (event: Event) => {
      setSourceReady(Boolean((event as CustomEvent<{ ready: boolean }>).detail?.ready));
    };
    window.addEventListener("reflectometry:source-status", updateSourceStatus);
    return () => window.removeEventListener("reflectometry:source-status", updateSourceStatus);
  }, []);

  return (
    <ScientificHeader
      aria-label="Reflectometry"
      product="Reflectometry"
      productMark="R"
      descriptor="Optical fitting"
      href="./"
      skipLink={<SkipToContent href="#reflectometry-workspace">Skip to fitting workspace</SkipToContent>}
      contextLabel="Current measurement"
      context={<span id="header-source-name">No measurement loaded</span>}
      contextDetail={<span id="header-source-status" className="visually-hidden" aria-hidden="true">Needs input</span>}
      status={{ state: sourceReady ? "ready" : "needs-input", label: sourceReady ? "Ready" : "Needs input" }}
      help={{
        id: "app-help",
        summary: "Load spectra, define the stack, preview the model, then run a fit and inspect residuals and uncertainty.",
        shortcuts: [
          { keys: ["Ctrl/⌘", "Enter"], description: "Run fit" },
          { keys: ["Esc"], description: "Cancel fitting" },
        ],
        footer: "Reflectometry v4.0.0",
      }}
    />
  );
}
