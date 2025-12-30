import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { getDatabasePath, initializeUserDataDirectories } from './user-data';

// 初始化用户数据目录
initializeUserDataDirectories();

// 创建 SQLite 客户端
const client = createClient({
  url: getDatabasePath(),
});

// 创建 drizzle 实例
export const db = drizzle(client);

// 全局初始化状态
let isDatabaseInitialized = false;
let initPromise: Promise<void> | null = null;

// 定义用户表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  password: text('password').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 定义文件夹表
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  userId: text('user_id').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 定义任务表
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  folderId: text('folder_id').notNull(),
  userId: text('user_id').notNull(),
  notes: text('notes'),
  isTodayTask: integer('is_today_task', { mode: 'boolean' }).notNull().default(false),
  startDate: text('start_date'),
  dueDate: text('due_date'),
  tags: text('tags'), // 标签字段，多个标签用逗号分隔
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 定义任务步骤表
export const taskSteps = sqliteTable('task_steps', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  title: text('title').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  order: integer('order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 定义任务文件表
export const taskFiles = sqliteTable('task_files', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  fileName: text('file_name').notNull(),
  originalName: text('original_name').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  filePath: text('file_path').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 定义访问记录表
export const accessLogs = sqliteTable('access_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  path: text('path').notNull(),
});

// 定义解锁记录表
export const unlockRecords = sqliteTable('unlock_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  date: text('date').notNull(), // yyyyMMdd
  unlockCode: text('unlock_code').notNull(), // 直接存储解锁码原文
});

// 定义系统配置表
export const systemConfig = sqliteTable('system_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 定义消息记录表
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  msg: text('msg').notNull(),
  type: text('type').notNull().default('info'), // 消息类型：'feature' | 'expiry' | 'info'
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 定义标签表
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  userId: text('user_id').notNull(),
  selectable: integer('selectable', { mode: 'boolean' }).notNull().default(true), // 控制标签是否可被选择
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 初始化数据库表
export async function initDatabase() {
  // 如果已经初始化过，直接返回
  if (isDatabaseInitialized) {
    return;
  }

  // 如果正在初始化，等待初始化完成
  if (initPromise) {
    return initPromise;
  }

  // 开始初始化
  initPromise = performDatabaseInit();
  try {
    await initPromise;
    isDatabaseInitialized = true;
  } finally {
    initPromise = null;
  }
}

// 实际的数据库初始化逻辑
async function performDatabaseInit() {
  try {
    console.log('Starting database initialization...');
    
    // 检查并创建用户表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      
      // 创建用户表索引
      await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
      
      console.log('Users table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating users table:', error);
      throw error;
    }

    // 检查并创建文件夹表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          user_id TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
  
      // 检查并添加 archived 字段（如果不存在）
      try {
        await db.run(sql`ALTER TABLE folders ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
        console.log('Archived column added to existing folders table');
      } catch {
        console.log('Archived column already exists in folders table');
      }

      // 创建文件夹表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_folders_user_created ON folders(user_id, created_at)`);
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_folders_user_archived ON folders(user_id, archived)`);
      
      console.log('Folders table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating folders table:', error);
      throw error;
    }

    // 检查并创建任务表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          folder_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          notes TEXT,
          is_today_task INTEGER NOT NULL DEFAULT 0,
          start_date TEXT,
          due_date TEXT,
          tags TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      
      // 创建任务表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_folder_created ON tasks(user_id, folder_id, created_at)`);
      
      // 检查并添加 start_date 字段（如果不存在）
      try {
        await db.run(sql`ALTER TABLE tasks ADD COLUMN start_date TEXT`);
        console.log('Start date column added to existing tasks table');
      } catch {
        console.log('Start date column already exists in tasks table');
      }
      
      // 检查并添加 tags 字段（如果不存在）
      try {
        await db.run(sql`ALTER TABLE tasks ADD COLUMN tags TEXT`);
        console.log('Tags column added to existing tasks table');
      } catch {
        console.log('Tags column already exists in tasks table');
      }
      
      console.log('Tasks table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating tasks table:', error);
      throw error;
    }

    // 检查并创建任务步骤表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS task_steps (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          "order" INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      
      // 创建任务步骤表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_task_steps_task_order ON task_steps(task_id, "order")`);
      
      console.log('Task steps table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating task_steps table:', error);
      throw error;
    }

    // 检查并创建任务文件表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS task_files (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          original_name TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          file_path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      
      // 创建任务文件表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id)`);
      
      console.log('Task files table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating task_files table:', error);
      throw error;
    }

    // 检查并创建访问记录表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          user_agent TEXT,
          ip_address TEXT,
          path TEXT NOT NULL
        )
      `);
      
      // 创建访问记录表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp_path ON access_logs(timestamp, path)`);
      
      console.log('Access logs table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating access_logs table:', error);
      throw error;
    }
    
    // 检查并创建解锁记录表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS unlock_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          date TEXT NOT NULL,
          unlock_code TEXT NOT NULL
        )
      `);

      // 如有需要，可添加其他索引
      // await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_unlock_records_username_date ON unlock_records(username, date)`);

      console.log('Unlock records table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating unlock_records table:', error);
      throw error;
    }

    // 检查并创建系统配置表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS system_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // 创建系统配置表索引
      await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key)`);

      console.log('System config table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating system_config table:', error);
      throw error;
    }

    // 检查并创建消息表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          msg TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'info',
          read INTEGER NOT NULL DEFAULT 0,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // 创建消息表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_messages_type_created ON messages(type, created_at)`);
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_messages_read_created ON messages(read, created_at)`);
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at)`);

      console.log('Messages table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating messages table:', error);
      throw error;
    }

    // 检查并创建标签表
    try {
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          user_id TEXT NOT NULL,
          selectable INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // 检查并添加 selectable 字段（如果不存在）
      try {
        await db.run(sql`ALTER TABLE tags ADD COLUMN selectable INTEGER NOT NULL DEFAULT 1`);
        console.log('Selectable column added to existing tags table');
      } catch {
        console.log('Selectable column already exists in tags table');
      }

      // 创建标签表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tags_user_created ON tags(user_id, created_at)`);
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tags_name_user ON tags(name, user_id)`);

      console.log('Tags table and indexes created/verified successfully');
    } catch (error) {
      console.error('Error creating tags table:', error);
      throw error;
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// 确保数据库已初始化的辅助函数
export async function ensureDatabaseInitialized() {
  await initDatabase();
} 