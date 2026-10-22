import { createRoot } from "react-dom/client";
import { PondApp } from "./components/pond/pond-app";
import "./styles.css";

createRoot(document.getElementById("app")!).render(<PondApp />);
