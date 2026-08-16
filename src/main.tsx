import { createRoot } from "react-dom/client";
import { ScientificUiProvider } from "@jorpago2/scientific-ui";
import "./styles/carbon-base.scss";
import "@jorpago2/scientific-ui/styles.css";
import "./styles/carbon.scss";
import App from "./app/App";
import ReflectometryProvider from "./app/ReflectometryProvider";

const root = document.getElementById("root");
if (!root) throw new Error("Missing React root element.");
createRoot(root).render(
  <ScientificUiProvider>
    <ReflectometryProvider>
      <App />
    </ReflectometryProvider>
  </ScientificUiProvider>,
);
