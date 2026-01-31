const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

// 检查是否在 Electron 打包环境中运行
const isPackaged = process.env.ELECTRON_IS_PACKAGED === 'true';

if (isPackaged) {
  // 在打包环境中，确保禁用 Next.js 遥测
  process.env.NEXT_TELEMETRY_DISABLED = '1';
}

// 简单的日志工具
function getLogsPath() {
  const os = require('os');
  const appName = 'Hodo';
  
  let userDataPath;
  switch (process.platform) {
    case 'win32':
      userDataPath = path.join(process.env.APPDATA || '', appName);
      break;
    case 'darwin':
      userDataPath = path.join(os.homedir(), 'Library', 'Application Support', appName);
      break;
    default:
      userDataPath = path.join(os.homedir(), '.config', appName);
      break;
  }
  
  const logsDir = path.join(userDataPath, 'logs');
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

// 捕获未处理的错误
process.on('uncaughtException', (error) => {
  logger.error('[FATAL] Uncaught exception', { error: error.message, stack: error.stack });
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[FATAL] Unhandled rejection', { reason: reason?.toString(), stack: reason?.stack });
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

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
  }).listen(port, hostname, () => {
    logger.info('[STARTUP] HTTP server started successfully', { url: `http://${hostname}:${port}` });
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((error) => {
  logger.error('[STARTUP] Failed to prepare Next.js app', { error: error.message, stack: error.stack });
  console.error('Failed to prepare Next.js app:', error);
  process.exit(1);
});
