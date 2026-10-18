import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

let mounted = false;

function mount() {
  if (mounted) return;
  mounted = true;

  const container = document.getElementById("root");
  if (!container) return;

  createRoot(container).render(
    <MemoryRouter initialEntries={["/matter"]}>
      <App />
    </MemoryRouter>,
  );
}

if (typeof Office !== "undefined") {
  Office.onReady(() => mount());
  window.setTimeout(mount, 100);
} else {
  mount();
}
