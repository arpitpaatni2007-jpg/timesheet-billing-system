// server.js

const express = require("express");
const cors    = require("cors");   // ADD THIS
const path    = require("path");
const fs      = require("fs");
const app     = express();

// ── Create required folders on startup ───────────────────────────────────────
const REQUIRED_DIRS = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "generated-reports"),
  path.join(__dirname, "config"),            // needed for client-sheet-settings.json
];
for (const dir of REQUIRED_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created missing directory: ${dir}`);
  }
}

// ── Import routes ─────────────────────────────────────────────────────────────
const uploadRoutes = require("./routes/uploadRoutes");
const reportRoutes = require("./routes/reportRoutes");
const configRoutes = require("./routes/configRoutes");   // ← NEW

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/upload",  uploadRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/config",  configRoutes);   // ← NEW: GET/POST /api/config/client-sheets

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:  "running",
    message: "Timesheet & Billing Automation API is live ✅",
    version: "Phase 7",
    routes: {
      upload:                "POST /api/upload",
      uploadGrouped:         "POST /api/upload/grouped",
      generateTimesheet:     "POST /api/reports/generate-timesheet",
      billingSummaryJSON:    "POST /api/reports/billing-summary",
      billingSummaryExcel:   "POST /api/reports/generate-billing-summary",
      downloadReport:        "GET  /api/reports/download/:filename",
      getClientSheetConfig:  "GET  /api/config/client-sheets",
      saveClientSheetConfig: "POST /api/config/client-sheets",
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📂 Uploads:          ${path.join(__dirname, "uploads")}`);
  console.log(`📊 Reports:          ${path.join(__dirname, "generated-reports")}`);
  console.log(`⚙️  Config:           ${path.join(__dirname, "config")}`);
});