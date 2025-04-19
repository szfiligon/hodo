import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const dbPath: string = join(process.cwd(), 'db', 'todos.db');
console.log("Database initialization started.");
console.log("Database path:", dbPath);

// Create directory if it doesn't exist
const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

let db: Database.Database;

try {
  db = new Database(dbPath);
  console.log("Database initialized successfully.");

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_menus (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      task_menu_id TEXT NOT NULL,
      text TEXT NOT NULL,
      color_tag TEXT DEFAULT NULL,
      remarks TEXT DEFAULT NULL,
      completed BOOLEAN DEFAULT 0,
      remind_me DATETIME DEFAULT NULL,
      due_date DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      importance BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_steps (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      text TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_menu_associations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      menu_id TEXT NOT NULL
    );
  `);

  console.log("Database tables created or verified successfully.");

} catch (error) {
  console.error("Failed to create or access the database:", error);
  process.exit(1);
}

export default db;