// services/managerReportParser.js
//
// PURPOSE: Read the manager's Toggl/time-tracking Excel report (.xlsx)
// and extract clean, structured data with client assignments.
//
// Manager report columns (in order):
//   Description | Duration | Member | Email | Project | Tags | Start date | Start time | Stop date | Stop time
//
// Key facts:
//   - Duration is stored as a fraction of a day (e.g. 0.00694 = 10 minutes)
//     Excel serial time: multiply by 24 to get hours
//   - Client name is embedded in Description: "Client-D - IRS941..." → "Client-D"
//   - Project column = manager activity category (not a project name)

const XLSX = require("xlsx"); // For reading .xlsx files
const path = require("path");

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
// HELPER: Extract client name from description text
// Returns null if no known client is found (= unallocated/internal work)
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
// HELPER: Convert Excel serial duration to decimal hours
//
// The xlsx library reads Duration as a decimal fraction of a day.
// Example: 0.00694444 days × 24 = 0.1667 hours = 10 minutes
// ─────────────────────────────────────────────────────────────────────────────
function serialDurationToHours(value) {

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  // Handle time strings like "0:13:59"
  if (typeof value === "string" && value.includes(":")) {

    const parts = value.split(":").map(Number);

    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;

    return hours + (minutes / 60) + (seconds / 3600);
  }

  // Handle Excel serial numbers
  const num = parseFloat(value);

  if (!isNaN(num)) {
    return num * 24;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Convert Excel serial date to ISO string "YYYY-MM-DD"
// Excel counts days since 1899-12-30 (with a known leap-year bug)
// ─────────────────────────────────────────────────────────────────────────────
function serialDateToISO(value) {
  if (!value) return null;

  // If xlsx already parsed it as a JS Date object
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }

  // If it's a raw serial number (e.g. 46143)
  const num = parseFloat(value);
  if (!isNaN(num) && num > 40000) { // sanity check: > year 2009
    // Excel epoch: days since Dec 30, 1899
    const epoch = new Date(1899, 11, 30); // months are 0-indexed in JS
    epoch.setDate(epoch.getDate() + num);
    return epoch.toISOString().split("T")[0];
  }

  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION: parseManagerReport
//
// Reads the manager Excel file and returns:
// {
//   managerName: "Manager X",
//   reportPeriod: "May 2026",        // inferred from dates
//   totalHours: 33.46,
//   clientEntries: [                  // entries tied to a specific client
//     {
//       clientName:       "Client-D",
//       description:      "Client-D - IRS941 eFS discuss with Employee C",
//       managerCategory:  "Project Monitoring, Control & Reporting",
//       hours:            1.0058,
//       date:             "2026-05-04"
//     }, ...
//   ],
//   unallocatedEntries: [             // internal/overhead entries
//     { description, managerCategory, hours, date }, ...
//   ],
//   clientSummary: {                  // total hours per client (for merging)
//     "Client-D": 4.71,
//     "DKBC":     8.44,
//     ...
//   },
//   unallocatedHours: 10.15
// }
// ─────────────────────────────────────────────────────────────────────────────
function parseManagerReport(filePath) {

  // ── Step 1: Verify file exists ─────────────────────────────────────────────
  const fs = require("fs");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Manager report file not found: ${filePath}`);
  }

  // ── Step 2: Read Excel file ────────────────────────────────────────────────
  // cellDates:true  → parse date serial numbers into JS Date objects
  // raw:false       → format cells as displayed strings where possible
  const workbook  = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0]; // use the first sheet
  const sheet     = workbook.Sheets[sheetName];

  // Convert sheet to array of row-arrays (not objects) so we can handle
  // the header row manually and avoid column name parsing issues
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,       // return array of arrays
    defval: null,    // missing cells = null
    raw: false,      // format dates/times as strings where possible
  });

  // Also read with raw:true to get the numeric serial for Duration
  const rawRowsNumeric = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,       // keep raw values (numbers for dates/times)
  });

  if (rawRows.length < 2) {
    throw new Error("Manager report appears empty — no data rows found");
  }

  // ── Step 3: Identify columns from header row ───────────────────────────────
  const headerRow = rawRows[0].map(h => (h || "").toString().trim().toLowerCase());
  //
  // Expected headers (case-insensitive):
  //   description | duration | member | email | project | tags | start date | ...

  const colIndex = {
    description : headerRow.indexOf("description"),
    duration    : headerRow.indexOf("duration"),
    member      : headerRow.indexOf("member"),
    email       : headerRow.indexOf("email"),
    project     : headerRow.indexOf("project"),   // manager activity category
    startDate   : headerRow.indexOf("start date"),
  };

  // Validate that required columns exist
  const required = ["description", "duration", "member"];
  for (const col of required) {
    if (colIndex[col] === -1) {
      throw new Error(
        `Manager report is missing required column: "${col}". ` +
        `Found headers: ${rawRows[0].join(", ")}`
      );
    }
  }

  // ── Step 4: Process each data row ─────────────────────────────────────────
  const clientEntries     = [];
  const unallocatedEntries = [];
  let managerName         = "Manager";
  const allDates          = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row        = rawRows[i];
    const rowNumeric = rawRowsNumeric[i];

    // Skip empty rows
    const description = row[colIndex.description];
    if (!description || String(description).trim() === "") continue;

    // Get member name (use first non-empty value found)
    const member = row[colIndex.member];
    if (member && member !== "-" && managerName === "Manager") {
      managerName = String(member).trim();
    }

    // ── Duration: use raw numeric value (fraction of day) ─────────────────
    // The parsed string version is unreliable for time math;
    // the raw numeric value is always a clean decimal
const durationRaw = row[colIndex.duration];
const hours = roundHours(serialDurationToHours(durationRaw));

    if (hours <= 0) continue; // skip zero-duration rows

    // ── Manager Activity Category ──────────────────────────────────────────
    const category = row[colIndex.project]
      ? String(row[colIndex.project]).trim()
      : "Uncategorized";

    // ── Date ──────────────────────────────────────────────────────────────
    let dateStr = null;
    if (colIndex.startDate !== -1) {
      const rawDate    = row[colIndex.startDate];
      const numericDate = rowNumeric[colIndex.startDate];
      if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().split("T")[0];
      } else if (numericDate && typeof numericDate === "number" && numericDate > 40000) {
        dateStr = serialDateToISO(numericDate);
      } else if (rawDate) {
        dateStr = String(rawDate).split(" ")[0]; // take date part only
      }
    }
    if (dateStr) allDates.push(dateStr);

    // ── Detect client from description ────────────────────────────────────
    const clientName = extractClientFromDescription(String(description).trim());

    const entry = {
      description     : String(description).trim(),
      managerCategory : category === "-" ? "Unspecified" : category,
      hours,
      date: dateStr,
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

  const totalClientHours     = Object.values(clientSummary).reduce((s, h) => s + h, 0);
  const unallocatedHours     = roundHours(
    unallocatedEntries.reduce((s, e) => s + e.hours, 0)
  );

  // ── Step 6: Infer report period from dates in the file ────────────────────
  let reportPeriod = "Unknown Period";
  if (allDates.length > 0) {
    allDates.sort();
    const firstDate = new Date(allDates[0]);
    // Format as "May 2026"
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
    totalClientHours : roundHours(totalClientHours),
    unallocatedHours,
    clientSummary,     // { "Client-D": 4.71, "DKBC": 8.44, ... }
    clientEntries,     // all entries with a detected client
    unallocatedEntries // internal/overhead entries
  };
}

// Round to 2 decimal places
function roundHours(h) {
  return Math.round(h * 100) / 100;
}

module.exports = { parseManagerReport, extractClientFromDescription, CLIENT_PREFIX_MAP };