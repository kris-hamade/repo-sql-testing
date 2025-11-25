/**
 * Initialize the database with schema
 * Run this once to create the initial database file
 */
const { initDatabase, closeDatabase } = require('./db');

console.log('Initializing database...');
initDatabase();
console.log('Database initialized successfully!');
closeDatabase();
console.log('Database file created: data.db');

