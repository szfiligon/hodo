const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

// 检查是否在打包后的环境中运行
const isPackaged = process.env.ELECTRON_IS_PACKAGED === 'true';

if (isPackaged) {
  // 设置工作目录为 app.asar 的父目录
  const appPath = process.env.ELECTRON_APP_PATH || path.dirname(process.execPath);
  const workingDir = path.join(appPath, 'resources', 'app');
  process.chdir(workingDir);
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  
  // 设置 NODE_PATH 以便找到 node_modules
  const nodeModulesPath = path.join(workingDir, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    process.env.NODE_PATH = nodeModulesPath;
    // 将 node_modules 路径添加到 module.paths
    require('module').globalPaths.push(nodeModulesPath);
  }
  
  // 设置 Next.js 相关路径
  const nextPath = path.join(workingDir, '.next');
  if (fs.existsSync(nextPath)) {
    process.env.NEXT_RUNTIME_DIR = nextPath;
  }
}

// 简单的日志工具（因为这是 CommonJS 环境）
function getLogsPath() {
  const os = require('os');
  const appName = 'Hodo';
  
  // 根据操作系统确定用户数据目录
  let userDataPath;
  
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
  
  const logsDir = path.join(userDataPath, 'logs');
  
  // 确保日志目录存在
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  return logsDir;
}

class Logger {
  constructor() {
    const logDir = getLogsPath();
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    this.logFile = path.join(logDir, `hodo-${dateStr}.log`);
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    const logMessage = `[${timestamp}] [${level}] ${message}${dataStr}\n`;
    
    console.log(logMessage.trim());
    fs.appendFileSync(this.logFile, logMessage, 'utf8');
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }
}

const logger = new Logger();

logger.info('[STARTUP] Next.js server starting', {
  isPackaged,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd()
});

const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// 准备 Next.js 应用
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  logger.info('[STARTUP] Next.js app prepared successfully', { dev, hostname, port });
  
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error('Error occurred handling request', { url: req.url, error: err.message });
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, () => {
    logger.info('[STARTUP] HTTP server started successfully', { url: `http://${hostname}:${port}` });
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((error) => {
  logger.error('[STARTUP] Failed to prepare Next.js app', { error: error.message, stack: error.stack });
  console.error('Failed to prepare Next.js app:', error);
  process.exit(1);
}); 