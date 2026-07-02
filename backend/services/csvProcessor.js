// ─── csvProcessor.js ──────────────────────────────────────────────────────────
// PURPOSE: Reads a saved CSV file and converts it into clean, usable JSON.
// Called by uploadController after a file is successfully uploaded.
//
// REAL FILE FACTS (from your actual timesheet CSV):
//   - 22 columns per row
//   - Last 3 rows are summary/blank — must be skipped
//   - Daily Log is "HH:MM" string (e.g. "03:30")
//   - Hours(For Calculation) is decimal (e.g. 3.5) — used for billing
//   - Actual Cost has mixed symbols: "₹ 3,000.00", "? 90.00", "-"
//   - Some Notes fields contain commas inside quotes — PapaParse handles this
// ─────────────────────────────────────────────────────────────────────────────

const fs      = require("fs");       // Built-in: read files from disk
const path    = require("path");     // Built-in: work with file paths safely
const Papa    = require("papaparse"); // PapaParse: robust CSV parser
const XLSX    = require("xlsx");     // Already installed — used by managerReportParser.js
                                     // Reused here for .xlsx employee timesheets


// ─── Helper Function 1: Clean Actual Cost ────────────────────────────────────
// The "Actual Cost" column has messy values like:
//   "₹ 3,000.00"  → 3000
//   "? 90.00"     → 90       (? appears when currency symbol doesn't render)
//   "-"           → null     (means cost was not recorded)
//
// Returns a number or null.

const parseActualCost = (rawValue) => {
  if (!rawValue || rawValue.trim() === "-" || rawValue.trim() === "") {
    return null; // No cost recorded
  }

  // Remove currency symbols (₹, $, ?, spaces), remove commas from "3,000"
  // Then parse whatever number is left
  const cleaned = rawValue
    .replace(/[₹$?]/g, "")   // Remove currency characters
    .replace(/,/g, "")        // Remove comma separators: "3,000" → "3000"
    .trim();                  // Remove surrounding whitespace

  const number = parseFloat(cleaned); // Convert string to decimal number

  return isNaN(number) ? null : number; // If result is not a number, return null
};


// ─── Helper Function 2: Convert Daily Log to Minutes ─────────────────────────
// "Daily Log" column stores time as "HH:MM" (e.g. "03:30", "00:45")
// We convert to total minutes for easier calculation later.
// Example: "03:30" → 210 minutes
//
// Returns a number (minutes) or 0 if format is invalid.

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || timeStr.trim() === "-" || !timeStr.includes(":")) {
    return 0; // Can't parse, return 0 minutes
  }

  const parts = timeStr.trim().split(":"); // "03:30" → ["03", "30"]

  const hours   = parseInt(parts[0], 10); // "03" → 3    (10 = base 10 decimal)
  const minutes = parseInt(parts[1], 10); // "30" → 30

  // If either part is not a valid number, return 0
  if (isNaN(hours) || isNaN(minutes)) return 0;

  return (hours * 60) + minutes; // 3 hours × 60 + 30 minutes = 210
};


// ─── Helper Function 3: Parse Date ───────────────────────────────────────────
// "Date" column is in DD-MM-YYYY format (e.g. "05-05-2026")
// JavaScript's new Date() expects YYYY-MM-DD, so we reformat it.
// Returns an ISO date string "2026-05-05" or null if invalid.

const parseDate = (dateStr) => {
  if (!dateStr || dateStr.trim() === "-" || dateStr.trim() === "") {
    return null;
  }

  const parts = dateStr.trim().split("-"); // "05-05-2026" → ["05", "05", "2026"]

  if (parts.length !== 3) return null; // Not a valid DD-MM-YYYY date

  const day   = parts[0]; // "05"
  const month = parts[1]; // "05"
  const year  = parts[2]; // "2026"

  // Reformat to YYYY-MM-DD which is the international standard
  return `${year}-${month}-${day}`; // → "2026-05-05"
};


// ─── Helper Function 4: Check if Row is a Summary or Blank Row ───────────────
// Your CSV has these non-data rows we must skip:
//   Row 192: ",,,,Total Log Hours,546:05:00,..." (summary totals row)
//   Rows 193-195: completely empty rows
//
// Returns true if the row should be SKIPPED, false if it's real data.

const isSummaryOrBlankRow = (row) => {
  // If the User column is empty, it's not a real timesheet entry
  if (!row["User"] || row["User"].trim() === "") {
    return true; // Skip this row
  }

  // If the Task/Bug ID looks like a summary marker (no real ID pattern)
  // Real IDs look like: N-1-T847, POP-T1261, CW-4 etc.
  // Summary row has empty Task/Bug ID
  if (!row["Task/Bug ID"] || row["Task/Bug ID"].trim() === "") {
    return true; // Skip this row
  }

  return false; // This row has real data, keep it
};


// ─── Loader A: Parse CSV file using PapaParse ────────────────────────────────
// Returns an array of row objects keyed by column header name.
// e.g. [{ "User": "Employee A", "Project Name": "Client-A - OMS", ... }, ...]

const loadCsvRows = (filePath) => {
  const fileContent = fs.readFileSync(filePath, "utf8");

  const parsed = Papa.parse(fileContent, {
    header         : true,   // First row becomes the column key names
    skipEmptyLines : true,   // Automatically skip 100% empty lines
    trimHeaders    : true,   // Remove spaces around column header names
    dynamicTyping  : false,  // Keep everything as string — we convert manually
  });

  if (parsed.errors && parsed.errors.length > 0) {
    console.warn(`⚠️  PapaParse warnings for: ${path.basename(filePath)}`);
    parsed.errors.forEach(err => console.warn(`   Row ${err.row}: ${err.message}`));
  }

  return parsed.data; // array of row objects
};


// ─── Loader B: Parse XLSX file using the xlsx library ────────────────────────
// Converts the first worksheet to the same array-of-objects shape as PapaParse.
// The xlsx library is already a dependency (used by managerReportParser.js) —
// no new install needed.
//
// WHY raw:false here?
//   The employee timesheet stores hours as plain numbers ("3.5", "1", "0.75"),
//   dates as DD-MM-YYYY strings, and Daily Log as "HH:MM" strings.
//   raw:false keeps everything as formatted strings, which is what the
//   existing cleanRow mapping already expects and handles correctly.

const loadXlsxRows = (filePath) => {
  const workbook  = XLSX.readFile(filePath, { raw: false, cellDates: false });
  // raw:false    → format cells as display strings (not raw serial numbers)
  // cellDates:false → keep date cells as strings ("05-05-2026") matching CSV format

  const sheetName = workbook.SheetNames[0]; // always use the first sheet
  const sheet     = workbook.Sheets[sheetName];

  // sheet_to_json with header:1 returns array-of-arrays; with defval:"" and
  // no header option it returns array-of-objects keyed by row 1 values — which
  // is the same shape PapaParse produces with header:true.
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval      : "",     // missing cells become "" instead of undefined
    raw         : false,  // use formatted strings, not raw numbers
  });

  console.log(`📊 XLSX employee timesheet: ${rows.length} rows from sheet "${sheetName}"`);
  return rows; // array of row objects, same shape as PapaParse output
};


// ─── Main Function: processCSV ────────────────────────────────────────────────
// Accepts both .csv and .xlsx employee timesheet files.
// Detects the format by file extension, loads the rows with the correct loader,
// then runs the SAME Steps 5–7 (clean, validate, summarise) for both formats.
//
// @param {string} filePath - Absolute path to the saved file (.csv or .xlsx)
// @returns {object} - { success, totalRows, validRows, skippedRows, data, summary }

const processCSV = (filePath) => {

  // ── Step 1: Verify the file actually exists on disk ──────────────────────
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  // ── Step 2: Detect format and load rows ───────────────────────────────────
  // path.extname returns ".csv" or ".xlsx" (lowercase after .toLowerCase())
  const ext  = path.extname(filePath).toLowerCase();
  let   rows; // will be array of row objects keyed by column header

  if (ext === ".xlsx" || ext === ".xls") {
    rows = loadXlsxRows(filePath);
    console.log(`📊 Employee timesheet detected as XLSX (${path.basename(filePath)})`);
  } else {
    // Default: treat as CSV (covers .csv and any unrecognised extension)
    rows = loadCsvRows(filePath);
    console.log(`📄 Employee timesheet detected as CSV (${path.basename(filePath)})`);
  }

  if (!rows || rows.length === 0) {
    throw new Error("Employee timesheet file appears empty — no data rows found.");
  }

  // ── Steps 3–4 (CSV-only): already handled inside loadCsvRows ─────────────
  // PapaParse warnings are logged there. XLSX loader logs its own row count.

  // ── Step 5: Process each row — clean, validate, transform ────────────────
  // THIS BLOCK IS IDENTICAL FOR BOTH CSV AND XLSX.
  // Both loaders produce the same shape: { "User": "...", "Project Name": "...", ... }
  const validRows   = [];
  let   skippedRows = 0;

  rows.forEach((row, index) => {
    if (isSummaryOrBlankRow(row)) {
      skippedRows++;
      return;
    }

    const cleanRow = {
      user          : row["User"]?.trim() || "",
      email         : row["Log User Mailid"]?.trim() || "",
      role          : row["Role"]?.trim() || "",
      addedBy       : row["Added By"]?.trim() || "",

      taskId        : row["Task/Bug ID"]?.trim() || "",
      taskName      : row["Task/General/Bug"]?.trim() || "",
      taskType      : row["Type"]?.trim() || "",

      projectName   : row["Project Name"]?.trim() || "",
      projectId     : row["Project ID"]?.trim() || "",
      projectGroup  : row["Project Group"]?.trim() || "",
      taskModule    : row["Task List/Module"]?.trim() || "",
      milestone     : row["milestone"]?.trim() === "None" ? null : row["milestone"]?.trim(),

      date              : parseDate(row["Date"]),
      dailyLog          : row["Daily Log"]?.trim() || "",
      dailyLogMinutes   : parseTimeToMinutes(row["Daily Log"]),
      hoursForBilling   : parseFloat(row["Hours(For Calculation)"]) || 0,
      billingType       : row["Billing Type"]?.trim() || "",
      actualCost        : parseActualCost(row["Actual Cost"]),

      notes         : row["Notes"]?.trim() || "",
      timePeriod    : row["Time Period"]?.trim() === "-" ? null : row["Time Period"]?.trim(),
      fromTo        : row["From - To"]?.trim() === "-" ? null : row["From - To"]?.trim(),
      timerNotes    : row["Timer Notes"]?.trim() === "-" ? null : row["Timer Notes"]?.trim(),

      createdTime   : row["Created Time"]?.trim() || "",
      _rowIndex     : index + 2,
    };

    validRows.push(cleanRow);
  });


  // ── Step 6: Build a Summary object ───────────────────────────────────────
  const uniqueUsers   = [...new Set(validRows.map(r => r.user))];
  const uniqueProjects = [...new Set(validRows.map(r => r.projectName))];
  const totalBillingHours = validRows.reduce((sum, r) => sum + r.hoursForBilling, 0);
  const billableCount     = validRows.filter(r => r.billingType === "Billable").length;
  const nonBillableCount  = validRows.filter(r => r.billingType !== "Billable").length;

  const summary = {
    totalEmployees    : uniqueUsers.length,
    employees         : uniqueUsers,
    totalProjects     : uniqueProjects.length,
    projects          : uniqueProjects,
    totalBillingHours : parseFloat(totalBillingHours.toFixed(2)),
    billableEntries   : billableCount,
    nonBillableEntries: nonBillableCount,
  };


  // ── Step 7: Return everything ─────────────────────────────────────────────
  return {
    success     : true,
    totalRows   : rows.length,
    validRows   : validRows.length,
    skippedRows : skippedRows,
    summary     : summary,
    data        : validRows,
  };

};


// ─── Export ───────────────────────────────────────────────────────────────────
// Only processCSV is exported — helper functions stay private to this file

module.exports = { processCSV };