// server.js
// This is the main entry point of your backend application.
// It sets up the Express server and connects all routes.

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const REQUIRED_DIRS = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "generated-reports"),
];

for (const dir of REQUIRED_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created missing directory: ${dir}`);
  }
}
// -------------------------------------------------------
// IMPORT ROUTES
// Each route file handles a different group of API endpoints
// -------------------------------------------------------
const uploadRoutes = require("./routes/uploadRoutes"); // Phase 3 & 4: CSV upload + grouping
const reportRoutes = require("./routes/reportRoutes"); // Phase 5: Excel report generation

// -------------------------------------------------------
// MIDDLEWARE
// Middleware runs on every request before it hits your routes
// -------------------------------------------------------
app.use(express.json());                        // Allows Express to read JSON in request body
app.use(express.urlencoded({ extended: true })); // Allows Express to read form fields in request body

// -------------------------------------------------------
// ROUTES
// Each app.use() connects a URL prefix to a route file
// -------------------------------------------------------

// Phase 3 & 4: CSV upload and grouping
// POST /api/upload           → raw parsed CSV data
// POST /api/upload/grouped   → client-grouped JSON
app.use("/api/upload", uploadRoutes);

// Phase 5: Excel report generation and download
// POST /api/reports/generate-timesheet  → generates Excel workbook
// GET  /api/reports/download/:filename  → downloads the generated file
app.use("/api/reports", reportRoutes);

// -------------------------------------------------------
// HEALTH CHECK ROUTE
// Visit http://localhost:5001/ in your browser to confirm server is running
// -------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    status:  "running",
    message: "Timesheet & Billing Automation API is live ✅",
    version: "Phase 5",
    routes: {
      upload:         "POST /api/upload",
      uploadGrouped:  "POST /api/upload/grouped",
      generateReport: "POST /api/reports/generate-timesheet",
      downloadReport: "GET  /api/reports/download/:filename"
    }
  });
});

// -------------------------------------------------------
// START THE SERVER
// -------------------------------------------------------
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📂 Upload endpoint:  POST http://localhost:${PORT}/api/upload`);
  console.log(`📊 Report endpoint:  POST http://localhost:${PORT}/api/reports/generate-timesheet`);
  console.log(`⬇️  Download route:  GET  http://localhost:${PORT}/api/reports/download/:filename`);
});