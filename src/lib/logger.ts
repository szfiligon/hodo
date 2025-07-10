import { v4 as uuidv4 } from 'uuid';

// 检查是否在服务器端
const isServer = typeof window === 'undefined';

// 生成简短的 traceId
function generateShortId(): string {
  // 使用时间戳 + 随机数的组合，生成8位字符
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp.slice(-4)}${random}`;
}

// 从调用栈自动生成逻辑文件名
function getLogicalFileName(): string {
  const stack = new Error().stack;
  if (!stack) return 'unknown';

  const lines = stack.split('\n');
  // 查找第一个不是logger.ts的调用栈行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && !line.includes('logger.ts') && !line.includes('getCallerInfo') && !line.includes('log')) {
      const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
      if (match) {
        const [, , filepath] = match;
        // 从文件路径中提取逻辑文件名
        const pathParts = filepath.split('/');
        const filename = pathParts[pathParts.length - 1]; // 获取文件名
        const dirname = pathParts[pathParts.length - 2]; // 获取目录名
        
        // 如果是route.ts文件，使用目录名作为逻辑名
        if (filename === 'route.ts') {
          return dirname;
        }
        
        // 否则使用文件名（去掉扩展名）
        return filename.replace(/\.(ts|js|tsx|jsx)$/, '');
      }
    }
  }
  
  return 'unknown';
}

// 获取用户名（服务器端）
async function getUsername(): Promise<string> {
  if (!isServer) return 'client';
  
  try {
    const db = require('@/lib/db').default;
    const user = db.prepare('SELECT username FROM users LIMIT 1').get();
    return user?.username || 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

// 从请求中获取traceId
function getTraceIdFromRequest(request?: Request): string {
  if (!request) return generateShortId();
  
  const traceId = request.headers.get('x-trace-id');
  // 如果请求头中的traceId太长（UUID格式），则生成新的短ID
  if (traceId && traceId.length > 10) {
    return generateShortId();
  }
  return traceId || generateShortId();
}

// 文件日志写入函数（仅服务器端）
function writeToFile(level: string, logMessage: string, meta?: any) {
  if (!isServer) return;
  try {
    const fs = require('fs');
    const path = require('path');
    // 确保logs目录存在
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    // 构建完整的日志消息
    const fullMessage = `${logMessage}${meta ? ` | ${JSON.stringify(meta)}` : ''}\n`;
    // 写入所有日志文件
    const appLogPath = path.join(logsDir, 'app.log');
    fs.appendFileSync(appLogPath, fullMessage);
    // 如果是错误日志，也写入错误日志文件
    if (level === 'error') {
      const errorLogPath = path.join(logsDir, 'error.log');
      fs.appendFileSync(errorLogPath, fullMessage);
    }
  } catch (error) {
    // 如果文件写入失败，只输出到控制台
    console.error('Failed to write to log file:', error);
  }
}

// 创建带 traceId 的日志方法
class Logger {
  private traceId: string;
  private username: string;

  constructor(traceId?: string, username?: string) {
    this.traceId = traceId || generateShortId();
    this.username = username || 'unknown';
  }

  private async log(level: string, message: string, meta?: any) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // 获取用户名（如果还没有设置）
    if (this.username === 'unknown' && isServer) {
      this.username = await getUsername();
    }
    
    // 自动获取逻辑文件名
    const logicalName = getLogicalFileName();
    
    const logMessage = `${timestamp}|${this.username}|${this.traceId}|${logicalName}|${message}`;
    
    // 使用 console 进行日志输出
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warn' ? 'warn' : 
                         level === 'debug' ? 'debug' : 'log';
    console[consoleMethod](`[${level.toUpperCase()}] ${logMessage}`, meta || '');
    // 服务器端同时写入文件
    writeToFile(level, logMessage, meta);
  }

  async info(message: string, meta?: any) {
    await this.log('info', message, meta);
  }

  async error(message: string, meta?: any) {
    await this.log('error', message, meta);
  }

  async warn(message: string, meta?: any) {
    await this.log('warn', message, meta);
  }

  async debug(message: string, meta?: any) {
    await this.log('debug', message, meta);
  }

  // 创建新的 logger 实例，可以传入新的 traceId 和 username
  child(traceId?: string, username?: string): Logger {
    return new Logger(traceId, username);
  }

  // 获取当前 traceId
  getTraceId(): string {
    return this.traceId;
  }

  // 获取当前用户名
  getUsername(): string {
    return this.username;
  }
}

// 创建默认 logger 实例
const defaultLogger = new Logger();

// 便捷函数：从请求创建logger
function createLoggerFromRequest(request?: Request): Logger {
  const traceId = getTraceIdFromRequest(request);
  return new Logger(traceId);
}

// 导出默认 logger 和 Logger 类
export { Logger, defaultLogger as logger, createLoggerFromRequest };
export default defaultLogger; 