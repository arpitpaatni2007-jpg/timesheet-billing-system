// services/excelGenerator.js
// Generates the Client Wise Timesheet workbook.
// Each named client gets its own sheet; unlisted clients share "Other Clients".
//
// COLUMN LAYOUT (14 columns, matches company sample):
//   A  Project Name
//   B  Project ID          ← now populated from entry.projectId
//   C  Task List / Module
//   D  Task / General / Bug
//   E  Task / Bug ID       ← now populated from entry.taskId
//   F  User
//   G  Date
//   H  Hours (For Calculation)   ← HOURS column, formulas reference H not E
//   I  Billing Type        ← now populated from entry.billingType
//   J  Notes               ← now populated from entry.notes
//   K  Created Time        ← now populated from entry.createdTime
//   L  Type                ← now populated from entry.taskType
//   M  Project Group       ← now populated from entry.projectGroup
//   N  Milestone           ← now populated from entry.milestone
//
// DATA EXPANSION:
//   The grouper stores individual CSV rows in emp.entries[] as objects
//   containing date, hours, and all metadata fields needed for each column.
//   This file expands those entries so each raw CSV row becomes one Excel row,
//   preserving date-level granularity. Project/Module/Task/User repeat per row.

const ExcelJS = require("exceljs");
const path    = require("path");
const fs      = require("fs");

// ─── Hours column index (1-based) ───────────────────────────────────────────
// All SUM formulas and styleDataRow reference this.
const HOURS_COL     = 8;  // column H
const HOURS_COL_LET = "H";

// Total label merges columns A through G (leaving H for the sum value)
const MERGE_LABEL_END = 7; // column G

// Number format: "General" — Excel renders 74 as "74", 1.5 as "1.5"
// No custom format = no trailing dot issue in any Excel version
const HOURS_FMT = "General";

// ─── Load client sheet config ────────────────────────────────────────────────
function loadClientSheetConfig() {
  const configPath = path.join(__dirname, "../config/client-sheet-settings.json");
  try {
    if (!fs.existsSync(configPath)) return [];
    const raw = fs.readFileSync(configPath, "utf8");
    const cfg = JSON.parse(raw);
    return Array.isArray(cfg.separateSheets) ? cfg.separateSheets : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
async function generateTimesheetExcel(groupedData, reportMonth) {

  const workbook = new ExcelJS.Workbook();
  workbook.creator  = "Timesheet Automation System";
  workbook.created  = new Date();
  workbook.modified = new Date();

  const outputDir = path.join(__dirname, "../generated-reports");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const fileName   = `Client Wise - Timesheet ${reportMonth}.xlsx`;
  const outputPath = path.join(outputDir, fileName);

  // ── Sheet grouping from config ────────────────────────────────────────────
  const separateSheets = loadClientSheetConfig();
  const useGrouping    = separateSheets.length > 0;

  let namedClients = [];
  let otherClients = [];

  if (!useGrouping) {
    namedClients = groupedData;
  } else {
    for (const client of groupedData) {
      if (separateSheets.includes(client.clientName)) {
        namedClients.push(client);
      } else {
        otherClients.push(client);
      }
    }
  }

  for (const client of namedClients) {
    addClientSheet(workbook, client.clientName.substring(0, 31), [client], reportMonth);
  }

  if (otherClients.length > 0) {
    addClientSheet(workbook, "Other Clients", otherClients, reportMonth);
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Timesheet workbook saved: ${outputPath}`);
  return outputPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// addClientSheet
// ─────────────────────────────────────────────────────────────────────────────
function addClientSheet(workbook, sheetName, clientsOnSheet, reportMonth) {

  const sheet = workbook.addWorksheet(sheetName);

  const displayName = clientsOnSheet.length === 1
    ? clientsOnSheet[0].clientName
    : "Other Clients";

  // ── Title rows (1–4) ───────────────────────────────────────────────────────
  // Merge across all 14 columns (A:N)
  sheet.addRow([`Client Wise – Timesheet Report`]);
  sheet.mergeCells("A1:N1");
  styleTitle(sheet.getRow(1).getCell(1));

  sheet.addRow([`Client: ${displayName}`]);
  sheet.mergeCells("A2:N2");
  styleSubTitle(sheet.getRow(2).getCell(1));

  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });
  sheet.addRow([`Period: ${reportMonth}   |   Generated on: ${generatedOn}`]);
  sheet.mergeCells("A3:N3");
  styleSubTitle(sheet.getRow(3).getCell(1));

  sheet.addRow([]); // blank spacer row 4

  // ── Column headers (row 5) ────────────────────────────────────────────────
  const headerRow = sheet.addRow([
    "Project Name",          // A  col 1
    "Project ID",            // B  col 2  — blank in data rows
    "Task List / Module",    // C  col 3
    "Task / General / Bug",  // D  col 4
    "Task / Bug ID",         // E  col 5  — blank in data rows
    "User",                  // F  col 6
    "Date",                  // G  col 7
    "Hours (For Calculation)",// H  col 8  ← hours column
    "Billing Type",          // I  col 9  — blank in data rows
    "Notes",                 // J  col 10 — blank in data rows
    "Created Time",          // K  col 11 — blank in data rows
    "Type",                  // L  col 12 — blank in data rows
    "Project Group",         // M  col 13 — blank in data rows
    "Milestone",             // N  col 14 — blank in data rows
  ]);
  styleHeaderRow(headerRow);
  sheet.views = [{ state: "frozen", ySplit: 5 }];

  // ── Column widths ─────────────────────────────────────────────────────────
  sheet.getColumn(1).width  = 38;   // A  Project Name
  sheet.getColumn(2).width  = 14;   // B  Project ID
  sheet.getColumn(3).width  = 28;   // C  Task List / Module
  sheet.getColumn(4).width  = 34;   // D  Task / General / Bug
  sheet.getColumn(5).width  = 14;   // E  Task / Bug ID
  sheet.getColumn(6).width  = 22;   // F  User
  sheet.getColumn(7).width  = 14;   // G  Date
  sheet.getColumn(8).width  = 18;   // H  Hours (For Calculation)
  sheet.getColumn(9).width  = 14;   // I  Billing Type
  sheet.getColumn(10).width = 24;   // J  Notes
  sheet.getColumn(11).width = 18;   // K  Created Time
  sheet.getColumn(12).width = 10;   // L  Type
  sheet.getColumn(13).width = 16;   // M  Project Group
  sheet.getColumn(14).width = 16;   // N  Milestone

  // ── Data rows ─────────────────────────────────────────────────────────────
  // Each entry in emp.entries[] becomes ONE row.
  // Project Name, Module, Task, User repeat for every entry of that employee.

  for (const client of clientsOnSheet) {

    const clientDataRowNumbers = [];

    for (const project of client.projects) {

      const projectDataRowNumbers = [];

      for (const mod of project.modules) {
        for (const task of mod.tasks) {
          for (const emp of task.employees) {

            // Expand each raw entry into its own row.
            // The fallback handles old grouped data where entries[] may only
            // have { date, hours } — all extra fields default to empty string.
            const entries = (emp.entries && emp.entries.length > 0)
              ? emp.entries
              : [{
                  date        : "",
                  hours       : emp.totalHours,
                  projectId   : "",
                  taskId      : "",
                  billingType : "",
                  notes       : "",
                  createdTime : "",
                  taskType    : "",
                  projectGroup: "",
                  milestone   : "",
                }];

            for (const entry of entries) {
              const dataRow = sheet.addRow([
                project.projectName,          // A  Project Name
                entry.projectId    || "",     // B  Project ID
                mod.moduleName,               // C  Task List / Module
                task.taskName,                // D  Task / General / Bug
                entry.taskId       || "",     // E  Task / Bug ID
                emp.employeeName,             // F  User
                entry.date         || "",     // G  Date
                entry.hours,                  // H  Hours (For Calculation)
                entry.billingType  || "",     // I  Billing Type
                entry.notes        || "",     // J  Notes
                entry.createdTime  || "",     // K  Created Time
                entry.taskType     || "",     // L  Type
                entry.projectGroup || "",     // M  Project Group
                entry.milestone    || "",     // N  Milestone
              ]);

              styleDataRow(dataRow);

              projectDataRowNumbers.push(dataRow.number);
              clientDataRowNumbers.push(dataRow.number);
            }
          }
        }
      }

      // ── Project subtotal row ───────────────────────────────────────────────
      if (projectDataRowNumbers.length > 0) {
        const pFirst = projectDataRowNumbers[0];
        const pLast  = projectDataRowNumbers[projectDataRowNumbers.length - 1];

        const projectSubtotal = projectDataRowNumbers.reduce((sum, rowNum) => {
          const cell = sheet.getRow(rowNum).getCell(HOURS_COL);
          return sum + (typeof cell.value === "number" ? cell.value : 0);
        }, 0);

        // Build a 14-column row; label in col A, formula in col H, rest blank
        const totalRowValues = new Array(14).fill("");
        totalRowValues[0] = `Total – ${project.projectName}`;  // col A (index 0)
        totalRowValues[HOURS_COL - 1] = {                       // col H (index 7)
          formula : `SUM(${HOURS_COL_LET}${pFirst}:${HOURS_COL_LET}${pLast})`,
          result  : roundHours(projectSubtotal),
        };

        const projectTotalRow = sheet.addRow(totalRowValues);
        styleProjectTotalRow(projectTotalRow);

        // Merge A through G for the label text
        sheet.mergeCells(
          `A${projectTotalRow.number}:${colLetter(MERGE_LABEL_END)}${projectTotalRow.number}`
        );

        sheet.addRow([]); // blank spacer after each project
      }
    }

    // ── Client grand total row ─────────────────────────────────────────────
    if (clientDataRowNumbers.length > 0) {
      const cFirst = clientDataRowNumbers[0];
      const cLast  = clientDataRowNumbers[clientDataRowNumbers.length - 1];

      const clientSubtotal = clientDataRowNumbers.reduce((sum, rowNum) => {
        const cell = sheet.getRow(rowNum).getCell(HOURS_COL);
        return sum + (typeof cell.value === "number" ? cell.value : 0);
      }, 0);

      const totalRowValues = new Array(14).fill("");
      totalRowValues[0] = `TOTAL BILLABLE HOURS – ${client.clientName.toUpperCase()}`;
      totalRowValues[HOURS_COL - 1] = {
        formula : `SUM(${HOURS_COL_LET}${cFirst}:${HOURS_COL_LET}${cLast})`,
        result  : roundHours(clientSubtotal),
      };

      const clientTotalRow = sheet.addRow(totalRowValues);
      styleClientTotalRow(clientTotalRow);

      sheet.mergeCells(
        `A${clientTotalRow.number}:${colLetter(MERGE_LABEL_END)}${clientTotalRow.number}`
      );

      if (clientsOnSheet.length > 1) sheet.addRow([]);
    }
  }
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function styleTitle(cell) {
  cell.font      = { name: "Arial", bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function styleSubTitle(cell) {
  cell.font      = { name: "Arial", bold: false, size: 11, color: { argb: "FF1F3864" } };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border    = allBorders();
  });
  row.height = 20;
}

function styleDataRow(row) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font      = { name: "Arial", size: 10 };
    cell.border    = allBorders();
    cell.alignment = { vertical: "middle" };
    if (colNumber === HOURS_COL) {
      cell.numFmt    = HOURS_FMT;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  row.height = 18;
}

function styleProjectTotalRow(row) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FF1F3864" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDAE3F3" } };
    cell.border    = allBorders();
    cell.alignment = { vertical: "middle" };
    if (colNumber === HOURS_COL) {
      cell.numFmt    = HOURS_FMT;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  row.height = 18;
}

function styleClientTotalRow(row) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font      = { name: "Arial", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cell.border    = allBorders();
    cell.alignment = { vertical: "middle" };
    if (colNumber === HOURS_COL) {
      cell.numFmt    = HOURS_FMT;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  row.height = 22;
}

function allBorders() {
  const thin = { style: "thin", color: { argb: "FFB8CCE4" } };
  return { top: thin, left: thin, bottom: thin, right: thin };
}

// Convert 1-based column number to letter (1→A, 7→G, 14→N)
function colLetter(n) {
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result    = String.fromCharCode(65 + rem) + result;
    n         = Math.floor((n - 1) / 26);
  }
  return result;
}

function roundHours(h) {
  return Math.round((h || 0) * 100) / 100;
}

// ─── roundTo15Min ─────────────────────────────────────────────────────────────
// Rounds decimal hours to the nearest 15-minute increment (0.25 hr).
//
// Used ONLY for displayed totals in the Monthly Billing Summary sheet.
// Do NOT use this on raw internal hours — it would corrupt billing calculations.
//
// Examples (per manager feedback):
//   2h 39m → 2.650 → round(2.650 / 0.25) × 0.25 = round(10.6) × 0.25
//           = 11 × 0.25 = 2.75  ✅
//   2h 35m → 2.583 → round(2.583 / 0.25) × 0.25 = round(10.33) × 0.25
//           = 10 × 0.25 = 2.50  ✅
//   3h 00m → 3.000 → round(12) × 0.25 = 3.00  (exact values unchanged) ✅
//
// Exported so billingSummaryExcelGenerator.js can import it without
// duplicating this logic.
function roundTo15Min(h) {
  return Math.round((h || 0) / 0.25) * 0.25;
}

module.exports = { generateTimesheetExcel, roundTo15Min };