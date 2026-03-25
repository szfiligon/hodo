import { PrismaClient } from '@prisma/client';
import { getDatabasePath, initializeUserDataDirectories } from './user-data';

type SqlCondition = { text: string; params: unknown[] };
type TableColumn = { __kind: 'column'; table: string; column: string; field: string };
type TableDef = { __table: string; __columns: Record<string, string> } & Record<string, TableColumn | string | Record<string, string>>;
type SelectProjectionValue = TableColumn | SqlCondition;

function createTable(tableName: string, columns: Record<string, string>): TableDef {
  const table: TableDef = {
    __table: tableName,
    __columns: columns,
  };
  for (const [field, column] of Object.entries(columns)) {
    table[field] = { __kind: 'column', table: tableName, column, field };
  }
  return table;
}

function isColumnRef(value: unknown): value is TableColumn {
  return typeof value === 'object' && value !== null && (value as TableColumn).__kind === 'column';
}

function fieldToColumn(table: TableDef, field: string): string {
  return table.__columns[field] ?? field;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlCondition {
  const params: unknown[] = [];
  let text = '';
  for (let i = 0; i < strings.length; i += 1) {
    text += strings[i];
    if (i < values.length) {
      const value = values[i];
      if (isColumnRef(value)) {
        text += `${quoteIdentifier(value.table)}.${quoteIdentifier(value.column)}`;
      } else if (typeof value === 'object' && value !== null && 'text' in (value as Record<string, unknown>) && 'params' in (value as Record<string, unknown>)) {
        const cond = value as SqlCondition;
        text += cond.text;
        params.push(...cond.params);
      } else {
        text += '?';
        params.push(value);
      }
    }
  }
  return { text, params };
}

export function eq(left: TableColumn, right: unknown): SqlCondition {
  return isColumnRef(right)
    ? { text: `${quoteIdentifier(left.table)}.${quoteIdentifier(left.column)} = ${quoteIdentifier(right.table)}.${quoteIdentifier(right.column)}`, params: [] }
    : { text: `${quoteIdentifier(left.table)}.${quoteIdentifier(left.column)} = ?`, params: [right] };
}

export function ne(left: TableColumn, right: unknown): SqlCondition {
  return { text: `${quoteIdentifier(left.table)}.${quoteIdentifier(left.column)} != ?`, params: [right] };
}

export function lt(left: TableColumn, right: unknown): SqlCondition {
  return { text: `${quoteIdentifier(left.table)}.${quoteIdentifier(left.column)} < ?`, params: [right] };
}

export function and(...conditions: Array<SqlCondition | undefined | null>): SqlCondition {
  const valid = conditions.filter(Boolean) as SqlCondition[];
  return {
    text: valid.map((c) => `(${c.text})`).join(' AND ') || '1=1',
    params: valid.flatMap((c) => c.params),
  };
}

export function inArray(left: TableColumn, values: unknown[]): SqlCondition {
  if (values.length === 0) return { text: '1=0', params: [] };
  return {
    text: `${quoteIdentifier(left.table)}.${quoteIdentifier(left.column)} IN (${values.map(() => '?').join(', ')})`,
    params: values,
  };
}

export function isNotNull(left: TableColumn): SqlCondition {
  return { text: `${quoteIdentifier(left.table)}.${quoteIdentifier(left.column)} IS NOT NULL`, params: [] };
}

export function desc(column: TableColumn): SqlCondition {
  return { text: `${quoteIdentifier(column.table)}.${quoteIdentifier(column.column)} DESC`, params: [] };
}

export function asc(column: TableColumn): SqlCondition {
  return { text: `${quoteIdentifier(column.table)}.${quoteIdentifier(column.column)} ASC`, params: [] };
}

class SelectBuilder<T = Record<string, unknown>> {
  private table?: TableDef;
  private whereCondition?: SqlCondition;
  private orderCondition?: SqlCondition;
  private rowLimit?: number;
  private projection?: Record<string, SelectProjectionValue>;

  constructor(projection?: Record<string, SelectProjectionValue>) {
    this.projection = projection;
  }

  from(table: TableDef) {
    this.table = table;
    return this;
  }

  where(condition: SqlCondition) {
    this.whereCondition = condition;
    return this;
  }

  orderBy(condition: SqlCondition) {
    this.orderCondition = condition;
    return this;
  }

  limit(limit: number) {
    this.rowLimit = limit;
    return this;
  }

  async execute(): Promise<T[]> {
    if (!this.table) throw new Error('Missing table in select query');
    const params: unknown[] = [];
    const selectClause = this.projection
      ? Object.entries(this.projection)
          .map(([alias, value]) => {
            if (isColumnRef(value)) {
              return `${quoteIdentifier(value.table)}.${quoteIdentifier(value.column)} AS ${quoteIdentifier(alias)}`;
            }
            params.push(...value.params);
            return `${value.text} AS ${quoteIdentifier(alias)}`;
          })
          .join(', ')
      : Object.entries(this.table.__columns)
          .map(([field, column]) => `${quoteIdentifier(this.table!.__table)}.${quoteIdentifier(column)} AS ${quoteIdentifier(field)}`)
          .join(', ');
    let query = `SELECT ${selectClause} FROM ${quoteIdentifier(this.table.__table)}`;
    if (this.whereCondition) {
      query += ` WHERE ${this.whereCondition.text}`;
      params.push(...this.whereCondition.params);
    }
    if (this.orderCondition) {
      query += ` ORDER BY ${this.orderCondition.text}`;
      params.push(...this.orderCondition.params);
    }
    if (this.rowLimit !== undefined) {
      query += ' LIMIT ?';
      params.push(this.rowLimit);
    }
    const rows = await prisma.$queryRawUnsafe<T[]>(query, ...params);
    return rows;
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class InsertBuilder {
  constructor(private table: TableDef) {}

  values(payload: Record<string, unknown>) {
    return new InsertValuesBuilder(this.table, payload);
  }
}

class InsertValuesBuilder<T = Record<string, unknown>> {
  constructor(private table: TableDef, private payload: Record<string, unknown>) {}

  private async doInsert() {
    const entries = Object.entries(this.payload);
    const columns = entries.map(([field]) => fieldToColumn(this.table, field));
    const values = entries.map(([, value]) => value);
    const query = `INSERT INTO ${quoteIdentifier(this.table.__table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${values
      .map(() => '?')
      .join(', ')})`;
    await prisma.$executeRawUnsafe(query, ...values);
  }

  async execute() {
    await this.doInsert();
  }

  async returning(): Promise<T[]> {
    await this.doInsert();
    const idField = Object.prototype.hasOwnProperty.call(this.payload, 'id') ? 'id' : null;
    if (!idField) {
      return [];
    }
    const idColumn = fieldToColumn(this.table, idField);
    const idValue = this.payload[idField];
    const selectClause = Object.entries(this.table.__columns)
      .map(([field, column]) => `${quoteIdentifier(this.table.__table)}.${quoteIdentifier(column)} AS ${quoteIdentifier(field)}`)
      .join(', ');
    const query = `SELECT ${selectClause} FROM ${quoteIdentifier(this.table.__table)} WHERE ${quoteIdentifier(idColumn)} = ? LIMIT 1`;
    return prisma.$queryRawUnsafe<T[]>(query, idValue);
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class UpdateBuilder {
  private payload: Record<string, unknown> = {};
  private whereCondition?: SqlCondition;

  constructor(private table: TableDef) {}

  set(payload: Record<string, unknown>) {
    this.payload = payload;
    return this;
  }

  where(condition: SqlCondition) {
    this.whereCondition = condition;
    return this;
  }

  async execute() {
    const entries = Object.entries(this.payload);
    const setClause = entries.map(([field]) => `${quoteIdentifier(fieldToColumn(this.table, field))} = ?`).join(', ');
    const query = `UPDATE ${quoteIdentifier(this.table.__table)} SET ${setClause}${
      this.whereCondition ? ` WHERE ${this.whereCondition.text}` : ''
    }`;
    const params = [...entries.map(([, value]) => value), ...(this.whereCondition?.params ?? [])];
    await prisma.$executeRawUnsafe(query, ...params);
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class DeleteBuilder {
  private whereCondition?: SqlCondition;

  constructor(private table: TableDef) {}

  where(condition: SqlCondition) {
    this.whereCondition = condition;
    return this;
  }

  async execute() {
    const query = `DELETE FROM ${quoteIdentifier(this.table.__table)}${this.whereCondition ? ` WHERE ${this.whereCondition.text}` : ''}`;
    await prisma.$executeRawUnsafe(query, ...(this.whereCondition?.params ?? []));
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class DbClient {
  select<T extends Record<string, SelectProjectionValue>>(projection?: T) {
    return new SelectBuilder<T extends undefined ? Record<string, unknown> : { [K in keyof T]: unknown }>(projection);
  }

  insert(table: TableDef) {
    return new InsertBuilder(table);
  }

  update(table: TableDef) {
    return new UpdateBuilder(table);
  }

  delete(table: TableDef) {
    return new DeleteBuilder(table);
  }

  async run(condition: SqlCondition) {
    await prisma.$executeRawUnsafe(condition.text, ...condition.params);
  }

  async execute(condition: SqlCondition) {
    return prisma.$queryRawUnsafe(condition.text, ...condition.params);
  }
}

// 初始化用户数据目录
initializeUserDataDirectories();
const databaseUrl = getDatabasePath();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

export const db = new DbClient();

// 全局初始化状态
let isDatabaseInitialized = false;
let initPromise: Promise<void> | null = null;

export const users = createTable('users', {
  id: 'id',
  username: 'username',
  password: 'password',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const folders = createTable('folders', {
  id: 'id',
  name: 'name',
  color: 'color',
  userId: 'user_id',
  archived: 'archived',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const tasks = createTable('tasks', {
  id: 'id',
  title: 'title',
  completed: 'completed',
  folderId: 'folder_id',
  userId: 'user_id',
  notes: 'notes',
  isTodayTask: 'is_today_task',
  tags: 'tags',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const taskFiles = createTable('task_files', {
  id: 'id',
  taskId: 'task_id',
  fileName: 'file_name',
  originalName: 'original_name',
  fileSize: 'file_size',
  mimeType: 'mime_type',
  filePath: 'file_path',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const accessLogs = createTable('access_logs', {
  id: 'id',
  timestamp: 'timestamp',
  userAgent: 'user_agent',
  ipAddress: 'ip_address',
  path: 'path',
});

export const unlockRecords = createTable('unlock_records', {
  id: 'id',
  username: 'username',
  date: 'date',
  unlockCode: 'unlock_code',
});

export const systemConfig = createTable('system_config', {
  id: 'id',
  key: 'key',
  value: 'value',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const messages = createTable('messages', {
  id: 'id',
  msg: 'msg',
  type: 'type',
  read: 'read',
  userId: 'user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export const tags = createTable('tags', {
  id: 'id',
  name: 'name',
  color: 'color',
  userId: 'user_id',
  selectable: 'selectable',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
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
          tags TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      
      // 创建任务表索引
      await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_folder_created ON tasks(user_id, folder_id, created_at)`);
      
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