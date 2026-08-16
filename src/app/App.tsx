import WorkspaceView from "../features/measurement/WorkspaceView.tsx";

/** React owns the application shell; the runtime store only exposes scientific state and actions. */
export default function App() {
  return <WorkspaceView />;
}
