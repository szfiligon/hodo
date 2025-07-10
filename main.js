import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain } from "electron";
import { getPort } from "get-port-please";
import { startServer } from "next/dist/server/lib/start-server.js";
import { join } from "path";
import logger from "./src/lib/logger.js";

// 设置 IPC 处理程序
ipcMain.handle('get-user-data-path', () => {
  logger.info('IPC: get-user-data-path called');
  return app.getPath('userData');
});

const createWindow = () => {
  logger.info('Creating main window');
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    webPreferences: {
      nodeIntegration: false, // 出于安全考虑设置为 false
      contextIsolation: true, // 启用上下文隔离
      sandbox: true, // 启用沙箱模式
      preload: join(__dirname, '../preload/index.js') // 添加预加载脚本
    },
  });

  mainWindow.on("ready-to-show", () => {
    logger.info('Main window ready to show');
    mainWindow.show();
  });

  const loadURL = async () => {
    if (is.dev) {
      logger.info('Loading URL in development mode: http://localhost:3000');
      mainWindow.loadURL("http://localhost:3000");
      // 在开发环境下打开开发者工具
      mainWindow.webContents.openDevTools();
      logger.info('Development tools opened');
    } else {
      try {
        const port = await startNextJSServer();
        logger.info(`Next.js server started on port: ${port}`);
        mainWindow.loadURL(`http://localhost:${port}`);
      } catch (error) {
        logger.error(`Error starting Next.js server: ${error.message}`, { error });
      }
    }
  };

  loadURL();
  return mainWindow;
};

const startNextJSServer = async () => {
  try {
    logger.info('Starting Next.js server...');
    const nextJSPort = await getPort({ portRange: [30_011, 50_000] });
    const webDir = join(app.getAppPath(), "app");
    logger.info(`Web directory: ${webDir}`);

    await startServer({
      dir: webDir,
      isDev: false,
      hostname: "localhost",
      port: nextJSPort,
      customServer: true,
      allowRetry: false,
      keepAliveTimeout: 5000,
      minimalMode: true,
    });

    logger.info(`Next.js server started successfully on port ${nextJSPort}`);
    return nextJSPort;
  } catch (error) {
    logger.error(`Error starting Next.js server: ${error.message}`, { error });
    throw error;
  }
};

app.whenReady().then(() => {
  logger.info('Electron app is ready');
  createWindow();

  ipcMain.on("ping", () => {
    logger.info('IPC: ping received');
    console.log("pong");
  });
  
  app.on("activate", () => {
    logger.info('App activated');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  logger.info('All windows closed');
  if (process.platform !== "darwin") {
    logger.info('Quitting app (not on macOS)');
    app.quit();
  }
});