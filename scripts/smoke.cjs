const path = require('node:path');
const {app, BrowserWindow, ipcMain} = require('electron');

const timeout = setTimeout(() => app.exit(2), 12000);
let menuRequested = false;
let refreshRequested = false;
ipcMain.once('widget:menu', () => { menuRequested = true; });
ipcMain.once('widget:refresh', () => { refreshRequested = true; });

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 360,
    height: 70,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'app', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  await window.loadFile(path.join(__dirname, '..', 'app', 'ui', 'index.html'));
  window.webContents.send('quota:update', {
    fiveHour: {remaining: 81, color: '#43c982', reset: '今天 18:20'},
    weekly: {remaining: 42, color: '#efb83f', reset: '9月1日 00:00'},
    deepseek: {remaining: '110', progress: 90, color: '#43c982', reset: '今日约 ¥12'},
    resets: 2
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const result = await window.webContents.executeJavaScript(`(() => ({
    values: [...document.querySelectorAll('.ring strong')].map((node) => node.textContent),
    resetCount: document.querySelector('#resets').textContent,
    direction: getComputedStyle(document.querySelector('#widget')).display,
    circleFont: getComputedStyle(document.querySelector('.ring strong')).fontSize,
    deepseekRing: document.querySelector('[data-key="deepseek"] .ring').style.getPropertyValue('--value'),
    width: Math.ceil(document.querySelector('#widget').getBoundingClientRect().width),
    height: Math.ceil(document.querySelector('#widget').getBoundingClientRect().height)
  }))()`);
  if (result.values.join('/') !== '81/42/110' || result.resetCount !== '· 重置 2' || result.direction !== 'flex' || result.circleFont !== '13px' || result.deepseekRing !== '90%' || result.width < 260 || result.width > 420 || result.height < 36 || result.height > 55) {
    throw new Error(JSON.stringify(result));
  }
  await window.webContents.executeJavaScript(`document.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))`);
  await new Promise((resolve) => setTimeout(resolve, 40));
  if (!menuRequested) throw new Error('Context menu bridge failed');
  await window.webContents.executeJavaScript(`document.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))`);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const refreshing = await window.webContents.executeJavaScript(`document.querySelector('#widget').classList.contains('refreshing')`);
  if (!refreshRequested || !refreshing) throw new Error('Double-click refresh bridge failed');
  console.log(`SMOKE_OK ${result.values.join('/')} ${result.width}x${result.height}`);
  clearTimeout(timeout);
  window.destroy();
  app.exit(0);
}).catch((error) => {
  console.error(error);
  clearTimeout(timeout);
  app.exit(1);
});
