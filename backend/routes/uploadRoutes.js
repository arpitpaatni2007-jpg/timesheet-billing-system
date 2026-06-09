// routes/uploadRoutes.js
// Defines the URL paths (routes) for file upload

const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");

// Import BOTH controllers
const { uploadFile, uploadAndGroup } = require("../controllers/uploadController");

// Configure multer: where to save files and what to name them
const storage = multer.diskStorage({
 destination: function (req, file, cb) {
  cb(null, path.join(__dirname, "../uploads"));
},
  filename: function (req, file, cb) {
    // Give each file a unique name using timestamp
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

// Only allow .csv files
const fileFilter = (req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() === ".csv") {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

const upload = multer({ storage, fileFilter });

// EXISTING route (Phase 3): raw parsed data
// POST /api/upload
router.post("/", upload.single("file"), uploadFile);

// NEW route (Phase 4): grouped client-wise data
// POST /api/upload/grouped
router.post("/grouped", upload.single("file"), uploadAndGroup);

module.exports = router;