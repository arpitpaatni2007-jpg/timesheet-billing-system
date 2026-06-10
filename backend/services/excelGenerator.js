// services/excelGenerator.js
// Generates the Client Wise Timesheet workbook.
// Each named client gets its own sheet; unlisted clients share "Other Clients".
//
// CHANGES:
//   1. numFmt fixed: "#,##0.##" — never shows trailing dot ("43" not "43.")
//   2. Formula cells include result: value so Excel shows correct values immediately
//      without requiring a manual recalculate (Ctrl+Alt+F9)
//   3. Reads config/client-sheet-settings.json to decide which clients get
//      individual sheets vs. merged into "Other Clients"

const ExcelJS = require("exceljs");
const path    = require("path");
const fs      = require("fs");

// ─── Number format used for all hour cells ───────────────────────────────────
// "#,##0.##" breakdown:
//   #,##0  = show at least one digit before decimal, comma separator optional
//   .##    = up to 2 decimal places, suppress trailing zeros AND trailing dot
// Result: 43→"43", 1.5→"1.5", 1.25→"1.25", 0→"0" — never "43." or "1.50"
const HOURS_FMT = "General";

// ─── Load client sheet config ────────────────────────────────────────────────
// Returns array of client names that should each get their own sheet.
// Clients NOT in this list are grouped onto "Other Clients" sheet.
// If the config file does not exist, returns [] meaning every client
// gets its own sheet (backwards-compatible default).
function loadClientSheetConfig() {
  const configPath = path.join(__dirname, "../config/client-sheet-settings.json");
  try {
    if (!fs.existsSync(configPath)) return [];           // no config → all separate
    const raw = fs.readFileSync(configPath, "utf8");
    const cfg = JSON.parse(raw);
    // cfg.separateSheets is the array e.g. ["Client-A", "Client-D"]
    return Array.isArray(cfg.separateSheets) ? cfg.separateSheets : [];
  } catch {
    return []; // corrupt file → safe fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// @param {Array}  groupedData  — output of groupByClient()
// @param {String} reportMonth  — e.g. "June 2026"
// @returns {String}            — absolute path to saved .xlsx
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

  // ── Read config to decide sheet grouping ──────────────────────────────────
  const separateSheets = loadClientSheetConfig();
  // separateSheets = [] means "give every client its own sheet" (default)
  const useGrouping    = separateSheets.length > 0;

  // ── Split clients into "named" (own sheet) and "others" (combined) ─────────
  let namedClients = [];
  let otherClients = [];

  if (!useGrouping) {
    // No config: every client gets its own sheet
    namedClients = groupedData;
    otherClients = [];
  } else {
    for (const client of groupedData) {
      if (separateSheets.includes(client.clientName)) {
        namedClients.push(client);
      } else {
        otherClients.push(client);
      }
    }
  }

  // ── Generate one sheet per named client ───────────────────────────────────
  for (const client of namedClients) {
    const sheetName = client.clientName.substring(0, 31);
    addClientSheet(workbook, sheetName, [client], reportMonth);
  }

  // ── Generate combined "Other Clients" sheet ───────────────────────────────
  if (otherClients.length > 0) {
    addClientSheet(workbook, "Other Clients", otherClients, reportMonth);
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Timesheet workbook saved: ${outputPath}`);
  return outputPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// addClientSheet
// Writes one worksheet tab.
// clientsOnSheet is an array — for named sheets it has one element,
// for "Other Clients" it has multiple.
// ─────────────────────────────────────────────────────────────────────────────
function addClientSheet(workbook, sheetName, clientsOnSheet, reportMonth) {

  const sheet = workbook.addWorksheet(sheetName);

  // ── Sheet-level title (row 1) ──────────────────────────────────────────────
  const displayName = clientsOnSheet.length === 1
    ? clientsOnSheet[0].clientName
    : "Other Clients";

  sheet.addRow([`Client Wise – Timesheet Report`]);
  sheet.mergeCells("A1:F1");
  styleTitle(sheet.getRow(1).getCell(1));

  sheet.addRow([`Client: ${displayName}`]);
  sheet.mergeCells("A2:F2");
  styleSubTitle(sheet.getRow(2).getCell(1));

  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });
  sheet.addRow([`Period: ${reportMonth}   |   Generated on: ${generatedOn}`]);
  sheet.mergeCells("A3:F3");
  styleSubTitle(sheet.getRow(3).getCell(1));

  sheet.addRow([]); // blank spacer row 4

  // ── Column headers (row 5) ────────────────────────────────────────────────
  const headerRow = sheet.addRow([
    "Project", "Module / Task List", "Task", "Employee", "Hours", "Notes"
  ]);
  styleHeaderRow(headerRow);
  sheet.views = [{ state: "frozen", ySplit: 5 }];

  // ── Column widths ─────────────────────────────────────────────────────────
  sheet.getColumn(1).width = 40;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 35;
  sheet.getColumn(4).width = 25;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 20;

  // ── Data rows ─────────────────────────────────────────────────────────────
  // allDataRowNumbers collects row numbers of EVERY employee data row
  // across ALL clients on this sheet, so the per-client grand totals
  // can reference them with SUM formulas.
  const allSheetDataRows = []; // for a potential grand-total-of-sheet if needed

  for (const client of clientsOnSheet) {

    const clientDataRowNumbers = []; // all data rows for THIS client on this sheet

    for (const project of client.projects) {

      const projectDataRowNumbers = [];

      for (const mod of project.modules) {
        for (const task of mod.tasks) {
          for (const emp of task.employees) {

            const dataRow = sheet.addRow([
              project.projectName,
              mod.moduleName,
              task.taskName,
              emp.employeeName,
              emp.totalHours,   // raw numeric value — ExcelJS writes it directly
              ""
            ]);

            styleDataRow(dataRow);

            projectDataRowNumbers.push(dataRow.number);
            clientDataRowNumbers.push(dataRow.number);
            allSheetDataRows.push(dataRow.number);
          }
        }
      }

      // ── Project subtotal row ───────────────────────────────────────────────
      if (projectDataRowNumbers.length > 0) {
        const pFirst = projectDataRowNumbers[0];
        const pLast  = projectDataRowNumbers[projectDataRowNumbers.length - 1];

        // Compute the actual subtotal so ExcelJS can write it as the formula
        // cached result. This prevents Excel showing "0" before recalculating.
        const projectSubtotal = projectDataRowNumbers.reduce((sum, rowNum) => {
          const cell = sheet.getRow(rowNum).getCell(5);
          return sum + (typeof cell.value === "number" ? cell.value : 0);
        }, 0);

        const projectTotalRow = sheet.addRow([
          `Total – ${project.projectName}`,
          "", "", "",
          {
            formula : `SUM(E${pFirst}:E${pLast})`,
            result  : roundHours(projectSubtotal),  // ← cached result fixes "0." display
          },
          ""
        ]);
        styleProjectTotalRow(projectTotalRow);
        sheet.mergeCells(`A${projectTotalRow.number}:D${projectTotalRow.number}`);

        sheet.addRow([]); // blank spacer after each project
      }
    }

    // ── Client grand total row ─────────────────────────────────────────────
    if (clientDataRowNumbers.length > 0) {
      const cFirst = clientDataRowNumbers[0];
      const cLast  = clientDataRowNumbers[clientDataRowNumbers.length - 1];

      const clientSubtotal = clientDataRowNumbers.reduce((sum, rowNum) => {
        const cell = sheet.getRow(rowNum).getCell(5);
        return sum + (typeof cell.value === "number" ? cell.value : 0);
      }, 0);

      const clientTotalRow = sheet.addRow([
        `TOTAL BILLABLE HOURS – ${client.clientName.toUpperCase()}`,
        "", "", "",
        {
          formula : `SUM(E${cFirst}:E${cLast})`,
          result  : roundHours(clientSubtotal),   // ← cached result
        },
        ""
      ]);
      styleClientTotalRow(clientTotalRow);
      sheet.mergeCells(`A${clientTotalRow.number}:D${clientTotalRow.number}`);

      // Extra blank spacer between clients on a combined sheet
      if (clientsOnSheet.length > 1) sheet.addRow([]);
    }
  }
}

// ── Style helpers ─────────────────────────────────────────────────────────────

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
    if (colNumber === 5) {
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
    if (colNumber === 5) {
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
    if (colNumber === 5) {
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

function roundHours(h) {
  return Math.round((h || 0) * 100) / 100;
}

module.exports = { generateTimesheetExcel };