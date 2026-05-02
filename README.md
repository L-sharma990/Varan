# Seat Allocation System

A full-stack University Seat Allocation System **VARAN** built with **HTML/CSS/JS**, **Node.js/Express**, and **MySQL**.

## Features
- Student registration & login
- Course preference filling & locking
- Merit-based seat allocation algorithm
- Admin control panel (open/close registration, run allocation, publish results)
- Payment simulation

## Tech Stack
- **Frontend:** HTML, Tailwind CSS, Vanilla JS
- **Backend:** Node.js, Express.js
- **Database:** MySQL

## Project Structure
```
SeatAllocation_v2/
├── backend/
│   ├── server.js          # Main Express server
│   ├── package.json
│   └── .env.example       # Copy to .env and fill in credentials
├── frontend/
│   ├── index.html         # Login / Register page
│   ├── dashboard.html     # Student dashboard
│   └── admin.html         # Admin control panel
└── sql/
    └── schema.sql         # Database schema and seed data
```

## Setup Instructions

### 1. Database Setup
Make sure MySQL is running. Then run the schema:
```bash
mysql -u root -p < sql/schema.sql
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and fill in your DB credentials
node server.js
```

### 3. Frontend
Open `frontend/index.html` in your browser.  
