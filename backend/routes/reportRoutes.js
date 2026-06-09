// routes/reportRoutes.js

const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");

const {
  generateTimesheet,
  downloadReport,
  generateBillingSummary,
  generateBillingSummaryExcelReport,  // Phase 7
} = require("../controllers/reportController");

const storage = multer.diskStorage({
destination: (req, file, cb) => {
  cb(null, path.join(__dirname, "../uploads"));
},
  filename    : (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".csv" || ext === ".xlsx") cb(null, true);
  else cb(new Error("Only .csv and .xlsx files are allowed."), false);
};

const upload = multer({ storage, fileFilter });

// ── Phase 5 ──────────────────────────────────────────────────────────────
router.post("/generate-timesheet", upload.single("file"), generateTimesheet);
router.get("/download/:filename",  downloadReport);

// ── Phase 6 ──────────────────────────────────────────────────────────────
router.post(
  "/billing-summary",
  upload.fields([
    { name: "timesheetCsv",  maxCount: 1 },
    { name: "managerReport", maxCount: 1 },
  ]),
  generateBillingSummary
);

// ── Phase 7 ──────────────────────────────────────────────────────────────
// POST /api/reports/generate-billing-summary
// Same two files as billing-summary, returns a downloadable .xlsx
router.post(
  "/generate-billing-summary",
  upload.fields([
    { name: "timesheetCsv",  maxCount: 1 },
    { name: "managerReport", maxCount: 1 },
  ]),
  generateBillingSummaryExcelReport
);

module.exports = router;