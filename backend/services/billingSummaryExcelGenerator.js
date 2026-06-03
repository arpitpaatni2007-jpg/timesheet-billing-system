// services/billingSummaryExcelGenerator.js
//
// PHASE 7 — Monthly Billing Summary Excel Generator
//
// WHAT THIS FILE DOES:
//   Takes the output of buildBillingSummary() and writes an Excel workbook
//   that exactly matches the company sample (Client_D_-_Monthly_Billing_Summary.xlsx).
//
// LAYOUT (reverse-engineered from sample, pixel-perfect):
//
//   Each "period block" occupies these rows in sequence:
//     Row +0 : Date header  — A=date(mint green), B-I=FFC6EFCE
//     Row +1 : Column headers — C=Manager Dev, D=Manager X, E..N=employees, N+1=Total, N+2=Work Summary
//     Row +2..+N : One data row per project
//     Row +N+1 : Grand totals row (bold, no fill, cols C onward)
//     Row +N+2 : Blank spacer
//     Row +N+3 : Blank spacer
//
//   COLUMNS (fixed positions):
//     A  = Rate label  ('Client-D rate' or blank)
//     B  = Project name
//     C  = Manager X Dev @35  (dev-level manager hours — 0 in sample, kept for compatibility)
//     D  = Manager X          (management hours from manager report)
//     E+ = Employee columns   (dynamic — one per unique employee across all projects)
//     I  = Total              (last numeric column, bold, right-aligned)
//     J  = Work Summary       (text, wide column, wrap text)
//
//   COLORS (exact hex from sample):
//     FFB7E1CD — Date header cell A (mint green)
//     FFC6EFCE — Date header cells B onward (light green)
//     FFC4D79B — Project name cell B (yellow-green, default / non-rate projects)
//     FFA4C2F4 — Project name cell B (light blue, ClientX - SubProject rate projects)
//     FFC4D79B — Employee hour cells (yellow-green)
//     FFF2F2F2 — Manager hour cell D (light gray, distinguishes manager from employees)
//     (no fill) — Total column, Work Summary column, Totals row

const ExcelJS = require("exceljs");
const path    = require("path");
const fs      = require("fs");

// ─────────────────────────────────────────────────────────────────────────────
// COLOR CONSTANTS  (ARGB format — ExcelJS needs the alpha prefix FF)
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  DATE_HEADER_A    : "FFB7E1CD",  // mint green  — date cell
  DATE_HEADER_REST : "FFC6EFCE",  // light green — rest of date row
  PROJECT_GREEN    : "FFC4D79B",  // yellow-green — default project row
  PROJECT_BLUE     : "FFA4C2F4",  // light blue  — ClientX-rate project row
  EMPLOYEE_CELL    : "FFC4D79B",  // yellow-green — employee hour cells
  MANAGER_CELL     : "FFF2F2F2",  // light gray  — manager hour cell
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Apply a solid fill to a cell
// ─────────────────────────────────────────────────────────────────────────────
function setFill(cell, argb) {
  if (!argb) return;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Round to 2 decimal places
// ─────────────────────────────────────────────────────────────────────────────
function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Determine if a project row uses the blue "rate" styling.
//
// Rule: a project is "blue" (billed at a client rate) if its name follows
// the pattern "ClientName - SubProject" or "ClientName- SubProject".
//
// Examples:
//   "Client-D - Gov-Agency 941"  → TRUE  (blue)
//   "Client-D - BOIR API"        → TRUE  (blue)
//   "Client-M website"           → FALSE (green — no sub-project separator)
//   "DKBC 3.1 go live"           → FALSE (green)
// ─────────────────────────────────────────────────────────────────────────────
function isClientRateProject(projectName, clientName) {
  const proj    = (projectName || "").trim();
  const prefix1 = (clientName  || "").trim() + " - "; // "Client-D - "
  const prefix2 = (clientName  || "").trim() + "- ";  // "Client-D- " (no space)
  return proj.startsWith(prefix1) || proj.startsWith(prefix2);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Collect all unique employee names across ALL clients.
// Returns a sorted array — these become the dynamic column headers E, F, G...
// Sorting ensures columns are stable across months for the same report.
// ─────────────────────────────────────────────────────────────────────────────
function collectAllEmployees(billingSummary) {
  const empSet = new Set();

  for (const client of (billingSummary.clients || [])) {
    for (const project of (client.projects || [])) {
      for (const emp of (project.employeeBreakdown || [])) {
        if (emp.employeeName && emp.employeeName !== "Unknown Employee") {
          empSet.add(emp.employeeName);
        }
      }
    }
  }

  return Array.from(empSet).sort(); // sorted alphabetically for stable columns
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Write a bold totals cell (no fill, right-aligned, bold)
// ─────────────────────────────────────────────────────────────────────────────
function writeTotal(cell, value) {
  cell.value     = round2(value);
  cell.font      = { name: "Arial", size: 10, bold: true };
  cell.numFmt    = "0.##";
  cell.alignment = { horizontal: "right" };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Convert "May 2026" → JS Date (first day of that month)
// Used for the date header cell so Excel displays it as a formatted date.
// ─────────────────────────────────────────────────────────────────────────────
function parseReportMonthToDate(reportMonth) {
  if (!reportMonth) return new Date();
  const d = new Date(`${reportMonth} 1`); // "May 2026 1" = May 1, 2026
  return isNaN(d.getTime()) ? new Date() : d;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: generateBillingSummaryExcel
//
// @param {Object} billingSummary   Output of buildBillingSummary()
// @param {String} reportMonth      e.g. "May 2026"
// @returns {String}                Absolute path to the saved .xlsx file
// ─────────────────────────────────────────────────────────────────────────────
async function generateBillingSummaryExcel(billingSummary, reportMonth) {

  const { managerName = "Manager X", clients = [] } = billingSummary;

  // ── Output folder ───────────────────────────────────────────────────────
  const outputDir = path.join(__dirname, "../generated-reports");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const fileName   = `Monthly Billing Summary ${reportMonth}.xlsx`;
  const outputPath = path.join(outputDir, fileName);

  // ── Create workbook and single sheet ───────────────────────────────────
  const workbook  = new ExcelJS.Workbook();
  workbook.creator  = "Timesheet Automation System";
  workbook.created  = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Billing Summary");

  // ── Discover employees → dynamic column layout ──────────────────────────
  const allEmployees = collectAllEmployees(billingSummary);
  // e.g. ["Employee A", "Employee B", "Employee C", "Employee D"]

  // ── Column index map ────────────────────────────────────────────────────
  // A=1, B=2, C=3, D=4, employees start at E=5
  const COL_A            = 1;  // Rate label
  const COL_B            = 2;  // Project name
  const COL_MGR_DEV      = 3;  // C — Manager Dev @35 (reserved, always 0)
  const COL_MGR          = 4;  // D — Manager hours
  const COL_EMP_START    = 5;  // E — first employee
  const COL_EMP_END      = COL_EMP_START + allEmployees.length - 1;
  const COL_TOTAL        = COL_EMP_END  + 1;  // Total column
  const COL_WORK_SUMMARY = COL_EMP_END  + 2;  // Work Summary column

  // ── Column widths (matching sample) ────────────────────────────────────
  sheet.getColumn(COL_A).width           = 15.85;
  sheet.getColumn(COL_B).width           = 35;
  sheet.getColumn(COL_MGR_DEV).width     = 15;
  sheet.getColumn(COL_MGR).width         = 12;
  for (let i = COL_EMP_START; i <= COL_EMP_END; i++) {
    sheet.getColumn(i).width = 13;
  }
  sheet.getColumn(COL_TOTAL).width        = 10;
  sheet.getColumn(COL_WORK_SUMMARY).width = 50;  // wide — sample is 49.85

  let currentRow = 1; // track the current writing position

  // ══════════════════════════════════════════════════════════════════════════
  // ROW 1 — Date header
  // A = date value (mint green), B→Total = light green, Work Summary = no fill
  // ══════════════════════════════════════════════════════════════════════════
  {
    const r     = sheet.getRow(currentRow);
    r.height    = 15.75;

    const cellA = r.getCell(COL_A);
    cellA.value     = parseReportMonthToDate(reportMonth);
    cellA.numFmt    = "mmmm yyyy"; // display as "May 2026"
    cellA.alignment = { horizontal: "right" };
    cellA.font      = { name: "Arial", size: 10 };
    setFill(cellA, COLOR.DATE_HEADER_A);

    // B through Total column: light green
    for (let c = COL_B; c <= COL_TOTAL; c++) {
      const cell = r.getCell(c);
      setFill(cell, COLOR.DATE_HEADER_REST);
      cell.font = { name: "Arial", size: 10 };
    }

    currentRow++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ROW 2 — Column headers
  // C = "Manager X Dev @35", D = managerName, E-? = employee names,
  // Total (bold), Work Summary
  // ══════════════════════════════════════════════════════════════════════════
  {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    r.getCell(COL_MGR_DEV).value = `${managerName} Dev @35`;
    r.getCell(COL_MGR_DEV).font  = { name: "Arial", size: 10 };

    r.getCell(COL_MGR).value = managerName;
    r.getCell(COL_MGR).font  = { name: "Arial", size: 10 };

    for (let i = 0; i < allEmployees.length; i++) {
      const cell  = r.getCell(COL_EMP_START + i);
      cell.value  = allEmployees[i];
      cell.font   = { name: "Arial", size: 10 };
    }

    const cellTotal = r.getCell(COL_TOTAL);
    cellTotal.value = "Total";
    cellTotal.font  = { name: "Arial", size: 10, bold: true }; // bold in sample

    r.getCell(COL_WORK_SUMMARY).value = "Work Summary";
    r.getCell(COL_WORK_SUMMARY).font  = { name: "Arial", size: 10 };

    currentRow++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DATA ROWS — one row per project, across all clients
  // Manager hours are placed on the FIRST project of each client,
  // then zeroed out for subsequent projects of the same client.
  // ══════════════════════════════════════════════════════════════════════════

  // Accumulators for the grand totals row
  const colTotals   = {};  // { "Employee A": 1.5, "Employee C": 81.5 }
  allEmployees.forEach(e => { colTotals[e] = 0; });
  let grandMgrDev = 0;
  let grandMgr    = 0;
  let grandTotal  = 0;

  for (const client of clients) {
    const clientName   = client.clientName   || "";
    const managerHours = round2(client.managerHours || 0);

    // Manager hours go on the first project row, then clear for the rest
    let mgrHoursRemaining = managerHours;

    for (const project of (client.projects || [])) {
      const projName  = project.projectName || "";
      const isBlue    = isClientRateProject(projName, clientName);
      const projColor = isBlue ? COLOR.PROJECT_BLUE : COLOR.PROJECT_GREEN;

      // How many manager hours to show on this row
      const mgrOnThisRow    = mgrHoursRemaining;
      mgrHoursRemaining     = 0; // zero for remaining projects of this client

      // Employee hours lookup for this specific project
      const empHoursMap = {};
      for (const emp of (project.employeeBreakdown || [])) {
        empHoursMap[emp.employeeName] = round2(emp.hours);
      }

      // Row total = manager hours + all employee hours for this project
      const rowTotal = round2(
        mgrOnThisRow + round2(project.employeeHours || 0)
      );

      const r  = sheet.getRow(currentRow);
      r.height = 15.75;

      // Col A: Rate label (only for blue projects)
      if (isBlue) {
        const cellA  = r.getCell(COL_A);
        cellA.value  = `${clientName} rate`;
        cellA.font   = { name: "Arial", size: 10 };
      }

      // Col B: Project name
      const cellB  = r.getCell(COL_B);
      cellB.value  = projName;
      cellB.font   = { name: "Arial", size: 10 };
      setFill(cellB, projColor);

      // Col C: Manager Dev hours (background matches project color, value blank)
      setFill(r.getCell(COL_MGR_DEV), projColor);

      // Col D: Manager hours — always light gray background
      const cellD = r.getCell(COL_MGR);
      setFill(cellD, COLOR.MANAGER_CELL);
      if (mgrOnThisRow > 0) {
        cellD.value  = mgrOnThisRow;
        cellD.numFmt = "0.##";
        cellD.font   = { name: "Arial", size: 10 };
      }

      // Cols E+: Employee hours — yellow-green background
      for (let i = 0; i < allEmployees.length; i++) {
        const empName  = allEmployees[i];
        const empHours = empHoursMap[empName] || 0;
        const cell     = r.getCell(COL_EMP_START + i);

        setFill(cell, COLOR.EMPLOYEE_CELL);
        if (empHours > 0) {
          cell.value     = empHours;
          cell.numFmt    = "0.##";
          cell.font      = { name: "Arial", size: 10 };
          cell.alignment = { horizontal: "right" };
        }

        colTotals[empName] = round2(colTotals[empName] + empHours);
      }

      // Total column — bold, no fill, right-aligned
      const cellTotal     = r.getCell(COL_TOTAL);
      cellTotal.value     = rowTotal;
      cellTotal.font      = { name: "Arial", size: 10, bold: true };
      cellTotal.numFmt    = "0.##";
      cellTotal.alignment = { horizontal: "right" };

      // Work Summary — wrap text for long descriptions
      const summaryText = (project.workSummary || []).join(", ");
      if (summaryText) {
        const cellWS     = r.getCell(COL_WORK_SUMMARY);
        cellWS.value     = summaryText;
        cellWS.font      = { name: "Arial", size: 10 };
        cellWS.alignment = { wrapText: true };
        if (summaryText.length > 80) r.height = 63.75; // expand for long text
      }

      // Accumulate grand totals
      grandMgr   = round2(grandMgr   + mgrOnThisRow);
      grandTotal = round2(grandTotal + rowTotal);

      currentRow++;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GRAND TOTALS ROW
  // Matches sample row 8: C=0, D=5, E=1.5, F=81.5, G=0, H=0, I=88
  // All values bold, right-aligned, no fill
  // ══════════════════════════════════════════════════════════════════════════
  {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    writeTotal(r.getCell(COL_MGR_DEV), grandMgrDev);  // always 0 (dev hours)
    writeTotal(r.getCell(COL_MGR),     grandMgr);

    for (let i = 0; i < allEmployees.length; i++) {
      writeTotal(
        r.getCell(COL_EMP_START + i),
        colTotals[allEmployees[i]] || 0
      );
    }

    writeTotal(r.getCell(COL_TOTAL), grandTotal);

    currentRow++;
  }

  // Two blank spacer rows (matches sample rows 9 and 10)
  currentRow += 2;

  // ── Save ────────────────────────────────────────────────────────────────
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Billing Summary saved: ${outputPath}`);

  return outputPath;
}

module.exports = { generateBillingSummaryExcel };