import { Content } from "@carbon/react";
import WorkspaceView from "../features/measurement/WorkspaceView.tsx";
import AppHeader from "./AppHeader.tsx";
import { useEffect } from "react";

/** Presentation shell. Scientific behaviour lives outside this component. */
export default function App() {
  useEffect(() => {
    void import("../multilayer-app.ts").catch((error: unknown) => {
      const status = document.getElementById("status");
      if (status) status.textContent = `Error loading the application: ${error instanceof Error ? error.message : String(error)}`;
    });
  }, []);

  return <><AppHeader /><Content className="app-main" aria-label="Reflectometry workspace"><WorkspaceView /></Content></>;
}
