// ── features/UploadZone.jsx ───────────────────────────────────────────────────
// Renders two FileInput components side by side:
//   Left:  Employee CSV
//   Right: Manager XLSX
// Props come from the parent Dashboard which owns useUpload() state.

import React from "react";
import { Upload } from "lucide-react";
import FileInput from "./FileInput";

// MIME types accepted by the Employee input (CSV or XLSX — backend now handles both)
const CSV_ACCEPT = {
  "text/csv":        [".csv"],
  "application/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
};

// MIME types accepted by the Manager input (XLSX or CSV — backend now handles both)
const MANAGER_ACCEPT = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv":        [".csv"],
  "application/csv": [".csv"],
};

const UploadZone = ({
  employeeFile, managerFile,
  setEmployeeFile, setManagerFile,
}) => (
  <section style={{
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding:      "24px",
  }}>
    {/* Section header */}
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
      <div style={{
        width: "30px", height: "30px", borderRadius: "var(--radius-sm)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-secondary)",
      }}>
        <Upload size={14} strokeWidth={2} />
      </div>
      <div>
        <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
          Upload Files
        </h2>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          Both files required to generate billing reports
        </p>
      </div>
    </div>

    {/* Two drop zones */}
    <div style={{
      display:             "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap:                 "16px",
    }}>
      <FileInput
        label="Employee Timesheet"
        description=".CSV / .XLSX format"
        accept={CSV_ACCEPT}
        file={employeeFile}
        onChange={setEmployeeFile}
        onClear={() => setEmployeeFile(null)}
      />
      <FileInput
        label="Manager Hours"
        description=".CSV / .XLSX format"
        accept={MANAGER_ACCEPT}
        file={managerFile}
        onChange={setManagerFile}
        onClear={() => setManagerFile(null)}
      />
    </div>

    {/* Progress indicator below inputs */}
    <div style={{
      marginTop:   "16px",
      display:     "flex",
      alignItems:  "center",
      gap:         "8px",
    }}>
      {/* Dot 1 */}
      <div style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: employeeFile ? "var(--success)" : "var(--border-default)",
        transition: "background 0.3s ease",
      }} />
      <div style={{
        flex: 1, height: "1px",
        background: (employeeFile && managerFile) ? "var(--success)" : "var(--border-subtle)",
        transition: "background 0.3s ease",
      }} />
      {/* Dot 2 */}
      <div style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: managerFile ? "var(--success)" : "var(--border-default)",
        transition: "background 0.3s ease",
      }} />

      <span style={{ fontSize: "12px", color: "var(--text-tertiary)", marginLeft: "4px" }}>
        {!employeeFile && !managerFile && "No files selected"}
        {employeeFile && !managerFile && "1 of 2 — add manager CSV or XLSX"}
        {!employeeFile && managerFile && "1 of 2 — add employee CSV"}
        {employeeFile && managerFile && "Both files ready ✓"}
      </span>
    </div>
  </section>
);

export default UploadZone;