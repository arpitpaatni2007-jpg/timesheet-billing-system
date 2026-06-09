// services/billingSummaryExcelGenerator.js
//
// PHASE 7 — Monthly Billing Summary Excel Generator
//
// CHANGES IN THIS VERSION:
//   1. Manager appears as a regular employee column (no separate hardcoded col C/D)
//   2. Manager column gets gray fill (FFF2F2F2) via isManager flag from builder
//   3. All totals use =SUM() formulas instead of hardcoded numbers
//   4. numFmt fixed: integers show "43" not "43.", decimals show "1.5" not "1.50"
//
// COLUMN LAYOUT (now fully dynamic):
//   A  = Rate label
//   B  = Project name
//   C+ = All employees including manager (sorted: employees first, manager last)
//   ?  = Total  (=SUM formula across employee cols)
//   ?  = Work Summary

const ExcelJS = require("exceljs");
const path    = require("path");
const fs      = require("fs");

// ─── Color constants (exact hex values from company sample) ─────────────────
const COLOR = {
  DATE_HEADER_A    : "FFB7E1CD",  // mint green  — date cell A
  DATE_HEADER_REST : "FFC6EFCE",  // light green — rest of date header row
  PROJECT_GREEN    : "FFC4D79B",  // yellow-green — standard project row
  PROJECT_BLUE     : "FFA4C2F4",  // light blue  — ClientX - SubProject rate row
  EMPLOYEE_CELL    : "FFC4D79B",  // yellow-green — employee hour cells
  MANAGER_CELL     : "FFF2F2F2",  // light gray  — manager hour cell
};

// ─── Apply solid fill to a cell ──────────────────────────────────────────────
function setFill(cell, argb) {
  if (!argb) return;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

// ─── Round to 2 decimal places ───────────────────────────────────────────────
function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

// ─── Number format: shows "43" not "43.", "1.5" not "1.50" ──────────────────
// Excel spec: # = show digit only if non-zero, suppress trailing zeros AND dot
const NUM_FMT = "0.##";

// ─── Detect if a project is a rate-billed (blue) project ─────────────────────
// Rule: project name starts with "ClientName - " or "ClientName- "
function isClientRateProject(projectName, clientName) {
  const proj    = (projectName || "").trim();
  const prefix1 = (clientName  || "").trim() + " - ";
  const prefix2 = (clientName  || "").trim() + "- ";
  return proj.startsWith(prefix1) || proj.startsWith(prefix2);
}

// ─── Convert "May 2026" → first day of that month as a JS Date ───────────────
function parseReportMonthToDate(reportMonth) {
  if (!reportMonth) return new Date();
  const d = new Date(`${reportMonth} 1`);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ─── Collect all unique people (employees + manager) across ALL clients ───────
// The manager appears in employeeBreakdown with isManager:true (from builder).
// We sort so: regular employees alphabetically first, manager last.
// This keeps the manager column visually separate on the right.
function collectAllPeople(billingSummary) {
  const employees = new Set();
  const managers  = new Set();

  for (const client of (billingSummary.clients || [])) {
    for (const project of (client.projects || [])) {
      for (const emp of (project.employeeBreakdown || [])) {
        if (!emp.employeeName || emp.employeeName === "Unknown Employee") continue;
        if (emp.isManager) {
          managers.add(emp.employeeName);
        } else {
          employees.add(emp.employeeName);
        }
      }
    }
  }

  // Regular employees alphabetically, then manager(s) at the end
  return [
    ...Array.from(employees).sort(),
    ...Array.from(managers).sort(),
  ];
}

// ─── Excel column letter from 1-based index (1=A, 27=AA, etc.) ───────────────
function colLetter(n) {
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result    = String.fromCharCode(65 + rem) + result;
    n         = Math.floor((n - 1) / 26);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
async function generateBillingSummaryExcel(billingSummary, reportMonth) {

  const { managerName = "Manager", clients = [] } = billingSummary;

  // Output folder
  const outputDir = path.join(__dirname, "../generated-reports");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const fileName   = `Monthly Billing Summary ${reportMonth}.xlsx`;
  const outputPath = path.join(outputDir, fileName);

  const workbook = new ExcelJS.Workbook();
  workbook.creator  = "Timesheet Automation System";
  workbook.created  = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Billing Summary");

  // ── Discover all people (employees + manager) ──────────────────────────────
  // allPeople = ["Employee A", "Employee B", "Employee C", "Nishant Rajvanshi"]
  const allPeople = collectAllPeople(billingSummary);

  // Build a Set of manager names for quick gray-fill lookup
  const managerNames = new Set();
  for (const client of clients) {
    for (const project of (client.projects || [])) {
      for (const emp of (project.employeeBreakdown || [])) {
        if (emp.isManager) managerNames.add(emp.employeeName);
      }
    }
  }

  // ── Column index map (1-based) ─────────────────────────────────────────────
  // A=1, B=2, people start at C=3
  const COL_A            = 1;   // Rate label
  const COL_B            = 2;   // Project name
  const COL_PEOPLE_START = 3;   // First person column (C)
  const COL_PEOPLE_END   = COL_PEOPLE_START + allPeople.length - 1;
  const COL_TOTAL        = COL_PEOPLE_END + 1;
  const COL_WORK_SUMMARY = COL_PEOPLE_END + 2;

  // ── Column widths ──────────────────────────────────────────────────────────
  sheet.getColumn(COL_A).width           = 15.85;
  sheet.getColumn(COL_B).width           = 38;
  for (let i = COL_PEOPLE_START; i <= COL_PEOPLE_END; i++) {
    sheet.getColumn(i).width = 16;
  }
  sheet.getColumn(COL_TOTAL).width        = 10;
  sheet.getColumn(COL_WORK_SUMMARY).width = 50;

  let currentRow = 1;

  // ════════════════════════════════════════════════════════════════════════════
  // ROW 1 — Date header
  // ════════════════════════════════════════════════════════════════════════════
  {
    const r     = sheet.getRow(currentRow);
    r.height    = 15.75;

    const cellA = r.getCell(COL_A);
    cellA.value     = parseReportMonthToDate(reportMonth);
    cellA.numFmt    = "mmmm yyyy";
    cellA.alignment = { horizontal: "right" };
    cellA.font      = { name: "Arial", size: 10 };
    setFill(cellA, COLOR.DATE_HEADER_A);

    // B through Total: light green
    for (let c = COL_B; c <= COL_TOTAL; c++) {
      const cell = r.getCell(c);
      setFill(cell, COLOR.DATE_HEADER_REST);
      cell.font = { name: "Arial", size: 10 };
    }

    currentRow++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ROW 2 — Column headers
  // ════════════════════════════════════════════════════════════════════════════
  const headerRowNumber = currentRow;
  {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    // Person columns: C onward
    for (let i = 0; i < allPeople.length; i++) {
      const cell  = r.getCell(COL_PEOPLE_START + i);
      cell.value  = allPeople[i];
      cell.font   = { name: "Arial", size: 10 };
    }

    // Total header — bold (matches sample)
    const cellTotal = r.getCell(COL_TOTAL);
    cellTotal.value = "Total";
    cellTotal.font  = { name: "Arial", size: 10, bold: true };

    // Work Summary header
    r.getCell(COL_WORK_SUMMARY).value = "Work Summary";
    r.getCell(COL_WORK_SUMMARY).font  = { name: "Arial", size: 10 };

    currentRow++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DATA ROWS — track first data row for column SUM formula range
  // ════════════════════════════════════════════════════════════════════════════
  const firstDataRow = currentRow; // needed for column-total SUM range

  for (const client of clients) {
    const clientName = client.clientName || "";

    for (const project of (client.projects || [])) {
      const projName  = project.projectName || "";
      const isBlue    = isClientRateProject(projName, clientName);
      const projColor = isBlue ? COLOR.PROJECT_BLUE : COLOR.PROJECT_GREEN;

      // Quick lookup: personName → hours for this project row
      const hoursMap = {};
      for (const emp of (project.employeeBreakdown || [])) {
        hoursMap[emp.employeeName] = round2(emp.hours);
      }

      const r  = sheet.getRow(currentRow);
      r.height = 15.75;

      // Col A: rate label (only for blue projects)
      if (isBlue) {
        const cellA = r.getCell(COL_A);
        cellA.value = `${clientName} rate`;
        cellA.font  = { name: "Arial", size: 10 };
      }

      // Col B: project name
      const cellB = r.getCell(COL_B);
      cellB.value = projName;
      cellB.font  = { name: "Arial", size: 10 };
      setFill(cellB, projColor);

      // Person columns
      for (let i = 0; i < allPeople.length; i++) {
        const personName = allPeople[i];
        const hrs        = hoursMap[personName] || 0;
        const colIdx     = COL_PEOPLE_START + i;
        const cell       = r.getCell(colIdx);

        // Manager gets gray fill; employees get yellow-green
        const isThisMgr = managerNames.has(personName);
        setFill(cell, isThisMgr ? COLOR.MANAGER_CELL : COLOR.EMPLOYEE_CELL);

        if (hrs > 0) {
          cell.value     = hrs;
          cell.numFmt    = NUM_FMT;
          cell.font      = { name: "Arial", size: 10 };
          cell.alignment = { horizontal: "right" };
        }
      }

      // Total column — =SUM(C{row}:{lastPeopleCol}{row})
      // This formula recalculates automatically if any cell is manually edited
      const firstPersonCell = colLetter(COL_PEOPLE_START) + currentRow;
      const lastPersonCell  = colLetter(COL_PEOPLE_END)   + currentRow;
      const cellTotal       = r.getCell(COL_TOTAL);
      cellTotal.value       = { formula: `SUM(${firstPersonCell}:${lastPersonCell})` };
      cellTotal.font        = { name: "Arial", size: 10, bold: true };
      cellTotal.numFmt      = NUM_FMT;
      cellTotal.alignment   = { horizontal: "right" };

      // Work Summary
      const summaryText = (project.workSummary || []).join(", ");
      if (summaryText) {
        const cellWS     = r.getCell(COL_WORK_SUMMARY);
        cellWS.value     = summaryText;
        cellWS.font      = { name: "Arial", size: 10 };
        cellWS.alignment = { wrapText: true };
        if (summaryText.length > 80) r.height = 63.75;
      }

      currentRow++;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GRAND TOTALS ROW
  // All numeric columns use =SUM(C{firstData}:C{lastData}) formulas
  // ════════════════════════════════════════════════════════════════════════════
  const lastDataRow = currentRow - 1;
  {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    // Person column totals
    for (let i = 0; i < allPeople.length; i++) {
      const colIdx   = COL_PEOPLE_START + i;
      const colLet   = colLetter(colIdx);
      const cell     = r.getCell(colIdx);
      cell.value     = { formula: `SUM(${colLet}${firstDataRow}:${colLet}${lastDataRow})` };
      cell.font      = { name: "Arial", size: 10, bold: true };
      cell.numFmt    = NUM_FMT;
      cell.alignment = { horizontal: "right" };
    }

    // Grand Total column — sum of the Total column
    const totalColLet   = colLetter(COL_TOTAL);
    const cellGrandTotal = r.getCell(COL_TOTAL);
    cellGrandTotal.value     = { formula: `SUM(${totalColLet}${firstDataRow}:${totalColLet}${lastDataRow})` };
    cellGrandTotal.font      = { name: "Arial", size: 10, bold: true };
    cellGrandTotal.numFmt    = NUM_FMT;
    cellGrandTotal.alignment = { horizontal: "right" };

    currentRow++;
  }

  // Two blank spacer rows
  currentRow += 2;

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Billing Summary saved: ${outputPath}`);

  return outputPath;
}

module.exports = { generateBillingSummaryExcel };