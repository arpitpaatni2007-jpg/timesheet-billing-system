// ── ui/Badge.jsx ──────────────────────────────────────────────────────────────
// Small status pill. Used in the History table for file types and statuses.
// Variants: "success" | "warning" | "error" | "info" | "neutral"

import React from "react";

const variantStyles = {
  success: {
    background: "var(--success-dim)",
    color:      "var(--success)",
    border:     "1px solid #34c77b30",
  },
  warning: {
    background: "var(--accent-dim)",
    color:      "var(--accent)",
    border:     "1px solid var(--accent-border)",
  },
  error: {
    background: "var(--error-dim)",
    color:      "var(--error)",
    border:     "1px solid #f0525230",
  },
  info: {
    background: "var(--info-dim)",
    color:      "var(--info)",
    border:     "1px solid #5b8af030",
  },
  neutral: {
    background: "var(--bg-elevated)",
    color:      "var(--text-secondary)",
    border:     "1px solid var(--border-subtle)",
  },
};

const Badge = ({ children, variant = "neutral" }) => (
  <span
    style={{
      display:      "inline-flex",
      alignItems:   "center",
      gap:          "4px",
      padding:      "2px 8px",
      borderRadius: "4px",
      fontSize:     "12px",
      fontWeight:   "500",
      fontFamily:   "var(--font-mono)",
      letterSpacing: "0.02em",
      ...variantStyles[variant],
    }}
  >
    {children}
  </span>
);

export default Badge;
