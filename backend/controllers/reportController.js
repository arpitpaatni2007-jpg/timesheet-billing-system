// controllers/reportController.js

const path = require("path");
const fs   = require("fs");

const csvProcessor                   = require("../services/csvProcessor");
const { groupByClient }              = require("../services/timesheetGrouper");
const { generateTimesheetExcel }     = require("../services/excelGenerator");
const { parseManagerReport }         = require("../services/managerReportParser");
const { buildBillingSummary }        = require("../services/billingSummaryBuilder");
const { generateBillingSummaryExcel} = require("../services/billingSummaryExcelGenerator"); // Phase 7

// ─── Phase 5: POST /api/reports/generate-timesheet ─── (unchanged)
const generateTimesheet = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No CSV file uploaded" });
    }
    let reportMonth = req.body.reportMonth;
    if (!reportMonth) {
      const now = new Date();
      reportMonth = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    const parsedResult = csvProcessor.processCSV(req.file.path);
    if (!parsedResult?.data?.length) {
      return res.status(400).json({ success: false, error: "CSV file is empty or invalid" });
    }
    const groupedData = groupByClient(parsedResult.data);
    if (!groupedData?.length) {
      return res.status(400).json({ success: false, error: "No data could be grouped." });
    }
    const savedPath  = await generateTimesheetExcel(groupedData, reportMonth);
    const reportName = path.basename(savedPath);
    return res.status(200).json({
      success: true, reportName, reportMonth,
      totalRows: parsedResult.validRows, totalClients: groupedData.length,
      path: savedPath,
      message: `Report generated with ${groupedData.length} client sheet(s).`
    });
  } catch (error) {
    console.error("❌ generateTimesheet error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── Phase 5: GET /api/reports/download/:filename ─── (unchanged)
const downloadReport = (req, res) => {
  try {
    const fileName = req.params.filename;
    const filePath = path.join(__dirname, "../generated-reports", fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "Report file not found" });
    }
    res.download(filePath, fileName);
  } catch (error) {
    console.error("❌ downloadReport error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── Phase 6: POST /api/reports/billing-summary ─── (unchanged)
const generateBillingSummary = async (req, res) => {
  try {
    const timesheetFile = req.files?.["timesheetCsv"]?.[0]  || null;
    const managerFile   = req.files?.["managerReport"]?.[0] || null;
    if (!timesheetFile) {
      return res.status(400).json({ success: false, error: 'Send employee CSV as "timesheetCsv"' });
    }
    if (!managerFile) {
      return res.status(400).json({ success: false, error: 'Send manager Excel as "managerReport"' });
    }
    let reportMonth = req.body.reportMonth;
    if (!reportMonth) {
      const now = new Date();
      reportMonth = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    const parsedResult   = csvProcessor.processCSV(timesheetFile.path);
    if (!parsedResult?.data?.length) {
      return res.status(400).json({ success: false, error: "Employee CSV is empty or invalid" });
    }
    const groupedData    = groupByClient(parsedResult.data);
    const managerData    = parseManagerReport(managerFile.path);
    const billingSummary = buildBillingSummary(groupedData, managerData, reportMonth);
    return res.status(200).json({
      success: true, reportPeriod: reportMonth,
      managerName: managerData.managerName,
      totalClients: billingSummary.clients.length,
      grandTotal: billingSummary.grandTotal,
      summary: billingSummary,
      message: `Billing summary built for ${billingSummary.clients.length} client(s).`
    });
  } catch (error) {
    console.error("❌ generateBillingSummary error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 — POST /api/reports/generate-billing-summary  (NEW)
//
// Accepts same two files as Phase 6 billing-summary:
//   "timesheetCsv"  → employee timesheet .csv
//   "managerReport" → manager Toggl export .xlsx
// Optional: "reportMonth" = "May 2026"
//
// Returns: { success, reportName, path }
// Also saves the .xlsx to generated-reports/
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7: POST /api/reports/generate-billing-summary
// Accepts same two files as /billing-summary, but also writes the Excel file.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7: POST /api/reports/generate-billing-summary
//
// Generates BOTH output files in one request:
//   1. Client Wise - Timesheet {month}.xlsx   ← intermediate verification workbook
//   2. Monthly Billing Summary {month}.xlsx   ← final billing output
//
// Both files are saved to generated-reports/ and both paths are returned.
// ─────────────────────────────────────────────────────────────────────────────
const generateBillingSummaryExcelReport = async (req, res) => {
  try {
    const timesheetFile = req.files?.["timesheetCsv"]?.[0]  || null;
    const managerFile   = req.files?.["managerReport"]?.[0] || null;

    if (!timesheetFile) {
      return res.status(400).json({
        success: false,
        error: 'Send employee CSV with field name "timesheetCsv"'
      });
    }
    if (!managerFile) {
      return res.status(400).json({
        success: false,
        error: 'Send manager Excel with field name "managerReport"'
      });
    }

    let reportMonth = req.body.reportMonth;
    if (!reportMonth) {
      const now = new Date();
      reportMonth = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    // ── Step 1: Parse the employee CSV once ────────────────────────────────────
    const parsedResult = csvProcessor.processCSV(timesheetFile.path);
    if (!parsedResult?.data?.length) {
      return res.status(400).json({
        success: false,
        error: "Employee CSV is empty or invalid."
      });
    }

    // ── Step 2: Group employee data (used by BOTH generators) ─────────────────
    const groupedData = groupByClient(parsedResult.data);

    // ── Step 3: Generate File 1 — Client Wise Timesheet workbook ──────────────
    // One sheet per client, grouped by Project → Module → Task → Employee.
    // This is the intermediate verification file the manager reviews first.
    const timesheetPath = await generateTimesheetExcel(groupedData, reportMonth);

    // ── Step 4: Parse manager report and build billing summary ────────────────
    const managerData    = parseManagerReport(managerFile.path);
    const billingSummary = buildBillingSummary(groupedData, managerData, reportMonth);

    // ── Step 5: Generate File 2 — Monthly Billing Summary workbook ────────────
    // Single sheet, one row per project, manager + employees as columns.
    const billingPath = await generateBillingSummaryExcel(billingSummary, reportMonth);

    // ── Step 6: Return both file names and paths ───────────────────────────────
    return res.status(200).json({
      success     : true,
      reportMonth,
      totalClients: billingSummary.clients.length,
      grandTotal  : billingSummary.grandTotal,

      // File 1 — Client Wise Timesheet
      timesheetReport: {
        reportName : path.basename(timesheetPath),
        path       : timesheetPath,
      },

      // File 2 — Billing Summary
      billingSummaryReport: {
        reportName : path.basename(billingPath),
        path       : billingPath,
      },

      message: `Generated 2 reports for ${billingSummary.clients.length} client(s): Timesheet + Billing Summary.`,
    });

  } catch (error) {
    console.error("❌ generateBillingSummaryExcelReport error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  generateTimesheet,
  downloadReport,
  generateBillingSummary,
  generateBillingSummaryExcelReport,  // Phase 7
};