const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const isDev = process.env.ELECTRON_DEV_SERVER === 'true' || process.env.VITE_DEV_SERVER_URL;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// 获取 ffmpeg 二进制文件路径
function getFFmpegPath() {
  try {
    // 优先使用打包内的 ffmpeg
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch (err) {
    // ffmpeg-static 未安装，继续尝试系统 ffmpeg
  }
  // 降级到系统 ffmpeg
  return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();

let selectedFolder = '';
/**
 * windows: Map<webContentsId, {
 *  win: BrowserWindow,
 *  recording: boolean,
 *  recordingPaths: { eventLog, networkLog, framesDir } | null,
 *  captureInterval?: NodeJS.Timeout,
 *  networkListener?: Function
 * }>
 */
const windows = new Map();

/**
 * Creates the main renderer window.
 */
function createMainWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  return win;
}

function openUrlWindow(url) {
  const child = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'child-preload.js')
    }
  });

  const id = child.webContents.id;
  windows.set(id, {
    win: child,
    recording: false,
    recordingPaths: null,
    captureInterval: null,
    networkListener: null
  });

  child.on('closed', () => {
    stopRecording(id);
    windows.delete(id);
  });

  child.loadURL(url);
  return id;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  const now = new Date();
  const pad = (n) => `${n}`.padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(
    now.getMinutes()
  )}-${pad(now.getSeconds())}`;
}

function appendLine(filePath, payload) {
  fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, () => {});
}

function startRecording(windowId) {
  const entry = windows.get(windowId);
  if (!entry || entry.win.isDestroyed()) {
    return { success: false, message: '窗口不存在或已关闭' };
  }
  if (!selectedFolder) {
    return { success: false, message: '请先选择存储文件夹' };
  }
  if (entry.recording) {
    return { success: true, message: '该窗口已在录制中' };
  }

  const runDir = path.join(selectedFolder, `record-${windowId}-${timestamp()}`);
  ensureDir(runDir);

  const eventLog = path.join(runDir, 'events.ndjson');
  const networkLog = path.join(runDir, 'network.ndjson');
  const framesDir = path.join(runDir, 'frames');
  ensureDir(framesDir);

  entry.recordingPaths = { eventLog, networkLog, framesDir };
  entry.recording = true;

  // Network capture
  const session = entry.win.webContents.session;
  if (!entry.networkListener) {
    entry.networkListener = (details) => {
      if (!entry.recording) return;
      if (!windows.has(windowId)) return;
      if (details.webContentsId !== windowId) return;
      appendLine(entry.recordingPaths.networkLog, {
        type: 'network',
        method: details.method,
        url: details.url,
        statusCode: details.statusCode,
        fromCache: details.fromCache,
        timestamp: Date.now()
      });
    };
    session.webRequest.onCompleted(entry.networkListener);
  }

  // Frame capture
  let frameIndex = 0;
  entry.captureInterval = setInterval(async () => {
    if (!windows.has(windowId)) return;
    const current = windows.get(windowId);
    if (!current || !current.recording || current.win.isDestroyed()) return;
    try {
      const image = await current.win.capturePage();
      const file = path.join(current.recordingPaths.framesDir, `${String(frameIndex).padStart(5, '0')}.png`);
      fs.writeFile(file, image.toPNG(), () => {});
      frameIndex += 1;
    } catch (err) {
      // ignore capture errors while recording
    }
  }, 33);

  // tell child to start event collection
  entry.win.webContents.send('recording-toggle', { active: true });

  return { success: true, message: `开始录制，输出目录：${runDir}` };
}

function stopRecording(windowId) {
  const entry = windows.get(windowId);
  if (!entry) return;

  if (entry.recording) {
    entry.recording = false;

    if (entry.captureInterval) {
      clearInterval(entry.captureInterval);
      entry.captureInterval = null;
    }

    if (entry.win && !entry.win.isDestroyed()) {
      entry.win.webContents.send('recording-toggle', { active: false });
    }

    // 停止录制时，合成视频
    if (entry.recordingPaths) {
      const { framesDir, eventLog, networkLog } = entry.recordingPaths;
      const videoFile = path.join(path.dirname(framesDir), 'recording.mp4');
      composeVideo(framesDir, videoFile);
    }
  }

  entry.recordingPaths = null;
}

function composeVideo(framesDir, outputFile) {
  // 检查帧文件是否存在
  const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png'));
  if (files.length === 0) {
    console.log('没有截图帧，跳过视频合成');
    return;
  }

  const inputPattern = path.join(framesDir, '%05d.png');
  const args = [
    '-framerate', '30',
    '-i', inputPattern,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    outputFile
  ];

  execFile(FFMPEG_PATH, args, (error) => {
    if (error) {
      console.error('视频合成失败:', error.message);
      return;
    }
    console.log(`视频已保存: ${outputFile}`);
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true, path: '' };
  }

  selectedFolder = result.filePaths[0];
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('open-url', async (_event, url) => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, message: '仅支持 http/https 链接' };
    }
    const id = openUrlWindow(parsed.toString());
    return { success: true, windowId: id };
  } catch (err) {
    return { success: false, message: 'URL 无效，请检查输入' };
  }
});

ipcMain.handle('start-recording', (_event, windowId) => {
  const res = startRecording(windowId);
  return res;
});

ipcMain.handle('stop-recording', (_event, windowId) => {
  stopRecording(windowId);
  return { success: true, message: '已停止录制' };
});

ipcMain.handle('get-status', () => {
  return {
    folder: selectedFolder,
    windows: Array.from(windows.entries())
      .filter(([, entry]) => entry.win && !entry.win.isDestroyed())
      .map(([id, entry]) => ({
        id,
        url: entry.win.webContents.getURL(),
        recording: entry.recording
      }))
  };
});

ipcMain.on('record-event', (event, payload) => {
  const senderId = event.sender.id;
  const entry = windows.get(senderId);
  if (!entry || !entry.recording || !entry.recordingPaths) return;
  appendLine(entry.recordingPaths.eventLog, { ...payload, ts: Date.now() });
});

