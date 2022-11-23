let electron, {BrowserWindow, ipcMain} = require("electron");
const config = require('../constant');
const {IpcMain} = require('electron');

/**
 * @param {IpcMain} ipcMain
 * @param {Electron.Display[] | undefined} displays
 * */
function setupCustomerDisplay(ipcMain, displays) {
    /** @type {BrowserWindow | null}  */
    let customerDisplay = null;
    ipcMain.on('open-customer-display', (event, args) => {
        let x = 0;
        let y = 0

        if (displays.length > 1) {
            x = displays[1].bounds.x;
            y = displays[1].bounds.y;
        }
        customerDisplay = new BrowserWindow({
            x,
            y,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableWebSQL: true,
                allowRunningInsecureContent: true,

            },
            fullscreen: true, // TODO switch to true for prod
            titleBarStyle: 'hidden' // TODO switch to 'hidden' for prod,
        });
        customerDisplay.loadURL(new URL(`${config.url}/#/customer-display`).href)
        customerDisplay.on('close', () => {
            customerDisplay = null;
            ipcMain.emit('customer-display-closed')
        })
    });

    ipcMain.on('close-customer-display', (event, args) => {
        customerDisplay.close();
        customerDisplay = null;
    });

    ipcMain.on('check-customer-display-status', (event, args) => {
        event.sender.send('customer-display-status', !!customerDisplay)
    })
}

module.exports = setupCustomerDisplay;