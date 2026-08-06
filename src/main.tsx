import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.scss";

const root = document.getElementById("root");
if (!root) throw new Error("Missing React root element.");

createRoot(root).render(<App />);
