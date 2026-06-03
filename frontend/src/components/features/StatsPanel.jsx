// ── features/StatsPanel.jsx ───────────────────────────────────────────────────
// Renders 4 StatCards from the billing summary JSON response.
// Only shown once summaryData is available (not null).
// Props:
//   summaryData — the full response object from getBillingSummary()
//   isLoading   — shows skeleton state while generating

import React from "react";
import { Building2, Clock, Users, DollarSign } from "lucide-react";
import StatCard from "../ui/StatCard";
import { formatHours } from "../../lib/utils";

// ── Skeleton card while loading ───────────────────────────────────────────────
const SkeletonCard = () => (
  <div style={{
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding:      "20px 22px",
    height:       "104px",
    overflow:     "hidden",
  }}>
    {/* Shimmer effect using CSS animation from globals.css */}
    {[40, 80, 50].map((w, i) => (
      <div key={i} style={{
        height:     "12px",
        width:      `${w}%`,
        borderRadius: "4px",
        background:  "linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)",
        backgroundSize: "400px 100%",
        animation:  "shimmer 1.4s ease infinite",
        marginBottom: i < 2 ? "10px" : 0,
      }} />
    ))}
  </div>
);

const StatsPanel = ({ summaryData, isLoading }) => {
  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section>
        <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)",
                     marginBottom: "16px" }}>
          Summary Statistics
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}>
          {[1, 2, 3, 4].map(n => <SkeletonCard key={n} />)}
        </div>
      </section>
    );
  }

  // ── No data yet ──────────────────────────────────────────────────────────
  if (!summaryData) return null;

  // Extract from the summary object — adjust key names to match your backend response
const s = summaryData || {};
const summary = s.summary || {};
const grandTotal = s.grandTotal || {};
const stats = [
  {
    label: "Total Clients",
    value: s.totalClients ?? grandTotal.totalClients ?? "—",
    icon: Building2,
    accent: false,
    cls: "fade-up-1",
  },
  {
    label: "Manager Hours",
    value: formatHours(
      grandTotal.totalManagerHours ??
      summary.totalManagerHours ??
      0
    ),
    icon: Users,
    accent: false,
    cls: "fade-up-2",
  },
  {
    label: "Employee Hours",
    value: formatHours(
      grandTotal.totalEmployeeHours ??
      summary.totalEmployeeHours ??
      0
    ),
    icon: Clock,
    accent: false,
    cls: "fade-up-3",
  },
  {
    label: "Total Billable",
    value: formatHours(
      grandTotal.totalBillableHours ??
      summary.totalBillableHours ??
      0
    ),
    icon: DollarSign,
    accent: true,
    cls: "fade-up-4",
  },
];
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: "16px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
          Summary Statistics
        </h2>
        <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          {summaryData?.validRows ?? ""} entries processed
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
      }}>
        {stats.map(({ label, value, icon, accent, cls }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            accent={accent}
            className={cls}
          />
        ))}
      </div>

      {/* Employees breakdown strip
      {s.employees && s.employees.length > 0 && (
        <div style={{
          marginTop:    "12px",
          padding:      "12px 16px",
          background:   "var(--bg-surface)",
          border:       "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          display:      "flex",
          alignItems:   "center",
          gap:          "10px",
          flexWrap:     "wrap",
          animation:    "fadeUp 0.4s 0.25s ease both",
        }}>
          <span style={{ fontSize: "12px", color: "var(--text-tertiary)",
                         textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: "500" }}>
            Employees
          </span>
          {s.employees.map(name => (
            <span key={name} style={{
              padding: "2px 10px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "4px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}>
              {name}
            </span>
          ))}
        </div>
      )} */}
    </section>
  );
};

export default StatsPanel;
