// services/excelGenerator.js
// This file takes the grouped client data and writes it into an Excel workbook.
// Each client gets their own sheet (tab) in the workbook.

const ExcelJS = require("exceljs"); // ExcelJS library for creating .xlsx files
const path    = require("path");    // Node.js built-in for file paths
const fs      = require("fs");      // Node.js built-in for file system operations

/**
 * Main function: Generate the Excel workbook from grouped client data.
 *
 * @param {Array}  groupedData  - The client-grouped JSON from Phase 4
 * @param {String} reportMonth  - e.g. "May 2026" — used in filename and header
 * @returns {String}            - Full path to the saved .xlsx file
 */
async function generateTimesheetExcel(groupedData, reportMonth) {

  // --- SETUP ---

  // Create a new blank workbook
  const workbook = new ExcelJS.Workbook();

  // Set document properties (shows up in File > Properties in Excel)
  workbook.creator    = "Timesheet Automation System";
  workbook.created    = new Date();
  workbook.modified   = new Date();

  // Make sure the output folder exists; create it if it doesn't
  const outputDir = path.join(__dirname, "../generated-reports");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Build the filename: "Client Wise - Timesheet May 2026.xlsx"
  const fileName   = `Client Wise - Timesheet ${reportMonth}.xlsx`;
  const outputPath = path.join(outputDir, fileName);

  // --- LOOP THROUGH EACH CLIENT ---
  // Each client gets their own worksheet (tab)

  for (const client of groupedData) {

    // Worksheet name = client name (Excel limits sheet names to 31 chars)
    const sheetName = client.clientName.substring(0, 31);
    const sheet     = workbook.addWorksheet(sheetName);

    // -------------------------------------------------------
    // ROW 1: Report title
    // -------------------------------------------------------
    sheet.addRow([`Client Wise – Timesheet Report`]);
    sheet.mergeCells(`A1:F1`); // merge across all 6 columns
    styleTitle(sheet.getRow(1).getCell(1));

    // ROW 2: Client name
    sheet.addRow([`Client: ${client.clientName}`]);
    sheet.mergeCells(`A2:F2`);
    styleSubTitle(sheet.getRow(2).getCell(1));

    // ROW 3: Report period and generation date
    const generatedOn = new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric"
    });
    sheet.addRow([`Period: ${reportMonth}   |   Generated on: ${generatedOn}`]);
    sheet.mergeCells(`A3:F3`);
    styleSubTitle(sheet.getRow(3).getCell(1));

    // ROW 4: Blank spacer row
    sheet.addRow([]);

    // -------------------------------------------------------
    // ROW 5: Column headers
    // -------------------------------------------------------
    const headerRow = sheet.addRow([
      "Project",
      "Module / Task List",
      "Task",
      "Employee",
      "Hours",
      "Notes"
    ]);
    styleHeaderRow(headerRow); // bold, background color, borders

    // Freeze rows 1–5 so headers stay visible when scrolling
    sheet.views = [{ state: "frozen", ySplit: 5 }];

    // -------------------------------------------------------
    // DATA ROWS: Loop through Projects → Modules → Tasks → Employees
    // -------------------------------------------------------
// Track every data row number for each project, so we can write
    // =SUM(E6:E12) style formulas instead of hardcoded totals.
    // This means if anyone edits a cell manually, totals recalculate.
    const allDataRowNumbers = []; // collects every employee row number

    for (const project of client.projects) {

      const projectDataRowNumbers = []; // employee rows for this project only

      for (const mod of project.modules) {
        for (const task of mod.tasks) {
          for (const emp of task.employees) {

            const dataRow = sheet.addRow([
              project.projectName,
              mod.moduleName,
              task.taskName,
              emp.employeeName,
              emp.totalHours,  // raw value written here (not a formula)
              ""
            ]);

            styleDataRow(dataRow);

            projectDataRowNumbers.push(dataRow.number);
            allDataRowNumbers.push(dataRow.number);
          }
        }
      }

      // PROJECT SUBTOTAL — =SUM of this project's employee rows in col E
      // If rows are not contiguous (spacers between projects), we join with +
      // But since rows ARE contiguous per project, a range SUM is safe.
      const projFirstRow = projectDataRowNumbers[0];
      const projLastRow  = projectDataRowNumbers[projectDataRowNumbers.length - 1];
      const projectTotalRow = sheet.addRow([
        `Total – ${project.projectName}`,
        "", "", "",
        { formula: `SUM(E${projFirstRow}:E${projLastRow})` },  // ← formula
        ""
      ]);
      styleProjectTotalRow(projectTotalRow);
      sheet.mergeCells(`A${projectTotalRow.number}:D${projectTotalRow.number}`);

      sheet.addRow([]); // blank spacer
    }

    // CLIENT GRAND TOTAL — =SUM of ALL employee rows in col E for this sheet
    // We list each project subtotal row's formula refs OR sum all data rows.
    // Summing all data rows directly is simpler and equally correct.
    const clientFirstRow = allDataRowNumbers[0];
    const clientLastRow  = allDataRowNumbers[allDataRowNumbers.length - 1];
    const clientTotalRow = sheet.addRow([
      `TOTAL BILLABLE HOURS – ${client.clientName.toUpperCase()}`,
      "", "", "",
      { formula: `SUM(E${clientFirstRow}:E${clientLastRow})` },  // ← formula
      ""
    ]);
    styleClientTotalRow(clientTotalRow);
    sheet.mergeCells(`A${clientTotalRow.number}:D${clientTotalRow.number}`);
    

    // -------------------------------------------------------
    // COLUMN WIDTHS (auto-size by setting fixed widths)
    // -------------------------------------------------------
    sheet.getColumn(1).width = 40;  // Project
    sheet.getColumn(2).width = 30;  // Module
    sheet.getColumn(3).width = 35;  // Task
    sheet.getColumn(4).width = 25;  // Employee
    sheet.getColumn(5).width = 12;  // Hours
    sheet.getColumn(6).width = 20;  // Notes
  }

  // --- SAVE THE WORKBOOK ---
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Excel report saved: ${outputPath}`);

  return outputPath; // return the path so the API can send it back
}

// ============================================================
// STYLE HELPER FUNCTIONS
// These keep the code clean by separating style logic
// ============================================================

// Title row (Row 1)
function styleTitle(cell) {
  cell.font      = { name: "Arial", bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } }; // dark navy
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

// Sub-title rows (Row 2 and 3)
function styleSubTitle(cell) {
  cell.font      = { name: "Arial", bold: false, size: 11, color: { argb: "FF1F3864" } };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }; // light blue
  cell.alignment = { horizontal: "left", vertical: "middle" };
}

// Header row (Row 5)
function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } }; // medium blue
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border    = allBorders();
  });
  row.height = 20;
}

// Regular data rows
function styleDataRow(row) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font      = { name: "Arial", size: 10 };
    cell.border    = allBorders();
    cell.alignment = { vertical: "middle" };

    // Format the Hours column (column 5) as a number with 2 decimal places
    if (colNumber === 5) {
      cell.numFmt    = "0.##";
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  row.height = 18;
}

// Project subtotal row
function styleProjectTotalRow(row) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font      = { name: "Arial", bold: true, size: 10, color: { argb: "FF1F3864" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDAE3F3" } }; // pale blue
    cell.border    = allBorders();
    cell.alignment = { vertical: "middle" };

    if (colNumber === 5) {
      cell.numFmt    = "0.##";
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  row.height = 18;
}

// Client grand total row
function styleClientTotalRow(row) {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font      = { name: "Arial", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } }; // dark navy
    cell.border    = allBorders();
    cell.alignment = { vertical: "middle" };

    if (colNumber === 5) {
      cell.numFmt    = "0.##";
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  row.height = 22;
}

// Reusable border style (thin borders on all 4 sides)
function allBorders() {
  const thin = { style: "thin", color: { argb: "FFB8CCE4" } };
  return { top: thin, left: thin, bottom: thin, right: thin };
}

// Round hours to 2 decimal places
function roundHours(hours) {
  return Math.round(hours * 100) / 100;
}

// Export the main function
module.exports = { generateTimesheetExcel };