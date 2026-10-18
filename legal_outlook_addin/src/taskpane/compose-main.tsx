import React from "react";
import { createRoot } from "react-dom/client";
import ComposePane from "./ComposePane";
import "./styles.css";

Office.onReady(() => {
  const container = document.getElementById("root");
  if (!container) return;
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ComposePane />
    </React.StrictMode>,
  );
});
