import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain } from "electron";
import { getPort } from "get-port-please";
import { startServer } from "next/dist/server/lib/start-server.js";
import { join } from "path";
import log from 'electron-log';

log.transports.file.fileName = 'main.log';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}';
log.transports.file.level = false;  // Corrected from string 'false' to boolean false
log.transports.console.level = false;  // Corrected from string 'false' to boolean false
log.transports.file.maxSize = 1048576;
const userLog = log.scope('user');
userLog.info('用户范围的消息');
app.on('ready', async () => {
  // 渲染进程崩溃
  app.on('renderer-process-crashed', (event, webContents, killed) => {
    log.error(
      `APP-ERROR:renderer-process-crashed; event: ${JSON.stringify(event)}; webContents:${JSON.stringify(
        webContents
      )}; killed:${JSON.stringify(killed)}`
    );
  });

  // GPU进程崩溃
  app.on('gpu-process-crashed', (event, killed) => {
    log.error(`APP-ERROR:gpu-process-crashed; event: ${JSON.stringify(event)}; killed: ${JSON.stringify(killed)}`);
  });

  // 渲染进程结束
  app.on('render-process-gone', async (event, webContents, details) => {
    log.error(
      `APP-ERROR:render-process-gone; event: ${JSON.stringify(event)}; webContents:${JSON.stringify(
        webContents
      )}; details:${JSON.stringify(details)}`
    );
  });

  // 子进程结束
  app.on('child-process-gone', async (event, details) => {
    log.error(`APP-ERROR:child-process-gone; event: ${JSON.stringify(event)}; details:${JSON.stringify(details)}`);
  });
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow.show());

  const loadURL = async () => {
    if (is.dev) {
      mainWindow.loadURL("http://localhost:3000");
    } else {
      try {
        const port = await startNextJSServer();
        console.log("Next.js server started on port:", port);
        mainWindow.loadURL(`http://localhost:${port}`);
      } catch (error) {
        console.error("Error starting Next.js server:", error);
      }
    }
  };

  loadURL();
  return mainWindow;
};

const startNextJSServer = async () => {
  try {
    const nextJSPort = await getPort({ portRange: [30_011, 50_000] });
    const webDir = join(app.getAppPath(), "app");

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

    return nextJSPort;
  } catch (error) {
    console.error("Error starting Next.js server:", error);
    throw error;
  }
};

app.whenReady().then(() => {
  createWindow();

  ipcMain.on("ping", () => console.log("pong"));
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});