import axios from "axios";

const API_BASE = "http://localhost:5001/api/reports";

export const getBillingSummary = async (
  timesheetFile,
  managerFile,
  reportMonth
) => {
  const formData = new FormData();

  formData.append("timesheetCsv", timesheetFile);
  formData.append("managerReport", managerFile);

  if (reportMonth) {
    formData.append("reportMonth", reportMonth);
  }

  const response = await axios.post(
    `${API_BASE}/billing-summary`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const generateBillingSummaryExcel = async (
  timesheetFile,
  managerFile,
  reportMonth
) => {
  const formData = new FormData();

  formData.append("timesheetCsv", timesheetFile);
  formData.append("managerReport", managerFile);

  if (reportMonth) {
    formData.append("reportMonth", reportMonth);
  }

  const response = await axios.post(
    `${API_BASE}/generate-billing-summary`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const downloadReport = (fileName) => {
  return `${API_BASE}/download/${encodeURIComponent(fileName)}`;
};

export const triggerBrowserDownload = (fileName) => {
  const link = document.createElement("a");
  link.href = downloadReport(fileName);
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};