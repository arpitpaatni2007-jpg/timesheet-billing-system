// ── features/FileInput.jsx ────────────────────────────────────────────────────
// Drag-and-drop file input with visual states: idle, drag-over, file-selected.
// Uses react-dropzone under the hood.
// Props:
//   label     — "Employee Timesheet CSV"
//   accept    — { "text/csv": [".csv"] } or { "application/vnd.openxmlformats...": [".xlsx"] }
//   file      — currently selected File object or null
//   onChange  — fn(File) — called when user drops or selects a file
//   onClear   — fn() — called when user clicks the X button

import React from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X, FileText, FileSpreadsheet } from "lucide-react";
import { formatBytes } from "../../lib/utils";

const FileInput = ({ label, accept, file, onChange, onClear, description }) => {
  // useDropzone returns props to spread on the drop target div
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple: false,          // Only one file at a time
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) onChange(acceptedFiles[0]); // Pass the File to parent
    },
  });

  // Decide which icon to show based on file type
  const acceptsCSV   = Object.keys(accept || {}).some(k => k.includes("csv"));
  const FileIcon     = acceptsCSV ? FileText : FileSpreadsheet;
  const accentColor  = acceptsCSV ? "var(--info)" : "var(--success)";
  const accentDim    = acceptsCSV ? "var(--info-dim)" : "var(--success-dim)";

  // ── File already selected — show filename card ────────────────────────────
  if (file) {
    return (
      <div style={{
        background:   "var(--bg-elevated)",
        border:       `1px solid var(--border-default)`,
        borderRadius: "var(--radius-md)",
        padding:      "16px",
      }}>
        {/* Label above */}
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "10px",
                    textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: "500" }}>
          {label}
        </p>

        {/* File info row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "38px", height: "38px",
            borderRadius: "var(--radius-sm)",
            background: accentDim,
            border: `1px solid ${accentColor}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: accentColor, flexShrink: 0,
          }}>
            <FileIcon size={18} strokeWidth={1.5} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: "13px", fontWeight: "500", color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {file.name}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {formatBytes(file.size)}
            </p>
          </div>

          {/* Clear button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            title="Remove file"
            style={{
              background: "var(--bg-hover)", border: "1px solid var(--border-subtle)",
              borderRadius: "4px", padding: "4px", color: "var(--text-tertiary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--error)"; e.currentTarget.style.borderColor = "var(--error)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── No file yet — show the drop zone ─────────────────────────────────────
  return (
    <div
      {...getRootProps()} // Spreads onClick, onDragOver, etc.
      style={{
        background:   isDragActive ? accentDim : "var(--bg-elevated)",
        border:       `1px dashed ${isDragActive ? accentColor : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        padding:      "28px 20px",
        textAlign:    "center",
        cursor:       "pointer",
        transition:   "all 0.2s ease",
        outline:      "none",
        animation:    isDragActive ? "pulse-border 1s ease infinite" : "none",
      }}
    >
      <input {...getInputProps()} /> {/* Hidden native file input */}

      <div style={{
        width: "40px", height: "40px", borderRadius: "var(--radius-sm)",
        background: isDragActive ? accentDim : "var(--bg-hover)",
        border: `1px solid ${isDragActive ? accentColor : "var(--border-subtle)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isDragActive ? accentColor : "var(--text-tertiary)",
        margin: "0 auto 12px",
        transition: "all 0.2s ease",
      }}>
        <UploadCloud size={20} strokeWidth={1.5} />
      </div>

      <p style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "6px" }}>
        {label}
      </p>

      <p style={{ fontSize: "13px", color: isDragActive ? accentColor : "var(--text-secondary)" }}>
        {isDragActive ? "Drop it here" : "Drag & drop or click to browse"}
      </p>

      {description && (
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
          {description}
        </p>
      )}
    </div>
  );
};

export default FileInput;
