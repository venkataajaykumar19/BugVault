const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());

// Middleware for parsing JSON with error handling for malformed JSON
app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and persistence
db.pragma('journal_mode = WAL');

// Automatic database table migration on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS bugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    error TEXT NOT NULL,
    cause TEXT NOT NULL,
    solution TEXT NOT NULL,
    date TEXT NOT NULL
  )
`);

// Prepared statements for maximum performance and SQL injection prevention
const insertBugStmt = db.prepare(`
  INSERT INTO bugs (title, error, cause, solution, date)
  VALUES (@title, @error, @cause, @solution, @date)
`);

const selectAllBugsStmt = db.prepare(`
  SELECT id, title, error, cause, solution, date
  FROM bugs
  ORDER BY id DESC
`);

const selectBugByIdStmt = db.prepare(`
  SELECT id, title, error, cause, solution, date
  FROM bugs
  WHERE id = ?
`);

const updateBugStmt = db.prepare(`
  UPDATE bugs
  SET title = @title,
      error = @error,
      cause = @cause,
      solution = @solution,
      date = @date
  WHERE id = @id
`);

const deleteBugStmt = db.prepare(`
  DELETE FROM bugs
  WHERE id = ?
`);

// ==========================================
// HEALTH ROUTE
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ==========================================
// EXACT FOUR CRUD ROUTES
// ==========================================

// 1. POST /bugs - Create a new bug entry
app.post('/bugs', (req, res) => {
  try {
    const { title, error, cause, solution, date } = req.body || {};

    // Validation: all fields are required and must be non-empty strings
    const missingFields = [];
    if (!title || typeof title !== 'string' || !title.trim()) missingFields.push('title');
    if (!error || typeof error !== 'string' || !error.trim()) missingFields.push('error');
    if (!cause || typeof cause !== 'string' || !cause.trim()) missingFields.push('cause');
    if (!solution || typeof solution !== 'string' || !solution.trim()) missingFields.push('solution');
    if (!date || typeof date !== 'string' || !date.trim()) missingFields.push('date');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields: missingFields,
        message: `Please provide all required fields: ${missingFields.join(', ')}`
      });
    }

    const info = insertBugStmt.run({
      title: title.trim(),
      error: error.trim(),
      cause: cause.trim(),
      solution: solution.trim(),
      date: date.trim()
    });

    const newBug = selectBugByIdStmt.get(info.lastInsertRowid);
    return res.status(201).json(newBug);
  } catch (err) {
    console.error('Error inserting bug:', err.message);
    return res.status(500).json({
      error: 'Failed to create bug record',
      message: 'A database error occurred while creating the record.'
    });
  }
});

// 2. GET /bugs - Retrieve all bug records
app.get('/bugs', (req, res) => {
  try {
    const bugs = selectAllBugsStmt.all();
    return res.status(200).json(bugs);
  } catch (err) {
    console.error('Error fetching bugs:', err.message);
    return res.status(500).json({
      error: 'Failed to fetch bug records',
      message: 'A database error occurred while retrieving records.'
    });
  }
});

// 3. PUT /bugs/:id - Update an existing bug record
app.put('/bugs/:id', (req, res) => {
  try {
    const bugId = parseInt(req.params.id, 10);
    if (isNaN(bugId) || bugId <= 0) {
      return res.status(400).json({
        error: 'Invalid bug ID',
        message: 'Bug ID must be a positive integer.'
      });
    }

    // Check if record exists
    const existingBug = selectBugByIdStmt.get(bugId);
    if (!existingBug) {
      return res.status(404).json({
        error: 'Bug record not found',
        message: `No bug found with ID ${bugId}.`
      });
    }

    const { title, error, cause, solution, date } = req.body || {};

    // Validate update fields
    const missingFields = [];
    if (!title || typeof title !== 'string' || !title.trim()) missingFields.push('title');
    if (!error || typeof error !== 'string' || !error.trim()) missingFields.push('error');
    if (!cause || typeof cause !== 'string' || !cause.trim()) missingFields.push('cause');
    if (!solution || typeof solution !== 'string' || !solution.trim()) missingFields.push('solution');
    if (!date || typeof date !== 'string' || !date.trim()) missingFields.push('date');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields for update',
        missingFields: missingFields,
        message: `Please provide all required fields: ${missingFields.join(', ')}`
      });
    }

    updateBugStmt.run({
      id: bugId,
      title: title.trim(),
      error: error.trim(),
      cause: cause.trim(),
      solution: solution.trim(),
      date: date.trim()
    });

    const updatedBug = selectBugByIdStmt.get(bugId);
    return res.status(200).json(updatedBug);
  } catch (err) {
    console.error('Error updating bug:', err.message);
    return res.status(500).json({
      error: 'Failed to update bug record',
      message: 'A database error occurred while updating the record.'
    });
  }
});

// 4. DELETE /bugs/:id - Delete a bug record
app.delete('/bugs/:id', (req, res) => {
  try {
    const bugId = parseInt(req.params.id, 10);
    if (isNaN(bugId) || bugId <= 0) {
      return res.status(400).json({
        error: 'Invalid bug ID',
        message: 'Bug ID must be a positive integer.'
      });
    }

    // Check if record exists
    const existingBug = selectBugByIdStmt.get(bugId);
    if (!existingBug) {
      return res.status(404).json({
        error: 'Bug record not found',
        message: `No bug found with ID ${bugId}.`
      });
    }

    deleteBugStmt.run(bugId);
    return res.status(200).json({
      success: true,
      message: `Bug with ID ${bugId} successfully deleted.`,
      deletedId: bugId
    });
  } catch (err) {
    console.error('Error deleting bug:', err.message);
    return res.status(500).json({
      error: 'Failed to delete bug record',
      message: 'A database error occurred while deleting the record.'
    });
  }
});

// Global catch-all error handling middleware (e.g. invalid JSON payloads)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Malformed JSON',
      message: 'The request payload contains invalid JSON syntax.'
    });
  }
  console.error('Unhandled server error:', err.message);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred.'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`BugVault API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Bugs endpoint: http://localhost:${PORT}/bugs`);
});

module.exports = { app, server, db };
