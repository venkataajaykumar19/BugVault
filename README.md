# BugVault — Personal Coding Bug Tracker

A full-stack personal bug tracking and solution reference web application built to eliminate repetitive debugging by recording coding errors, their root causes, and their working fixes.

---

## What is it?
BugVault is a web app for recording and reviewing coding errors, their causes, and the solutions that fixed them.

---

## What problem does it solve?
I often encounter errors while learning programming and building projects, but after fixing them I sometimes forget what caused them or how I solved them. BugVault stores those problems and solutions so I can quickly reference them instead of repeating the same debugging process.

---

## What did I intentionally exclude?
- **No user authentication:** This MVP is designed for personal use, so adding JWT/session-based authentication would increase complexity without improving the core bug-logging workflow.
- **No file attachments:** Storing screenshots or raw crash log dumps would require cloud object storage (S3/Cloudinary) and multi-part upload pipelines that are not necessary for the core problem of recording errors and their solutions.

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite + `better-sqlite3` (with WAL mode & automated table migrations)
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (ES6+)
- **Deployment:** Render (Backend API Web Service) + GitHub Pages / Netlify (Frontend)

---

## Database Schema

Entity: **BUG** (Table: `bugs` in SQLite `database.sqlite`)

| Field | SQLite Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Unique identifier for each bug record |
| `title` | `TEXT NOT NULL` | Concise summary of the error / problem |
| `error` | `TEXT NOT NULL` | Error message, console stack trace, or symptom |
| `cause` | `TEXT NOT NULL` | Root cause explaining why the bug happened |
| `solution` | `TEXT NOT NULL` | Step-by-step fix or code changes applied |
| `date` | `TEXT NOT NULL` | ISO date string (`YYYY-MM-DD`) when encountered |

---

## API Routes (Exactly Four CRUD Routes + Health Check)

| Method | Endpoint | Purpose | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health Check | Returns `{"status":"ok"}` for deployment and uptime monitoring. |
| `POST` | `/bugs` | **CREATE** | Validates `title`, `error`, `cause`, `solution`, `date`. Inserts into SQLite and returns HTTP `201` with created record. |
| `GET` | `/bugs` | **READ** | Queries all bug records from SQLite ordered by ID descending. Returns HTTP `200` with JSON array. |
| `PUT` | `/bugs/:id` | **UPDATE** | Finds bug by ID (404 if not found), validates inputs, updates record in SQLite, and returns HTTP `200` with updated bug. |
| `DELETE` | `/bugs/:id` | **DELETE** | Finds bug by ID (404 if not found), deletes record from SQLite, and returns HTTP `200` with confirmation. |

*Note: In strict compliance with Kalvium assignment specifications, no auxiliary CRUD routes (such as `GET /bugs/:id`) were created.*

---

## Live Deployment

- **Frontend Live URL:** https://venkataajaykumar19.github.io/BugVault/frontend/index.html
- **Backend Live URL:** https://bugvault-api.onrender.com
- **Health Check URL:** https://bugvault-api.onrender.com/health

---

## Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm start
```
The backend starts at `http://localhost:3000`. Test health with:
```bash
curl http://localhost:3000/health
```

### 3. Frontend Setup
Open `frontend/index.html` directly in your browser or run a static file server:
```bash
npx serve frontend
# or open frontend/index.html in Google Chrome
```

---

## Automated Verification Suite

Run the full end-to-end local test suite:
```bash
node backend/test_crud.js
```
This tests:
1. `GET /health` $\rightarrow$ 200 OK
2. `POST /bugs` $\rightarrow$ 201 Created
3. `GET /bugs` $\rightarrow$ 200 OK (verified SQLite database persistence)
4. `PUT /bugs/:id` $\rightarrow$ 200 OK (verified updated data in SQLite)
5. `DELETE /bugs/:id` $\rightarrow$ 200 OK (verified record deletion)
6. Edge case validations (missing fields 400, non-existent ID 404, invalid ID 400)
7. Complete CRUD sequence: CREATE $\rightarrow$ READ $\rightarrow$ UPDATE $\rightarrow$ READ $\rightarrow$ DELETE $\rightarrow$ READ
