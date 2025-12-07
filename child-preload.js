const { contextBridge, ipcRenderer } = require('electron');

let active = false;
const disposers = [];

function record(type, payload = {}) {
  ipcRenderer.send('record-event', {
    type,
    ...payload
  });
}

function startCapture() {
  if (active) return;
  active = true;

  const onClick = (e) => {
    const target = e.target || {};
    record('click', {
      x: e.clientX,
      y: e.clientY,
      tag: target.tagName,
      id: target.id,
      className: target.className
    });
  };

  const onKey = (e) => {
    record('keydown', {
      key: e.key,
      code: e.code,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey
    });
  };

  const onScroll = () => {
    record('scroll', {
      x: window.scrollX,
      y: window.scrollY
    });
  };

  const onError = (e) => {
    record('error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno
    });
  };

  window.addEventListener('click', onClick, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('error', onError, true);

  disposers.push(() => window.removeEventListener('click', onClick, true));
  disposers.push(() => window.removeEventListener('keydown', onKey, true));
  disposers.push(() => window.removeEventListener('scroll', onScroll, true));
  disposers.push(() => window.removeEventListener('error', onError, true));

  record('recording-start');
}

function stopCapture() {
  if (!active) return;
  active = false;
  disposers.splice(0).forEach((fn) => fn());
  record('recording-stop');
}

ipcRenderer.on('recording-toggle', (_event, payload) => {
  if (payload?.active) {
    startCapture();
  } else {
    stopCapture();
  }
});

contextBridge.exposeInMainWorld('childRecorder', {
  isActive: () => active
});

