import WorkspaceView from "../features/measurement/WorkspaceView.tsx";
import { Button, InlineNotification } from "@carbon/react";
import { useCallback, useEffect, useState } from "react";

/** Presentation shell. Scientific behaviour lives outside this component. */
export default function App() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setLoadError(null);
    setEngineReady(false);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    for (const id of ["fit-button", "fit-panel-button", "preview-button"]) {
      document.getElementById(id)?.setAttribute("disabled", "");
    }
    void import("../multilayer-app.ts")
      .then(() => { if (active) setEngineReady(true); })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, [attempt]);

  return <>
    {loadError && (
      <div className="engine-load-error" role="alert">
        <InlineNotification
          hideCloseButton
          kind="error"
          lowContrast
          title="Reflectometry engine could not start"
          subtitle={loadError}
        />
        <Button kind="ghost" size="sm" type="button" onClick={retry}>Retry</Button>
      </div>
    )}
    <WorkspaceView engineReady={engineReady} />
  </>;
}
