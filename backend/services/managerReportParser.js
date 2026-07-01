// services/managerReportParser.js
//
// PURPOSE: Read the manager's time-tracking report and extract clean,
// structured data with client assignments.
//
// SUPPORTED FILE FORMATS:
//   .xlsx  — Toggl Excel export (original format, unchanged)
//   .csv   — Toggl CSV export  (new support added in Task 1)
//
// HOW FORMAT DETECTION WORKS:
//   path.extname(filePath).toLowerCase() returns ".xlsx" or ".csv".
//   The correct parser is chosen based on this extension.
//   Both paths produce identical rawRows and rawRowsNumeric arrays,
//   so ALL processing logic from Step 3 onward is shared — zero duplication.
//
// MANAGER REPORT COLUMNS (same in both formats):
//   Description | Duration | Member | Email | Project | Tags | Start date | ...
//
// KEY FACTS:
//   XLSX Duration: stored as a fraction of a day (0.00694 = 10 min)
//                  → multiply by 24 to get hours
//   CSV  Duration: stored as a time string ("0:13:59" or "2:05:00")
//                  → serialDurationToHours() already handles this format
//   The Duration parser (serialDurationToHours) handles BOTH formats,
//   so no special-casing is needed after the file is loaded.

const XLSX  = require("xlsx");       // Reads .xlsx files
const Papa  = require("papaparse"); // Reads .csv files (already used by csvProcessor.js)
const path  = require("path");
const fs    = require("fs");

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT DETECTION RULES
//
// Add or edit this list to match the client name prefixes in your
// manager's Description column. The key is what appears at the START
// of the description; the value is the clean client name to use.
// ─────────────────────────────────────────────────────────────────────────────
const CLIENT_PREFIX_MAP = [
  { prefix: "client-d",    clientName: "Client-D"    },
  { prefix: "client-a",    clientName: "Client-A"    },
  { prefix: "client-g",    clientName: "Client-G"    },
  { prefix: "dkbc",        clientName: "DKBC"        },
  { prefix: "hcpt",        clientName: "HCPT"        },
  { prefix: "clinic",      clientName: "Clinic"      },
  { prefix: "oms",         clientName: "OMS"         },
  { prefix: "digital lab", clientName: "Digital Lab" },
  // Add more clients here as needed:
  // { prefix: "client-e", clientName: "Client-E" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Extract client name from description text.
// Returns null if no known client is found (= unallocated/internal work).
// ─────────────────────────────────────────────────────────────────────────────
function extractClientFromDescription(description) {
  if (!description) return null;

  const lower = description.trim().toLowerCase();

  for (const rule of CLIENT_PREFIX_MAP) {
    if (lower.startsWith(rule.prefix)) {
      return rule.clientName; // match found
    }
  }

  return null; // no client match → internal/unallocated
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Convert a duration value to decimal hours.
//
// Handles two formats:
//   String "H:MM:SS" or "H:MM" — from CSV exports ("2:05:00" → 2.083)
//   Number 0.00694              — from XLSX serial time (0.00694 × 24 = 0.1667)
//
// Both formats appear because:
//   XLSX: the xlsx library reads the Duration cell as a numeric serial
//   CSV:  PapaParse reads it as the raw string exactly as Toggl wrote it
// ─────────────────────────────────────────────────────────────────────────────
function serialDurationToHours(value) {

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  // Handle time strings like "0:13:59" or "2:05:00" (from CSV)
  if (typeof value === "string" && value.includes(":")) {
    const parts   = value.split(":").map(Number);
    const hours   = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return hours + (minutes / 60) + (seconds / 3600);
  }

  // Handle Excel serial fraction (from XLSX) — multiply by 24 to get hours
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num * 24;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Convert an Excel serial date number to "YYYY-MM-DD".
// Used for XLSX only — CSV dates are already readable strings.
// ─────────────────────────────────────────────────────────────────────────────
function serialDateToISO(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }

  const num = parseFloat(value);
  if (!isNaN(num) && num > 40000) { // sanity check: serial > year 2009
    const epoch = new Date(1899, 11, 30); // Excel epoch: Dec 30, 1899
    epoch.setDate(epoch.getDate() + num);
    return epoch.toISOString().split("T")[0];
  }

  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADER A: Load rows from an XLSX file.
//
// Returns { rawRows, rawRowsNumeric } where:
//   rawRows        — array of arrays, cells as formatted strings (raw:false)
//   rawRowsNumeric — array of arrays, cells as raw numbers  (raw:true)
//
// Two reads are needed because:
//   raw:false gives Duration as a string (e.g. "0:14:00") — good for display
//   raw:true  gives Duration as a decimal fraction (0.009722) — reliable for math
//   We use the raw:true value for Duration calculation, raw:false for everything else.
// ─────────────────────────────────────────────────────────────────────────────
function loadXlsx(filePath) {
  const workbook  = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1, defval: null, raw: false,
  });

  const rawRowsNumeric = XLSX.utils.sheet_to_json(sheet, {
    header: 1, defval: null, raw: true,
  });

  return { rawRows, rawRowsNumeric };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADER B: Load rows from a CSV file.
//
// Returns { rawRows, rawRowsNumeric } in the SAME shape as loadXlsx().
//
// For CSV:
//   PapaParse reads the file and returns rows as objects keyed by header name.
//   We need array-of-arrays to match the XLSX shape, so we:
//     1. Read the header row → becomes rawRows[0]  (array of column names)
//     2. Convert each data row object → array of values in header order
//
//   rawRowsNumeric === rawRows for CSV because:
//     - Duration in CSV is always a string ("2:05:00"), never a numeric serial.
//     - serialDurationToHours() handles the string format directly.
//     - There are no Excel serial numbers to decode — dates are already strings.
//   Setting rawRowsNumeric = rawRows means the per-row processing code
//   (which reads rowNumeric[colIndex.duration]) still works without any changes.
// ─────────────────────────────────────────────────────────────────────────────
function loadCsv(filePath) {
  const fileContent = fs.readFileSync(filePath, "utf8");

  const parsed = Papa.parse(fileContent, {
    header        : true,    // first row becomes key names
    skipEmptyLines: true,    // skip blank rows
    dynamicTyping : false,   // keep everything as strings (Duration stays "2:05:00")
  });

  if (!parsed.data || parsed.data.length === 0) {
    return { rawRows: [], rawRowsNumeric: [] };
  }

  // Extract ordered header names from the first parsed row's keys.
  // Papa.parse with header:true doesn't give us a separate header array,
  // but parsed.meta.fields contains the column names in order.
  const headers = parsed.meta.fields; // e.g. ["Description","Start date",...,"Duration",...]

  // Build array-of-arrays:
  //   rawRows[0]   = headers array  (matches rawRows[0] from XLSX)
  //   rawRows[1..] = one array per data row, values in same order as headers
  const rawRows = [
    headers, // header row as an array
    ...parsed.data.map(rowObj => headers.map(h => rowObj[h] ?? null)),
  ];

  // For CSV, rawRowsNumeric is identical to rawRows.
  // Duration is a string like "2:05:00" — serialDurationToHours() handles it.
  // Start date is a string like "2026-05-01" — no serial conversion needed.
  const rawRowsNumeric = rawRows;

  return { rawRows, rawRowsNumeric };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: parseManagerReport
//
// Accepts either .xlsx or .csv.
// Detects format by file extension, loads with the correct loader,
// then runs the same Steps 3–7 regardless of format.
//
// Returns:
// {
//   managerName: "Manager X",
//   reportPeriod: "May 2026",
//   totalHours: 33.46,
//   totalClientHours: 23.31,
//   unallocatedHours: 10.15,
//   clientSummary: { "Client-D": 4.71, "DKBC": 8.44, ... },
//   clientEntries: [ { clientName, description, managerCategory, hours, date }, ... ],
//   unallocatedEntries: [ { description, managerCategory, hours, date }, ... ]
// }
// ─────────────────────────────────────────────────────────────────────────────
function parseManagerReport(filePath) {

  // ── Step 1: Verify file exists ────────────────────────────────────────────
  if (!fs.existsSync(filePath)) {
    throw new Error(`Manager report file not found: ${filePath}`);
  }

  // ── Step 2: Detect format and load rows ───────────────────────────────────
  //
  // path.extname("/uploads/1234-report.csv") → ".csv"
  // path.extname("/uploads/1234-report.xlsx") → ".xlsx"
  //
  // This is the ONLY place where CSV and XLSX differ.
  // Everything from Step 3 onward uses rawRows and rawRowsNumeric identically.

  const ext = path.extname(filePath).toLowerCase();
  let rawRows, rawRowsNumeric;

  if (ext === ".csv") {
    // ── CSV path ─────────────────────────────────────────────────────────
    ({ rawRows, rawRowsNumeric } = loadCsv(filePath));
    console.log(`📄 Manager report detected as CSV (${path.basename(filePath)})`);

  } else if (ext === ".xlsx" || ext === ".xls") {
    // ── XLSX path (original, unchanged) ──────────────────────────────────
    ({ rawRows, rawRowsNumeric } = loadXlsx(filePath));
    console.log(`📊 Manager report detected as XLSX (${path.basename(filePath)})`);

  } else {
    throw new Error(
      `Unsupported manager report format: "${ext}". ` +
      `Please upload a .xlsx or .csv file.`
    );
  }

  if (!rawRows || rawRows.length < 2) {
    throw new Error("Manager report appears empty — no data rows found.");
  }

  // ── Step 3: Identify column positions from the header row ─────────────────
  //
  // headerRow is the first row, lowercased so matching is case-insensitive.
  // This works for both XLSX and CSV because both loaders put the header
  // as rawRows[0].
  //
  // Expected column names (case-insensitive):
  //   description | duration | member | email | project | start date

  const headerRow = rawRows[0].map(h => (h || "").toString().trim().toLowerCase());

  const colIndex = {
    description : headerRow.indexOf("description"),
    duration    : headerRow.indexOf("duration"),
    member      : headerRow.indexOf("member"),
    email       : headerRow.indexOf("email"),
    project     : headerRow.indexOf("project"),    // manager activity category
    startDate   : headerRow.indexOf("start date"), // may also appear as "start date"
  };

  // Validate required columns exist
  const required = ["description", "duration", "member"];
  for (const col of required) {
    if (colIndex[col] === -1) {
      throw new Error(
        `Manager report is missing required column: "${col}". ` +
        `Found headers: ${rawRows[0].join(", ")}`
      );
    }
  }

  // ── Step 4: Process each data row ────────────────────────────────────────
  const clientEntries      = [];
  const unallocatedEntries = [];
  let   managerName        = "Manager";
  const allDates           = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row        = rawRows[i];
    const rowNumeric = rawRowsNumeric[i];

    // Skip blank rows
    const description = row[colIndex.description];
    if (!description || String(description).trim() === "") continue;

    // Capture manager name from the Member column (first non-empty value)
    const member = row[colIndex.member];
    if (member && member !== "-" && managerName === "Manager") {
      managerName = String(member).trim();
    }

    // ── Duration → decimal hours ───────────────────────────────────────────
    // We read from rowNumeric so that:
    //   XLSX: gets the raw numeric serial (e.g. 0.00694) → multiplied by 24
    //   CSV:  gets the same string as rowNumeric === rawRows, e.g. "2:05:00"
    // serialDurationToHours() handles both types with no additional logic here.
    const durationRaw = rowNumeric[colIndex.duration];
    const hours       = roundHours(serialDurationToHours(durationRaw));

    if (hours <= 0) continue; // skip zero-duration rows

    // ── Manager activity category ──────────────────────────────────────────
    const category = row[colIndex.project]
      ? String(row[colIndex.project]).trim()
      : "Uncategorized";

    // ── Date → "YYYY-MM-DD" string ────────────────────────────────────────
    // XLSX: may be a Date object or serial number → handled by serialDateToISO()
    // CSV:  already a plain string like "2026-05-01" → take as-is after split
    let dateStr = null;
    if (colIndex.startDate !== -1) {
      const rawDate     = row[colIndex.startDate];
      const numericDate = rowNumeric[colIndex.startDate];

      if (rawDate instanceof Date) {
        // XLSX with cellDates:true parsed it to a JS Date
        dateStr = rawDate.toISOString().split("T")[0];
      } else if (typeof numericDate === "number" && numericDate > 40000) {
        // XLSX raw serial number
        dateStr = serialDateToISO(numericDate);
      } else if (rawDate) {
        // CSV plain string: "2026-05-01" or "2026-05-01 09:00:00" — take date part
        dateStr = String(rawDate).split(" ")[0].split("T")[0];
      }
    }
    if (dateStr) allDates.push(dateStr);

    // ── Client detection ───────────────────────────────────────────────────
    const clientName = extractClientFromDescription(String(description).trim());

    const entry = {
      description     : String(description).trim(),
      managerCategory : category === "-" ? "Unspecified" : category,
      hours,
      date            : dateStr,
    };

    if (clientName) {
      clientEntries.push({ ...entry, clientName });
    } else {
      unallocatedEntries.push(entry);
    }
  }

  // ── Step 5: Build client summary (total hours per client) ─────────────────
  const clientSummary = {};
  for (const entry of clientEntries) {
    clientSummary[entry.clientName] =
      roundHours((clientSummary[entry.clientName] || 0) + entry.hours);
  }

  const totalClientHours = roundHours(
    Object.values(clientSummary).reduce((s, h) => s + h, 0)
  );
  const unallocatedHours = roundHours(
    unallocatedEntries.reduce((s, e) => s + e.hours, 0)
  );

  // ── Step 6: Infer report period from the earliest date in the file ─────────
  let reportPeriod = "Unknown Period";
  if (allDates.length > 0) {
    allDates.sort();
    const firstDate = new Date(allDates[0] + "T00:00:00"); // force local midnight
    reportPeriod = firstDate.toLocaleDateString("en-US", {
      month: "long",
      year:  "numeric",
    });
  }

  // ── Step 7: Return structured result ──────────────────────────────────────
  return {
    managerName,
    reportPeriod,
    totalHours       : roundHours(totalClientHours + unallocatedHours),
    totalClientHours,
    unallocatedHours,
    clientSummary,       // { "Client-D": 4.71, "DKBC": 8.44, ... }
    clientEntries,       // all entries with a detected client
    unallocatedEntries,  // internal/overhead entries
  };
}

// Round to 2 decimal places — prevents floating-point drift like 2.30000000003
function roundHours(h) {
  return Math.round((h || 0) * 100) / 100;
}

module.exports = { parseManagerReport, extractClientFromDescription, CLIENT_PREFIX_MAP };