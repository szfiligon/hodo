import Database from 'better-sqlite3';

const db = new Database('db/todos.db');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS task_menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_menu_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    color_tag TEXT DEFAULT NULL,
    remarks TEXT DEFAULT NULL,
    completed BOOLEAN DEFAULT 0,
    remind_me DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_menu_id) REFERENCES task_menus(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);


// Log SQL queries
const originalPrepare = db.prepare;
(db as any).prepare = function(sql: string) {
  console.log('Executing SQL:', sql);
  return originalPrepare.call(this, sql);
};

export default db; 