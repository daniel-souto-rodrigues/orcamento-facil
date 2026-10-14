const path = require('node:path');
const { app, BrowserWindow, dialog } = require('electron');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let server;
  let applicationUrl;

  app.setName('Orçamento Fácil');
  process.env.ORCAMENTO_DATA_DIR = app.isPackaged
    ? process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath)
    : path.resolve(__dirname, '..');
  process.env.PORT = '0';

  async function startServer() {
    server = require('../server.cjs');
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    applicationUrl = `http://127.0.0.1:${server.address().port}/`;
  }

  async function createWindow() {
    const window = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 980,
      minHeight: 680,
      autoHideMenuBar: true,
      backgroundColor: '#f1f4f5',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    await window.loadURL(applicationUrl);
  }

  app.whenReady().then(async () => {
    await startServer();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  }).catch((error) => {
    console.error('Não foi possível iniciar o Orçamento Fácil.', error);
    dialog.showErrorBox('Falha ao iniciar', 'O aplicativo não conseguiu iniciar o serviço local.');
    app.quit();
  });

  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.on('before-quit', () => {
    if (server?.listening) server.close();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
