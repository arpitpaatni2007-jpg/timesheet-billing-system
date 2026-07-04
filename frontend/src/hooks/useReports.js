// ── hooks/useReports.js ───────────────────────────────────────────────────────
// Handles the billing summary fetch and stores generated report history
// in localStorage so the Recent Reports panel persists across page reloads.
 
import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getBillingSummary,
  generateBillingSummaryExcel,
  downloadReport,
  triggerBrowserDownload,
} from "../api/reports";
 
const HISTORY_KEY = "billing_report_history"; // localStorage key
const MAX_HISTORY  = 10;                       // Keep last 10 entries
 
const useReports = () => {
  const [summaryData, setSummaryData]     = useState(null);  // JSON from /billing-summary
  const [isGenerating, setIsGenerating]   = useState(false); // Loading state for summary
  const [isDownloading, setIsDownloading] = useState(false); // Loading state for Excel
  const [error, setError]                 = useState(null);  // Last error message
 
  // ── NEW: store both filenames returned by /generate-billing-summary ─────────
  // These are plain strings e.g. "Monthly Billing Summary June 2026.xlsx".
  // Set to null until downloadExcel() succeeds.
  // Cleared back to null whenever a new download starts, so stale names
  // never show for a different month's generation.
  const [billingReportName,   setBillingReportName]   = useState(null);
  const [timesheetReportName, setTimesheetReportName] = useState(null);
 
  // ── Load history from localStorage ────────────────────────────────────────
  const getHistory = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return []; // If localStorage is corrupted, start fresh
    }
  }, []);
 
  // ── Save a new entry to history ────────────────────────────────────────────
  const addToHistory = useCallback((entry) => {
    const history = getHistory();
    const updated = [entry, ...history].slice(0, MAX_HISTORY); // Keep newest first, cap at 10
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [getHistory]);
 
  // ── generateSummary — calls POST /api/reports/billing-summary ──────────────
  // Returns JSON stats only. Does NOT generate Excel files.
  // The download buttons appear separately after downloadExcel() succeeds.
  const generateSummary = useCallback(async (employeeFile, managerFile) => {
    if (!employeeFile) {
      toast.error("Please upload the employee timesheet first.");
      return;
    }
 
    setIsGenerating(true);
    setError(null);
 
    try {
      const result = await getBillingSummary(employeeFile, managerFile);
      setSummaryData(result);
      toast.success("Billing summary generated!");
      return result;
    } catch (err) {
      setError(err.message);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, []);
 
  // ── downloadExcel ──────────────────────────────────────────────────────────
  // Calls POST /api/reports/generate-billing-summary.
  // The backend generates BOTH files and returns:
  //   {
  //     timesheetReport:      { reportName: "Client Wise - Timesheet June 2026.xlsx" },
  //     billingSummaryReport: { reportName: "Monthly Billing Summary June 2026.xlsx" }
  //   }
  //
  // After success:
  //   - Both filenames are stored in state so ReportActions can show two download buttons.
  //   - The billing summary file is downloaded immediately (primary deliverable).
  //   - Both entries are added to history.
  const downloadExcel = useCallback(async (employeeFile, managerFile) => {
    if (!employeeFile) {
      toast.error("Please upload the employee timesheet first.");
      return;
    }
 
    setIsDownloading(true);
    setError(null);
 
    // Clear any filenames from a previous run so buttons disappear during generation
    setBillingReportName(null);
    setTimesheetReportName(null);
 
    const toastId = toast.loading("Generating Excel reports...");
 
    try {
      // Step 1: POST both files → server generates both .xlsx files and returns names
      const result = await generateBillingSummaryExcel(employeeFile, managerFile);
 
      // Step 2: Extract both filenames from the response.
      // Backend shape: { timesheetReport: { reportName }, billingSummaryReport: { reportName } }
      const billingName   = result?.billingSummaryReport?.reportName
                         || result?.reportName       // fallback: older single-file shape
                         || result?.filename;
 
      const timesheetName = result?.timesheetReport?.reportName;
 
      if (!billingName || typeof billingName !== "string") {
        throw new Error(
          `Server did not return a billing summary filename. Got: ${JSON.stringify(result)}`
        );
      }
 
      // Step 3: Store both names in state — this triggers the two download buttons to appear
      setBillingReportName(billingName);
      if (timesheetName) setTimesheetReportName(timesheetName);
 
      // Step 4: Immediately download the billing summary (primary deliverable)
      triggerBrowserDownload(billingName);
 
      // Step 5: Add both files to history (only store plain strings, never objects)
      const now = new Date().toISOString();
      addToHistory({
        id:           Date.now(),
        filename:     billingName,
        generatedAt:  now,
        employeeFile: employeeFile.name,
        managerFile:  managerFile?.name ?? null,
        size:         0,
      });
      if (timesheetName) {
        addToHistory({
          id:           Date.now() + 1,   // +1 ensures unique id within same ms
          filename:     timesheetName,
          generatedAt:  now,
          employeeFile: employeeFile.name,
          managerFile:  managerFile?.name ?? null,
          size:         0,
        });
      }
 
      toast.success("Reports ready!", { id: toastId });
    } catch (err) {
      setError(err.message);
      toast.error(`Download failed: ${err.message}`, { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  }, [addToHistory]);
 
  return {
    summaryData,
    isGenerating,
    isDownloading,
    error,
    generateSummary,
    downloadExcel,
    getHistory,
    // ── NEW: expose both filenames so Dashboard can pass them to ReportActions
    billingReportName,
    timesheetReportName,
  };
};
 
export default useReports;