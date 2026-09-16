# BugVault — Video Recording Walkthrough Guide (Max 3 Minutes)

This script provides the exact breakdown for recording your manual 3-minute submission video for the Kalvium Personal CRUD App assignment.

---

## Video Setup & Requirements Checklist
- [ ] **Maximum duration:** 3 minutes (180 seconds).
- [ ] **Camera:** ON throughout the entire video (webcam in corner).
- [ ] **Real application:** Showing the live deployed application in browser.
- [ ] **Real code:** Showing `backend/server.js` in VS Code / IDE.
- [ ] **No slides:** Keep the screen on the live app and code.
- [ ] **Natural speaking:** Speak conversationally; do not read robotically from a script.
- [ ] **Sharing permissions:** Upload to Google Drive and set **"Anyone with the link can view"**.

---

## PART 1 — Live Application Demo (~90 Seconds)

### Step 1: Open the Frontend
- Open the deployed frontend in your browser: `https://venkataajaykumar19.github.io/BugVault/frontend/index.html` (or your active deployment URL).
- Point out the title **"BugVault"** and subtitle: *"Save the errors you've solved so you don't have to solve them twice."*
- Show the connection status badge (**"● Backend Online"**).

### Step 2: Create a Bug Record (CREATE)
- Fill in the form fields:
  - **Title:** `Prisma environment error`
  - **Error:** `Environment variable not found`
  - **Cause:** `DATABASE_URL was missing`
  - **Solution:** `Added DATABASE_URL to .env`
  - **Date:** Today's date (auto-populated or selected)
- Click **"Save Bug Record"**.
- Point to the loading indicator (**"Saving..."**) and the success banner (**"Bug record #... saved successfully!"**).
- Show the new card appearing in the **Saved Bug Solutions** list without reloading the page.

### Step 3: Update the Bug Record (UPDATE)
- Click the **"✏️ Edit"** button on the newly created record.
- Show how the form immediately populates with the bug's current data.
- Notice the mode badge changes to **"Editing Mode"** and the button changes to **"Update Bug"**.
- Modify the Solution field:
  - Change to: `Added DATABASE_URL to .env and regenerated Prisma client via npx prisma generate`
- Click **"Update Bug"**.
- Show the success banner and the updated card in the list reflecting the changes.

### Step 4: Delete the Bug Record (DELETE)
- Click the **"🗑️ Delete"** button on the record.
- Show the browser confirmation dialog: *"Are you sure you want to delete...?"*
- Click **OK**.
- Show the loading state (**"Deleting..."**), followed by the card disappearing smoothly from the list.

### Step 5: Explain the Problem While Demonstrating
- *Say naturally:*  
  > *"I built BugVault because whenever I encounter tricky bugs while building projects, I often fix them and then forget what caused them or how I fixed them weeks later. BugVault lets me capture the exact error, the root cause, and my verified solution in SQLite so I never have to waste hours re-debugging the same issue."*

---

## PART 2 — Code Walkthrough (~60 Seconds)

### Step 1: Open `backend/server.js`
- Switch to your editor showing `backend/server.js`.
- Highlight the **POST /bugs** or **PUT /bugs/:id** route.

### Step 2: Explain What It Does & How It Works
- *Focus on WHY and HOW:*
  1. **Validation & Defensive Design:**  
     Explain why you validate all 5 required fields (`title`, `error`, `cause`, `solution`, `date`) before running queries, returning a clean 400 response if anything is missing.
  2. **SQLite Prepared Statements:**  
     Point out `insertBugStmt` and `updateBugStmt`. Explain that you use `better-sqlite3` prepared statements with named parameters (`@title`, `@error`, etc.) to prevent SQL injection and achieve synchronous, high-performance database execution.
  3. **Data Integrity & Schema:**  
     Show the automated `CREATE TABLE IF NOT EXISTS bugs (...)` migration on startup, ensuring the table always exists without requiring manual SQL setup scripts.
  4. **Persistence:**  
     Explain that SQLite stores records in `database.sqlite` with WAL mode (`journal_mode = WAL`), allowing data to survive server restarts.

---

## PART 3 — Personal Problem Statement (~30 Seconds)

### Step 1: Wrap Up With The Core Motivation
- Look at the camera and deliver the personal problem in your own words:
  > *"To summarize: as a student developer, repeating the same debugging struggle is one of the biggest time sinks. BugVault solves this directly by giving me an instant, personal reference log of every solved bug. That's why I prioritized speed, reliable SQLite persistence, and clean error/cause/solution separation over unnecessary features like user logins."*

---

## Post-Recording Submission Steps
1. Export the MP4 video (verify audio and webcam are crisp).
2. Upload the video to your Google Drive.
3. Right-click the video file $\rightarrow$ **Share** $\rightarrow$ **General Access** $\rightarrow$ Change from **Restricted** to **"Anyone with the link"** (Role: Viewer).
4. Copy the link and verify it opens in an incognito browser window.
5. Paste the link into the Kalvium submission portal.
