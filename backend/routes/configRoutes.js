// routes/configRoutes.js
// Registers the two config endpoints under /api/config

const express = require("express");
const router  = express.Router();
const { getClientSheetConfig, saveClientSheetConfig } = require("../controllers/configController");

// GET  /api/config/client-sheets  — returns current config
router.get("/client-sheets", getClientSheetConfig);

// POST /api/config/client-sheets  — saves new config
// Body: { "separateSheets": ["Client-A", "Client-D"] }
router.post("/client-sheets", saveClientSheetConfig);

module.exports = router;