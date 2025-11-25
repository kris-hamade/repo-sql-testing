const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

let db = null;

/**
 * Initialize the database and create tables if they don't exist
 */
function initDatabase() {
  if (db) {
    return db;
  }

  db = new Database(DB_PATH);
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      options TEXT,
      github_username TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on github_username for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_github_username ON users(github_username)
  `);

  return db;
}

/**
 * Create a new user record
 * @param {string} name - User's name
 * @param {string} state - User's state
 * @param {string} options - JSON string of dropdown options
 * @param {string} githubUsername - GitHub username of the creator
 * @returns {Object} The created record
 */
function createRecord(name, state, options, githubUsername) {
  const database = initDatabase();
  
  const stmt = database.prepare(`
    INSERT INTO users (name, state, options, github_username, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const result = stmt.run(name, state, options || null, githubUsername);
  
  return getRecord(result.lastInsertRowid);
}

/**
 * Update an existing user record
 * @param {number} id - Record ID
 * @param {string} name - Updated name
 * @param {string} state - Updated state
 * @param {string} options - Updated JSON string of dropdown options
 * @param {string} githubUsername - GitHub username of the updater (must match existing record)
 * @returns {Object} The updated record
 */
function updateRecord(id, name, state, options, githubUsername) {
  const database = initDatabase();
  
  // First verify the record exists and belongs to the user
  const existing = getRecord(id);
  if (!existing) {
    throw new Error(`Record with ID ${id} not found`);
  }
  
  if (existing.github_username !== githubUsername) {
    throw new Error(`Unauthorized: Record belongs to ${existing.github_username}, not ${githubUsername}`);
  }

  const stmt = database.prepare(`
    UPDATE users 
    SET name = ?, state = ?, options = ?, updated_at = datetime('now')
    WHERE id = ? AND github_username = ?
  `);

  const result = stmt.run(name, state, options || null, id, githubUsername);
  
  if (result.changes === 0) {
    throw new Error('Update failed: Record not found or unauthorized');
  }
  
  return getRecord(id);
}

/**
 * Get a record by ID
 * @param {number} id - Record ID
 * @returns {Object|null} The record or null if not found
 */
function getRecord(id) {
  const database = initDatabase();
  
  const stmt = database.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) || null;
}

/**
 * Get a record by GitHub username
 * @param {string} githubUsername - GitHub username
 * @returns {Object|null} The record or null if not found
 */
function getRecordByUsername(githubUsername) {
  const database = initDatabase();
  
  const stmt = database.prepare('SELECT * FROM users WHERE github_username = ? ORDER BY created_at DESC LIMIT 1');
  return stmt.get(githubUsername) || null;
}

/**
 * Get all records
 * @returns {Array} Array of all records
 */
function getAllRecords() {
  const database = initDatabase();
  
  const stmt = database.prepare('SELECT * FROM users ORDER BY created_at DESC');
  return stmt.all();
}

/**
 * Close the database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  createRecord,
  updateRecord,
  getRecord,
  getRecordByUsername,
  getAllRecords,
  closeDatabase
};

