// ── ui/EmptyState.jsx ─────────────────────────────────────────────────────────
// Shown when a panel has no data yet — e.g., no reports in history.
// Props: icon (Lucide), title, description

import React from "react";

const EmptyState = ({ icon: Icon, title, description }) => (
  <div style={{
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    justifyContent: "center",
    padding:       "48px 24px",
    gap:           "12px",
    textAlign:     "center",
  }}>
    {Icon && (
      <div style={{
        width:        "48px",
        height:       "48px",
        borderRadius: "var(--radius-md)",
        background:   "var(--bg-elevated)",
        border:       "1px solid var(--border-subtle)",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        color:        "var(--text-tertiary)",
        marginBottom: "4px",
      }}>
        <Icon size={22} strokeWidth={1.5} />
      </div>
    )}

    <p style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-secondary)" }}>
      {title}
    </p>

    {description && (
      <p style={{ fontSize: "13px", color: "var(--text-tertiary)", maxWidth: "280px" }}>
        {description}
      </p>
    )}
  </div>
);

export default EmptyState;
