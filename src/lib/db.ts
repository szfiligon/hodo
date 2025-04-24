import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

let dbPath: string;

// 判断运行环境
if (process.type === 'renderer') {
  // 在渲染进程中
  // @ts-ignore
  dbPath = window.electron.getUserDataPath();
} else if (process.type === 'browser') {
  // 在主进程中
  const { app } = require('electron');
  dbPath = app.getPath('userData');
} else {
  // 在 Next.js API 路由中
  dbPath = join(process.cwd(), 'db');
}

// 确保数据库目录存在
const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

// 设置数据库文件路径
dbPath = join(dbPath, 'todos.db');

console.log("Database initialization started.");
console.log("Database path:", dbPath);

let db: Database.Database;

try {
  db = new Database(dbPath);
  console.log("Database initialized successfully.");

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_menus (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize default user if not exists
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
    db.prepare(`
      INSERT INTO users (id, username, password)
      VALUES ('${uuidv4()}', 'admin', 'admin123')
    `).run();
    console.log("Default user created successfully.");
  }

  console.log("Database tables created or verified successfully.");

} catch (error) {
  console.error("Failed to create or access the database:", error);
  process.exit(1);
}

export default db;