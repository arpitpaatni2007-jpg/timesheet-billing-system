// ── hooks/useUpload.js ────────────────────────────────────────────────────────
// Manages state for the two file inputs:
//   1. employeeFile — the CSV timesheet
//   2. managerFile  — the manager XLSX
//
// Exported:
//   employeeFile, managerFile     — the File objects (or null)
//   setEmployeeFile, setManagerFile — setters called by FileInput components
//   clearFiles                    — resets both after a successful operation
//   isReady                       — true only when BOTH files are selected

import { useState, useCallback } from "react";

const useUpload = () => {
  const [employeeFile, setEmployeeFile] = useState(null); // Employee CSV
  const [managerFile, setManagerFile]   = useState(null); // Manager XLSX

  // clearFiles — call this after a successful generation to reset the form
  const clearFiles = useCallback(() => {
    setEmployeeFile(null);
    setManagerFile(null);
  }, []);

  // isReady — employee CSV is required; manager file is optional
  const isReady = Boolean(employeeFile);

  return {
    employeeFile,
    managerFile,
    setEmployeeFile,
    setManagerFile,
    clearFiles,
    isReady,
  };
};

export default useUpload;