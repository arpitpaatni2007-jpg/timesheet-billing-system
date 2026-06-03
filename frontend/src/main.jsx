// ── main.jsx ──────────────────────────────────────────────────────────────────
// Entry point. ReactDOM mounts the app into <div id="root"> in index.html.
// Global CSS is imported here — once — so it applies to every component.

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
