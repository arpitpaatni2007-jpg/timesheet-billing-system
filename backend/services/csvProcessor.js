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


// ─── Main Function: processCSV ────────────────────────────────────────────────
// This is the ONLY function exported from this file.
// Called by uploadController.js after a file is saved to disk.
//
// @param {string} filePath - Absolute path to the saved CSV file
// @returns {object} - { success, totalRows, validRows, skippedRows, data, summary }

const processCSV = (filePath) => {

  // ── Step 1: Verify the file actually exists on disk ──────────────────────
  if (!fs.existsSync(filePath)) {
    // Throw an error — uploadController will catch it
    throw new Error(`CSV file not found at path: ${filePath}`);
  }

  // ── Step 2: Read the raw file content from disk ───────────────────────────
  const fileContent = fs.readFileSync(filePath, "utf8");
  // readFileSync = read entire file at once (synchronous)
  // "utf8" = interpret bytes as readable text (not binary)

  // ── Step 3: Parse CSV using PapaParse ─────────────────────────────────────
  const parsed = Papa.parse(fileContent, {
    header         : true,   // First row becomes the column key names
    skipEmptyLines : true,   // Automatically skip 100% empty lines
    trimHeaders    : true,   // Remove spaces around column header names
    dynamicTyping  : false,  // Keep everything as string — we'll convert manually
    // Why false? Because "01:00" would become 1 and "CW-4" might get mangled
  });
  // parsed.data  = array of row objects (one object per row)
  // parsed.errors = any parse errors PapaParse found
  // parsed.meta   = info about the file (delimiter, line endings, etc.)


  // ── Step 4: Log any parse warnings (not fatal, just informational) ────────
  if (parsed.errors && parsed.errors.length > 0) {
    console.warn(`⚠️  PapaParse warnings for file: ${path.basename(filePath)}`);
    parsed.errors.forEach(err => {
      console.warn(`   Row ${err.row}: ${err.message}`); // Print each warning
    });
  }

  // ── Step 5: Process each row — clean, validate, transform ────────────────
  const validRows   = []; // Rows that passed validation
  let   skippedRows = 0;  // Count of rows we skipped (summary/blank)

  parsed.data.forEach((row, index) => {
    // index = row position (0-based) in the array

    // Skip summary rows and blank rows
    if (isSummaryOrBlankRow(row)) {
      skippedRows++;
      return; // "return" inside forEach = skip to next row (like "continue")
    }

    // Build a clean, structured object for this row
    // Each key name is camelCase for easy use in JavaScript/React
    const cleanRow = {

      // ── Identity ──────────────────────────────────────────────────────────
      user          : row["User"]?.trim() || "",
      // "?." is optional chaining — safe if row["User"] is undefined
      // "|| ''" gives empty string instead of undefined

      email         : row["Log User Mailid"]?.trim() || "",
      role          : row["Role"]?.trim() || "",
      addedBy       : row["Added By"]?.trim() || "",

      // ── Task Info ─────────────────────────────────────────────────────────
      taskId        : row["Task/Bug ID"]?.trim() || "",
      taskName      : row["Task/General/Bug"]?.trim() || "",
      taskType      : row["Type"]?.trim() || "",         // "task" or "issue"

      // ── Project Info ──────────────────────────────────────────────────────
      projectName   : row["Project Name"]?.trim() || "",
      projectId     : row["Project ID"]?.trim() || "",
      projectGroup  : row["Project Group"]?.trim() || "", // "Maintenance" / "Development"
      taskModule    : row["Task List/Module"]?.trim() || "",
      milestone     : row["milestone"]?.trim() === "None" ? null : row["milestone"]?.trim(),
      // Convert the string "None" → actual null value

      // ── Time & Billing ────────────────────────────────────────────────────
      date              : parseDate(row["Date"]),
      // "05-05-2026" → "2026-05-05"

      dailyLog          : row["Daily Log"]?.trim() || "",
      // Keep the original "HH:MM" string (e.g. "03:30")

      dailyLogMinutes   : parseTimeToMinutes(row["Daily Log"]),
      // Also store as minutes: 210

      hoursForBilling   : parseFloat(row["Hours(For Calculation)"]) || 0,
      // The reliable decimal hours field: "3.5" → 3.5
      // || 0 means: if parseFloat returns NaN, default to 0

      billingType       : row["Billing Type"]?.trim() || "",
      // "Billable" or "Non-Billable"

      actualCost        : parseActualCost(row["Actual Cost"]),
      // "₹ 3,000.00" → 3000  |  "-" → null

      // ── Notes ─────────────────────────────────────────────────────────────
      notes         : row["Notes"]?.trim() || "",
      timePeriod    : row["Time Period"]?.trim() === "-" ? null : row["Time Period"]?.trim(),
      fromTo        : row["From - To"]?.trim() === "-" ? null : row["From - To"]?.trim(),
      timerNotes    : row["Timer Notes"]?.trim() === "-" ? null : row["Timer Notes"]?.trim(),

      // ── Metadata ──────────────────────────────────────────────────────────
      createdTime   : row["Created Time"]?.trim() || "",
      // Keep as-is: "05-05-2026 18:02"

      _rowIndex     : index + 2,
      // +2 because: index is 0-based, plus header row = actual CSV line number
      // Useful for debugging: "error on row 5" matches row 5 in Excel
    };

    validRows.push(cleanRow); // Add this cleaned row to our results array
  });


  // ── Step 6: Build a Summary object ───────────────────────────────────────
  // Quick stats about the parsed file — useful for the frontend dashboard

  // Get all unique employee names
  const uniqueUsers = [...new Set(validRows.map(r => r.user))];
  // new Set() removes duplicates. Spread [...] converts it back to array

  // Get all unique projects
  const uniqueProjects = [...new Set(validRows.map(r => r.projectName))];

  // Sum up all billing hours
  const totalBillingHours = validRows.reduce((sum, r) => sum + r.hoursForBilling, 0);
  // reduce = loop through array keeping a running total
  // sum starts at 0, adds hoursForBilling from each row

  // Count billable vs non-billable rows
  const billableCount    = validRows.filter(r => r.billingType === "Billable").length;
  const nonBillableCount = validRows.filter(r => r.billingType !== "Billable").length;

  const summary = {
    totalEmployees    : uniqueUsers.length,
    employees         : uniqueUsers,
    totalProjects     : uniqueProjects.length,
    projects          : uniqueProjects,
    totalBillingHours : parseFloat(totalBillingHours.toFixed(2)),
    // toFixed(2) = round to 2 decimal places → "546.08"
    // parseFloat converts it back from string to number
    billableEntries   : billableCount,
    nonBillableEntries: nonBillableCount,
  };


  // ── Step 7: Return everything ─────────────────────────────────────────────
  return {
    success     : true,
    totalRows   : parsed.data.length,  // Total rows PapaParse found
    validRows   : validRows.length,    // Rows with real data
    skippedRows : skippedRows,         // Summary/blank rows ignored
    summary     : summary,             // Quick stats
    data        : validRows,           // The actual cleaned JSON array
  };

};


// ─── Export ───────────────────────────────────────────────────────────────────
// Only processCSV is exported — helper functions stay private to this file

module.exports = { processCSV };