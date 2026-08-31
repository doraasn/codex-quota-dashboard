import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray} from 'electron';
import {emptyWidgetState} from './quota-format.js';
import {locateCodex, QuotaClient} from './quota-client.js';
import {DeepSeekClient} from './deepseek-client.js';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(appDir, '..');
const refreshEveryMs = 5000;
const layerDelayMs = 120;
const initialSize = {width: 360, height: 46};

let window;
let tray;
let client;
let deepSeekClient;
let refreshTimer;
let layerTimer;
let closing = false;
let measuredSize = {...initialSize};
let widgetState = emptyWidgetState();

app.setPath('userData', path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'CodexQuotaDashboard'));
const shutdownOnly = process.argv.includes('--shutdown');
const ownsLock = app.requestSingleInstanceLock();

if (!ownsLock || shutdownOnly) {
  app.quit();
} else {
  app.on('second-instance', (_event, args) => {
    if (args.includes('--shutdown')) quit();
    else reveal();
  });
}

app.whenReady().then(() => {
  if (!ownsLock || shutdownOnly) return;
  app.setAppUserModelId('com.doraasn.codexquotadashboard');
  start();
});

app.on('before-quit', dispose);

async function start() {
  if (window || closing) return;
  await createWindow();
  createTray();
  connect();
  deepSeekClient = new DeepSeekClient(app.getPath('userData'));
  deepSeekClient.on('balance', applyDeepSeekState);
  requestBalances();
  refreshTimer = setInterval(requestBalances, refreshEveryMs);
  refreshTimer.unref?.();
}

async function createWindow() {
  const saved = readPosition();
  const fallback = defaultPosition();
  window = new BrowserWindow({
    ...(saved || fallback),
    ...initialSize,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    movable: true,
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    title: 'Codex Quota Dashboard',
    webPreferences: {
      preload: path.join(appDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.setAlwaysOnTop(true, 'screen-saver');
  window.on('moved', () => {
    savePosition();
    scheduleLayerRepair();
  });
  window.on('blur', scheduleLayerRepair);
  window.on('minimize', (event) => {
    event.preventDefault();
    reveal();
  });
  window.on('closed', () => {
    window = null;
  });
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  await window.loadFile(path.join(appDir, 'ui', 'index.html'));
  sendState(widgetState);
  window.showInactive();
}

function createTray() {
  const resource = app.isPackaged ? path.join(process.resourcesPath, 'tray.png') : path.join(projectDir, 'assets', 'tray.png');
  tray = new Tray(nativeImage.createFromPath(resource));
  tray.setToolTip('Codex 额度');
  tray.on('click', reveal);
  updateTrayMenu();
}

function updateTrayMenu() {
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {label: '刷新额度', click: requestBalances},
      {type: 'separator'},
      {label: '退出', click: quit}
    ])
  );
}

function connect() {
  const executable = locateCodex();
  if (!executable) {
    sendState(emptyWidgetState());
    return;
  }
  client = new QuotaClient();
  client.on('quota', applyCodexState);
  client.on('offline', () => applyCodexState(emptyWidgetState()));
  client.start(executable);
}

function requestBalances() {
  requestQuota();
  deepSeekClient?.refresh();
}

function requestQuota() {
  if (!client) connect();
  client?.refresh();
}

function applyCodexState(state) {
  widgetState = {
    ...widgetState,
    fiveHour: state.fiveHour,
    weekly: state.weekly,
    resets: state.resets
  };
  sendState(widgetState);
}

function applyDeepSeekState(state) {
  widgetState = {...widgetState, deepseek: state};
  sendState(widgetState);
}

function sendState(state) {
  if (!window || window.isDestroyed()) return;
  window.webContents.send('quota:update', state);
}

ipcMain.on('widget:resize', (event, size) => {
  if (!window || event.sender !== window.webContents) return;
  const width = Math.max(180, Math.min(500, Math.ceil(Number(size?.width) || 0)));
  const height = Math.max(36, Math.min(80, Math.ceil(Number(size?.height) || 0)));
  if (width === measuredSize.width && height === measuredSize.height) return;
  measuredSize = {width, height};
  window.setContentSize(width, height, false);
});

ipcMain.on('widget:menu', (event) => {
  if (!window || event.sender !== window.webContents) return;
  Menu.buildFromTemplate([{label: '退出', click: quit}]).popup({window});
});

ipcMain.on('widget:refresh', (event) => {
  if (!window || event.sender !== window.webContents) return;
  requestBalances();
});

function scheduleLayerRepair() {
  if (!window || !overlapsTaskbar()) return;
  clearTimeout(layerTimer);
  layerTimer = setTimeout(() => {
    if (!window || closing || !overlapsTaskbar()) return;
    window.setAlwaysOnTop(false);
    window.setAlwaysOnTop(true, 'screen-saver');
  }, layerDelayMs);
  layerTimer.unref?.();
}

function overlapsTaskbar() {
  const bounds = window.getBounds();
  const work = screen.getDisplayMatching(bounds).workArea;
  return bounds.x < work.x || bounds.y < work.y || bounds.x + bounds.width > work.x + work.width || bounds.y + bounds.height > work.y + work.height;
}

function reveal() {
  if (!window || closing) return;
  if (window.isMinimized()) window.restore();
  window.setAlwaysOnTop(true, 'screen-saver');
  if (!window.isVisible()) window.showInactive();
}

function defaultPosition() {
  const work = screen.getPrimaryDisplay().workArea;
  return {x: work.x + work.width - initialSize.width - 20, y: work.y + work.height - initialSize.height - 20};
}

function positionPath() {
  return path.join(app.getPath('userData'), 'position.json');
}

function readPosition() {
  try {
    const value = JSON.parse(fs.readFileSync(positionPath(), 'utf8'));
    return Number.isFinite(value.x) && Number.isFinite(value.y) ? {x: Math.trunc(value.x), y: Math.trunc(value.y)} : null;
  } catch {
    return null;
  }
}

function savePosition() {
  if (!window || window.isDestroyed()) return;
  const [x, y] = window.getPosition();
  fs.mkdirSync(app.getPath('userData'), {recursive: true});
  fs.writeFileSync(positionPath(), JSON.stringify({x, y}), 'utf8');
}

function quit() {
  if (closing) return;
  dispose();
  tray?.destroy();
  window?.destroy();
  app.exit(0);
}

function dispose() {
  if (closing) return;
  closing = true;
  clearInterval(refreshTimer);
  clearTimeout(layerTimer);
  savePosition();
  client?.stop();
  client = null;
  deepSeekClient = null;
}
