// ── ui/StatCard.jsx ───────────────────────────────────────────────────────────
// Displays one key metric: a label, a large mono value, and an icon.
// Props:
//   label     — "Total Clients"
//   value     — "9" or "546.08 hrs"
//   icon      — Lucide icon component
//   accent    — if true, highlights with amber accent color
//   className — for stagger animation classes

import React from "react";

const StatCard = ({ label, value, icon: Icon, accent = false, className = "" }) => (
  <div
    className={className}
    style={{
      background:   "var(--bg-surface)",
      border:       `1px solid ${accent ? "var(--accent-border)" : "var(--border-subtle)"}`,
      borderRadius: "var(--radius-md)",
      padding:      "20px 22px",
      display:      "flex",
      flexDirection: "column",
      gap:          "14px",
      position:     "relative",
      overflow:     "hidden",
      transition:   "border-color 0.2s ease",
    }}
  >
    {/* Top row: label + icon */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{
        fontSize:      "12px",
        fontWeight:    "500",
        color:         "var(--text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}>
        {label}
      </span>

      {Icon && (
        <div style={{
          width:        "32px",
          height:       "32px",
          borderRadius: "var(--radius-sm)",
          background:   accent ? "var(--accent-dim)" : "var(--bg-elevated)",
          border:       `1px solid ${accent ? "var(--accent-border)" : "var(--border-subtle)"}`,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          color:        accent ? "var(--accent)" : "var(--text-secondary)",
          flexShrink:   0,
        }}>
          <Icon size={15} strokeWidth={2} />
        </div>
      )}
    </div>

    {/* Value — large mono number */}
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize:   "26px",
      fontWeight: "500",
      color:      accent ? "var(--accent)" : "var(--text-primary)",
      lineHeight: 1,
    }}>
      {value ?? "—"}
    </div>

    {/* Subtle accent strip on left edge when highlighted */}
    {accent && (
      <div style={{
        position:    "absolute",
        left:        0,
        top:         "20%",
        bottom:      "20%",
        width:       "3px",
        background:  "var(--accent)",
        borderRadius: "0 2px 2px 0",
      }} />
    )}
  </div>
);

export default StatCard;
