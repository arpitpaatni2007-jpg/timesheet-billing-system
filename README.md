# Timesheet Billing System

An AI-assisted full-stack Timesheet & Billing Automation platform developed during my internship at Computer Ware India Pvt. Ltd.

The application automates the conversion of Zoho Projects timesheet exports into structured client-wise workbooks, monthly billing summaries, and manager reconciliation reports, significantly reducing manual effort and improving reporting accuracy.

## Overview

This application automates the process of:

- Uploading employee timesheets
- Uploading manager reports
- Generating billing summaries
- Calculating employee and manager hours
- Generating Excel billing reports
- Downloading finalized billing reports
- Maintaining report history

The system eliminates manual billing calculations and produces structured reports automatically.

---

## Features

### Backend

- CSV/XLSX Employee Timesheet Processing
- CSV/XLSX Manager Report Processing
- Client-wise Timesheet Generation
- Monthly Billing Summary Generation
- Manager Summary/Reconciliation Sheet
- Automatic Client Grouping
- Multi-level Subtotals & Excel Formulas
- Excel Report Generation (ExcelJS)
- Optional Manager Report Support
- Client Sheet Preference Configuration
- Smart Report Download API
- Report History Support

### Frontend

- Drag & Drop File Upload
- CSV/XLSX File Validation
- Responsive Dashboard
- Billing Summary Generation
- Download Generated Reports
- Client Sheet Configuration
- Saved User Preferences
- Recent Report History
- Loading Indicators
- Error Handling
- Mobile Responsive UI
---

## Tech Stack

## Frontend

- React
- Vite
- Axios
- React Hot Toast
- Lucide React

## Backend

- Node.js
- Express.js
- Multer
- PapaParse
- ExcelJS
- XLSX
- CORS

---

## Project Structure

timesheet-billing-system/

├── frontend/

│ ├── src/

│ ├── components/

│ ├── hooks/

│ └── api/

│

├── backend/

│ ├── controllers/

│ ├── routes/

│ ├── services/

│ ├── uploads/

│ └── generated-reports/

│

└── README.md

---

## Installation

### Backend

```bash
cd backend
npm install
npm start
```

Backend runs on:

```
http://localhost:5001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```
http://localhost:5173
```

---

## Workflow

1. Upload Employee Timesheet (CSV/XLSX)
2. (Optional) Upload Manager Report
3. Parse & Validate Input Files
4. Group Records Client-wise
5. Generate Billing Summary
6. Calculate Employee & Manager Hours
7. Apply Business Rules & Formulas
8. Generate Excel Reports
9. Download Billing Summary & Client-wise Workbook

---

## Current Status

### Completed

- Employee Timesheet Upload
- Manager Report Upload
- CSV/XLSX Support
- Drag & Drop Upload
- Billing Summary Generation
- Client-wise Workbook Generation
- Manager Summary Sheet
- Client Sheet Configuration
- Saved Preferences
- Excel Formula Generation
- Report Download
- Dashboard Statistics
- Report History
- Mobile Responsive UI

## Future Enhancements

- AI-powered Task Summarization
- Fuzzy Project Matching Improvements
- User Authentication
- Role-based Access Control
- Database Integration
- Cloud Storage Support
- Scheduled Report Generation
- Email Report Delivery
---

## Author

**Arpit Patni**

B.Tech CSE (AI & ML)
K.R. Mangalam University

Internship Project – Computer Ware India Pvt. Ltd. (2026)
