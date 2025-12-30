import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * 获取用户数据目录路径
 * 在开发和生产环境中都使用用户主目录下的应用数据文件夹
 */
export function getUserDataPath(): string {
  const appName = 'Hodo';
  
  // 根据操作系统确定用户数据目录
  let userDataPath: string;
  
  switch (process.platform) {
    case 'win32':
      // Windows: %APPDATA%\Hodo
      userDataPath = path.join(process.env.APPDATA || '', appName);
      break;
    case 'darwin':
      // macOS: ~/Library/Application Support/Hodo
      userDataPath = path.join(os.homedir(), 'Library', 'Application Support', appName);
      break;
    default:
      // Linux: ~/.config/Hodo
      userDataPath = path.join(os.homedir(), '.config', appName);
      break;
  }
  
  return userDataPath;
}

/**
 * 获取数据库文件路径
 */
export function getDatabasePath(): string {
  const userDataPath = getUserDataPath();
  const dataDir = path.join(userDataPath, 'data');
  
  // 确保数据目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return `file:${path.join(dataDir, 'hodo.db')}`;
}

/**
 * 获取日志目录路径
 */
export function getLogsPath(): string {
  const userDataPath = getUserDataPath();
  const logsDir = path.join(userDataPath, 'logs');
  
  // 确保日志目录存在
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  return logsDir;
}

/**
 * 获取日志文件路径
 */
export function getLogFilePath(): string {
  const logsDir = getLogsPath();
  return path.join(logsDir, 'app.log');
}

/**
 * 初始化用户数据目录结构
 */
export function initializeUserDataDirectories(): void {
  try {
    const userDataPath = getUserDataPath();
    const dataDir = path.join(userDataPath, 'data');
    const logsDir = path.join(userDataPath, 'logs');
    
    // 创建主目录
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
      console.log('Created user data directory:', userDataPath);
    }
    
    // 创建数据目录
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('Created data directory:', dataDir);
    }
    
    // 创建日志目录
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log('Created logs directory:', logsDir);
    }
    
    console.log('User data directories initialized successfully');
  } catch (error) {
    console.error('Failed to initialize user data directories:', error);
    throw error;
  }
}

/**
 * 获取用户数据目录信息（用于调试）
 */
export function getUserDataInfo() {
  return {
    userDataPath: getUserDataPath(),
    databasePath: getDatabasePath(),
    logsPath: getLogsPath(),
    logFilePath: getLogFilePath(),
    platform: process.platform,
    isPackaged: process.env.ELECTRON_IS_PACKAGED === 'true'
  };
} 