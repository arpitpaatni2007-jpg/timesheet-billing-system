// ── pages/Dashboard.jsx ───────────────────────────────────────────────────────
// The single-page dashboard. Owns all state via hooks.
// Assembles: UploadZone → ReportStatus → ReportActions → ClientSheetConfig
//            → StatsPanel → ReportHistory

import React, { useCallback } from "react";
import useUpload from "../hooks/useUpload";
import useReports from "../hooks/useReports";
import UploadZone from "../components/features/UploadZone";
import ReportActions from "../components/features/ReportActions";
import ClientSheetConfig from "../components/features/ClientSheetConfig"; // ← NEW
import StatsPanel from "../components/features/StatsPanel";
import ReportStatus from "../components/features/ReportStatus";
import ReportHistory from "../components/features/ReportHistory";
import { triggerBrowserDownload } from "../api/reports";
import toast from "react-hot-toast";

const deriveStatus = ({ isReady, isGenerating, isDownloading, summaryData, error }) => {
  if (error)         return "error";
  if (isGenerating)  return "generating";
  if (isDownloading) return "downloading";
  if (summaryData)   return "done";
  if (isReady)       return "ready";
  return "idle";
};

const Dashboard = () => {
  const upload  = useUpload();
  const reports = useReports();

  const status = deriveStatus({
    isReady:       upload.isReady,
    isGenerating:  reports.isGenerating,
    isDownloading: reports.isDownloading,
    summaryData:   reports.summaryData,
    error:         reports.error,
  });

  const handleGenerate = useCallback(() => {
    reports.generateSummary(upload.employeeFile, upload.managerFile);
  }, [reports, upload.employeeFile, upload.managerFile]);

  const handleDownload = useCallback(() => {
    reports.downloadExcel(upload.employeeFile, upload.managerFile);
  }, [reports, upload.employeeFile, upload.managerFile]);

  const handleDownloadBilling = useCallback(() => {
    if (!reports.billingReportName) return;
    triggerBrowserDownload(reports.billingReportName);
  }, [reports.billingReportName]);

  const handleDownloadTimesheet = useCallback(() => {
    if (!reports.timesheetReportName) return;
    triggerBrowserDownload(reports.timesheetReportName);
  }, [reports.timesheetReportName]);

const handleHistoryDownload = useCallback((filename) => {
  const toastId = toast.loading("Preparing download...");

  try {
    triggerBrowserDownload(filename);
    toast.success("Download started!", { id: toastId });
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
      {/* ── Upload + Actions + Config column ─────────────────────────────── */}
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

        {/* Right column: ReportActions + ClientSheetConfig stacked */}
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

          {/* Client sheet configuration panel */}
          <ClientSheetConfig summaryData={reports.summaryData} />
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