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

## Database Schema (Two Related Relational Entities)

Database Engine: **SQLite 3** (`better-sqlite3` with `PRAGMA foreign_keys = ON` & WAL mode)

### 1. Table: `categories`
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique identifier for each category |
| `name` | `TEXT` | `NOT NULL UNIQUE` | Unique category name (e.g. JavaScript, React, Node.js, Database, Git/GitHub) |

### 2. Table: `bugs`
| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique identifier for each bug record |
| `title` | `TEXT` | `NOT NULL` | Concise summary of the error / problem |
| `error` | `TEXT` | `NOT NULL` | Error message, console stack trace, or symptom |
| `cause` | `TEXT` | `NOT NULL` | Root cause explaining why the bug happened |
| `solution` | `TEXT` | `NOT NULL` | Step-by-step fix or code changes applied |
| `date` | `TEXT` | `NOT NULL` | ISO date string (`YYYY-MM-DD`) when encountered |
| `category_id` | `INTEGER` | `REFERENCES categories(id)` | Foreign Key linking the bug to its parent category |

### Relationship:
- **One-to-Many (1:N):** One category has many bugs (`categories 1 ---- N bugs`).
- **Referential Integrity:** Each bug belongs to exactly one category referenced through `category_id`.
- **Preservation Invariant:** Deleting a bug does not delete the category (no cascading deletion).

---

## API Routes (4 CRUD Routes + Health Check + Categories Route)

| Method | Endpoint | Purpose | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Operational Check | Returns `{"status":"ok"}` for deployment and uptime monitoring. |
| `GET` | `/categories` | **READ CATEGORIES** | Retrieves all available categories from SQLite table `categories`. |
| `POST` | `/bugs` | **CREATE** | Validates `title`, `error`, `cause`, `solution`, `date`, `category_id`. Inserts into SQLite and returns HTTP `201` with created record. |
| `GET` | `/bugs` | **READ** | Queries all bug records with a SQL `LEFT JOIN categories` ordered by ID descending. Returns HTTP `200` with JSON array. |
| `PUT` | `/bugs/:id` | **UPDATE** | Finds bug by ID (404 if not found), validates inputs & `category_id`, updates record in SQLite, and returns HTTP `200` with updated bug. |
| `DELETE` | `/bugs/:id` | **DELETE** | Finds bug by ID (404 if not found), deletes record from SQLite, and returns HTTP `200` with confirmation. (Category is preserved). |

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
This runs 39 automated assertions covering:
1. `GET /health` $\rightarrow$ 200 OK
2. `GET /categories` $\rightarrow$ 200 OK (verifies seeded categories: JavaScript, React, Node.js, Database, Git/GitHub)
3. SQLite Schema & Foreign Key Pragma $\rightarrow$ `PRAGMA foreign_key_list(bugs)` confirms active foreign key
4. `POST /bugs` with Category $\rightarrow$ 201 Created (verifies `category_id` and joined `category_name`)
5. Foreign Key Validation $\rightarrow$ 400 Bad Request on missing or non-existent `category_id` (integrity protection)
6. `GET /bugs` with SQL JOIN $\rightarrow$ 200 OK (verifies joined category data)
7. `PUT /bugs/:id` $\rightarrow$ 200 OK (verifies switching categories)
8. `DELETE /bugs/:id` $\rightarrow$ 200 OK (verifies record deletion while preserving parent category)
9. Edge case validations (missing fields 400, non-existent ID 404, invalid ID 400)
10. Complete relational CRUD sequence: CREATE $\rightarrow$ READ $\rightarrow$ UPDATE $\rightarrow$ READ $\rightarrow$ DELETE $\rightarrow$ READ
11. Multi-pass persistence across server restarts (WAL mode durability)
