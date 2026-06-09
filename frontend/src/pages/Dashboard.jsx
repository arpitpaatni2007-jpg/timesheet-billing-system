// ── pages/Dashboard.jsx ───────────────────────────────────────────────────────
// The single-page dashboard. Owns all state via hooks.
// Assembles: UploadZone → ReportStatus → ReportActions → StatsPanel → ReportHistory
//
// State flow:
//   useUpload()  → file state → passed to UploadZone (display) and actions (API calls)
//   useReports() → API state → passed to ReportActions (loading) and StatsPanel (data)

import React, { useCallback } from "react";
import useUpload from "../hooks/useUpload";
import useReports from "../hooks/useReports";
import UploadZone from "../components/features/UploadZone";
import ReportActions from "../components/features/ReportActions";
import StatsPanel from "../components/features/StatsPanel";
import ReportStatus from "../components/features/ReportStatus";
import ReportHistory from "../components/features/ReportHistory";
import { downloadReport, triggerBrowserDownload } from "../api/reports";
import toast from "react-hot-toast";

// Derive a simple status string from hook state for ReportStatus component
const deriveStatus = ({ isReady, isGenerating, isDownloading, summaryData, error }) => {
  if (error)        return "error";
  if (isGenerating) return "generating";
  if (isDownloading) return "downloading";
  if (summaryData)  return "done";
  if (isReady)      return "ready";
  return "idle";
};

const Dashboard = () => {
  const upload  = useUpload();
  const reports = useReports();

  // Derived status string for the ReportStatus pipeline indicator
  const status = deriveStatus({
    isReady:       upload.isReady,
    isGenerating:  reports.isGenerating,
    isDownloading: reports.isDownloading,
    summaryData:   reports.summaryData,
    error:         reports.error,
  });

  // Generate Summary — calls /billing-summary, populates StatsPanel
  const handleGenerate = useCallback(() => {
    reports.generateSummary(upload.employeeFile, upload.managerFile);
  }, [reports, upload.employeeFile, upload.managerFile]);

  // Download Excel — calls /generate-billing-summary, generates both files,
  // stores both filenames in hook state, auto-downloads billing summary
  const handleDownload = useCallback(() => {
    reports.downloadExcel(upload.employeeFile, upload.managerFile);
  }, [reports, upload.employeeFile, upload.managerFile]);

  // Download Billing Summary by filename — uses existing GET download endpoint
  const handleDownloadBilling = useCallback(() => {
    if (!reports.billingReportName) return;
    triggerBrowserDownload(reports.billingReportName);
  }, [reports.billingReportName]);

  // Download Client Wise Timesheet by filename — uses existing GET download endpoint
  const handleDownloadTimesheet = useCallback(() => {
    if (!reports.timesheetReportName) return;
    triggerBrowserDownload(reports.timesheetReportName);
  }, [reports.timesheetReportName]);

  // Re-download from history — fetches file by name from backend
  const handleHistoryDownload = useCallback(async (filename) => {
    const toastId = toast.loading("Fetching report...");
    try {
      const blob = await downloadReport(filename);
      triggerBrowserDownload(blob, filename);
      toast.success("Downloaded!", { id: toastId });
    } catch (err) {
      toast.error(`Download failed: ${err.message}`, { id: toastId });
    }
  }, []);

  return (
    <main style={{
      maxWidth: "1100px",
      margin:   "0 auto",
      padding:  "0 24px 60px",
    }}>
      {/* ── Upload + Actions row ──────────────────────────────────────────── */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "1fr 340px",
        gap:                 "16px",
        alignItems:          "start",
        marginBottom:        "16px",
      }}
        className="main-grid"
      >
        <UploadZone
          employeeFile={upload.employeeFile}
          managerFile={upload.managerFile}
          setEmployeeFile={upload.setEmployeeFile}
          setManagerFile={upload.setManagerFile}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <ReportActions
            isReady={upload.isReady}
            isGenerating={reports.isGenerating}
            isDownloading={reports.isDownloading}
            error={reports.error}
            onGenerate={handleGenerate}
            onDownload={handleDownload}
            onDownloadBilling={handleDownloadBilling}
            onDownloadTimesheet={handleDownloadTimesheet}
            billingReportName={reports.billingReportName}
            timesheetReportName={reports.timesheetReportName}
          />
        </div>
      </div>

      {/* ── Pipeline status bar ───────────────────────────────────────────── */}
      <div style={{ marginBottom: "16px" }}>
        <ReportStatus status={status} />
      </div>

      {/* ── Stats panel (only after summary is generated) ────────────────── */}
      {(reports.summaryData || reports.isGenerating) && (
        <div style={{ marginBottom: "16px", animation: "fadeUp 0.3s ease both" }}>
          <StatsPanel
            summaryData={reports.summaryData}
            isLoading={reports.isGenerating}
          />
        </div>
      )}

      {/* ── Recent reports ────────────────────────────────────────────────── */}
      <ReportHistory onDownload={handleHistoryDownload} />

      {/* Responsive grid collapse */}
      <style>{`
        @media (max-width: 720px) {
          .main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
};

export default Dashboard;