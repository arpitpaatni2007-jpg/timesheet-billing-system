// ── features/ReportStatus.jsx ─────────────────────────────────────────────────
// Shows the current pipeline status:
//   idle       → waiting for files
//   ready      → files uploaded, ready to generate
//   generating → API call in progress
//   done       → summary received, ready to download
//   error      → something failed

import React from "react";
import { CheckCircle2, Clock, AlertTriangle, Loader2, CircleDot } from "lucide-react";
import Spinner from "../ui/Spinner";

const STATES = {
  idle:       { label: "Waiting for files",         color: "var(--text-tertiary)",  icon: CircleDot },
  ready:      { label: "Ready to generate",         color: "var(--info)",           icon: CircleDot },
  generating: { label: "Generating summary...",     color: "var(--accent)",         icon: null      }, // Spinner used
  downloading:{ label: "Generating Excel...",       color: "var(--accent)",         icon: null      },
  done:       { label: "Report ready",              color: "var(--success)",        icon: CheckCircle2 },
  error:      { label: "Generation failed",         color: "var(--error)",          icon: AlertTriangle },
};

// Pipeline steps shown as a horizontal track
const STEPS = [
  { id: "upload",   label: "Upload files" },
  { id: "generate", label: "Generate summary" },
  { id: "download", label: "Download Excel" },
];

const getActiveStep = (status) => {
  if (status === "idle") return 0;
  if (status === "ready") return 1;
  if (status === "generating") return 1;
  if (status === "downloading") return 2;
  if (status === "done") return 3; // All complete
  return 0;
};

const ReportStatus = ({ status = "idle" }) => {
  const state      = STATES[status] || STATES.idle;
  const Icon       = state.icon;
  const activeStep = getActiveStep(status);

  return (
    <section style={{
      background:   "var(--bg-surface)",
      border:       "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding:      "20px 24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "12px" }}>

        {/* Left: current status */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {(status === "generating" || status === "downloading") ? (
            <Spinner size="sm" color="var(--accent)" />
          ) : (
            Icon && <Icon size={15} color={state.color} strokeWidth={2} />
          )}
          <span style={{ fontSize: "13px", fontWeight: "500", color: state.color }}>
            {state.label}
          </span>
        </div>

        {/* Right: pipeline steps */}
        <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
          {STEPS.map((step, i) => {
            const isDone    = i < activeStep;
            const isActive  = i === activeStep && status !== "idle";
            const isCurrent = i === activeStep;

            return (
              <React.Fragment key={step.id}>
                {/* Step dot */}
                <div style={{
                  display:      "flex",
                  flexDirection: "column",
                  alignItems:   "center",
                  gap:          "4px",
                }}>
                  <div style={{
                    width:        "8px",
                    height:       "8px",
                    borderRadius: "50%",
                    background:   isDone
                      ? "var(--success)"
                      : (isActive ? "var(--accent)" : "var(--border-strong)"),
                    transition: "background 0.3s ease",
                    boxShadow: isActive
                      ? "0 0 6px var(--accent)" // Glow on current step
                      : isDone
                      ? "0 0 4px #34c77b50"
                      : "none",
                  }} />
                  <span style={{
                    fontSize:  "10px",
                    color:     isDone ? "var(--success)"
                              : (isCurrent && status !== "idle" ? "var(--accent)" : "var(--text-tertiary)"),
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {step.label}
                  </span>
                </div>

                {/* Connector line between dots */}
                {i < STEPS.length - 1 && (
                  <div style={{
                    width:      "48px",
                    height:     "1px",
                    background: i < activeStep ? "var(--success)" : "var(--border-subtle)",
                    margin:     "0 2px",
                    marginBottom: "14px", // Align with dot center, not label
                    transition: "background 0.3s ease",
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ReportStatus;
