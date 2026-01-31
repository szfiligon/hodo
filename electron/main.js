const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// 获取日志目录路径
function getLogsPath() {
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

// 获取日志文件路径
function getLogFilePath() {
  const logsDir = getLogsPath();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  return path.join(logsDir, `electron-${dateStr}.log`);
}

const logFilePath = getLogFilePath();

// 日志输出函数
function log(message, ...args) {
  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ' ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ') : '';
  const logMessage = `[${timestamp}] [ELECTRON] ${message}${argsStr}\n`;
  
  console.log(logMessage.trim());
  
  try {
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

log('Electron main process starting', {
  logFile: logFilePath,
  platform: process.platform,
  nodeVersion: process.version,
  electronVersion: process.versions.electron,
  isPackaged: app.isPackaged
});

// 启动 Next.js 服务器
function startServer() {
  log('Starting Next.js server...');
  
  const isPackaged = app.isPackaged;
  let serverPath;
  let workingDir;
  
  if (isPackaged) {
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    workingDir = unpackedPath;
    serverPath = path.join(unpackedPath, 'server.js');
  } else {
    workingDir = path.join(__dirname, '..');
    serverPath = path.join(workingDir, 'server.js');
  }
  
  // 设置环境变量
  process.env.ELECTRON_IS_PACKAGED = isPackaged ? 'true' : 'false';
  if (isPackaged) {
    process.env.ELECTRON_APP_PATH = path.dirname(process.execPath);
  }
  
  // 切换到正确的工作目录
  try {
    process.chdir(workingDir);
  } catch (error) {
    log('Failed to change working directory:', error);
  }
  
  // 创建窗口
  createWindow();
  
  // 验证服务器文件是否存在
  if (!fs.existsSync(serverPath)) {
    log('ERROR: Server file does not exist:', serverPath);
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<h1>服务器文件未找到</h1><p>路径: ${serverPath}</p><p>请检查打包配置</p>';
      `);
    }
    return;
  }
  
  // 准备服务器环境变量
  const serverEnv = { 
    ...process.env, 
    NODE_ENV: 'production',
    ELECTRON_IS_PACKAGED: isPackaged ? 'true' : 'false',
    ELECTRON_APP_PATH: isPackaged ? path.dirname(process.execPath) : undefined,
    ELECTRON_RUN_AS_NODE: '1'
  };
  
  // 在打包环境中设置 NODE_PATH
  if (isPackaged) {
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    const nodeModulesPath = path.join(unpackedPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      serverEnv.NODE_PATH = unpackedPath;
    }
  }
  
  // 删除可能干扰的 Electron 相关环境变量
  delete serverEnv.ELECTRON_NO_ATTACH_CONSOLE;
  delete serverEnv.ELECTRON_FORCE_IS_PACKAGED;
  delete serverEnv.ELECTRON_OVERRIDE_DIST_PATH;
  
  // 启动服务器进程
  serverProcess = spawn(process.execPath, [serverPath], {
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: workingDir,
    shell: false
  });
  
  // 标记服务器是否已启动
  let serverReady = false;
  
  // 捕获服务器输出
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    
    // 检测服务器是否已启动
    if (!serverReady && (output.includes('HTTP server started successfully') || output.includes('Ready on http://localhost:3000'))) {
      serverReady = true;
      log('Server is ready, loading window...');
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        const currentURL = mainWindow.webContents.getURL();
        if (currentURL && currentURL.includes('localhost:3000')) {
          mainWindow.reload();
        } else {
          mainWindow.loadURL('http://localhost:3000').catch((error) => {
            log('Failed to load URL after server ready:', error);
          });
        }
      }
    }
  });
  
  serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    log('Server stderr:', output.trim());
  });
  
  serverProcess.on('error', (error) => {
    log('Server process error:', error.message);
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<h1>服务器启动失败</h1><pre>${error.message}</pre>';
      `);
    }
  });
  
  serverProcess.on('exit', (code, signal) => {
    log('Server process exited', { code, signal });
    if (code !== 0 && code !== null) {
      log('Server exited with error code:', code);
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
          document.body.innerHTML = '<h1>服务器已退出</h1><p>退出代码: ${code}</p><p>请查看日志文件获取详细信息</p>';
        `);
      }
    }
  });
  
  // 备用方案：如果10秒后服务器仍未就绪，尝试加载页面
  setTimeout(() => {
    if (!serverReady && mainWindow && !mainWindow.isDestroyed()) {
      log('Server startup timeout, attempting to load page...');
      const currentURL = mainWindow.webContents.getURL();
      if (!currentURL || !currentURL.includes('localhost:3000')) {
        mainWindow.loadURL('http://localhost:3000').catch((error) => {
          log('Failed to load URL after timeout:', error);
        });
      }
    }
  }, 10000);
}

// 创建浏览器窗口
function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  
  log('Creating browser window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    mainWindow.show();
  });
  
  // 先显示等待页面，等服务器启动后再加载实际页面
  const waitingPage = `data:text/html,<html><head><meta charset="utf-8"><title>启动中...</title><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;}div{text-align:center;padding:20px;background:white;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}</style></head><body><div><h1>正在启动服务器...</h1><p>请稍候</p></div></body></html>`;
  
  mainWindow.loadURL(waitingPage).catch((error) => {
    log('Failed to load waiting page:', error);
  });
  
  // 开发环境下打开开发者工具
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.on('closed', () => {
    log('Window closed');
    mainWindow = null;
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log('Page load failed:', { errorCode, errorDescription, validatedURL });
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    log('Page loaded successfully');
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  log('App ready, starting server...');
  startServer();
});

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  log('All windows closed');
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    startServer();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  log('App quitting, killing server process...');
  if (serverProcess) {
    serverProcess.kill();
  }
});
