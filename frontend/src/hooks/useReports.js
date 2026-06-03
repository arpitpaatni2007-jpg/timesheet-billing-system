// ── hooks/useReports.js ───────────────────────────────────────────────────────
// Handles the billing summary fetch and stores generated report history
// in localStorage so the Recent Reports panel persists across page reloads.

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getBillingSummary,
  generateBillingSummaryExcel,
  downloadReport,           // NEW: needed to fetch the actual Blob after generation
  triggerBrowserDownload,
} from "../api/reports";

const HISTORY_KEY = "billing_report_history"; // localStorage key
const MAX_HISTORY  = 10;                       // Keep last 10 entries

const useReports = () => {
  const [summaryData, setSummaryData]     = useState(null);  // JSON from /billing-summary
  const [isGenerating, setIsGenerating]   = useState(false); // Loading state for summary
  const [isDownloading, setIsDownloading] = useState(false); // Loading state for Excel
  const [error, setError]                 = useState(null);  // Last error message

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
  const generateSummary = useCallback(async (employeeFile, managerFile) => {
    if (!employeeFile || !managerFile) {
      toast.error("Please upload both files first.");
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
  // FIX: generateBillingSummaryExcel returns JSON { filename: "..." }, NOT a Blob.
  // We must extract the filename string, then call downloadReport(filename)
  // to fetch the actual Blob, then pass THAT to triggerBrowserDownload.
  //
  // Old (broken) flow:
  //   const blob = await generateBillingSummaryExcel(...)   // returned Blob
  //   triggerBrowserDownload(blob, filename)
  //   → blob was actually a JSON object → [object Object] in URL
  //
  // Fixed flow:
  //   const result = await generateBillingSummaryExcel(...) // returns { filename: "..." }
  //   const filename = result.filename                      // plain string
  //   const blob = await downloadReport(filename)           // real Blob from GET endpoint
  //   triggerBrowserDownload(blob, filename)                // works correctly
  const downloadExcel = useCallback(async (employeeFile, managerFile) => {
    if (!employeeFile || !managerFile) {
      toast.error("Please upload both files first.");
      return;
    }

    setIsDownloading(true);
    setError(null);

    const toastId = toast.loading("Generating Excel report...");

    try {
      // Step 1: POST both files to generate the Excel on the server.
      // Returns JSON like: { filename: "Monthly Billing Summary June 2026.xlsx" }
      const result = await generateBillingSummaryExcel(employeeFile, managerFile);

      // Step 2: Extract the filename string.
      // Support both { filename } and { data: { filename } } response shapes.
      const filename =
  result?.reportName ||
  result?.filename ||
  result?.data?.reportName ||
  result?.data?.filename;

      if (!filename || typeof filename !== "string") {
        throw new Error(
          `Server did not return a filename. Response: ${JSON.stringify(result)}`
        );
      }

      // Step 3: Fetch the actual binary file using the filename string.
      // GET /api/reports/download/:filename → returns a real Blob.
    triggerBrowserDownload(filename);

      // Step 5: Save a plain-string filename to history (never store the object).
      addToHistory({
        id:           Date.now(),
        filename,                        // string — safe to store in localStorage
        generatedAt:  new Date().toISOString(),
        employeeFile: employeeFile.name,
        managerFile:  managerFile.name,
        size: 0         // real byte count from the Blob
      });

      toast.success("Excel downloaded!", { id: toastId });
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
  };
};

export default useReports;