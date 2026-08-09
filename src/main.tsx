import { createRoot } from "react-dom/client";
import { GlobalTheme } from "@carbon/react";
import "./styles/carbon.scss";
import "@jorpago2/scientific-ui/styles.css";
import App from "./app/App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing React root element.");
document.documentElement.classList.add("cds--g10");

createRoot(root).render(<GlobalTheme theme="g10"><App /></GlobalTheme>);
