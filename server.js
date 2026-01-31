const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

// 检查是否在 Electron 打包环境中运行
const isPackaged = process.env.ELECTRON_IS_PACKAGED === 'true';

if (isPackaged) {
  // 在打包环境中，使用标准 Next.js 构建输出
  // server.js 在 app.asar 中，.next/server 和 node_modules 在 app.asar.unpacked 中
  // 工作目录设置为 process.resourcesPath（由 Electron 主进程设置）
  // 确保禁用 Next.js 遥测
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  
  // NODE_PATH 应该已经由 Electron 主进程设置
  // Next.js 会自动查找 .next/server 和 .next/static
  // .next/server 在 app.asar.unpacked 中（通过 asarUnpack 解压）
  // .next/static 在 app.asar 中（通过 files 配置包含）
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
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd()
});

const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// 准备 Next.js 应用
// Next.js 会在当前工作目录查找 .next 目录
// 在打包环境中，工作目录应该设置为 app.asar.unpacked（由 Electron 主进程设置）
const nextDir = path.join(process.cwd(), '.next');
logger.info('[STARTUP] Initializing Next.js app', {
  dev,
  hostname,
  port,
  cwd: process.cwd(),
  nextDir: nextDir,
  nextDirExists: fs.existsSync(nextDir)
});

// 检查 .next 目录的关键文件
if (fs.existsSync(nextDir)) {
  const buildIdPath = path.join(nextDir, 'BUILD_ID');
  const serverPath = path.join(nextDir, 'server');
  logger.info('[STARTUP] Checking .next directory', {
    BUILD_ID: fs.existsSync(buildIdPath),
    server: fs.existsSync(serverPath),
    serverContents: fs.existsSync(serverPath) ? fs.readdirSync(serverPath).slice(0, 5) : []
  });
}

// 显式指定 distDir，确保 Next.js 能找到构建文件
// 注意：Next.js 15 可能需要不同的配置
logger.info('[STARTUP] Creating Next.js app instance...');

// 检查关键文件是否存在
const requiredFiles = [
  'BUILD_ID',
  'server/app',
  'server/chunks'
];
const missingFiles = requiredFiles.filter(file => {
  const filePath = path.join(nextDir, file);
  return !fs.existsSync(filePath);
});

if (missingFiles.length > 0) {
  logger.error('[STARTUP] Missing required files', { missingFiles });
  console.error('Missing required files:', missingFiles);
}

const app = next({ 
  dev, 
  hostname, 
  port,
  dir: process.cwd() // 显式指定工作目录
});
logger.info('[STARTUP] Next.js app instance created');
const handle = app.getRequestHandler();
logger.info('[STARTUP] Request handler created');

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

logger.info('[STARTUP] Starting app.prepare()...');

// 添加超时处理
const prepareTimeout = setTimeout(() => {
  logger.error('[STARTUP] app.prepare() timeout after 30 seconds');
  console.error('Next.js app.prepare() timeout');
  process.exit(1);
}, 30000);

app.prepare().then(() => {
  clearTimeout(prepareTimeout);
  logger.info('[STARTUP] Next.js app prepared successfully', { dev, hostname, port });
  
  logger.info('[STARTUP] Creating HTTP server...');
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error('Error occurred handling request', { url: req.url, error: err.message });
      res.statusCode = 500;
      res.end('internal server error');
    }
  });
  
  server.on('error', (err) => {
    logger.error('[STARTUP] HTTP server error', { error: err.message, stack: err.stack });
    console.error('HTTP server error:', err);
    process.exit(1);
  });
  
  server.listen(port, hostname, () => {
    logger.info('[STARTUP] HTTP server started successfully', { url: `http://${hostname}:${port}` });
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((error) => {
  clearTimeout(prepareTimeout);
  logger.error('[STARTUP] Failed to prepare Next.js app', { error: error.message, stack: error.stack });
  console.error('Failed to prepare Next.js app:', error);
  console.error('Error stack:', error.stack);
  process.exit(1);
}); 