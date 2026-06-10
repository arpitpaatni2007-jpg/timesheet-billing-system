// controllers/configController.js
//
// Handles reading and writing of config/client-sheet-settings.json.
// This lets the frontend persist which clients get their own sheet.

const path = require("path");
const fs   = require("fs");

const CONFIG_PATH = path.join(__dirname, "../config/client-sheet-settings.json");

// Ensure the config directory and file exist
function ensureConfigExists() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ separateSheets: [] }, null, 2), "utf8");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/config/client-sheets
// Returns current config: { separateSheets: ["Client-A", "Client-D"] }
// ─────────────────────────────────────────────────────────────────────────────
const getClientSheetConfig = (req, res) => {
  try {
    ensureConfigExists();
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const cfg = JSON.parse(raw);
    return res.status(200).json({
      success        : true,
      separateSheets : Array.isArray(cfg.separateSheets) ? cfg.separateSheets : [],
    });
  } catch (error) {
    console.error("❌ getClientSheetConfig error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/config/client-sheets
// Body: { separateSheets: ["Client-A", "Client-D"] }
// Saves the array and returns it back.
// ─────────────────────────────────────────────────────────────────────────────
const saveClientSheetConfig = (req, res) => {
  try {
    ensureConfigExists();

    const { separateSheets } = req.body;

    // Validate: must be an array of strings
    if (!Array.isArray(separateSheets)) {
      return res.status(400).json({
        success : false,
        error   : '"separateSheets" must be an array of client name strings.',
      });
    }

    // Strip duplicates and empty strings
    const cleaned = [...new Set(
      separateSheets.map(s => String(s).trim()).filter(Boolean)
    )];

    const cfg = { separateSheets: cleaned };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");

    console.log(`✅ Client sheet config saved: [${cleaned.join(", ")}]`);

    return res.status(200).json({
      success        : true,
      separateSheets : cleaned,
      message        : `Config saved. ${cleaned.length === 0
        ? "All clients will get individual sheets."
        : `${cleaned.length} client(s) will get separate sheets; others → "Other Clients".`}`,
    });
  } catch (error) {
    console.error("❌ saveClientSheetConfig error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getClientSheetConfig, saveClientSheetConfig };