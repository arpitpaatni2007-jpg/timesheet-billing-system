// services/timesheetGrouper.js
// This file takes a flat list of CSV rows and groups them
// by Client → Project → Module → Task → Employee

/**
 * STEP 1: Extract the Client Name from the Project Name.
 *
 * In many timesheets, the Project Name looks like:
 *   "ClientName - ProjectDescription"
 * We split by " - " and take the first part as the Client name.
 *
 * If there's no " - " in the name, we use the whole project name as the client.
 */
function extractClientName(projectName) {
  if (!projectName) return "Unknown Client"; // safety check

  const parts = projectName.split(" - "); // split on " - "
  if (parts.length >= 2) {
    return parts[0].trim(); // first part = client name
  }

  return projectName.trim(); // fallback: use full project name
}

/**
 * STEP 2: Main grouping function.
 *
 * Takes an array of row objects (from csvProcessor.js)
 * and returns a deeply nested grouped structure.
 *
 * Each row is expected to have these fields (adjust to match your CSV headers):
 *   - Project Name
 *   - Task List Name  (or Module)
 *   - Task Name
 *   - User Name       (Employee)
 *   - Hours           (number of hours worked)
 *   - Date            (optional, kept for reference)
 */
function groupByClient(rows) {
  const clients = {}; // this will hold everything, keyed by client name

  rows.forEach((row) => {
    // --- Extract fields from each CSV row ---
    // NOTE: Change these keys to exactly match your CSV column headers!
   const projectName = row.projectName || "Unknown Project";

const moduleName = row.taskModule || "Unspecified Module";

const taskName = row.taskName || "Unspecified Task";

const employeeName = row.user || "Unknown Employee";

const date = row.date || "";

const hours = Number(row.hoursForBilling || 0);
    // Skip rows with 0 or missing hours
    if (!hours || isNaN(hours)) return;

    // --- Extract client name from project name ---
    const clientName = extractClientName(projectName);

    // --- Build nested structure: clients → projects → modules → tasks → employees ---

    // Level 1: Client
    if (!clients[clientName]) {
      clients[clientName] = {
        clientName: clientName,
        totalHours: 0,   // will accumulate
        projects: {}
      };
    }

    // Level 2: Project
    if (!clients[clientName].projects[projectName]) {
      clients[clientName].projects[projectName] = {
        projectName: projectName,
        totalHours: 0,
        modules: {}
      };
    }

    // Level 3: Module (Task List)
    const project = clients[clientName].projects[projectName];
    if (!project.modules[moduleName]) {
      project.modules[moduleName] = {
        moduleName: moduleName,
        totalHours: 0,
        tasks: {}
      };
    }

    // Level 4: Task
    const module = project.modules[moduleName];
    if (!module.tasks[taskName]) {
      module.tasks[taskName] = {
        taskName: taskName,
        totalHours: 0,
        employees: {}
      };
    }

    // Level 5: Employee
    const task = module.tasks[taskName];
    if (!task.employees[employeeName]) {
      task.employees[employeeName] = {
        employeeName: employeeName,
        totalHours: 0,
        entries: []  // optional: keep individual date-level entries
      };
    }

    // --- Add hours at every level ---
    task.employees[employeeName].totalHours += hours;

    // Store every field that excelGenerator writes into a data row.
    // Previously only { date, hours } were kept here, which caused
    // Project ID, Task/Bug ID, Billing Type, Notes, Created Time, Type,
    // Project Group, and Milestone to appear blank in the Excel output.
    // These fields are all present on the clean row from csvProcessor.js.
    // The grouping keys (projectName, moduleName, taskName, employeeName)
    // are NOT stored here — excelGenerator reads those from the parent
    // objects in the hierarchy, not from individual entries.
    task.employees[employeeName].entries.push({
      date,                                     // G  Date
      hours,                                    // H  Hours (For Calculation)
      projectId   : row.projectId    || "",     // B  Project ID
      taskId      : row.taskId       || "",     // E  Task / Bug ID
      billingType : row.billingType  || "",     // I  Billing Type
      notes       : row.notes        || "",     // J  Notes
      createdTime : row.createdTime  || "",     // K  Created Time
      taskType    : row.taskType     || "",     // L  Type
      projectGroup: row.projectGroup || "",     // M  Project Group
      milestone   : row.milestone    || "",     // N  Milestone
    });

    task.totalHours     += hours;
    module.totalHours   += hours;
    project.totalHours  += hours;
    clients[clientName].totalHours += hours;
  });

  // --- STEP 3: Convert nested objects to arrays for cleaner JSON output ---
  // Objects with string keys are hard to loop in frontend/Excel later.
  // Arrays are much easier to work with.
  return convertToArrayFormat(clients);
}

/**
 * STEP 3: Convert all nested objects (keyed by name) into arrays.
 * This makes the output easier to use in Excel generation later.
 */
function convertToArrayFormat(clients) {
  return Object.values(clients).map((client) => {
    return {
      clientName: client.clientName,
      totalHours: roundHours(client.totalHours),

      projects: Object.values(client.projects).map((project) => {
        return {
          projectName: project.projectName,
          totalHours: roundHours(project.totalHours),

          modules: Object.values(project.modules).map((mod) => {
            return {
              moduleName: mod.moduleName,
              totalHours: roundHours(mod.totalHours),

              tasks: Object.values(mod.tasks).map((task) => {
                return {
                  taskName: task.taskName,
                  totalHours: roundHours(task.totalHours),

                  employees: Object.values(task.employees).map((emp) => {
                    return {
                      employeeName: emp.employeeName,
                      totalHours: roundHours(emp.totalHours),
                      entries: emp.entries  // individual date-level rows
                    };
                  })
                };
              })
            };
          })
        };
      })
    };
  });
}

/**
 * Helper: Round hours to 2 decimal places.
 * Avoids floating-point weirdness like 2.3000000000000003
 */
function roundHours(hours) {
  return Math.round(hours * 100) / 100;
}

// Export so other files can use it
module.exports = { groupByClient };