# Timesheet Billing System

A full-stack Timesheet & Billing Automation platform built during my internship.

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

- CSV Timesheet Processing
- Manager Report Processing
- Billing Summary Generation
- Client-wise Aggregation
- Employee Hours Calculation
- Manager Hours Calculation
- Excel Report Generation
- File Download API
- Report History Support

### Frontend

- Drag & Drop File Upload
- Responsive Dashboard
- Summary Statistics
- Report Generation Workflow
- Excel Download
- Recent Reports History
- Loading States
- Error Handling
- Mobile Responsive Design

---

## Tech Stack

### Frontend

- React
- Vite
- Axios
- Lucide React

### Backend

- Node.js
- Express.js
- XLSX
- Multer

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

1. Upload Employee Timesheet CSV
2. Upload Manager Hours Report
3. Generate Billing Summary
4. Calculate Billable Hours
5. Generate Excel Report
6. Download Final Billing Report

---

## Current Status

### Completed

- File Upload System
- Billing Summary Engine
- Excel Report Generation
- Report Download
- Statistics Dashboard
- Report History
- Mobile Responsive UI

### Future Enhancements

- Authentication
- User Roles
- Database Integration
- Cloud Storage
- Report Scheduling
- Email Delivery

---

## Author

Arpit Patni

Internship Project 2026
