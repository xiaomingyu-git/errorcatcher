<template>
  <div class="app">
    <header class="hero">
      <h1>Electron + Vue3 Demo</h1>
      <p>选择一个文件夹，并在内置窗口中打开任意 URL</p>
    </header>

    <section class="card">
      <div class="card-header">
        <h2>1. 选择文件夹</h2>
        <span class="hint">仅在本地使用，不会上传</span>
      </div>
      <button class="primary" @click="handleSelectFolder">选择文件夹</button>
      <p class="path" v-if="folderPath">已选择：{{ folderPath }}</p>
      <p class="path muted" v-else>尚未选择文件夹</p>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>2. 打开 URL</h2>
        <span class="hint">支持 http / https</span>
      </div>
      <div class="url-row">
        <input
          v-model="url"
          type="text"
          placeholder="例如：https://example.com"
          @keyup.enter="handleOpenUrl"
        />
        <button class="primary" @click="handleOpenUrl">打开</button>
      </div>
      <p class="status" v-if="message">{{ message }}</p>

      <div class="windows-header">
        <h3>已打开窗口</h3>
        <span class="hint">每个窗口可独立开始/停止录制</span>
      </div>
      <div v-if="windows.length === 0" class="muted">暂无窗口，请先打开 URL</div>
      <div v-else class="windows-list">
        <div class="window-item" v-for="w in windows" :key="w.id">
          <div class="window-meta">
            <p class="id">ID: {{ w.id }}</p>
            <p class="url" :title="w.url">{{ w.url }}</p>
            <p class="status-tag" :class="w.recording ? 'on' : 'off'">
              {{ w.recording ? '录制中' : '空闲' }}
            </p>
          </div>
          <div class="window-actions">
            <button
              class="primary danger"
              :disabled="!folderPath"
              v-if="w.recording"
              @click="stopRecording(w.id)"
            >
              停止录制
            </button>
            <button
              class="primary"
              :disabled="!folderPath"
              v-else
              @click="startRecording(w.id)"
            >
              开始录制
            </button>
            <p class="muted small">保存目录：{{ folderPath || '未选择' }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const folderPath = ref('');
const url = ref('');
const message = ref('');
const windows = ref([]);

const handleSelectFolder = async () => {
  message.value = '';
  if (!window.electronAPI?.selectFolder) {
    message.value = '渲染进程无法访问选择文件夹接口';
    return;
  }
  const result = await window.electronAPI.selectFolder();
  if (!result || result.canceled) {
    message.value = '已取消选择';
    return;
  }
  folderPath.value = result.path;
  message.value = '文件夹已选择';
  await refreshStatus();
};

const handleOpenUrl = async () => {
  message.value = '';
  const target = url.value.trim();
  if (!target) {
    message.value = '请先输入 URL';
    return;
  }
  if (!window.electronAPI?.openUrl) {
    message.value = '渲染进程无法访问打开 URL 接口';
    return;
  }
  const res = await window.electronAPI.openUrl(target);
  if (!res?.success) {
    message.value = res?.message || '打开失败，请检查 URL';
    return;
  }
  message.value = '已在新窗口打开';
  await refreshStatus();
};

const refreshStatus = async () => {
  if (!window.electronAPI?.getStatus) return;
  const res = await window.electronAPI.getStatus();
  windows.value = res?.windows || [];
  if (res?.folder) {
    folderPath.value = res.folder;
  }
};

const startRecording = async (id) => {
  message.value = '';
  if (!window.electronAPI?.startRecording) {
    message.value = '渲染进程无法访问录制接口';
    return;
  }
  const res = await window.electronAPI.startRecording(id);
  message.value = res?.message || (res?.success ? '已开始录制' : '无法开始录制');
  await refreshStatus();
};

const stopRecording = async (id) => {
  message.value = '';
  if (!window.electronAPI?.stopRecording) {
    message.value = '渲染进程无法访问停止接口';
    return;
  }
  const res = await window.electronAPI.stopRecording(id);
  message.value = res?.message || '已停止录制';
  await refreshStatus();
};

onMounted(() => {
  refreshStatus();
});
</script>


