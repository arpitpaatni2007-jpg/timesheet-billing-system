
// ── features/ReportActions.jsx ────────────────────────────────────────────────
// Action buttons:
//   1. Generate Summary      — calls /billing-summary, shows JSON stats
//   2. Download Excel        — calls /generate-billing-summary, saves both .xlsx files
//
// After Download Excel succeeds, the single "Download Excel" button is replaced
// by TWO individual download buttons, one per generated file:
//   • Download Billing Summary
//   • Download Client Wise Timesheet
//
// The two download buttons only appear when their respective report names are
// present (i.e. after a successful generation). They disappear while a new
// generation is in progress.

import React from "react";
import { BarChart2, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import Button from "../ui/Button";

const ReportActions = ({
  isReady,             // bool   — true when both files are selected
  isGenerating,        // bool   — spinner on Generate button
  isDownloading,       // bool   — spinner on Download button
  error,               // string | null — last error message
  onGenerate,          // fn()   — calls generateSummary (JSON stats)
  onDownload,          // fn()   — calls downloadExcel (generates both files)
  onDownloadBilling,   // fn()   — download billing summary by name
  onDownloadTimesheet, // fn()   — download timesheet workbook by name
  billingReportName,   // string | null — set after generation succeeds
  timesheetReportName, // string | null — set after generation succeeds
}) => {
  // The two individual download buttons are visible only when:
  //   • we are NOT currently downloading (prevent stale buttons during re-run)
  //   • the filename string is present (generation succeeded at least once)
  const showBillingButton   = !isDownloading && !!billingReportName;
  const showTimesheetButton = !isDownloading && !!timesheetReportName;
  const showDownloadButtons = showBillingButton || showTimesheetButton;

  return (
    <section style={{
      background:   "var(--bg-surface)",
      border:       "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding:      "24px",
    }}>
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
          Report Actions
        </h2>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "2px" }}>
          {isReady
            ? "Files ready — generate or download your reports"
            : "Upload both files above to enable these actions"}
        </p>
      </div>

      {/* ── Row 1: Generate + Download trigger ──────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {/* Generate Summary — always visible when isReady */}
        <Button
          variant="secondary"
          leftIcon={BarChart2}
          loading={isGenerating}
          disabled={!isReady || isDownloading}
          onClick={onGenerate}
          style={{ flex: "1 1 auto", minWidth: "160px" }}
        >
          Generate Summary
        </Button>

        {/* Download Excel — triggers generation of both files on the server.
            Hidden once both download buttons are showing (no need to re-trigger). */}
        {!showDownloadButtons && (
          <Button
            variant="primary"
            leftIcon={Download}
            loading={isDownloading}
            disabled={!isReady || isGenerating}
            onClick={onDownload}
            style={{ flex: "1 1 auto", minWidth: "160px" }}
          >
            {isDownloading ? "Generating…" : "Download Excel"}
          </Button>
        )}
      </div>

      {/* ── Row 2: Individual download buttons (appear after generation) ── */}
      {showDownloadButtons && (
        <div style={{
          marginTop:    "12px",
          display:      "flex",
          flexDirection:"column",
          gap:          "8px",
        }}>
          {/* Divider label */}
          <p style={{
            fontSize:    "11px",
            fontWeight:  "600",
            color:       "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "2px",
          }}>
            Ready to download
          </p>

          {/* Billing Summary download button */}
          {showBillingButton && (
            <Button
              variant="primary"
              leftIcon={Download}
              onClick={onDownloadBilling}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontWeight: "600" }}>Monthly Billing Summary</span>
                <span style={{
                  fontSize:    "11px",
                  fontWeight:  "400",
                  opacity:     0.75,
                  marginTop:   "1px",
                  whiteSpace:  "nowrap",
                  overflow:    "hidden",
                  textOverflow:"ellipsis",
                  maxWidth:    "220px",
                }}>
                  {billingReportName}
                </span>
              </span>
            </Button>
          )}

          {/* Client Wise Timesheet download button */}
          {showTimesheetButton && (
            <Button
              variant="secondary"
              leftIcon={FileSpreadsheet}
              onClick={onDownloadTimesheet}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontWeight: "600" }}>Client Wise Timesheet</span>
                <span style={{
                  fontSize:    "11px",
                  fontWeight:  "400",
                  opacity:     0.75,
                  marginTop:   "1px",
                  whiteSpace:  "nowrap",
                  overflow:    "hidden",
                  textOverflow:"ellipsis",
                  maxWidth:    "220px",
                }}>
                  {timesheetReportName}
                </span>
              </span>
            </Button>
          )}

          {/* Re-generate link — lets user re-trigger without reloading */}
          <button
            onClick={onDownload}
            disabled={!isReady || isDownloading}
            style={{
              background:  "none",
              border:      "none",
              padding:     "4px 0 0",
              fontSize:    "12px",
              color:       "var(--text-tertiary)",
              cursor:      isReady && !isDownloading ? "pointer" : "default",
              textAlign:   "left",
              textDecoration: "underline",
              opacity:     isReady && !isDownloading ? 1 : 0.4,
            }}
          >
            ↺ Regenerate with current files
          </button>
        </div>
      )}

      {/* ── Error message ────────────────────────────────────────────────── */}
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

      {/* ── Disabled hint ─────────────────────────────────────────────────── */}
      {!isReady && (
        <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-tertiary)" }}>
          ↑ Upload employee CSV and manager XLSX to unlock
        </p>
      )}
    </section>
  );
};

export default ReportActions;
