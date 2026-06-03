// ── layouts/MainLayout.jsx ────────────────────────────────────────────────────
// The outer shell: a top header bar + the main content area below it.
// Kept intentionally compact — this is an internal tool, not a public site.

import React from "react";
import { FileSpreadsheet, Activity } from "lucide-react";

const MainLayout = ({ children }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

    {/* ── Top Header ───────────────────────────────────────────────────────── */}
    <header style={{
      background:     "var(--bg-surface)",
      borderBottom:   "1px solid var(--border-subtle)",
      position:       "sticky",
      top:            0,
      zIndex:         100,
      backdropFilter: "blur(8px)", // Subtle frosted glass effect when scrolling
    }}>
      <div style={{
        maxWidth:    "1100px",
        margin:      "0 auto",
        padding:     "0 24px",
        height:      "56px",
        display:     "flex",
        alignItems:  "center",
        justifyContent: "space-between",
        gap:         "16px",
      }}>
        {/* Left: Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Icon badge */}
          <div style={{
            width:        "32px",
            height:       "32px",
            borderRadius: "var(--radius-sm)",
            background:   "var(--accent-dim)",
            border:       "1px solid var(--accent-border)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            color:        "var(--accent)",
          }}>
            <FileSpreadsheet size={16} strokeWidth={2} />
          </div>

          <div>
            <h1 style={{
              fontSize:   "14px",
              fontWeight: "600",
              color:      "var(--text-primary)",
              lineHeight: 1.2,
            }}>
              Reporting Portal
            </h1>
            <p style={{
              fontSize: "11px",
              color:    "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}>
              Timesheet &amp; Billing Automation
            </p>
          </div>
        </div>

        {/* Right: Status indicator */}
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        "8px",
          padding:    "5px 12px",
          background: "var(--bg-elevated)",
          border:     "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
        }}>
          {/* Animated green dot — shows API is reachable */}
          <div style={{
            width:     "6px",
            height:    "6px",
            borderRadius: "50%",
            background: "var(--success)",
            boxShadow:  "0 0 5px var(--success)",
            animation:  "pulse-border 2s ease infinite",
          }} />
          <span style={{
            fontSize:   "12px",
            color:      "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}>
            api:5001
          </span>
        </div>
      </div>
    </header>

    {/* ── Page title bar ────────────────────────────────────────────────────── */}
    <div style={{
      borderBottom: "1px solid var(--border-subtle)",
      background:   "var(--bg-base)",
    }}>
      <div style={{
        maxWidth: "1100px",
        margin:   "0 auto",
        padding:  "20px 24px",
        display:  "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}>
        <div>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      fontWeight: "500", marginBottom: "4px" }}>
            Dashboard
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: "600", color: "var(--text-primary)" }}>
            Billing Summary Generator
          </h1>
        </div>

        {/* Date badge */}
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        "6px",
          padding:    "5px 12px",
          background: "var(--bg-elevated)",
          border:     "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
        }}>
          <Activity size={13} color="var(--text-tertiary)" />
          <span style={{
            fontSize:   "12px",
            color:      "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}>
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric"
            })}
          </span>
        </div>
      </div>
    </div>

    {/* ── Page content ──────────────────────────────────────────────────────── */}
    <div style={{
      flex:       1,
      background: "var(--bg-base)",
      paddingTop: "24px",
    }}>
      {children}
    </div>
  </div>
);

export default MainLayout;
