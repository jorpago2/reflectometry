import { SkipToContent, Toggletip, ToggletipButton, ToggletipContent } from "@carbon/react";
import { Help } from "@carbon/react/icons";
import { ScientificHeader } from "@jorpago2/scientific-ui";

export default function AppHeader() {
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
      contextDetail={<span id="header-source-status" className="header-source-status" role="status" aria-live="polite">Needs input</span>}
      primaryAction={
        <Toggletip align="bottom-end" autoAlign className="app-help">
          <ToggletipButton id="app-help" className="app-help-button" label="Help" aria-keyshortcuts="?">
            <Help size={20} aria-hidden="true" />
          </ToggletipButton>
          <ToggletipContent className="app-help-panel"><strong>Quick workflow</strong><p>Load spectra, define the stack, preview the model, then run a fit and inspect residuals and uncertainty.</p><dl><div><dt><kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd></dt><dd>Run fit</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Cancel fitting</dd></div><div><dt><kbd>?</kbd></dt><dd>Toggle this help</dd></div></dl><small>Reflectometry v4.0.0</small></ToggletipContent>
        </Toggletip>
      }
    />
  );
}
