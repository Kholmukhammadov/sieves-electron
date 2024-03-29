const electron = require("electron");
const {
  app,
  BrowserWindow,
  ipcMain,
  webContents,
  PrintSettings,
} = require("electron");
require("update-electron-app")({
  repo: "Kholmukhammadov/sieves-electron",
  updateInterval: "12 hour",
});
const setupCustomerDisplay = require("./customer-display");
const handlePrint = require("./electron-print");
const config = require("../constant");
app.disableHardwareAcceleration();

/** @type {Electron.CrossProcessExports.BrowserWindow} */
let mainWindow;

try {
  require("electron-reloader")(module, {
    debug: true,
    watchRenderer: true,
  });
} catch (error) {}
let isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}
function createWindow() {
  /** @type {Electron.Display[]} */
  const displays = electron?.screen.getAllDisplays();
  const x = displays[0].bounds.x || 0;
  const y = displays[0].bounds.y || 0;
  mainWindow = new BrowserWindow({
    width: 2000,
    height: 3000,
    autoHideMenuBar: true,
    icon: "./assets/icon/logo.png",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      enableWebSQL: true,
    },
    // fullscreen: true,
    // alwaysOnTop: true,
    // skipTaskbar: true
  });

  mainWindow.loadURL(config.url, { slashes: true });
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
  setupCustomerDisplay(ipcMain, displays);
  handlePrint(
    ipcMain,
    mainWindow.webContents.getPrinters().find((printer) => printer.isDefault)
      .name
  );
  mainWindow.on("closed", function () {
    mainWindow = null;
    app.quit();
  });
}

if (require("electron-squirrel-startup")) app.quit();
app.on("ready", () => {
  // Create main window
  createWindow();
});

ipcMain.on("sendCommand", (event, commandValue) => {
  const port = new SerialPort(
    { path: "\\\\.\\COM20", baudRate: 9600 },
    (err) => {
      if (err) {
        event.reply("sendCommandResponse", err.message);
      } else {
        port.write(Buffer.from(commandValue, "hex"), (writeErr) => {
          if (writeErr) {
            event.reply("sendCommandResponse", writeErr.message);
          } else {
            // Additional processing if needed
            event.reply("sendCommandResponse", null);
          }

          // Close the serial port after writing
          port.close();
        });
      }
    }
  );
});

app.on("window-all-closed", function () {
  app.quit();
});

app.on("second-instance", (event, argv, cwd) => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});

app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
