// ── features/ReportActions.jsx ────────────────────────────────────────────────
// Two action buttons:
//   1. Generate Billing Summary — calls /billing-summary, shows JSON stats
//   2. Download Excel Report    — calls /generate-billing-summary, saves .xlsx
// Both are disabled until both files are uploaded (isReady).

import React from "react";
import { BarChart2, Download, AlertCircle } from "lucide-react";
import Button from "../ui/Button";

const ReportActions = ({
  isReady,           // bool — true when both files selected
  isGenerating,      // bool — spinner on Generate button
  isDownloading,     // bool — spinner on Download button
  error,             // string | null — last error message
  onGenerate,        // fn() — calls getBillingSummary
  onDownload,        // fn() — calls generateBillingSummaryExcel
}) => (
  <section style={{
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding:      "24px",
  }}>
    {/* Section header */}
    <div style={{ marginBottom: "20px" }}>
      <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
        Report Actions
      </h2>
      <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "2px" }}>
        {isReady
          ? "Files ready — generate or download your report"
          : "Upload both files above to enable these actions"}
      </p>
    </div>

    {/* Buttons row */}
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      <Button
        variant="secondary"
        leftIcon={BarChart2}
        loading={isGenerating}
        disabled={!isReady}
        onClick={onGenerate}
        style={{ flex: "1 1 auto", minWidth: "160px" }}
      >
        Generate Summary
      </Button>

      <Button
        variant="primary"
        leftIcon={Download}
        loading={isDownloading}
        disabled={!isReady}
        onClick={onDownload}
        style={{ flex: "1 1 auto", minWidth: "160px" }}
      >
        Download Excel
      </Button>
    </div>

    {/* Error message — shown inline below the buttons */}
    {error && (
      <div style={{
        marginTop:    "14px",
        padding:      "10px 14px",
        background:   "var(--error-dim)",
        border:       "1px solid #f0525230",
        borderRadius: "var(--radius-sm)",
        display:      "flex",
        alignItems:   "flex-start",
        gap:          "8px",
      }}>
        <AlertCircle size={15} color="var(--error)" style={{ flexShrink: 0, marginTop: "1px" }} />
        <p style={{ fontSize: "13px", color: "var(--error)", lineHeight: "1.4" }}>
          {error}
        </p>
      </div>
    )}

    {/* Disabled hint */}
    {!isReady && (
      <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-tertiary)" }}>
        ↑ Upload employee CSV and manager XLSX to unlock
      </p>
    )}
  </section>
);

export default ReportActions;
