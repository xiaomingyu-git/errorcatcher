const { contextBridge, ipcRenderer } = require('electron');

let active = false;
let lastScrollTime = 0;
const SCROLL_THROTTLE = 200;
let lastInputTime = 0;
const INPUT_THROTTLE = 30;

function record(type, payload = {}) {
  ipcRenderer.send('record-event', {
    type,
    ...payload
  });
}

function setupGlobalListeners() {
  // 只在 preload 中监听 input/click/scroll 等 DOM 事件
  // keydown 由主进程的 before-input-event 监听
  
  window.addEventListener('input', (e) => {
    if (!active) return;
    const now = Date.now();
    if (now - lastInputTime < INPUT_THROTTLE) return;
    lastInputTime = now;
    
    const target = e.target || {};
    record('input', {
      tag: target.tagName,
      id: target.id || '',
      value: target.value?.substring(0, 100) || '',
      placeholder: target.placeholder || ''
    });
  }, true);

  window.addEventListener('click', (e) => {
    if (!active) return;
    const target = e.target || {};
    let className = '';
    if (target.className) {
      className = typeof target.className === 'string' ? target.className : (target.getAttribute?.('class') || '');
    }
    record('click', {
      x: e.clientX,
      y: e.clientY,
      tag: target.tagName,
      id: target.id || '',
      className: className,
      innerHTML: target.textContent?.substring(0, 100) || ''
    });
  }, true);

  window.addEventListener('scroll', () => {
    if (!active) return;
    const now = Date.now();
    if (now - lastScrollTime < SCROLL_THROTTLE) return;
    lastScrollTime = now;
    record('scroll', {
      x: window.scrollX,
      y: window.scrollY
    });
  }, true);

  window.addEventListener('error', (e) => {
    if (!active) return;
    record('error', {
      message: e.message || '',
      filename: e.filename || '',
      lineno: e.lineno || 0,
      colno: e.colno || 0
    });
  }, true);
}

// 拦截链接跳转，保持在当前窗口
function interceptLinks() {
  window.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const target = link.getAttribute('target');
    const isBlank = target === '_blank';
    const isModified = e.ctrlKey || e.metaKey || e.button === 1;
    if (isBlank || isModified) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = href;
    }
  }, true);
}

// 拦截 window.open
function interceptWindowOpen() {
  window.open = function(url, target, features) {
    if (url) {
      window.location.href = url;
    }
    return window;
  };
}

// 初始化：立即执行，不等待 DOMContentLoaded
setupGlobalListeners();
interceptLinks();
interceptWindowOpen();

ipcRenderer.on('recording-toggle', (_event, payload) => {
  if (payload?.active) {
    active = true;
    record('recording-start');
  } else {
    active = false;
    record('recording-stop');
  }
});

contextBridge.exposeInMainWorld('childRecorder', {
  isActive: () => active
});

contextBridge.exposeInMainWorld('electronAPI', {
  openUrl: (url) => ipcRenderer.invoke('open-url', url)
});

