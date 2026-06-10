// ── features/ClientSheetConfig.jsx ───────────────────────────────────────────
// Lets the user choose which clients get their own sheet vs "Other Clients".
//
// Behaviour:
//   • On mount: loads saved config + detects clients from the last billing summary
//   • Checkboxes: one per detected client — tick = own sheet, untick = Other Clients
//   • Save: POSTs to /api/config/client-sheets and shows a success toast
//   • If no billing summary data yet, shows a short hint
//   • Config persists on the server; auto-applied on next workbook generation

import React, { useState, useEffect, useCallback } from "react";
import { Settings, Save, Info } from "lucide-react";
import toast from "react-hot-toast";
import { getClientSheetConfig, saveClientSheetConfig } from "../../api/reports";

const ClientSheetConfig = ({ summaryData }) => {
  const [allClients,      setAllClients]      = useState([]); // from summaryData
  const [selectedClients, setSelectedClients] = useState([]); // will get own sheet
  const [isSaving,        setIsSaving]        = useState(false);
  const [isLoaded,        setIsLoaded]        = useState(false);
  const [isExpanded,      setIsExpanded]      = useState(false); // collapsible

  // ── Derive client list from summaryData ──────────────────────────────────
  useEffect(() => {
    if (!summaryData) return;
    const clients = summaryData?.summary?.clients || summaryData?.clients || [];
    const names   = clients.map(c => c.clientName).filter(Boolean).sort();
    setAllClients(names);
  }, [summaryData]);

  // ── Load saved config from backend on first mount ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    getClientSheetConfig()
      .then(data => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.separateSheets)) {
          setSelectedClients(data.separateSheets);
        }
        setIsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true); // fail silently — UI still usable
      });
    return () => { cancelled = true; };
  }, []);

  // ── Toggle a client checkbox ──────────────────────────────────────────────
  const handleToggle = useCallback((clientName) => {
    setSelectedClients(prev =>
      prev.includes(clientName)
        ? prev.filter(c => c !== clientName)
        : [...prev, clientName]
    );
  }, []);

  // ── Select all / clear all ────────────────────────────────────────────────
  const handleSelectAll = useCallback(() => setSelectedClients([...allClients]), [allClients]);
  const handleClearAll  = useCallback(() => setSelectedClients([]),              []);

  // ── Save config ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const toastId = toast.loading("Saving preferences...");
    try {
      const result = await saveClientSheetConfig(selectedClients);
      if (result.success) {
        toast.success(result.message || "Preferences saved!", { id: toastId });
      } else {
        toast.error(result.error || "Save failed.", { id: toastId });
      }
    } catch (err) {
      toast.error(`Save failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }, [selectedClients]);

  // ── Derived state for the summary label ───────────────────────────────────
  const uncheckedCount = allClients.length - selectedClients.filter(c => allClients.includes(c)).length;
  const summaryLabel   = allClients.length === 0
    ? "Generate a summary first to detect clients"
    : selectedClients.length === 0
    ? "All clients → individual sheets"
    : uncheckedCount === 0
    ? "All clients → individual sheets"
    : `${selectedClients.length} own sheet${selectedClients.length !== 1 ? "s" : ""}, ${uncheckedCount} → Other Clients`;

  return (
    <section style={{
      background:   "var(--bg-surface)",
      border:       "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding:      "20px 24px",
    }}>
      {/* ── Header row (clickable to expand/collapse) ─────────────────────── */}
      <button
        onClick={() => setIsExpanded(e => !e)}
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          width:          "100%",
          background:     "none",
          border:         "none",
          cursor:         "pointer",
          padding:        0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Settings size={14} color="var(--text-secondary)" />
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", margin: 0 }}>
            Client Sheet Config
          </h2>
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
          {isExpanded ? "▲ hide" : "▼ show"}
        </span>
      </button>

      {/* ── Summary line (always visible) ────────────────────────────────── */}
      <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px", marginBottom: 0 }}>
        {summaryLabel}
      </p>

      {/* ── Expanded content ─────────────────────────────────────────────── */}
      {isExpanded && (
        <div style={{ marginTop: "16px" }}>

          {/* Info banner */}
          <div style={{
            display:      "flex",
            gap:          "8px",
            padding:      "8px 12px",
            background:   "var(--bg-subtle, #f8f9fa)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "14px",
          }}>
            <Info size={13} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: 0, lineHeight: "1.5" }}>
              Checked clients get their own sheet. Unchecked clients share an <strong>"Other Clients"</strong> sheet.
              Leaving all unchecked gives every client its own sheet (default).
            </p>
          </div>

          {allClients.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-tertiary)", fontStyle: "italic" }}>
              No clients detected yet. Click <strong>Generate Summary</strong> first.
            </p>
          ) : (
            <>
              {/* Select all / clear all */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
                <button
                  onClick={handleSelectAll}
                  style={{ fontSize: "12px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Select all
                </button>
                <button
                  onClick={handleClearAll}
                  style={{ fontSize: "12px", color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Clear all
                </button>
              </div>

              {/* Client checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                {allClients.map(clientName => (
                  <label
                    key={clientName}
                    style={{
                      display:    "flex",
                      alignItems: "center",
                      gap:        "8px",
                      cursor:     "pointer",
                      fontSize:   "13px",
                      color:      "var(--text-primary)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(clientName)}
                      onChange={() => handleToggle(clientName)}
                      style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--accent)" }}
                    />
                    {clientName}
                    {!selectedClients.includes(clientName) && (
                      <span style={{
                        fontSize:     "10px",
                        color:        "var(--text-tertiary)",
                        background:   "var(--bg-subtle, #f0f0f0)",
                        borderRadius: "3px",
                        padding:      "1px 5px",
                      }}>
                        → Other Clients
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "6px",
                  padding:        "8px 16px",
                  background:     isSaving ? "var(--text-tertiary)" : "var(--accent)",
                  color:          "#fff",
                  border:         "none",
                  borderRadius:   "var(--radius-sm)",
                  fontSize:       "13px",
                  fontWeight:     "600",
                  cursor:         isSaving ? "default" : "pointer",
                }}
              >
                <Save size={13} />
                {isSaving ? "Saving…" : "Save Preferences"}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default ClientSheetConfig;