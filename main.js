const { app, BrowserWindow } = require('electron');

function createWindow() {

    const win = new BrowserWindow({
        width: 1200,
        height: 800
    });

    win.loadFile('index.html');

    // 程式碼視窗開發工具，開發完成後可以註解掉這行
    //win.webContents.openDevTools();
}

app.whenReady().then(createWindow);