import { Header, HeaderGlobalBar, HeaderName, SkipToContent, Toggletip, ToggletipButton, ToggletipContent } from "@carbon/react";
import { Help } from "@carbon/react/icons";

export default function AppHeader() {
  return (
    <Header aria-label="Reflectometry">
      <SkipToContent href="#reflectometry-workspace">Skip to fitting workspace</SkipToContent>
      <HeaderName href="./" prefix="">Reflectometry</HeaderName>
      <div className="header-context" aria-label="Current measurement">
        <span id="header-source-name">No measurement loaded</span>
      </div>
      <HeaderGlobalBar>
        <Toggletip align="bottom-end" autoAlign className="app-help">
          <ToggletipButton id="app-help" className="app-help-button" label="Help" aria-keyshortcuts="?">
            <Help size={20} aria-hidden="true" />
          </ToggletipButton>
          <ToggletipContent className="app-help-panel"><strong>Quick workflow</strong><p>Load spectra, define the stack, preview the model, then run a fit and inspect residuals and uncertainty.</p><dl><div><dt><kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd></dt><dd>Run fit</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Cancel fitting</dd></div><div><dt><kbd>?</kbd></dt><dd>Toggle this help</dd></div></dl><small>Reflectometry v4.0.0</small></ToggletipContent>
        </Toggletip>
      </HeaderGlobalBar>
    </Header>
  );
}
