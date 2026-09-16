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

// Enable foreign key constraints and WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// 1. Create categories table
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )
`);

// 2. Seed default categories if empty
const defaultCategories = ['JavaScript', 'React', 'Node.js', 'Database', 'Git/GitHub'];
const insertCatStmt = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
for (const cat of defaultCategories) {
  insertCatStmt.run(cat);
}

// 3. Create or migrate bugs table with foreign key to categories
db.exec(`
  CREATE TABLE IF NOT EXISTS bugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    error TEXT NOT NULL,
    cause TEXT NOT NULL,
    solution TEXT NOT NULL,
    date TEXT NOT NULL,
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )
`);

// Safe migration check: add category_id column if it doesn't exist yet
const tableInfo = db.prepare('PRAGMA table_info(bugs)').all();
const hasCategoryId = tableInfo.some(col => col.name === 'category_id');
if (!hasCategoryId) {
  db.exec('ALTER TABLE bugs ADD COLUMN category_id INTEGER REFERENCES categories(id)');
  // Assign a default category to any pre-existing records without category_id
  const defaultCat = db.prepare("SELECT id FROM categories WHERE name = 'Database'").get() ||
                     db.prepare("SELECT id FROM categories LIMIT 1").get();
  if (defaultCat) {
    db.prepare('UPDATE bugs SET category_id = ? WHERE category_id IS NULL').run(defaultCat.id);
  }
}

// Prepared statements for maximum performance and SQL injection prevention
const insertBugStmt = db.prepare(`
  INSERT INTO bugs (title, error, cause, solution, date, category_id)
  VALUES (@title, @error, @cause, @solution, @date, @category_id)
`);

const selectAllBugsStmt = db.prepare(`
  SELECT b.id, b.title, b.error, b.cause, b.solution, b.date, b.category_id, c.name AS category_name
  FROM bugs b
  LEFT JOIN categories c ON b.category_id = c.id
  ORDER BY b.id DESC
`);

const selectBugByIdStmt = db.prepare(`
  SELECT b.id, b.title, b.error, b.cause, b.solution, b.date, b.category_id, c.name AS category_name
  FROM bugs b
  LEFT JOIN categories c ON b.category_id = c.id
  WHERE b.id = ?
`);

const selectCategoryByIdStmt = db.prepare(`
  SELECT id, name FROM categories WHERE id = ?
`);

const selectAllCategoriesStmt = db.prepare(`
  SELECT id, name FROM categories ORDER BY id ASC
`);

const updateBugStmt = db.prepare(`
  UPDATE bugs
  SET title = @title,
      error = @error,
      cause = @cause,
      solution = @solution,
      date = @date,
      category_id = @category_id
  WHERE id = @id
`);

const deleteBugStmt = db.prepare(`
  DELETE FROM bugs
  WHERE id = ?
`);

// ==========================================
// OPERATIONAL ROUTE: HEALTH CHECK
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ==========================================
// READ-ONLY ROUTE: CATEGORIES
// ==========================================
app.get('/categories', (req, res) => {
  try {
    const categories = selectAllCategoriesStmt.all();
    return res.status(200).json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err.message);
    return res.status(500).json({
      error: 'Failed to fetch categories',
      message: 'A database error occurred while retrieving categories.'
    });
  }
});

// ==========================================
// EXACT FOUR APPLICATION CRUD ROUTES
// ==========================================

// 1. POST /bugs - Create a new bug entry with category
app.post('/bugs', (req, res) => {
  try {
    const { title, error, cause, solution, date, category_id } = req.body || {};

    // Validation: all fields are required and must be non-empty strings
    const missingFields = [];
    if (!title || typeof title !== 'string' || !title.trim()) missingFields.push('title');
    if (!error || typeof error !== 'string' || !error.trim()) missingFields.push('error');
    if (!cause || typeof cause !== 'string' || !cause.trim()) missingFields.push('cause');
    if (!solution || typeof solution !== 'string' || !solution.trim()) missingFields.push('solution');
    if (!date || typeof date !== 'string' || !date.trim()) missingFields.push('date');
    if (category_id === undefined || category_id === null || category_id === '') missingFields.push('category_id');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields: missingFields,
        message: `Please provide all required fields: ${missingFields.join(', ')}`
      });
    }

    const parsedCategoryId = parseInt(category_id, 10);
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      return res.status(400).json({
        error: 'Invalid category ID',
        message: 'category_id must be a valid positive integer.'
      });
    }

    // Verify category exists in foreign table
    const category = selectCategoryByIdStmt.get(parsedCategoryId);
    if (!category) {
      return res.status(400).json({
        error: 'Invalid category',
        message: `Category with ID ${parsedCategoryId} does not exist.`
      });
    }

    const info = insertBugStmt.run({
      title: title.trim(),
      error: error.trim(),
      cause: cause.trim(),
      solution: solution.trim(),
      date: date.trim(),
      category_id: parsedCategoryId
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

// 2. GET /bugs - Retrieve all bug records with category information
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

// 3. PUT /bugs/:id - Update an existing bug record and category
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

    const { title, error, cause, solution, date, category_id } = req.body || {};

    // Validate update fields
    const missingFields = [];
    if (!title || typeof title !== 'string' || !title.trim()) missingFields.push('title');
    if (!error || typeof error !== 'string' || !error.trim()) missingFields.push('error');
    if (!cause || typeof cause !== 'string' || !cause.trim()) missingFields.push('cause');
    if (!solution || typeof solution !== 'string' || !solution.trim()) missingFields.push('solution');
    if (!date || typeof date !== 'string' || !date.trim()) missingFields.push('date');
    if (category_id === undefined || category_id === null || category_id === '') missingFields.push('category_id');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields for update',
        missingFields: missingFields,
        message: `Please provide all required fields: ${missingFields.join(', ')}`
      });
    }

    const parsedCategoryId = parseInt(category_id, 10);
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      return res.status(400).json({
        error: 'Invalid category ID',
        message: 'category_id must be a valid positive integer.'
      });
    }

    // Verify category exists in foreign table
    const category = selectCategoryByIdStmt.get(parsedCategoryId);
    if (!category) {
      return res.status(400).json({
        error: 'Invalid category',
        message: `Category with ID ${parsedCategoryId} does not exist.`
      });
    }

    updateBugStmt.run({
      id: bugId,
      title: title.trim(),
      error: error.trim(),
      cause: cause.trim(),
      solution: solution.trim(),
      date: date.trim(),
      category_id: parsedCategoryId
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

// 4. DELETE /bugs/:id - Delete a bug record (Category is preserved)
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
  console.log(`Categories endpoint: http://localhost:${PORT}/categories`);
  console.log(`Bugs endpoint: http://localhost:${PORT}/bugs`);
});

module.exports = { app, server, db };
