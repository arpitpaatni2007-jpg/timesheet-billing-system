// ── App.jsx ───────────────────────────────────────────────────────────────────
// Root component. No router — this is a single-page tool.
// Wraps everything in MainLayout.

import React from "react";
import { Toaster } from "react-hot-toast";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";

const App = () => (
  <>
    <MainLayout>
      <Dashboard />
    </MainLayout>

    {/* Toast notifications — positioned bottom-right */}
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background:  "var(--bg-elevated)",
          color:       "var(--text-primary)",
          border:      "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          fontSize:    "13px",
          fontFamily:  "var(--font-ui)",
          padding:     "10px 14px",
          boxShadow:   "0 8px 24px rgba(0,0,0,0.4)",
        },
        success: {
          iconTheme: {
            primary: "var(--success)",
            secondary: "var(--bg-elevated)",
          },
        },
        error: {
          iconTheme: {
            primary: "var(--error)",
            secondary: "var(--bg-elevated)",
          },
        },
        loading: {
          iconTheme: {
            primary: "var(--accent)",
            secondary: "var(--bg-elevated)",
          },
        },
      }}
    />
  </>
);

export default App;
