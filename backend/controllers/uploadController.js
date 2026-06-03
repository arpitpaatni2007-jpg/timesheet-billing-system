// controllers/uploadController.js
// Handles what happens after a file is uploaded

const csvProcessor  = require("../services/csvProcessor");   // parses CSV → array of rows
const { groupByClient } = require("../services/timesheetGrouper"); // NEW: groups rows by client

// Controller for POST /api/upload
const uploadFile = async (req, res) => {
  try {
    // Check if a file was actually uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Step 1: Parse the uploaded CSV into an array of row objects
const filePath = req.file.path;

// Parse CSV using your existing processor
const parsedResult = csvProcessor.processCSV(filePath);

// Get only the actual rows array
const rows = parsedResult.data;

// Group the rows
const groupedData = groupByClient(rows);

// Return grouped response
return res.status(200).json({
  success: true,
  message: "File uploaded and grouped successfully",
  totalRows: rows.length,
  totalClients: groupedData.length,
  data: groupedData
});
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Failed to process file" });
  }
};

// NEW Controller for POST /api/upload/grouped
// Does everything above AND groups the data by client
const uploadAndGroup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;

    // Step 1: Parse CSV
    const parsedResult = csvProcessor.processCSV(filePath);

    // Step 2: Group by Client → Project → Module → Task → Employee
    const groupedData = groupByClient(parsedResult.data);
    // Step 3: Return the structured grouped JSON
    return res.status(200).json({
      message: "File uploaded and grouped successfully",
      totalRows: parsedResult.validRows,
      totalClients: groupedData.length,
      data: groupedData
    });

  } catch (error) {
    console.error("Grouping error:", error);
    return res.status(500).json({ error: "Failed to group data" });
  }
};

// Export both controllers
module.exports = { uploadFile, uploadAndGroup };