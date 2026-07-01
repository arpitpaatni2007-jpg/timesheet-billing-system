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
//
// STRUCTURE PER PROJECT (matches manager sample workbook):
//
//   [data rows — outline level 3]         ← deepest, collapse to hide raw rows
//     [Task List subtotal — level 2]      ← SUBTOTAL(9, taskFirst:taskLast)
//   [Project subtotal — level 1]          ← SUBTOTAL(9, projFirst:projLast)
//   [blank spacer]
//   [Client grand total]                  ← SUBTOTAL(9, allDataFirst:allDataLast)
//
// WHY SUBTOTAL(9,...) INSTEAD OF SUM():
//   SUM() counts every row in its range, including rows hidden by outline
//   collapse. SUBTOTAL(9,...) skips hidden rows, so grand totals stay correct
//   after the user expands/collapses any group.
//
// SORT ORDER: Project Name → Task List → Task → User
//   The grouper already produces this hierarchy. We respect it here.
//
// OUTLINE LEVELS (Excel outline buttons appear on the left):
//   Level 3 = individual data rows (most granular)
//   Level 2 = Task List subtotal rows
//   Level 1 = Project subtotal rows
//   Level 0 = client grand total (always visible)
// ─────────────────────────────────────────────────────────────────────────────
function addClientSheet(workbook, sheetName, clientsOnSheet, reportMonth) {

  const sheet = workbook.addWorksheet(sheetName);

  // Excel outline summary rows appear BELOW the detail they summarise.
  // This property tells Excel that subtotals are below their group of rows,
  // which is the standard bottom-summary convention used in the sample workbook.
  sheet.properties.outlineProperties = {
    summaryBelow : true,   // subtotal row is below the data it summarises
    summaryRight : false,
  };

  const displayName = clientsOnSheet.length === 1
    ? clientsOnSheet[0].clientName
    : "Other Clients";

  // ── Title rows (1–4) ─────────────────────────────────────────────────────
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

  // ── Column headers (row 5) ───────────────────────────────────────────────
  const headerRow = sheet.addRow([
    "Project Name",           // A  col 1
    "Project ID",             // B  col 2
    "Task List / Module",     // C  col 3
    "Task / General / Bug",   // D  col 4
    "Task / Bug ID",          // E  col 5
    "User",                   // F  col 6
    "Date",                   // G  col 7
    "Hours (For Calculation)", // H  col 8  ← HOURS column
    "Billing Type",           // I  col 9
    "Notes",                  // J  col 10
    "Created Time",           // K  col 11
    "Type",                   // L  col 12
    "Project Group",          // M  col 13
    "Milestone",              // N  col 14
  ]);
  styleHeaderRow(headerRow);
  sheet.views = [{ state: "frozen", ySplit: 5 }];

  // ── Column widths ────────────────────────────────────────────────────────
  sheet.getColumn(1).width  = 38;
  sheet.getColumn(2).width  = 14;
  sheet.getColumn(3).width  = 28;
  sheet.getColumn(4).width  = 34;
  sheet.getColumn(5).width  = 14;
  sheet.getColumn(6).width  = 22;
  sheet.getColumn(7).width  = 14;
  sheet.getColumn(8).width  = 18;
  sheet.getColumn(9).width  = 14;
  sheet.getColumn(10).width = 24;
  sheet.getColumn(11).width = 18;
  sheet.getColumn(12).width = 10;
  sheet.getColumn(13).width = 16;
  sheet.getColumn(14).width = 16;

  // ── Data + subtotal rows ─────────────────────────────────────────────────
  for (const client of clientsOnSheet) {

    // Track every raw data row across all projects for the client grand total.
    // We only reference the very first and very last data row numbers here;
    // SUBTOTAL(9,...) over that range correctly skips any subtotal rows
    // that fall inside it (nested SUBTOTALs are ignored by Excel).
    let clientFirstDataRow = null;
    let clientLastDataRow  = null;
    let clientHoursAcc     = 0; // accumulator for the cached result value only

    for (const project of client.projects) {

      // Sorted order: Project → Task List (mod) → Task → User
      // The grouper already maintains this hierarchy, so we iterate in order.
      let projectFirstDataRow = null;
      let projectLastDataRow  = null;
      let projectHoursAcc     = 0;

      for (const mod of project.modules) {

        // ── Task List level: collect all data rows in this module ──────────
        let modFirstDataRow = null;
        let modLastDataRow  = null;
        let modHoursAcc     = 0;

        for (const task of mod.tasks) {
          for (const emp of task.employees) {

            // Expand entries — fallback for old data that only stored {date, hours}
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
                project.projectName,          // A
                entry.projectId    || "",     // B
                mod.moduleName,               // C
                task.taskName,                // D
                entry.taskId       || "",     // E
                emp.employeeName,             // F
                entry.date         || "",     // G
                entry.hours,                  // H
                entry.billingType  || "",     // I
                entry.notes        || "",     // J
                entry.createdTime  || "",     // K
                entry.taskType     || "",     // L
                entry.projectGroup || "",     // M
                entry.milestone    || "",     // N
              ]);

              styleDataRow(dataRow);

              // Outline level 3 = deepest detail rows (can be collapsed)
              dataRow.outlineLevel = 3;

              const rn = dataRow.number;
              const h  = typeof entry.hours === "number" ? entry.hours : 0;

              // Track ranges and accumulate hours at all three levels
              if (modFirstDataRow === null)     modFirstDataRow     = rn;
              if (projectFirstDataRow === null) projectFirstDataRow = rn;
              if (clientFirstDataRow === null)  clientFirstDataRow  = rn;

              modLastDataRow     = rn;
              projectLastDataRow = rn;
              clientLastDataRow  = rn;

              modHoursAcc     += h;
              projectHoursAcc += h;
              clientHoursAcc  += h;
            }
          }
        }

        // ── Task List subtotal row ────────────────────────────────────────
        // Uses SUBTOTAL(9,...) so it is excluded when a higher-level group
        // collapses and hides this row — prevents double-counting.
        if (modFirstDataRow !== null) {
          const modValues = new Array(14).fill("");
          modValues[0] = `Total – ${mod.moduleName}`;   // col A label

          // SUBTOTAL(9, H_first:H_last) — function 9 = SUM, ignores hidden rows
          modValues[HOURS_COL - 1] = {
            formula : `SUBTOTAL(9,${HOURS_COL_LET}${modFirstDataRow}:${HOURS_COL_LET}${modLastDataRow})`,
            result  : roundHours(modHoursAcc),
          };

          const modTotalRow = sheet.addRow(modValues);
          styleModuleTotalRow(modTotalRow);

          sheet.mergeCells(
            `A${modTotalRow.number}:${colLetter(MERGE_LABEL_END)}${modTotalRow.number}`
          );

          // Outline level 2 — visible when project group is expanded
          modTotalRow.outlineLevel = 2;
        }
      }

      // ── Project subtotal row ─────────────────────────────────────────────
      // Spans all data rows (and module subtotal rows) in this project.
      // SUBTOTAL(9,...) naturally skips the nested module SUBTOTAL rows.
      if (projectFirstDataRow !== null) {
        const projValues = new Array(14).fill("");
        projValues[0] = `Total – ${project.projectName}`;

        projValues[HOURS_COL - 1] = {
          formula : `SUBTOTAL(9,${HOURS_COL_LET}${projectFirstDataRow}:${HOURS_COL_LET}${projectLastDataRow})`,
          result  : roundHours(projectHoursAcc),
        };

        const projectTotalRow = sheet.addRow(projValues);
        styleProjectTotalRow(projectTotalRow);

        sheet.mergeCells(
          `A${projectTotalRow.number}:${colLetter(MERGE_LABEL_END)}${projectTotalRow.number}`
        );

        // Outline level 1 — collapses to hide all detail + module subtotals
        projectTotalRow.outlineLevel = 1;

        sheet.addRow([]); // blank spacer between projects
      }
    }

    // ── Client grand total row ───────────────────────────────────────────────
    // Spans from the very first to the very last data row of this client.
    // SUBTOTAL(9,...) skips all nested SUBTOTAL rows inside that range,
    // so it only sums the raw data rows — giving the correct total regardless
    // of which outline groups are expanded or collapsed.
    if (clientFirstDataRow !== null) {
      const clientValues = new Array(14).fill("");
      clientValues[0] = `TOTAL BILLABLE HOURS – ${client.clientName.toUpperCase()}`;

      clientValues[HOURS_COL - 1] = {
        formula : `SUBTOTAL(9,${HOURS_COL_LET}${clientFirstDataRow}:${HOURS_COL_LET}${clientLastDataRow})`,
        result  : roundHours(clientHoursAcc),
      };

      const clientTotalRow = sheet.addRow(clientValues);
      styleClientTotalRow(clientTotalRow);

      sheet.mergeCells(
        `A${clientTotalRow.number}:${colLetter(MERGE_LABEL_END)}${clientTotalRow.number}`
      );

      // Grand total row is level 0 — always visible, never collapsed
      // (no outlineLevel assignment needed; default is 0)

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

// Task List (module) subtotal — lighter shade than project total, darker than data rows
// Sits between data rows (level 3) and project total (level 1) visually
function styleModuleTotalRow(row) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FF1F3864" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9EFF7" } };
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