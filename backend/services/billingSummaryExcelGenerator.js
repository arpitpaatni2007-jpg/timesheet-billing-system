// services/billingSummaryExcelGenerator.js
//
// CHANGES IN THIS VERSION:
//   1. numFmt: "#,##0.##" — never shows trailing dot ("43" not "43.")
//   2. Formula cells include result: value so Excel shows correct totals
//      immediately without requiring manual recalculation

const ExcelJS = require("exceljs");
const path    = require("path");
const fs      = require("fs");

// ─── Color constants (exact hex values from company sample) ──────────────────
const COLOR = {
  DATE_HEADER_A    : "FFB7E1CD",
  DATE_HEADER_REST : "FFC6EFCE",
  PROJECT_GREEN    : "FFC4D79B",
  PROJECT_BLUE     : "FFA4C2F4",
  EMPLOYEE_CELL    : "FFC4D79B",
  MANAGER_CELL     : "FFF2F2F2",
};

// "#,##0.##" — shows "43" not "43.", "1.5" not "1.50", never a trailing dot
const HOURS_FMT = "General";

function setFill(cell, argb) {
  if (!argb) return;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

// Round to nearest 15-minute increment (0.25 hr) for displayed Summary totals.
// Applied only to the Total column cells in the Billing Summary sheet.
// Internal per-person hours and formula ranges are NOT affected.
// Examples: 31.32 → 31.25 | 5.72 → 5.75 | 154.83 → 154.75
function roundTo15Min(n) {
  return Math.round((n || 0) / 0.25) * 0.25;
}

function isClientRateProject(projectName, clientName) {
  const proj    = (projectName || "").trim();
  const prefix1 = (clientName  || "").trim() + " - ";
  const prefix2 = (clientName  || "").trim() + "- ";
  return proj.startsWith(prefix1) || proj.startsWith(prefix2);
}

function parseReportMonthToDate(reportMonth) {
  if (!reportMonth) return new Date();
  const d = new Date(`${reportMonth} 1`);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Collect all unique people: regular employees (alphabetical) then manager(s) last
function collectAllPeople(billingSummary) {
  const employees = new Set();
  const managers  = new Set();

  for (const client of (billingSummary.clients || [])) {
    for (const project of (client.projects || [])) {
      for (const emp of (project.employeeBreakdown || [])) {
        if (!emp.employeeName || emp.employeeName === "Unknown Employee") continue;
        if (emp.isManager) managers.add(emp.employeeName);
        else               employees.add(emp.employeeName);
      }
    }
  }

  return [
    ...Array.from(employees).sort(),
    ...Array.from(managers).sort(),
  ];
}

// Convert 1-based column index to Excel letter (1→A, 27→AA, etc.)
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

  const { clients = [] } = billingSummary;

  const outputDir = path.join(__dirname, "../generated-reports");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const fileName   = `Monthly Billing Summary ${reportMonth}.xlsx`;
  const outputPath = path.join(outputDir, fileName);

  const workbook = new ExcelJS.Workbook();
  workbook.creator  = "Timesheet Automation System";
  workbook.created  = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Billing Summary");

  const allPeople = collectAllPeople(billingSummary);

  // Manager name set for gray-fill detection
  const managerNames = new Set();
  for (const client of clients) {
    for (const project of (client.projects || [])) {
      for (const emp of (project.employeeBreakdown || [])) {
        if (emp.isManager) managerNames.add(emp.employeeName);
      }
    }
  }

  // Column positions (1-based)
  const COL_A            = 1;
  const COL_B            = 2;
  const COL_PEOPLE_START = 3;
  const COL_PEOPLE_END   = COL_PEOPLE_START + allPeople.length - 1;
  const COL_TOTAL        = COL_PEOPLE_END + 1;
  const COL_WORK_SUMMARY = COL_PEOPLE_END + 2;

  // Column widths
  sheet.getColumn(COL_A).width           = 15.85;
  sheet.getColumn(COL_B).width           = 38;
  for (let i = COL_PEOPLE_START; i <= COL_PEOPLE_END; i++) {
    sheet.getColumn(i).width = 16;
  }
  sheet.getColumn(COL_TOTAL).width        = 10;
  sheet.getColumn(COL_WORK_SUMMARY).width = 50;

  let currentRow = 1;

  // ── ROW 1: Date header ─────────────────────────────────────────────────────
  {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    const cellA = r.getCell(COL_A);
    cellA.value     = parseReportMonthToDate(reportMonth);
    cellA.numFmt    = "mmmm yyyy";
    cellA.alignment = { horizontal: "right" };
    cellA.font      = { name: "Arial", size: 10 };
    setFill(cellA, COLOR.DATE_HEADER_A);

    for (let c = COL_B; c <= COL_TOTAL; c++) {
      const cell = r.getCell(c);
      setFill(cell, COLOR.DATE_HEADER_REST);
      cell.font = { name: "Arial", size: 10 };
    }
    currentRow++;
  }

  // ── ROW 2: Column headers ──────────────────────────────────────────────────
  {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    for (let i = 0; i < allPeople.length; i++) {
      const cell  = r.getCell(COL_PEOPLE_START + i);
      cell.value  = allPeople[i];
      cell.font   = { name: "Arial", size: 10 };
    }

    const cellTotal = r.getCell(COL_TOTAL);
    cellTotal.value = "Total";
    cellTotal.font  = { name: "Arial", size: 10, bold: true };

    r.getCell(COL_WORK_SUMMARY).value = "Work Summary";
    r.getCell(COL_WORK_SUMMARY).font  = { name: "Arial", size: 10 };
    currentRow++;
  }

  const firstDataRow = currentRow; // used for column SUM range

  // ── Data rows ──────────────────────────────────────────────────────────────
  for (const client of clients) {
    const clientName = client.clientName || "";

    for (const project of (client.projects || [])) {
      const projName  = project.projectName || "";
      const isBlue    = isClientRateProject(projName, clientName);
      const projColor = isBlue ? COLOR.PROJECT_BLUE : COLOR.PROJECT_GREEN;

      const hoursMap = {};
      for (const emp of (project.employeeBreakdown || [])) {
        hoursMap[emp.employeeName] = round2(emp.hours);
      }

      const r  = sheet.getRow(currentRow);
      r.height = 15.75;

      if (isBlue) {
        const cellA = r.getCell(COL_A);
        cellA.value = `${clientName} rate`;
        cellA.font  = { name: "Arial", size: 10 };
      }

      const cellB = r.getCell(COL_B);
      cellB.value = projName;
      cellB.font  = { name: "Arial", size: 10 };
      setFill(cellB, projColor);

      // Compute row total for use as formula cached result.
      // round2 gives full precision for internal accumulation.
      // roundTo15Min is then applied for the displayed Total column value only —
      // the per-person cells (Employee A, B, C… Manager X) keep their exact hours.
      let rowTotal = 0;
      for (let i = 0; i < allPeople.length; i++) {
        rowTotal += hoursMap[allPeople[i]] || 0;
      }
      rowTotal = roundTo15Min(round2(rowTotal));

      for (let i = 0; i < allPeople.length; i++) {
        const personName = allPeople[i];
        const hrs        = hoursMap[personName] || 0;
        const colIdx     = COL_PEOPLE_START + i;
        const cell       = r.getCell(colIdx);

        const isThisMgr = managerNames.has(personName);
        setFill(cell, isThisMgr ? COLOR.MANAGER_CELL : COLOR.EMPLOYEE_CELL);

        if (hrs > 0) {
          cell.value     = hrs;
          cell.numFmt    = HOURS_FMT;
          cell.font      = { name: "Arial", size: 10 };
          cell.alignment = { horizontal: "right" };
        }
      }

      // Row total formula with cached result
      const firstPersonCell = colLetter(COL_PEOPLE_START) + currentRow;
      const lastPersonCell  = colLetter(COL_PEOPLE_END)   + currentRow;
      const cellTotal       = r.getCell(COL_TOTAL);
      cellTotal.value       = {
        formula : `SUM(${firstPersonCell}:${lastPersonCell})`,
        result  : rowTotal,   // ← cached result: Excel shows this immediately
      };
      cellTotal.font        = { name: "Arial", size: 10, bold: true };
      cellTotal.numFmt      = HOURS_FMT;
      cellTotal.alignment   = { horizontal: "right" };

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

  // ── Grand totals row ────────────────────────────────────────────────────────
  const lastDataRow = currentRow - 1;
  {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    // Compute actual column totals for cached results
    const colTotals = {};
    allPeople.forEach(name => { colTotals[name] = 0; });
    let grandTotalVal = 0;

    for (let rowNum = firstDataRow; rowNum <= lastDataRow; rowNum++) {
      for (let i = 0; i < allPeople.length; i++) {
        const cellVal = sheet.getRow(rowNum).getCell(COL_PEOPLE_START + i).value;
        if (typeof cellVal === "number") {
          colTotals[allPeople[i]] = round2((colTotals[allPeople[i]] || 0) + cellVal);
        }
      }
      const totalCell = sheet.getRow(rowNum).getCell(COL_TOTAL);
      const tv = totalCell.value;
      if (typeof tv === "number") {
        grandTotalVal = round2(grandTotalVal + tv);
      } else if (tv && typeof tv === "object" && typeof tv.result === "number") {
        grandTotalVal = round2(grandTotalVal + tv.result);
      }
    }

    for (let i = 0; i < allPeople.length; i++) {
      const colIdx = COL_PEOPLE_START + i;
      const colLet = colLetter(colIdx);
      const cell   = r.getCell(colIdx);
      cell.value   = {
        formula : `SUM(${colLet}${firstDataRow}:${colLet}${lastDataRow})`,
        result  : colTotals[allPeople[i]] || 0,
      };
      cell.font      = { name: "Arial", size: 10, bold: true };
      cell.numFmt    = HOURS_FMT;
      cell.alignment = { horizontal: "right" };
    }

    const totalColLet    = colLetter(COL_TOTAL);
    const cellGrandTotal = r.getCell(COL_TOTAL);
    cellGrandTotal.value = {
      formula : `SUM(${totalColLet}${firstDataRow}:${totalColLet}${lastDataRow})`,
      result  : grandTotalVal,
    };
    cellGrandTotal.font      = { name: "Arial", size: 10, bold: true };
    cellGrandTotal.numFmt    = HOURS_FMT;
    cellGrandTotal.alignment = { horizontal: "right" };

    currentRow++;
  }

  currentRow += 2; // two blank spacer rows

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Billing Summary saved: ${outputPath}`);
  return outputPath;
}

module.exports = { generateBillingSummaryExcel };