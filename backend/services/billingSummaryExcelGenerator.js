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

  // ── Manager Summary sheet ───────────────────────────────────────────────────
  // Added as a second worksheet in the same workbook.
  // Billing Summary sheet is NOT modified — this only appends a new sheet.
  addManagerSummarySheet(workbook, billingSummary, reportMonth);

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Billing Summary saved: ${outputPath}`);
  return outputPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// addManagerSummarySheet
//
// PURPOSE: Create a "Manager Summary" worksheet for reconciliation.
//
// The manager needs to verify that all their logged hours were correctly
// picked up and included in the Billing Summary. This sheet shows every
// entry from the manager's timesheet file in one place, with a clear
// "Included" / "Not Allocated" flag so they can cross-check against the
// Summary sheet without manually counting rows.
//
// DATA SOURCES (both already inside billingSummary):
//   billingSummary.clients[].managerEntries[]   → entries that matched a client
//                                                  (these ARE in the Summary)
//   billingSummary.unallocated.entries[]         → entries with no client match
//                                                  (these are NOT in the Summary)
//
// COLUMNS (9 total):
//   A  Date                — entry date from the manager's time tracker
//   B  Client              — matched client name, or "— Unallocated —"
//   C  Description         — full description text from the manager's log
//   D  Activity Category   — the manager's project/category tag (e.g. "Project Monitoring")
//   E  Hours               — hours logged for this entry
//   F  Included in Summary — "✓ Included" (green) or "⚠ Not Allocated" (amber)
//   G  Manager Name        — who logged this entry
//   H  Report Period       — the month this report covers
//   I  Notes               — any extra context (currently "Client match found" vs "No client prefix matched")
//
// SORT ORDER: Date ascending, then Client alphabetically within each date.
// ─────────────────────────────────────────────────────────────────────────────
function addManagerSummarySheet(workbook, billingSummary, reportMonth) {

  const sheet = workbook.addWorksheet("Manager Summary");

  // ── Sheet-level settings ────────────────────────────────────────────────────
  sheet.views       = [{ state: "frozen", ySplit: 3 }]; // freeze title + header rows
  sheet.properties  = { tabColor: { argb: "FF4472C4" } }; // blue tab to stand out

  // ── Column widths ───────────────────────────────────────────────────────────
  sheet.getColumn(1).width  = 14;  // A  Date
  sheet.getColumn(2).width  = 18;  // B  Client
  sheet.getColumn(3).width  = 52;  // C  Description (longest field)
  sheet.getColumn(4).width  = 36;  // D  Activity Category
  sheet.getColumn(5).width  = 10;  // E  Hours
  sheet.getColumn(6).width  = 20;  // F  Included in Summary
  sheet.getColumn(7).width  = 22;  // G  Manager Name
  sheet.getColumn(8).width  = 16;  // H  Report Period
  sheet.getColumn(9).width  = 36;  // I  Notes

  const TOTAL_COLS = 9;

  // ── ROW 1: Sheet title ──────────────────────────────────────────────────────
  {
    const r    = sheet.getRow(1);
    r.height   = 22;
    const cell = r.getCell(1);
    cell.value     = `Manager Hours Reconciliation — ${reportMonth}`;
    cell.font      = { name: "Arial", bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    sheet.mergeCells(`A1:I1`);

    // Fill remaining merged cells with the same background
    for (let c = 2; c <= TOTAL_COLS; c++) {
      setFill(r.getCell(c), "FF1F3864");
    }
  }

  // ── ROW 2: Sub-title with totals summary ────────────────────────────────────
  {
    const r    = sheet.getRow(2);
    r.height   = 16;

    const unallocHours  = round2((billingSummary.unallocated  || {}).hours || 0);
    const includedHours = round2(
      (billingSummary.grandTotal || {}).totalManagerHours || 0
    );
    const totalHours    = round2(includedHours + unallocHours);

    const cell = r.getCell(1);
    cell.value = `Total logged: ${totalHours} hrs  |  Included in Summary: ${includedHours} hrs  |  Not Allocated: ${unallocHours} hrs`;
    cell.font      = { name: "Arial", size: 10, color: { argb: "FF1F3864" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    sheet.mergeCells(`A2:I2`);

    for (let c = 2; c <= TOTAL_COLS; c++) {
      setFill(r.getCell(c), "FFD9E1F2");
    }
  }

  // ── ROW 3: Column headers ───────────────────────────────────────────────────
  {
    const headers = [
      "Date",
      "Client",
      "Description",
      "Activity Category",
      "Hours",
      "Included in Summary",
      "Manager",
      "Report Period",
      "Notes",
    ];

    const r  = sheet.getRow(3);
    r.height = 18;

    headers.forEach((h, i) => {
      const cell     = r.getCell(i + 1);
      cell.value     = h;
      cell.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
      cell.border    = mgBorders();
    });
  }

  // ── Collect all entries into one flat list ──────────────────────────────────
  // Two pools:
  //   1. clientEntries — one record per client, from billingSummary.clients[].managerEntries[]
  //   2. unallocatedEntries — from billingSummary.unallocated.entries[]
  //
  // Both pools have the same shape: { description, managerCategory, hours, date }
  // clientEntries additionally have clientName on each entry.

  const allRows = [];
  const managerName = billingSummary.managerName || "Manager";

  // Pool 1 — included entries (grouped by client inside billingSummary.clients)
  for (const client of (billingSummary.clients || [])) {
    for (const entry of (client.managerEntries || [])) {
      allRows.push({
        date        : entry.date             || "",
        clientName  : client.clientName      || "",
        description : entry.description      || "",
        category    : entry.managerCategory  || "Uncategorized",
        hours       : entry.hours            || 0,
        included    : true,
        note        : "Client match found",
      });
    }
  }

  // Pool 2 — unallocated entries (no client prefix was matched)
  for (const entry of ((billingSummary.unallocated || {}).entries || [])) {
    allRows.push({
      date        : entry.date             || "",
      clientName  : "",                          // no client — show placeholder below
      description : entry.description      || "",
      category    : entry.managerCategory  || "Uncategorized",
      hours       : entry.hours            || 0,
      included    : false,
      note        : "No client prefix matched",
    });
  }

  // ── Sort: date ascending, then client name alphabetically ──────────────────
  allRows.sort((a, b) => {
    const dateCmp = (a.date || "").localeCompare(b.date || "");
    if (dateCmp !== 0) return dateCmp;
    return (a.clientName || "").localeCompare(b.clientName || "");
  });

  // ── Write data rows ─────────────────────────────────────────────────────────
  let currentRow    = 4; // data starts after the 3 header rows
  let includedTotal = 0;
  let unallocTotal  = 0;

  for (const entry of allRows) {
    const r  = sheet.getRow(currentRow);
    r.height = 15.75;

    // Column A — Date
    const cellDate     = r.getCell(1);
    cellDate.value     = entry.date || "";
    cellDate.font      = { name: "Arial", size: 10 };
    cellDate.alignment = { horizontal: "center", vertical: "middle" };
    cellDate.border    = mgBorders();

    // Column B — Client (placeholder for unallocated)
    const cellClient     = r.getCell(2);
    cellClient.value     = entry.clientName || "— Unallocated —";
    cellClient.font      = {
      name:   "Arial",
      size:   10,
      italic: !entry.clientName,            // italicise the placeholder
      color:  { argb: entry.clientName ? "FF000000" : "FF808080" },
    };
    cellClient.alignment = { vertical: "middle" };
    cellClient.border    = mgBorders();

    // Column C — Description
    const cellDesc     = r.getCell(3);
    cellDesc.value     = entry.description;
    cellDesc.font      = { name: "Arial", size: 10 };
    cellDesc.alignment = { vertical: "middle", wrapText: true };
    cellDesc.border    = mgBorders();
    if (entry.description && entry.description.length > 60) r.height = 30;

    // Column D — Activity Category
    const cellCat     = r.getCell(4);
    cellCat.value     = entry.category;
    cellCat.font      = { name: "Arial", size: 10 };
    cellCat.alignment = { vertical: "middle" };
    cellCat.border    = mgBorders();

    // Column E — Hours
    const cellHrs     = r.getCell(5);
    cellHrs.value     = entry.hours;
    cellHrs.numFmt    = "General";
    cellHrs.font      = { name: "Arial", size: 10 };
    cellHrs.alignment = { horizontal: "center", vertical: "middle" };
    cellHrs.border    = mgBorders();

    // Column F — Included in Summary (the key reconciliation flag)
    const cellFlag  = r.getCell(6);
    if (entry.included) {
      cellFlag.value = "✓ Included";
      cellFlag.font  = { name: "Arial", size: 10, bold: true, color: { argb: "FF276221" } };
      setFill(cellFlag, "FFE2EFDA"); // light green background
      includedTotal  = round2(includedTotal + entry.hours);
    } else {
      cellFlag.value = "⚠ Not Allocated";
      cellFlag.font  = { name: "Arial", size: 10, bold: true, color: { argb: "FF7E3900" } };
      setFill(cellFlag, "FFFFF2CC"); // light amber background
      unallocTotal   = round2(unallocTotal + entry.hours);
    }
    cellFlag.alignment = { horizontal: "center", vertical: "middle" };
    cellFlag.border    = mgBorders();

    // Column G — Manager name
    const cellMgr     = r.getCell(7);
    cellMgr.value     = managerName;
    cellMgr.font      = { name: "Arial", size: 10 };
    cellMgr.alignment = { vertical: "middle" };
    cellMgr.border    = mgBorders();

    // Column H — Report period
    const cellPeriod     = r.getCell(8);
    cellPeriod.value     = reportMonth;
    cellPeriod.font      = { name: "Arial", size: 10 };
    cellPeriod.alignment = { horizontal: "center", vertical: "middle" };
    cellPeriod.border    = mgBorders();

    // Column I — Notes
    const cellNote     = r.getCell(9);
    cellNote.value     = entry.note;
    cellNote.font      = { name: "Arial", size: 10, color: { argb: "FF595959" } };
    cellNote.alignment = { vertical: "middle" };
    cellNote.border    = mgBorders();

    // Alternate row shading for readability — every odd data row gets a tint
    if ((currentRow - 4) % 2 === 1) {
      for (let c = 1; c <= TOTAL_COLS; c++) {
        const cell = r.getCell(c);
        // Only shade cells that don't already have a colour (the flag column)
        if (c !== 6 && (!cell.fill || cell.fill.type !== "pattern" || !cell.fill.fgColor?.argb || cell.fill.fgColor.argb === "FF000000")) {
          setFill(cell, "FFF5F8FE"); // very faint blue-grey
        }
      }
    }

    currentRow++;
  }

  // ── Totals footer row ───────────────────────────────────────────────────────
  {
    const r  = sheet.getRow(currentRow);
    r.height = 18;

    const cellLabel     = r.getCell(1);
    cellLabel.value     = "TOTALS";
    cellLabel.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cellLabel.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cellLabel.alignment = { horizontal: "right", vertical: "middle" };
    cellLabel.border    = mgBorders();
    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
    for (let c = 2; c <= 4; c++) {
      setFill(r.getCell(c), "FF1F3864");
    }

    // Total hours column (E)
    const cellTotalHrs     = r.getCell(5);
    cellTotalHrs.value     = {
      formula : `SUM(E4:E${currentRow - 1})`,
      result  : round2(includedTotal + unallocTotal),
    };
    cellTotalHrs.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cellTotalHrs.numFmt    = "General";
    cellTotalHrs.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cellTotalHrs.alignment = { horizontal: "center", vertical: "middle" };
    cellTotalHrs.border    = mgBorders();

    // Flag column (F) — summary text
    const cellFlagTotal     = r.getCell(6);
    cellFlagTotal.value     = `✓ ${includedTotal} hrs  ⚠ ${unallocTotal} hrs`;
    cellFlagTotal.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cellFlagTotal.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    cellFlagTotal.alignment = { horizontal: "center", vertical: "middle" };
    cellFlagTotal.border    = mgBorders();

    for (let c = 7; c <= TOTAL_COLS; c++) {
      const cell = r.getCell(c);
      setFill(cell, "FF1F3864");
      cell.border = mgBorders();
    }
  }

  // ── AutoFilter on header row so manager can filter by client, date, etc. ────
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to:   { row: 3, column: TOTAL_COLS },
  };
}

// Thin border style for the Manager Summary sheet
function mgBorders() {
  const thin = { style: "thin", color: { argb: "FFB8CCE4" } };
  return { top: thin, left: thin, bottom: thin, right: thin };
}

module.exports = { generateBillingSummaryExcel };