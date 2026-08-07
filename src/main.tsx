import { createRoot } from "react-dom/client";
import "./styles.scss";
import "./ui/layout.scss";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing React root element.");

createRoot(root).render(<App />);
