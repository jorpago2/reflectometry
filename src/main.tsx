import { createRoot } from "react-dom/client";
import { ScientificUiProvider } from "@jorpago2/scientific-ui";
import "./styles/carbon.scss";
import "@jorpago2/scientific-ui/styles.css";
import App from "./app/App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing React root element.");
createRoot(root).render(<ScientificUiProvider><App /></ScientificUiProvider>);
