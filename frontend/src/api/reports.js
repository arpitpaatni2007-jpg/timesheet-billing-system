import axios from "axios";

const API_BASE        = "http://localhost:5001/api/reports";
const API_CONFIG_BASE = "http://localhost:5001/api/config";

// ── Existing report API functions (unchanged) ─────────────────────────────────

export const getBillingSummary = async (timesheetFile, managerFile, reportMonth) => {
  const formData = new FormData();
  formData.append("timesheetCsv",  timesheetFile);
  formData.append("managerReport", managerFile);
  if (reportMonth) formData.append("reportMonth", reportMonth);

  const response = await axios.post(`${API_BASE}/billing-summary`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const generateBillingSummaryExcel = async (timesheetFile, managerFile, reportMonth) => {
  const formData = new FormData();
  formData.append("timesheetCsv",  timesheetFile);
  formData.append("managerReport", managerFile);
  if (reportMonth) formData.append("reportMonth", reportMonth);

  const response = await axios.post(`${API_BASE}/generate-billing-summary`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const downloadReport = (fileName) => {
  return `${API_BASE}/download/${encodeURIComponent(fileName)}`;
};

export const triggerBrowserDownload = (fileName) => {
  const link    = document.createElement("a");
  link.href     = downloadReport(fileName);
  link.target   = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ── NEW: Config API functions ─────────────────────────────────────────────────

/**
 * Fetch the current client sheet configuration.
 * Returns: { success: true, separateSheets: ["Client-A", "Client-D"] }
 */
export const getClientSheetConfig = async () => {
  const response = await axios.get(`${API_CONFIG_BASE}/client-sheets`);
  return response.data;
};

/**
 * Save a new client sheet configuration.
 * @param {string[]} separateSheets — list of client names that get individual sheets
 * Returns: { success: true, separateSheets: [...], message: "..." }
 */
export const saveClientSheetConfig = async (separateSheets) => {
  const response = await axios.post(
    `${API_CONFIG_BASE}/client-sheets`,
    { separateSheets },
    { headers: { "Content-Type": "application/json" } }
  );
  return response.data;
};