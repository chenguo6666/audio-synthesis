// Electron 主进程：用自定义 app:// 协议加载 dist/，让 ES Module Worker 与 wasm 正常工作
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const SCHEME = 'app';

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 400,
    minHeight: 500,
    title: '音频剪辑合成',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 外部链接（如 GitHub）用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.AUDIO_SMOKE_TEST) {
    const { runSmoke } = require('./smoke.cjs');
    runSmoke(win, process.env.AUDIO_SMOKE_TEST).then((code) => app.exit(code));
  }

  win.loadURL(`${SCHEME}://local/index.html`);
}

// 单实例运行
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle(SCHEME, (request) => {
      const { pathname } = new URL(request.url);
      const target = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
      // 防止路径穿越到 dist 之外
      if (!target.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(target).toString());
    });
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
