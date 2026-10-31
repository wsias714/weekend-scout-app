import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import Boundary from "./Boundary.tsx";
import { startFeedback } from "./feedback.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary><App /></Boundary>
  </StrictMode>,
);

startFeedback();
