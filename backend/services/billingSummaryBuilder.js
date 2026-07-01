// services/billingSummaryBuilder.js
//
// PURPOSE: Merge employee timesheet data (from Phase 4 grouper)
// with manager effort data (from managerReportParser) to produce
// a clean billing summary JSON per client.
//
// OUTPUT STRUCTURE per client:
// {
//   clientName: "Client-D",
//   reportPeriod: "May 2026",
//   managerName: "Manager X",
//   managerHours: 4.71,
//   employeeHours: 74.0,
//   totalHours: 78.71,
//   projects: [
//     {
//       projectName: "Client-D - Gov-Agency 941",
//       managerHours: 4.71,
//       employeeBreakdown: [
//         { employeeName: "Employee C", hours: 74.0 }
//       ],
//       totalHours: 78.71,
//       workSummary: ["integrating new xsd...", "debugging..."]
//     }
//   ],
//   managerEntries: [
//     { description: "...", category: "...", hours: 1.0, date: "2026-05-04" }
//   ]
// }

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Normalize a name for fuzzy matching
// Removes extra spaces, lowercases — so "Client-D" matches "client-d"
// ─────────────────────────────────────────────────────────────────────────────
function normalizeName(name) {
  return (name || "").toString().toLowerCase().trim().replace(/\s+/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Check if a project belongs to a client
//
// Employee timesheets have full project names like "Client-D - Gov-Agency 941"
// Manager data has client names like "Client-D"
// We match by checking if the project name CONTAINS the client name
// ─────────────────────────────────────────────────────────────────────────────
function projectBelongsToClient(projectName, clientName) {
  const proj   = normalizeName(projectName);
  const client = normalizeName(clientName);
  return proj.includes(client) || client.includes(proj);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Build the Work Summary / Comments text for one project row
//         in the Monthly Billing Summary sheet.
//
// PREVIOUS LOGIC (weak):
//   Collected up to 5 unique task *names* from the project hierarchy.
//   Ignored the actual daily notes employees wrote on each log entry.
//   Result: showed task titles like "New report - Requirement collection"
//   instead of what was actually done.
//
// NEW LOGIC:
//   Reads entry.notes — the free-text comments employees write per log entry.
//   Groups them under their task name so the manager can see what was done
//   on each task without the comment being out of context.
//   Falls back to the task name alone if no note was written for a task.
//
// OUTPUT FORMAT (one line per task that had meaningful work):
//   "Task Name: note1; note2; note3. Task Name 2: note4."
//
// RULES:
//   1. Only reads entry.notes (the actual daily comment field from the CSV).
//   2. Skips blank/dash/generic notes that add no information.
//   3. Deduplicates: same note text for the same task only appears once.
//   4. Groups notes under their task name for readability.
//   5. If a task has no useful notes, falls back to just the task name.
//   6. Skips tasks named "Unspecified Task".
//   7. Hard cap: total output ≤ 500 characters so the Excel cell stays usable.
//   8. Each task group ends with ". " as sentence separator.
// ─────────────────────────────────────────────────────────────────────────────
function extractWorkSummary(project) {

  // Noise values that add no information — filter these out
  const SKIP_NOTES = new Set(["-", "—", "n/a", "na", "none", "nil", ".", ".."]);

  // Per-task map: { taskName: Set<note> }
  // We use a Map to preserve task iteration order (module → task order)
  const taskNotes = new Map();

  for (const mod of (project.modules || [])) {
    for (const task of (mod.tasks || [])) {
      const taskName = (task.taskName || "").trim();

      // Skip placeholder task names
      if (!taskName || taskName === "Unspecified Task") continue;

      if (!taskNotes.has(taskName)) {
        taskNotes.set(taskName, new Set());
      }

      // Walk every employee's log entries for this task
      for (const emp of (task.employees || [])) {
        for (const entry of (emp.entries || [])) {
          const raw  = (entry.notes || "").trim();
          const note = raw.replace(/\s+/g, " ");   // collapse internal whitespace

          // Skip blank, single-char, or known-noise values
          if (!note || note.length < 3) continue;
          if (SKIP_NOTES.has(note.toLowerCase())) continue;

          taskNotes.get(taskName).add(note);
        }
      }
    }
  }

  // Build one text segment per task
  const segments = [];

  for (const [taskName, notesSet] of taskNotes) {
    const notes = Array.from(notesSet);

    if (notes.length === 0) {
      // No useful notes found — use the task name alone as a fallback
      segments.push(taskName);
    } else {
      // Join notes for this task with semicolons
      // e.g. "API integration: Built endpoint; Fixed validation bug"
      segments.push(`${taskName}: ${notes.join("; ")}`);
    }
  }

  if (segments.length === 0) return [];

  // Join all task segments with ". " separator and enforce 500-char hard cap
  // so the Work Summary cell never overflows into an unreadable wall of text.
  // We truncate at a sentence boundary where possible (last ". " before limit).
  const CHAR_LIMIT = 500;
  let full = segments.join(". ");

  if (full.length <= CHAR_LIMIT) {
    // Return as a single-element array — billingSummaryExcelGenerator joins with ", "
    // but since we already built a single formatted string, this is intentional.
    return [full];
  }

  // Truncate: find the last ". " boundary before the limit
  const truncated = full.slice(0, CHAR_LIMIT);
  const lastDot   = truncated.lastIndexOf(". ");
  const cutAt     = lastDot > 50 ? lastDot + 1 : CHAR_LIMIT; // keep at least 50 chars
  return [full.slice(0, cutAt).trimEnd() + "…"];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Get per-employee hour breakdown from a project
// Returns: [ { employeeName: "Employee C", hours: 74.0 }, ... ]
// ─────────────────────────────────────────────────────────────────────────────
function getEmployeeBreakdown(project) {
  const empMap = {}; // { "Employee C": 74.0 }

  for (const mod of (project.modules || [])) {
    for (const task of (mod.tasks || [])) {
      for (const emp of (task.employees || [])) {
        const name  = emp.employeeName || "Unknown";
        empMap[name] = roundHours((empMap[name] || 0) + emp.totalHours);
      }
    }
  }

  // Convert to array, sorted by hours descending
  return Object.entries(empMap)
    .map(([employeeName, hours]) => ({ employeeName, hours }))
    .sort((a, b) => b.hours - a.hours);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION: buildBillingSummary
//
// @param {Array}  groupedData     - output of groupByClient() from Phase 4
//                                   Array of { clientName, totalHours, projects[] }
// @param {Object} managerReport   - output of parseManagerReport()
//                                   { managerName, clientSummary, clientEntries, ... }
// @param {String} reportPeriod    - e.g. "May 2026"
//
// @returns {Object} complete billing summary
// ─────────────────────────────────────────────────────────────────────────────
function buildBillingSummary(groupedData, managerReport, reportPeriod) {

  const {
    managerName      = "Manager",
    clientSummary    = {},  // { "Client-D": 4.71 }
    clientEntries    = [],  // individual manager entries per client
    unallocatedHours = 0,
    unallocatedEntries = []
  } = managerReport || {};

  // ── Step 1: Build a lookup of manager entries grouped by client ────────────
  // { "Client-D": [ { description, category, hours, date }, ... ] }
  const managerEntriesByClient = {};
  for (const entry of clientEntries) {
    const cn = entry.clientName;
    if (!managerEntriesByClient[cn]) managerEntriesByClient[cn] = [];
    managerEntriesByClient[cn].push({
      description     : entry.description,
      managerCategory : entry.managerCategory,
      hours           : entry.hours,
      date            : entry.date,
    });
  }

  // ── Step 2: Collect all client names from both sources ────────────────────
  // We want to include clients that appear in EITHER the timesheet OR manager data
  const allClientNames = new Set([
    ...groupedData.map(c => c.clientName),
    ...Object.keys(clientSummary),
  ]);

  // ── Step 3: Build per-client billing summary ───────────────────────────────
  const clientBillingSummaries = [];

  for (const clientName of allClientNames) {

    // Find this client in the employee grouped data (may not exist)
    const employeeClient = groupedData.find(
      c => normalizeName(c.clientName) === normalizeName(clientName)
    );

    // Manager hours for this client (0 if not in manager report)
    const managerHoursForClient = clientSummary[clientName] || 0;

    // Employee total hours for this client (0 if not in timesheet)
    const employeeHoursForClient = employeeClient
      ? roundHours(employeeClient.totalHours)
      : 0;

    const totalHours = roundHours(managerHoursForClient + employeeHoursForClient);

    // ── Build per-project breakdown ──────────────────────────────────────────
    const projectSummaries = [];
    if (employeeClient && employeeClient.projects) {
      for (const project of employeeClient.projects) {

        // Employee breakdown: who worked on this project and how many hours
        const employeeBreakdown = getEmployeeBreakdown(project);

        // ── CHANGE: Inject manager as an employee on the FIRST project only ──
        // Manager hours are tracked at client level (not per-project in the
        // manager's time report). We assign all of them to the first project
        // so the billing summary row shows the manager alongside employees.
        // On subsequent projects of the same client, manager hours = 0 (already spent).
        const isFirstProject = projectSummaries.length === 0;
        if (isFirstProject && managerHoursForClient > 0) {
          employeeBreakdown.push({
            employeeName : managerName,   // e.g. "Nishant Rajvanshi"
            hours        : roundHours(managerHoursForClient),
            isManager    : true,          // flag so Excel generator can apply gray fill
          });
        }
        // ── END CHANGE ──

        const projectTotalHours = roundHours(
          employeeBreakdown.reduce((s, e) => s + e.hours, 0)
        );

        const workSummaryTasks = extractWorkSummary(project);

        projectSummaries.push({
          projectName       : project.projectName,
          employeeHours     : roundHours(project.totalHours || 0),
          managerHours      : isFirstProject ? roundHours(managerHoursForClient) : 0,
          totalHours        : projectTotalHours,
          employeeBreakdown,
          modules           : project.modules.map(mod => ({
            moduleName  : mod.moduleName,
            totalHours  : mod.totalHours,
            tasks       : mod.tasks.map(task => ({
              taskName  : task.taskName,
              totalHours: task.totalHours,
              employees : task.employees,
            }))
          })),
          workSummary: workSummaryTasks,
        });
      }
    }

    // If manager has entries but NO employee timesheet projects exist for this
    // client, create a single manager-only row so hours are not lost
    if (projectSummaries.length === 0 && managerHoursForClient > 0) {
      projectSummaries.push({
        projectName       : `${clientName} – Manager Oversight`,
        employeeHours     : 0,
        managerHours      : roundHours(managerHoursForClient),
        totalHours        : roundHours(managerHoursForClient),
        employeeBreakdown : [{
          employeeName : managerName,
          hours        : roundHours(managerHoursForClient),
          isManager    : true,
        }],
        modules     : [],
        workSummary : [],
      });
    }
 
    

    // Add a special "Manager Effort" pseudo-project if manager has entries
    // but the client has no employee timesheet projects
    if (projectSummaries.length === 0 && managerHoursForClient > 0) {
      projectSummaries.push({
        projectName       : `${clientName} – Manager Oversight`,
        employeeHours     : 0,
        managerHours      : managerHoursForClient,
        totalHours        : managerHoursForClient,
        employeeBreakdown : [],
        modules           : [],
        workSummary       : [],
      });
    }

    // ── Build the client-level summary ────────────────────────────────────────
    clientBillingSummaries.push({
      clientName,
      reportPeriod,
      managerName,

      // Hours breakdown
      managerHours         : roundHours(managerHoursForClient),
      employeeHours        : roundHours(employeeHoursForClient),
      totalHours,

      // Per-project detail
      projects: projectSummaries,

      // Raw manager entries for this client (for audit/detail view)
      managerEntries: managerEntriesByClient[clientName] || [],

      // Manager entries grouped by category for reporting
      managerByCategory: groupManagerByCategory(
        managerEntriesByClient[clientName] || []
      ),
    });
  }

  // ── Step 4: Sort clients alphabetically ───────────────────────────────────
  clientBillingSummaries.sort((a, b) =>
    a.clientName.localeCompare(b.clientName)
  );

  // ── Step 5: Build grand totals ────────────────────────────────────────────
  const grandTotal = {
    totalManagerHours  : roundHours(
      clientBillingSummaries.reduce((s, c) => s + c.managerHours, 0)
    ),
    totalEmployeeHours : roundHours(
      clientBillingSummaries.reduce((s, c) => s + c.employeeHours, 0)
    ),
    totalBillableHours : roundHours(
      clientBillingSummaries.reduce((s, c) => s + c.totalHours, 0)
    ),
    unallocatedManagerHours : roundHours(unallocatedHours),
    totalClients       : clientBillingSummaries.length,
  };

  // ── Step 6: Return everything ──────────────────────────────────────────────
  return {
    reportPeriod,
    managerName,
    generatedAt  : new Date().toISOString(),
    grandTotal,
    clients      : clientBillingSummaries,
    // Unallocated manager entries (internal meetings, HR, etc.)
    unallocated  : {
      hours   : roundHours(unallocatedHours),
      entries : unallocatedEntries,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Group manager entries by their activity category
// Returns: [ { category: "Project Monitoring...", hours: 3.5, entryCount: 4 }, ... ]
// ─────────────────────────────────────────────────────────────────────────────
function groupManagerByCategory(entries) {
  const catMap = {};

  for (const entry of entries) {
    const cat = entry.managerCategory || "Uncategorized";
    if (!catMap[cat]) catMap[cat] = { category: cat, hours: 0, entryCount: 0 };
    catMap[cat].hours      = roundHours(catMap[cat].hours + entry.hours);
    catMap[cat].entryCount += 1;
  }

  return Object.values(catMap).sort((a, b) => b.hours - a.hours);
}

function roundHours(h) {
  return Math.round(h * 100) / 100;
}

module.exports = { buildBillingSummary };