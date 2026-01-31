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

// 日志输出函数（同时输出到控制台和文件）
function log(message, ...args) {
  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ' ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ') : '';
  const logMessage = `[${timestamp}] [ELECTRON] ${message}${argsStr}\n`;
  
  // 输出到控制台（开发环境可见）
  console.log(logMessage.trim());
  
  // 写入文件
  try {
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

// 应用启动时立即记录日志文件位置和基本信息
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
    // 打包环境：使用标准 Next.js 构建输出
    // server.js、.next/server 和 node_modules 都在 app.asar.unpacked 中（通过 asarUnpack 解压）
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    workingDir = unpackedPath;
    serverPath = path.join(unpackedPath, 'server.js');
    
    log('Using server path:', serverPath);
    log('Using working directory:', workingDir);
    
    // node_modules 应该在 app.asar.unpacked 中（通过 asarUnpack 解压）
    const nodeModulesPath = path.join(unpackedPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      log('node_modules found at:', nodeModulesPath);
    } else {
      log('WARNING: node_modules not found at:', nodeModulesPath);
    }
  } else {
    // 开发环境：使用项目根目录的 server.js
    workingDir = path.join(__dirname, '..');
    serverPath = path.join(workingDir, 'server.js');
  }
  
  log('Server path:', serverPath);
  log('Working directory:', workingDir);
  log('Is packaged:', isPackaged);
  log('App path:', app.getAppPath());
  
  // 设置环境变量
  process.env.ELECTRON_IS_PACKAGED = isPackaged ? 'true' : 'false';
  if (isPackaged) {
    process.env.ELECTRON_APP_PATH = path.dirname(process.execPath);
  }
  
  // 切换到正确的工作目录（必须在设置环境变量之前）
  try {
    process.chdir(workingDir);
    log('Changed working directory to:', process.cwd());
    
    // 验证工作目录中的文件
    if (isPackaged) {
      const nodeModulesPath = path.join(workingDir, 'node_modules');
      const nextPath = path.join(nodeModulesPath, 'next');
      log('Checking node_modules in working directory:', {
        nodeModulesExists: fs.existsSync(nodeModulesPath),
        nextExists: fs.existsSync(nextPath),
        workingDir: workingDir
      });
      
      // 列出工作目录的内容
      try {
        const dirContents = fs.readdirSync(workingDir);
        log('Working directory contents:', dirContents.slice(0, 20)); // 只显示前20个
      } catch (err) {
        log('Cannot read working directory:', err.message);
      }
    }
  } catch (error) {
    log('Failed to change working directory:', error);
  }
  
  // 创建窗口（即使服务器启动失败也要显示窗口）
  createWindow();
  
  // 启动服务器进程
  // 根据方案：使用 spawn(process.execPath, [serverPath], { cwd: app.asar.unpacked })
  log('Spawning server process...');
  log('Exec path (Electron):', process.execPath);
  log('Server path:', serverPath);
  log('Working directory:', workingDir);
  
  // 最终验证
  if (!fs.existsSync(serverPath)) {
    log('ERROR: Server file does not exist:', serverPath);
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<h1>服务器文件未找到</h1><p>路径: ${serverPath}</p><p>请检查打包配置</p>';
      `);
    }
    return;
  }
  
  if (!fs.existsSync(process.execPath)) {
    log('ERROR: Electron executable not found:', process.execPath);
    return;
  }
  
  log('Starting server process...', {
    execPath: process.execPath,
    serverPath: serverPath,
    workingDir: workingDir
  });
  
  // 关键修复：使用 ELECTRON_RUN_AS_NODE=1 让 Electron 以 Node.js 模式运行脚本
  // 否则 Electron 可执行文件会再次启动 Electron 应用，导致死循环
  const serverEnv = { 
    ...process.env, 
    NODE_ENV: 'production',
    ELECTRON_IS_PACKAGED: isPackaged ? 'true' : 'false',
    ELECTRON_APP_PATH: isPackaged ? path.dirname(process.execPath) : undefined,
    ELECTRON_RUN_AS_NODE: '1' // 强制 Electron 以 Node.js 模式运行，而不是启动 Electron 应用
  };
  
  // 在打包环境中，node_modules 在 app.asar.unpacked 中（通过 asarUnpack 解压）
  if (isPackaged) {
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    const nodeModulesPath = path.join(unpackedPath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      log('Found node_modules at:', nodeModulesPath);
      // NODE_PATH 应该指向包含 node_modules 的目录（app.asar.unpacked）
      serverEnv.NODE_PATH = unpackedPath;
      log('Set NODE_PATH for server process:', serverEnv.NODE_PATH);
    } else {
      log('WARNING: node_modules not found at:', nodeModulesPath);
    }
  }
  
  // 删除可能干扰的 Electron 相关环境变量，防止再次启动 Electron
  delete serverEnv.ELECTRON_NO_ATTACH_CONSOLE;
  delete serverEnv.ELECTRON_FORCE_IS_PACKAGED;
  delete serverEnv.ELECTRON_OVERRIDE_DIST_PATH;
  
  log('Starting server with ELECTRON_RUN_AS_NODE=1 (Node.js mode)');
  log('Server environment:', {
    NODE_ENV: serverEnv.NODE_ENV,
    NODE_PATH: serverEnv.NODE_PATH,
    cwd: workingDir,
    serverPath: serverPath
  });
  
  // 根据方案：使用 spawn(process.execPath, [serverPath], { cwd: app.asar.unpacked })
  serverProcess = spawn(process.execPath, [serverPath], {
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'], // 捕获 stdout 和 stderr
    cwd: workingDir, // 设置工作目录为 app.asar.unpacked
    shell: false
  });
  
  // 捕获服务器输出
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    log('Server stdout:', output.trim());
  });
  
  serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    log('Server stderr:', output.trim());
  });
  
  serverProcess.on('error', (error) => {
    log('Server process error:', error.message, error.stack);
    // 显示错误窗口
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
      // 显示错误信息
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
          document.body.innerHTML = '<h1>服务器已退出</h1><p>退出代码: ${code}</p><p>请查看日志文件获取详细信息</p>';
        `);
      }
    }
  });
  
  // 等待服务器启动后刷新窗口
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      log('Reloading window after server startup...');
      mainWindow.reload();
    }
  }, 5000);
}

// 创建浏览器窗口
function createWindow() {
  // 如果窗口已存在，先关闭
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  
  log('Creating browser window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 先不显示，等加载完成后再显示
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    mainWindow.show();
  });
  
  const url = 'http://localhost:3000';
  log('Loading URL:', url);
  
  // 设置超时，如果服务器未启动则显示错误页面
  const loadTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      log('Load timeout, showing error page');
      mainWindow.loadURL(`data:text/html,<html><body><h1>等待服务器启动...</h1><p>如果此页面持续显示，请检查日志文件：${logFilePath}</p></body></html>`);
    }
  }, 10000);
  
  mainWindow.loadURL(url).then(() => {
    clearTimeout(loadTimeout);
    log('URL loaded successfully');
  }).catch((error) => {
    clearTimeout(loadTimeout);
    log('Failed to load URL:', error);
    mainWindow.loadURL(`data:text/html,<html><body><h1>无法连接到服务器</h1><p>错误: ${error.message}</p><p>日志文件: ${logFilePath}</p></body></html>`);
  });
  
  // 开发环境下打开开发者工具
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.on('closed', () => {
    log('Window closed');
    mainWindow = null;
  });
  
  // 监听页面加载错误
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
