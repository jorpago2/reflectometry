import { createRoot } from "react-dom/client";
import "./styles/carbon.scss";
import App from "./app/App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing React root element.");
document.documentElement.classList.add("cds--white");

createRoot(root).render(<App />);
