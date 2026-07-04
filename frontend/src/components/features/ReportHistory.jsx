// ── features/ReportHistory.jsx ────────────────────────────────────────────────
// Shows a table of recently generated Excel reports.
// Data persists in localStorage via useReports hook.
// Props:
//   history       — array of report objects from getHistory()
//   onDownload    — fn(filename) — triggers a backend re-download

import React from "react";
import { History, Download, Trash2 } from "lucide-react";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import { formatBytes, formatDate, truncate } from "../../lib/utils";

const HISTORY_KEY = "billing_report_history";

const ReportHistory = ({ onDownload }) => {
  // Read history from localStorage directly — re-renders when key changes
  const [history, setHistory] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // Clear one entry
  const removeEntry = (id) => {
    const updated = history.filter(r => r.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  // Clear all history
  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  // Listen for storage changes (if multiple tabs open)
  React.useEffect(() => {
    const onStorage = () => {
      try {
        setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Re-read history when component is rendered after a new download
  // (the hook writes to localStorage; we need to refresh state)
  React.useEffect(() => {
    const interval = setInterval(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        // Only update if something changed (compare lengths)
        setHistory(prev => prev.length !== stored.length ? stored : prev);
      } catch { /* ignore */ }
    }, 1000); // Poll every second (lightweight since it's just localStorage)
    return () => clearInterval(interval);
  }, []);

  return (
    <section style={{
      background:   "var(--bg-surface)",
      border:       "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      overflow:     "hidden", // Clip the table's bottom corners
    }}>
      {/* Panel header */}
      <div style={{
        padding:     "18px 24px",
        borderBottom: history.length > 0 ? "1px solid var(--border-subtle)" : "none",
        display:     "flex",
        alignItems:  "center",
        justifyContent: "space-between",
        gap:         "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "var(--radius-sm)",
            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-secondary)",
          }}>
            <History size={14} strokeWidth={2} />
          </div>
          <div>
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
              Recent Reports
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              {history.length} report{history.length !== 1 ? "s" : ""} generated
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: "12px", color: "var(--text-tertiary)", padding: "4px 8px",
              borderRadius: "4px", transition: "color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--error)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Empty state */}
      {history.length === 0 && (
        <EmptyState
          icon={History}
          title="No reports yet"
          description="Generated reports will appear here after your first download."
        />
      )}

      {/* Table */}
      {history.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width:          "100%",
            borderCollapse: "collapse",
            fontSize:       "13px",
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Filename", "Source files", "Generated", "Size", ""].map(col => (
                  <th key={col} style={{
                    padding:       "10px 16px",
                    textAlign:     "left",
                    fontWeight:    "500",
                    fontSize:      "11px",
                    color:         "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    whiteSpace:    "nowrap",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((report, i) => (
                <tr
                  key={report.id}
                  style={{
                    borderBottom: i < history.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    transition:   "background 0.1s ease",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {/* Filename */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Badge variant="success">XLSX</Badge>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "12px",
                        color: "var(--text-primary)",
                      }}>
                        {truncate(report.filename, 30)}
                      </span>
                    </div>
                  </td>

                  {/* Source files */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {truncate(report.employeeFile, 24)}
                      </span>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
  {report.managerFile
    ? truncate(report.managerFile, 24)
    : "No manager file"}
</span>
                    </div>
                  </td>

                  {/* Timestamp */}
                  <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "12px",
                      color: "var(--text-secondary)",
                    }}>
                      {formatDate(report.generatedAt)}
                    </span>
                  </td>

                  {/* Size */}
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "12px",
                      color: "var(--text-tertiary)",
                    }}>
                      {formatBytes(report.size)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {onDownload && (
                        <button
                          onClick={() => onDownload(report.filename)}
                          title="Re-download"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "4px", padding: "4px 8px",
                            cursor: "pointer", color: "var(--text-secondary)",
                            display: "flex", alignItems: "center", gap: "4px",
                            fontSize: "12px", transition: "all 0.15s ease",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                        >
                          <Download size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => removeEntry(report.id)}
                        title="Remove"
                        style={{
                          background: "transparent", border: "none",
                          borderRadius: "4px", padding: "4px",
                          cursor: "pointer", color: "var(--text-tertiary)",
                          display: "flex", alignItems: "center",
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--error)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ReportHistory;
