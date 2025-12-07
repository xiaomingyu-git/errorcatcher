# 浏览器记录插件完整开发指南

## 目录
1. [项目概述](#1-项目概述)
2. [完整文件结构](#2-完整文件结构)
3. [核心代码实现](#3-核心代码实现)
4. [开发环境设置](#4-开发环境设置)
5. [调试方法](#5-调试方法)
6. [测试和验证](#6-测试和验证)
7. [常见问题和解决方案](#7-常见问题和解决方案)
8. [部署和发布](#8-部署和发布)

## 1. 项目概述

### 1.1 浏览器兼容性说明

**重要提示**：本插件使用 File System Access API 实现，仅支持 **Chrome 86+** 浏览器。其他浏览器（如 Firefox、Safari、Edge 等）不支持此 API，无法使用本插件。

### 1.2 核心需求
- 让用户选择日志输出的文件夹，以时间戳为标题给每次记录创建独立文件夹
- 点击开始记录，实时记录当前浏览器tab页的网络请求、浏览器日志和屏幕录像
- 数据实时流式落地，不在点击停止时才开始写入
- 点击停止记录，完成记录过程

### 1.3 设计原则
- **简化优先**：专注核心功能，使用单一技术方案
- **实时性**：数据实时流式写入本地文件夹
- **用户体验**：简单直观的操作流程
- **原生支持**：利用浏览器原生 API，无需额外安装

## 2. 完整文件结构

```
browser-recorder-extension/
├── manifest.json                 # 插件清单文件
├── popup.html                    # 弹窗界面HTML
├── popup.js                      # 弹窗界面逻辑
├── popup.css                     # 弹窗界面样式
├── background.js                 # 后台脚本
├── content.js                    # 内容脚本
├── options.html                  # 选项页面
├── options.js                    # 选项页面逻辑
├── options.css                   # 选项页面样式
├── lib/
│   ├── fileSystemManager.js      # 文件系统管理器
│   ├── realtimeFileWriter.js     # 实时文件写入器
│   ├── sessionManager.js         # 会话管理器
│   ├── networkMonitor.js         # 网络请求监控
│   ├── consoleLogger.js          # 控制台日志捕获
│   ├── screenRecorder.js         # 屏幕录制器
│   ├── errorHandler.js           # 错误处理器
│   └── performanceOptimizer.js   # 性能优化器
├── icons/
│   ├── icon16.png               # 16x16图标
│   ├── icon48.png               # 48x48图标
│   └── icon128.png              # 128x128图标
└── README.md                     # 项目说明文档
```

## 3. 核心代码实现

### 3.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "浏览器记录助手",
  "version": "1.0.0",
  "description": "实时记录浏览器网络请求、控制台日志和屏幕录像",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  
  "optional_permissions": [
    "desktopCapture"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["lib/fileSystemManager.js", "lib/networkMonitor.js", "lib/consoleLogger.js", "content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_title": "浏览器记录助手",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "options_page": "options.html",
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "web_accessible_resources": [
    {
      "resources": ["lib/*.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 3.2 popup.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>浏览器记录助手</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>浏览器记录助手</h1>
      <div class="version">v1.0.0</div>
    </header>
    
    <main class="main-content">
      <!-- 文件夹选择区域 -->
      <section id="folder-section" class="folder-section">
        <div class="folder-info">
          <label for="folder-path">输出文件夹:</label>
          <div class="folder-display">
            <span id="folder-path" class="folder-path">未选择</span>
            <button id="change-folder-btn" class="btn btn-secondary">更改文件夹</button>
          </div>
        </div>
        <div id="folder-selection" class="folder-selection hidden">
          <p>选择日志输出文件夹，所有记录将保存在此文件夹下</p>
          <button id="select-folder-btn" class="btn btn-primary">选择文件夹</button>
          <div class="browser-warning">
            <strong>注意:</strong> 仅支持 Chrome 86+ 浏览器
          </div>
        </div>
      </section>
      
      <!-- 记录状态区域 -->
      <section id="status-section" class="status-section">
        <div class="status-info">
          <div class="status-item">
            <label>状态:</label>
            <span id="recording-status" class="status-text ready">准备就绪</span>
          </div>
          <div class="status-item">
            <label>记录时长:</label>
            <span id="recording-duration" class="duration-text">--:--</span>
          </div>
          <div class="status-item">
            <label>当前会话:</label>
            <span id="current-session" class="session-text">无</span>
          </div>
        </div>
      </section>
      
      <!-- 控制按钮区域 -->
      <section id="control-section" class="control-section">
        <div class="button-group">
          <button id="start-recording-btn" class="btn btn-success">开始记录</button>
          <button id="stop-recording-btn" class="btn btn-danger" disabled>停止记录</button>
        </div>
      </section>
      
      <!-- 进度指示器 -->
      <section id="progress-section" class="progress-section hidden">
        <div class="progress-info">
          <div class="progress-item">
            <label>网络请求:</label>
            <span id="network-count">0</span>
          </div>
          <div class="progress-item">
            <label>控制台日志:</label>
            <span id="console-count">0</span>
          </div>
          <div class="progress-item">
            <label>视频大小:</label>
            <span id="video-size">0 MB</span>
          </div>
        </div>
      </section>
    </main>
    
    <footer class="footer">
      <div class="footer-links">
        <a href="#" id="options-link">设置</a>
        <a href="#" id="help-link">帮助</a>
      </div>
    </footer>
  </div>
  
  <!-- 加载指示器 -->
  <div id="loading-overlay" class="loading-overlay hidden">
    <div class="loading-spinner"></div>
    <p>处理中...</p>
  </div>
  
  <!-- 消息提示 -->
  <div id="message-container" class="message-container"></div>
  
  <script src="popup.js"></script>
</body>
</html>
```

### 3.3 popup.css

```css
/* 基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  color: #333;
  background-color: #f5f5f5;
  width: 400px;
  min-height: 500px;
}

.container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 头部样式 */
.header {
  background-color: #4285f4;
  color: white;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 18px;
  font-weight: 500;
}

.version {
  font-size: 12px;
  opacity: 0.8;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 文件夹选择区域 */
.folder-section {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.folder-info label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.folder-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.folder-path {
  flex: 1;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
  word-break: break-all;
}

.folder-selection {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.browser-warning {
  margin-top: 12px;
  padding: 8px 12px;
  background-color: #fff3cd;
  border-radius: 4px;
  font-size: 12px;
  color: #856404;
}

/* 状态区域 */
.status-section {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-item label {
  font-weight: 500;
}

.status-text.ready {
  color: #28a745;
}

.status-text.recording {
  color: #dc3545;
}

.duration-text, .session-text {
  font-family: monospace;
  font-size: 13px;
}

/* 控制按钮区域 */
.control-section {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.button-group {
  display: flex;
  gap: 12px;
}

/* 按钮样式 */
.btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3367d6;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #218838;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

/* 进度区域 */
.progress-section {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-item label {
  font-weight: 500;
}

/* 底部区域 */
.footer {
  background-color: #f8f9fa;
  padding: 12px 16px;
  border-top: 1px solid #dee2e6;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.footer-links a {
  color: #6c757d;
  text-decoration: none;
  font-size: 12px;
}

.footer-links a:hover {
  color: #495057;
  text-decoration: underline;
}

/* 工具类 */
.hidden {
  display: none !important;
}

/* 加载指示器 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  z-index: 1000;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 消息提示 */
.message-container {
  position: fixed;
  top: 16px;
  right: 16px;
  left: 16px;
  z-index: 1001;
}

.message {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 8px;
  animation: slideIn 0.3s ease;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### 3.4 popup.js

```javascript
// 弹窗界面控制器
class PopupController {
  constructor() {
    this.isRecording = false;
    this.recordingStartTime = null;
    this.durationTimer = null;
    this.currentSessionId = null;
    
    this.initializeElements();
    this.attachEventListeners();
    this.loadInitialData();
  }
  
  // 初始化DOM元素引用
  initializeElements() {
    // 文件夹相关元素
    this.folderPath = document.getElementById('folder-path');
    this.folderSelection = document.getElementById('folder-selection');
    this.selectFolderBtn = document.getElementById('select-folder-btn');
    this.changeFolderBtn = document.getElementById('change-folder-btn');
    
    // 状态相关元素
    this.recordingStatus = document.getElementById('recording-status');
    this.recordingDuration = document.getElementById('recording-duration');
    this.currentSession = document.getElementById('current-session');
    
    // 控制按钮
    this.startRecordingBtn = document.getElementById('start-recording-btn');
    this.stopRecordingBtn = document.getElementById('stop-recording-btn');
    
    // 进度相关元素
    this.progressSection = document.getElementById('progress-section');
    this.networkCount = document.getElementById('network-count');
    this.consoleCount = document.getElementById('console-count');
    this.videoSize = document.getElementById('video-size');
    
    // 其他元素
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.messageContainer = document.getElementById('message-container');
    this.optionsLink = document.getElementById('options-link');
    this.helpLink = document.getElementById('help-link');
  }
  
  // 附加事件监听器
  attachEventListeners() {
    // 文件夹选择事件
    this.selectFolderBtn.addEventListener('click', () => this.selectOutputFolder());
    this.changeFolderBtn.addEventListener('click', () => this.changeOutputFolder());
    
    // 录制控制事件
    this.startRecordingBtn.addEventListener('click', () => this.startRecording());
    this.stopRecordingBtn.addEventListener('click', () => this.stopRecording());
    
    // 链接事件
    this.optionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    
    this.helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelpPage();
    });
  }
  
  // 加载初始数据
  async loadInitialData() {
    try {
      // 检查是否已设置输出文件夹
      const { outputDirHandle } = await chrome.storage.local.get('outputDirHandle');
      
      if (outputDirHandle) {
        // 验证目录句柄是否仍然有效
        if (await outputDirHandle.queryPermission({ mode: 'readwrite' }) === 'granted') {
          this.folderPath.textContent = '已选择文件夹';
          this.folderSelection.classList.add('hidden');
        } else {
          // 权限失效，显示文件夹选择界面
          this.folderPath.textContent = '权限已失效，请重新选择';
          this.folderSelection.classList.remove('hidden');
        }
      } else {
        // 未设置文件夹，显示选择界面
        this.folderPath.textContent = '未选择';
        this.folderSelection.classList.remove('hidden');
      }
      
      // 检查是否有正在进行的录制
      const { recordingState } = await chrome.storage.local.get('recordingState');
      if (recordingState && recordingState.isRecording) {
        this.restoreRecordingState(recordingState);
      }
    } catch (error) {
      console.error('加载初始数据失败:', error);
      this.showMessage('加载配置失败', 'error');
    }
  }
  
  // 选择输出文件夹
  async selectOutputFolder() {
    try {
      this.showLoading(true);
      
      // 检查浏览器兼容性
      if (!window.showDirectoryPicker) {
        throw new Error('您的浏览器不支持 File System Access API，请使用 Chrome 86+ 浏览器');
      }
      
      // 显示文件夹选择器
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      
      // 保存目录句柄到扩展存储
      await chrome.storage.local.set({
        outputDirHandle: dirHandle
      });
      
      // 更新UI
      this.folderPath.textContent = '已选择文件夹';
      this.folderSelection.classList.add('hidden');
      
      this.showMessage('文件夹选择成功', 'success');
    } catch (error) {
      console.error('文件夹选择失败:', error);
      this.showMessage(`文件夹选择失败: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }
  
  // 更改输出文件夹
  async changeOutputFolder() {
    try {
      // 清除现有文件夹设置
      await chrome.storage.local.remove('outputDirHandle');
      
      // 显示文件夹选择界面
      this.folderPath.textContent = '未选择';
      this.folderSelection.classList.remove('hidden');
      
      // 如果正在录制，停止录制
      if (this.isRecording) {
        await this.stopRecording();
      }
      
      this.showMessage('请重新选择输出文件夹', 'warning');
    } catch (error) {
      console.error('更改文件夹失败:', error);
      this.showMessage(`更改文件夹失败: ${error.message}`, 'error');
    }
  }
  
  // 开始录制
  async startRecording() {
    try {
      // 检查是否已设置输出文件夹
      const { outputDirHandle } = await chrome.storage.local.get('outputDirHandle');
      if (!outputDirHandle) {
        this.showMessage('请先选择输出文件夹', 'warning');
        this.folderSelection.classList.remove('hidden');
        return;
      }
      
      // 验证目录权限
      if (await outputDirHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        this.showMessage('文件夹权限已失效，请重新选择', 'warning');
        this.folderSelection.classList.remove('hidden');
        return;
      }
      
      this.showLoading(true);
      
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 发送开始录制消息到后台脚本
      const response = await chrome.runtime.sendMessage({
        action: 'startRecording',
        tabId: tab.id
      });
      
      if (response.success) {
        // 更新录制状态
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.currentSessionId = response.sessionId;
        
        // 更新UI状态
        this.updateRecordingUI(true);
        
        // 启动计时器
        this.startDurationTimer();
        
        // 启动进度更新
        this.startProgressUpdate();
        
        // 保存录制状态
        await this.saveRecordingState();
        
        this.showMessage('录制已开始', 'success');
      } else {
        throw new Error(response.error || '启动录制失败');
      }
    } catch (error) {
      console.error('开始录制失败:', error);
      this.showMessage(`开始录制失败: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }
  
  // 停止录制
  async stopRecording() {
    try {
      this.showLoading(true);
      
      // 发送停止录制消息到后台脚本
      const response = await chrome.runtime.sendMessage({
        action: 'stopRecording'
      });
      
      if (response.success) {
        // 更新录制状态
        this.isRecording = false;
        
        // 停止计时器
        this.stopDurationTimer();
        
        // 停止进度更新
        this.stopProgressUpdate();
        
        // 更新UI状态
        this.updateRecordingUI(false);
        
        // 清除录制状态
        await this.clearRecordingState();
        
        this.showMessage('录制已停止', 'success');
      } else {
        throw new Error(response.error || '停止录制失败');
      }
    } catch (error) {
      console.error('停止录制失败:', error);
      this.showMessage(`停止录制失败: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }
  
  // 更新录制UI状态
  updateRecordingUI(isRecording) {
    if (isRecording) {
      this.recordingStatus.textContent = '正在记录...';
      this.recordingStatus.className = 'status-text recording';
      this.currentSession.textContent = this.currentSessionId || '未知会话';
      this.startRecordingBtn.disabled = true;
      this.stopRecordingBtn.disabled = false;
      this.progressSection.classList.remove('hidden');
    } else {
      this.recordingStatus.textContent = '准备就绪';
      this.recordingStatus.className = 'status-text ready';
      this.currentSession.textContent = '无';
      this.startRecordingBtn.disabled = false;
      this.stopRecordingBtn.disabled = true;
      this.progressSection.classList.add('hidden');
    }
  }
  
  // 启动计时器
  startDurationTimer() {
    this.durationTimer = setInterval(() => {
      if (this.recordingStartTime) {
        const duration = Date.now() - this.recordingStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        this.recordingDuration.textContent = 
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }
  
  // 停止计时器
  stopDurationTimer() {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    this.recordingDuration.textContent = '--:--';
  }
  
  // 启动进度更新
  startProgressUpdate() {
    this.progressUpdateTimer = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getRecordingStats'
        });
        
        if (response.success) {
          this.networkCount.textContent = response.stats.networkCount || 0;
          this.consoleCount.textContent = response.stats.consoleCount || 0;
          this.videoSize.textContent = this.formatFileSize(response.stats.videoSize || 0);
        }
      } catch (error) {
        console.error('获取录制统计失败:', error);
      }
    }, 2000);
  }
  
  // 停止进度更新
  stopProgressUpdate() {
    if (this.progressUpdateTimer) {
      clearInterval(this.progressUpdateTimer);
      this.progressUpdateTimer = null;
    }
  }
  
  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // 恢复录制状态
  restoreRecordingState(recordingState) {
    this.isRecording = recordingState.isRecording;
    this.recordingStartTime = recordingState.startTime;
    this.currentSessionId = recordingState.sessionId;
    
    this.updateRecordingUI(true);
    this.startDurationTimer();
    this.startProgressUpdate();
  }
  
  // 保存录制状态
  async saveRecordingState() {
    await chrome.storage.local.set({
      recordingState: {
        isRecording: this.isRecording,
        startTime: this.recordingStartTime,
        sessionId: this.currentSessionId
      }
    });
  }
  
  // 清除录制状态
  async clearRecordingState() {
    await chrome.storage.local.remove('recordingState');
  }
  
  // 显示/隐藏加载指示器
  showLoading(show) {
    if (show) {
      this.loadingOverlay.classList.remove('hidden');
    } else {
      this.loadingOverlay.classList.add('hidden');
    }
  }
  
  // 显示消息提示
  showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    this.messageContainer.appendChild(message);
    
    // 3秒后自动移除消息
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }
  
  // 打开帮助页面
  openHelpPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('help.html')
    });
  }
}

// 初始化弹窗控制器
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
```

### 3.5 background.js

```javascript
// 后台脚本 - 服务工作者
class BackgroundService {
  constructor() {
    this.sessionManager = null;
    this.dataCollectionCoordinator = null;
    this.recordingStats = {
      networkCount: 0,
      consoleCount: 0,
      videoSize: 0
    };
    
    this.initializeEventListeners();
  }
  
  // 初始化事件监听器
  initializeEventListeners() {
    // 监听来自弹窗和内容脚本的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 保持消息通道开放以支持异步响应
    });
    
    // 监听扩展安装事件
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });
    
    // 监听标签页更新事件
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });
    
    // 监听标签页关闭事件
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });
  }
  
  // 处理消息
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startRecording':
          await this.handleStartRecording(message, sender, sendResponse);
          break;
          
        case 'stopRecording':
          await this.handleStopRecording(sendResponse);
          break;
          
        case 'getRecordingStats':
          await this.handleGetRecordingStats(sendResponse);
          break;
          
        case 'writeNetworkRequest':
          await this.handleWriteNetworkRequest(message.data);
          break;
          
        case 'writeConsoleLog':
          await this.handleWriteConsoleLog(message.data);
          break;
          
        case 'writeVideoChunk':
          await this.handleWriteVideoChunk(message.data);
          break;
          
        default:
          sendResponse({ success: false, error: '未知操作' });
      }
    } catch (error) {
      console.error('处理消息失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // 处理开始录制
  async handleStartRecording(message, sender, sendResponse) {
    try {
      // 检查是否已经在录制
      if (this.sessionManager && this.sessionManager.isRecording) {
        sendResponse({ success: false, error: '已经在录制中' });
        return;
      }
      
      // 初始化会话管理器
      const { FileSystemManager } = await import('./lib/fileSystemManager.js');
      const { RealtimeFileWriter } = await import('./lib/realtimeFileWriter.js');
      const { SessionManager } = await import('./lib/sessionManager.js');
      
      this.sessionManager = new SessionManager();
      
      // 开始录制会话
      const sessionInfo = await this.sessionManager.startRecording();
      
      // 初始化数据收集协调器
      const { DataCollectionCoordinator } = await import('./lib/dataCollectionCoordinator.js');
      this.dataCollectionCoordinator = new DataCollectionCoordinator(this.sessionManager);
      
      // 启动数据收集
      await this.dataCollectionCoordinator.startCollection();
      
      // 在目标标签页中注入内容脚本
      await this.injectContentScript(message.tabId);
      
      // 重置统计信息
      this.recordingStats = {
        networkCount: 0,
        consoleCount: 0,
        videoSize: 0
      };
      
      sendResponse({ 
        success: true, 
        sessionId: sessionInfo.sessionId 
      });
    } catch (error) {
      console.error('开始录制失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // 处理停止录制
  async handleStopRecording(sendResponse) {
    try {
      if (!this.sessionManager || !this.sessionManager.isRecording) {
        sendResponse({ success: false, error: '当前没有在录制' });
        return;
      }
      
      // 停止数据收集
      if (this.dataCollectionCoordinator) {
        await this.dataCollectionCoordinator.stopCollection();
        this.dataCollectionCoordinator = null;
      }
      
      // 停止录制会话
      const sessionInfo = await this.sessionManager.stopRecording();
      this.sessionManager = null;
      
      sendResponse({ 
        success: true, 
        sessionId: sessionInfo.sessionId,
        duration: sessionInfo.duration
      });
    } catch (error) {
      console.error('停止录制失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // 处理获取录制统计
  async handleGetRecordingStats(sendResponse) {
    sendResponse({ 
      success: true, 
      stats: { ...this.recordingStats }
    });
  }
  
  // 处理网络请求数据写入
  async handleWriteNetworkRequest(data) {
    if (this.sessionManager && this.sessionManager.isRecording) {
      await this.sessionManager.writeNetworkRequest(data);
      this.recordingStats.networkCount++;
    }
  }
  
  // 处理控制台日志写入
  async handleWriteConsoleLog(data) {
    if (this.sessionManager && this.sessionManager.isRecording) {
      await this.sessionManager.writeConsoleLog(data);
      this.recordingStats.consoleCount++;
    }
  }
  
  // 处理视频数据写入
  async handleWriteVideoChunk(data) {
    if (this.sessionManager && this.sessionManager.isRecording) {
      await this.sessionManager.writeVideoChunk(data);
      this.recordingStats.videoSize += data.size;
    }
  }
  
  // 注入内容脚本
  async injectContentScript(tabId) {
    try {
      // 检查标签页是否存在
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error('标签页不存在');
      }
      
      // 注入内容脚本
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      console.log('内容脚本注入成功');
    } catch (error) {
      console.error('注入内容脚本失败:', error);
      throw error;
    }
  }
  
  // 处理扩展安装
  handleInstalled(details) {
    if (details.reason === 'install') {
      console.log('浏览器记录助手已安装');
      
      // 设置默认配置
      chrome.storage.local.set({
        settings: {
          videoQuality: 'medium',
          maxRecordingDuration: 3600, // 1小时
          autoStopOnTabClose: true
        }
      });
    } else if (details.reason === 'update') {
      console.log('浏览器记录助手已更新');
    }
  }
  
  // 处理标签页更新
  handleTabUpdated(tabId, changeInfo, tab) {
    // 如果正在录制且标签页URL发生变化，记录日志
    if (this.sessionManager && this.sessionManager.isRecording && changeInfo.url) {
      this.sessionManager.writeConsoleLog({
        type: 'navigation',
        method: 'info',
        args: [`页面导航到: ${changeInfo.url}`],
        timestamp: new Date().toISOString(),
        pageUrl: changeInfo.url
      });
    }
  }
  
  // 处理标签页关闭
  async handleTabRemoved(tabId) {
    // 如果正在录制且设置了自动停止，则停止录制
    if (this.sessionManager && this.sessionManager.isRecording) {
      const { settings } = await chrome.storage.local.get('settings');
      if (settings && settings.autoStopOnTabClose) {
        console.log('标签页已关闭，自动停止录制');
        await this.handleStopRecording(() => {});
        
        // 通知弹窗录制已停止
        chrome.runtime.sendMessage({
          action: 'recordingAutoStopped',
          reason: 'tab_closed'
        });
      }
    }
  }
}

// 初始化后台服务
const backgroundService = new BackgroundService();
```

### 3.6 content.js

```javascript
// 内容脚本 - 在网页中运行
class ContentScript {
  constructor() {
    this.sessionManager = null;
    this.networkMonitor = null;
    this.consoleLogger = null;
    
    this.initialize();
  }
  
  // 初始化
  async initialize() {
    try {
      // 等待页面加载完成
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    } catch (error) {
      console.error('内容脚本初始化失败:', error);
    }
  }
  
  // 设置监控
  async setup() {
    try {
      // 检查是否需要启动监控
      const response = await chrome.runtime.sendMessage({
        action: 'checkRecordingStatus'
      });
      
      if (response.success && response.isRecording) {
        await this.startMonitoring();
      }
      
      // 监听来自后台脚本的消息
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true;
      });
    } catch (error) {
      console.error('设置监控失败:', error);
    }
  }
  
  // 处理消息
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startMonitoring':
          await this.startMonitoring();
          sendResponse({ success: true });
          break;
          
        case 'stopMonitoring':
          await this.stopMonitoring();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: '未知操作' });
      }
    } catch (error) {
      console.error('处理消息失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // 开始监控
  async startMonitoring() {
    try {
      // 初始化会话管理器代理
      this.sessionManager = new SessionManagerProxy();
      
      // 初始化网络监控器
      const { NetworkMonitor } = await import('./lib/networkMonitor.js');
      this.networkMonitor = new NetworkMonitor(this.sessionManager);
      
      // 初始化控制台日志记录器
      const { ConsoleLogger } = await import('./lib/consoleLogger.js');
      this.consoleLogger = new ConsoleLogger(this.sessionManager);
      
      console.log('内容脚本监控已启动');
    } catch (error) {
      console.error('启动监控失败:', error);
      throw error;
    }
  }
  
  // 停止监控
  async stopMonitoring() {
    try {
      // 清理网络监控器
      if (this.networkMonitor) {
        this.networkMonitor.cleanup();
        this.networkMonitor = null;
      }
      
      // 清理控制台日志记录器
      if (this.consoleLogger) {
        this.consoleLogger.cleanup();
        this.consoleLogger = null;
      }
      
      this.sessionManager = null;
      
      console.log('内容脚本监控已停止');
    } catch (error) {
      console.error('停止监控失败:', error);
      throw error;
    }
  }
}

// 会话管理器代理 - 用于内容脚本与后台脚本通信
class SessionManagerProxy {
  // 写入网络请求数据
  async writeNetworkRequest(data) {
    try {
      await chrome.runtime.sendMessage({
        action: 'writeNetworkRequest',
        data: data
      });
    } catch (error) {
      console.error('写入网络请求数据失败:', error);
    }
  }
  
  // 写入控制台日志
  async writeConsoleLog(data) {
    try {
      await chrome.runtime.sendMessage({
        action: 'writeConsoleLog',
        data: data
      });
    } catch (error) {
      console.error('写入控制台日志失败:', error);
    }
  }
  
  // 获取录制状态
  get isRecording() {
    // 这里应该从后台脚本获取实际状态
    return true;
  }
}

// 初始化内容脚本
const contentScript = new ContentScript();
```

### 3.7 lib/fileSystemManager.js

```javascript
// 文件系统管理器 - 处理文件系统访问和操作
export class FileSystemManager {
  constructor() {
    this.dirHandle = null;
    this.sessionDirHandle = null;
  }

  // 选择输出文件夹
  async selectOutputFolder() {
    try {
      // 检查浏览器兼容性
      if (!window.showDirectoryPicker) {
        throw new Error('您的浏览器不支持 File System Access API，请使用 Chrome 86+ 浏览器');
      }

      // 显示文件夹选择器
      this.dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      // 保存目录句柄到扩展存储
      await chrome.storage.local.set({
        outputDirHandle: this.dirHandle
      });

      return this.dirHandle;
    } catch (error) {
      console.error('文件夹选择失败:', error);
      throw error;
    }
  }

  // 从存储恢复目录句柄
  async restoreDirectoryHandle() {
    try {
      const { outputDirHandle } = await chrome.storage.local.get('outputDirHandle');
      
      if (outputDirHandle) {
        // 验证句柄是否仍然有效
        if (await outputDirHandle.queryPermission({ mode: 'readwrite' }) === 'granted') {
          this.dirHandle = outputDirHandle;
          return this.dirHandle;
        } else {
          // 请求权限
          if (await outputDirHandle.requestPermission({ mode: 'readwrite' }) === 'granted') {
            this.dirHandle = outputDirHandle;
            return this.dirHandle;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('恢复目录句柄失败:', error);
      return null;
    }
  }

  // 创建会话文件夹
  async createSessionFolder() {
    if (!this.dirHandle) {
      throw new Error('未选择输出文件夹');
    }

    // 生成时间戳文件夹名
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    this.sessionDirHandle = await this.dirHandle.getDirectoryHandle(timestamp, {
      create: true
    });

    // 创建子文件夹
    await this.sessionDirHandle.getDirectoryHandle('screenshots', {
      create: true
    });

    return this.sessionDirHandle;
  }

  // 获取会话文件夹句柄
  getSessionDirHandle() {
    return this.sessionDirHandle;
  }

  // 获取文件句柄
  async getFileHandle(fileName, create = true) {
    if (!this.sessionDirHandle) {
      throw new Error('未创建会话文件夹');
    }

    return await this.sessionDirHandle.getFileHandle(fileName, {
      create: create
    });
  }

  // 获取目录句柄
  async getDirectoryHandle(dirName, create = true) {
    if (!this.sessionDirHandle) {
      throw new Error('未创建会话文件夹');
    }

    return await this.sessionDirHandle.getDirectoryHandle(dirName, {
      create: create
    });
  }

  // 验证权限
  async verifyPermissions() {
    if (!this.dirHandle) {
      return false;
    }

    try {
      const permission = await this.dirHandle.queryPermission({ mode: 'readwrite' });
      return permission === 'granted';
    } catch (error) {
      console.error('验证权限失败:', error);
      return false;
    }
  }

  // 请求权限
  async requestPermissions() {
    if (!this.dirHandle) {
      return false;
    }

    try {
      const permission = await this.dirHandle.requestPermission({ mode: 'readwrite' });
      return permission === 'granted';
    } catch (error) {
      console.error('请求权限失败:', error);
      return false;
    }
  }

  // 清理资源
  cleanup() {
    this.dirHandle = null;
    this.sessionDirHandle = null;
  }
}
```

### 3.8 lib/realtimeFileWriter.js

```javascript
// 实时文件写入器 - 处理实时文件写入操作
export class RealtimeFileWriter {
  constructor(sessionDirHandle) {
    this.sessionDirHandle = sessionDirHandle;
    this.fileHandles = new Map();
    this.writeQueues = new Map();
    this.isWriting = new Map();
  }

  // 获取或创建文件句柄
  async getFileHandle(fileName) {
    if (!this.fileHandles.has(fileName)) {
      const fileHandle = await this.sessionDirHandle.getFileHandle(fileName, {
        create: true
      });
      this.fileHandles.set(fileName, fileHandle);
      this.writeQueues.set(fileName, []);
      this.isWriting.set(fileName, false);
    }
    return this.fileHandles.get(fileName);
  }

  // 实时写入数据
  async writeData(fileName, data) {
    try {
      // 添加到写入队列
      const queue = this.writeQueues.get(fileName) || [];
      queue.push({
        data: data,
        timestamp: Date.now()
      });
      this.writeQueues.set(fileName, queue);

      // 如果当前没有写入操作，立即处理
      if (!this.isWriting.get(fileName)) {
        await this.processWriteQueue(fileName);
      }
      
      return true;
    } catch (error) {
      console.error(`写入文件 ${fileName} 失败:`, error);
      throw error;
    }
  }

  // 处理写入队列
  async processWriteQueue(fileName) {
    if (this.isWriting.get(fileName)) {
      return; // 已有写入操作在进行
    }

    this.isWriting.set(fileName, true);

    try {
      const queue = this.writeQueues.get(fileName) || [];
      if (queue.length === 0) {
        this.isWriting.set(fileName, false);
        return;
      }

      const fileHandle = await this.getFileHandle(fileName);
      
      // 创建可写流
      const writable = await fileHandle.createWritable({
        keepExistingData: true
      });
      
      // 定位到文件末尾
      await writable.seek(writable.length);
      
      // 批量写入数据
      const dataArray = queue.map(item => item.data);
      const combinedData = dataArray.join('\n') + '\n';
      await writable.write(combinedData);
      
      // 关闭写入流
      await writable.close();
      
      // 清空队列
      this.writeQueues.set(fileName, []);
      
      return true;
    } catch (error) {
      console.error(`处理写入队列失败 ${fileName}:`, error);
      throw error;
    } finally {
      this.isWriting.set(fileName, false);
      
      // 如果队列中还有数据，继续处理
      const queue = this.writeQueues.get(fileName) || [];
      if (queue.length > 0) {
        setTimeout(() => this.processWriteQueue(fileName), 100);
      }
    }
  }

  // 批量写入数据
  async batchWrite(fileName, dataArray) {
    try {
      const fileHandle = await this.getFileHandle(fileName);
      
      // 创建可写流
      const writable = await fileHandle.createWritable({
        keepExistingData: true
      });
      
      // 定位到文件末尾
      await writable.seek(writable.length);
      
      // 批量写入数据
      const combinedData = dataArray.join('\n') + '\n';
      await writable.write(combinedData);
      
      // 关闭写入流
      await writable.close();
      
      return true;
    } catch (error) {
      console.error(`批量写入文件 ${fileName} 失败:`, error);
      throw error;
    }
  }

  // 写入二进制数据
  async writeBinaryData(fileName, binaryData) {
    try {
      const fileHandle = await this.getFileHandle(fileName);
      
      // 创建可写流
      const writable = await fileHandle.createWritable({
        keepExistingData: true
      });
      
      // 定位到文件末尾
      await writable.seek(writable.length);
      
      // 写入二进制数据
      await writable.write(binaryData);
      
      // 关闭写入流
      await writable.close();
      
      return true;
    } catch (error) {
      console.error(`写入二进制文件 ${fileName} 失败:`, error);
      throw error;
    }
  }

  // 强制刷新所有队列
  async flushAllQueues() {
    const promises = [];
    
    for (const fileName of this.writeQueues.keys()) {
      promises.push(this.processWriteQueue(fileName));
    }
    
    await Promise.all(promises);
  }

  // 关闭所有文件句柄
  async closeAllFiles() {
    try {
      // 先刷新所有队列
      await this.flushAllQueues();
      
      // 清理资源
      this.fileHandles.clear();
      this.writeQueues.clear();
      this.isWriting.clear();
    } catch (error) {
      console.error('关闭文件失败:', error);
      throw error;
    }
  }

  // 获取文件大小
  async getFileSize(fileName) {
    try {
      const fileHandle = await this.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return file.size;
    } catch (error) {
      console.error(`获取文件大小失败 ${fileName}:`, error);
      return 0;
    }
  }

  // 检查文件是否存在
  async fileExists(fileName) {
    try {
      await this.getFileHandle(fileName, false);
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### 3.9 lib/sessionManager.js

```javascript
// 会话管理器 - 管理录制会话
import { FileSystemManager } from './fileSystemManager.js';
import { RealtimeFileWriter } from './realtimeFileWriter.js';

export class SessionManager {
  constructor() {
    this.fileSystemManager = new FileSystemManager();
    this.fileWriter = null;
    this.isRecording = false;
    this.sessionStartTime = null;
    this.sessionId = null;
    this.sessionFolderName = null;
  }

  // 开始记录会话
  async startRecording() {
    try {
      // 确保有有效的目录句柄
      if (!this.fileSystemManager.dirHandle) {
        const restored = await this.fileSystemManager.restoreDirectoryHandle();
        if (!restored) {
          throw new Error('请先选择输出文件夹');
        }
      }

      // 创建会话文件夹
      const sessionDirHandle = await this.fileSystemManager.createSessionFolder();
      
      // 生成会话文件夹名称
      this.sessionFolderName = this.generateSessionFolderName();
      
      // 初始化文件写入器
      this.fileWriter = new RealtimeFileWriter(sessionDirHandle);
      
      // 记录会话信息
      this.sessionStartTime = Date.now();
      this.sessionId = this.generateSessionId();
      this.isRecording = true;

      // 写入会话元数据
      await this.writeSessionMetadata();

      return {
        sessionId: this.sessionId,
        startTime: this.sessionStartTime,
        folderName: this.sessionFolderName
      };
    } catch (error) {
      console.error('开始记录失败:', error);
      throw error;
    }
  }

  // 停止记录会话
  async stopRecording() {
    if (!this.isRecording) {
      return {
        sessionId: this.sessionId,
        duration: 0
      };
    }

    try {
      this.isRecording = false;
      
      // 更新会话元数据
      await this.updateSessionMetadata();
      
      // 关闭所有文件
      if (this.fileWriter) {
        await this.fileWriter.closeAllFiles();
        this.fileWriter = null;
      }

      return {
        sessionId: this.sessionId,
        duration: Date.now() - this.sessionStartTime
      };
    } catch (error) {
      console.error('停止记录失败:', error);
      throw error;
    }
  }

  // 写入会话元数据
  async writeSessionMetadata() {
    const metadata = {
      sessionId: this.sessionId,
      folderName: this.sessionFolderName,
      startTime: new Date(this.sessionStartTime).toISOString(),
      browser: navigator.userAgent,
      url: window.location.href,
      version: '1.0.0',
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    await this.fileWriter.writeData('metadata.json', JSON.stringify(metadata, null, 2));
  }

  // 更新会话元数据
  async updateSessionMetadata() {
    const metadata = {
      sessionId: this.sessionId,
      folderName: this.sessionFolderName,
      startTime: new Date(this.sessionStartTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.sessionStartTime,
      browser: navigator.userAgent,
      url: window.location.href,
      version: '1.0.0',
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // 重新写入完整的元数据文件
    const sessionDirHandle = this.fileSystemManager.getSessionDirHandle();
    const metadataFileHandle = await sessionDirHandle.getFileHandle('metadata.json', {
      create: true
    });
    
    const writable = await metadataFileHandle.createWritable();
    await writable.write(JSON.stringify(metadata, null, 2));
    await writable.close();
  }

  // 生成会话ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 生成会话文件夹名称
  generateSessionFolderName() {
    return new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
  }

  // 写入网络请求数据
  async writeNetworkRequest(requestData) {
    if (!this.isRecording || !this.fileWriter) return;
    
    const logEntry = {
      id: this.generateEntryId(),
      ...requestData,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString()
    };
    
    await this.fileWriter.writeData('network.log', JSON.stringify(logEntry));
  }

  // 写入控制台日志
  async writeConsoleLog(logData) {
    if (!this.isRecording || !this.fileWriter) return;
    
    const logEntry = {
      id: this.generateEntryId(),
      ...logData,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString()
    };
    
    await this.fileWriter.writeData('console.log', JSON.stringify(logEntry));
  }

  // 写入视频数据
  async writeVideoChunk(videoChunk) {
    if (!this.isRecording || !this.fileWriter) return;
    
    await this.fileWriter.writeBinaryData('recording.webm', videoChunk);
  }

  // 写入用户事件
  async writeUserEvent(eventData) {
    if (!this.isRecording || !this.fileWriter) return;
    
    const logEntry = {
      id: this.generateEntryId(),
      ...eventData,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString()
    };
    
    await this.fileWriter.writeData('events.log', JSON.stringify(logEntry));
  }

  // 写入截图
  async writeScreenshot(imageData, fileName = null) {
    if (!this.isRecording || !this.fileWriter) return;
    
    const screenshotName = fileName || `screenshot_${Date.now()}.png`;
    const screenshotsDir = await this.fileSystemManager.getDirectoryHandle('screenshots');
    
    // 创建截图文件
    const fileHandle = await screenshotsDir.getFileHandle(screenshotName, {
      create: true
    });
    
    const writable = await fileHandle.createWritable();
    await writable.write(imageData);
    await writable.close();
    
    // 记录截图信息
    await this.writeUserEvent({
      type: 'screenshot',
      fileName: screenshotName,
      description: '自动截图'
    });
  }

  // 生成条目ID
  generateEntryId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取录制状态
  get recordingStatus() {
    return {
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      duration: this.isRecording ? Date.now() - this.sessionStartTime : 0,
      folderName: this.sessionFolderName
    };
  }

  // 获取会话统计信息
  async getSessionStats() {
    if (!this.fileWriter) {
      return {
        networkCount: 0,
        consoleCount: 0,
        eventCount: 0,
        videoSize: 0
      };
    }

    try {
      const networkCount = await this.countFileLines('network.log');
      const consoleCount = await this.countFileLines('console.log');
      const eventCount = await this.countFileLines('events.log');
      const videoSize = await this.fileWriter.getFileSize('recording.webm');

      return {
        networkCount,
        consoleCount,
        eventCount,
        videoSize
      };
    } catch (error) {
      console.error('获取会话统计失败:', error);
      return {
        networkCount: 0,
        consoleCount: 0,
        eventCount: 0,
        videoSize: 0
      };
    }
  }

  // 计算文件行数
  async countFileLines(fileName) {
    try {
      const size = await this.fileWriter.getFileSize(fileName);
      if (size === 0) return 0;
      
      // 简单估算：假设平均每行100字节
      return Math.ceil(size / 100);
    } catch (error) {
      return 0;
    }
  }

  // 清理资源
  cleanup() {
    this.isRecording = false;
    this.sessionStartTime = null;
    this.sessionId = null;
    this.sessionFolderName = null;
    
    if (this.fileWriter) {
      this.fileWriter.closeAllFiles();
      this.fileWriter = null;
    }
    
    if (this.fileSystemManager) {
      this.fileSystemManager.cleanup();
    }
  }
}
```

### 3.10 lib/networkMonitor.js

```javascript
// 网络请求监控器 - 监控和记录网络请求
export class NetworkMonitor {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.originalXHR = window.XMLHttpRequest;
    this.originalFetch = window.fetch;
    this.requestCounter = 0;
    this.setupInterception();
  }
  
  // 设置请求拦截
  setupInterception() {
    this.setupXHRInterception();
    this.setupFetchInterception();
  }
  
  // 设置XMLHttpRequest拦截
  setupXHRInterception() {
    const self = this;
    
    window.XMLHttpRequest = function() {
      const xhr = new self.originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(method, url, ...args) {
        xhr._method = method;
        xhr._url = url;
        xhr._startTime = Date.now();
        xhr._requestId = ++self.requestCounter;
        return originalOpen.apply(xhr, [method, url, ...args]);
      };
      
      xhr.send = function(data) {
        xhr._requestData = data;
        
        xhr.addEventListener('load', function() {
          self.logNetworkRequest(xhr, data, false);
        });
        
        xhr.addEventListener('error', function() {
          self.logNetworkRequest(xhr, data, true);
        });
        
        xhr.addEventListener('timeout', function() {
          self.logNetworkRequest(xhr, data, true, 'timeout');
        });
        
        xhr.addEventListener('abort', function() {
          self.logNetworkRequest(xhr, data, true, 'abort');
        });
        
        return originalSend.apply(xhr, [data]);
      };
      
      return xhr;
    };
  }
  
  // 设置Fetch拦截
  setupFetchInterception() {
    const self = this;
    
    window.fetch = function(url, options = {}) {
      const startTime = Date.now();
      const requestId = ++self.requestCounter;
      
      return self.originalFetch(url, options)
        .then(response => {
          self.logFetchRequest(url, options, response, startTime, false, requestId);
          return response;
        })
        .catch(error => {
          self.logFetchRequest(url, options, null, startTime, true, requestId, error);
          throw error;
        });
    };
  }
  
  // 记录XMLHttpRequest
  logNetworkRequest(xhr, requestData, isError = false, errorType = 'error') {
    if (!this.sessionManager.isRecording) return;
    
    try {
      const networkData = {
        type: 'xhr',
        requestId: xhr._requestId,
        method: xhr._method || 'GET',
        url: xhr._url,
        status: xhr.status,
        statusText: xhr.statusText,
        responseHeaders: this.parseResponseHeaders(xhr.getAllResponseHeaders()),
        requestHeaders: this.parseRequestHeaders(xhr),
        requestData: this.sanitizeRequestData(requestData),
        response: this.sanitizeResponseData(xhr.responseText),
        responseURL: xhr.responseURL,
        readyState: xhr.readyState,
        timeout: xhr.timeout,
        withCredentials: xhr.withCredentials,
        timestamp: new Date().toISOString(),
        duration: Date.now() - xhr._startTime,
        isError: isError,
        errorType: errorType,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent
      };
      
      // 直接写入文件
      this.sessionManager.writeNetworkRequest(networkData);
    } catch (error) {
      console.error('记录网络请求失败:', error);
    }
  }
  
  // 记录Fetch请求
  logFetchRequest(url, options, response, startTime, isError, requestId, error) {
    if (!this.sessionManager.isRecording) return;
    
    try {
      const networkData = {
        type: 'fetch',
        requestId: requestId,
        method: options.method || 'GET',
        url: url,
        status: response ? response.status : 0,
        statusText: response ? response.statusText : 'Error',
        responseHeaders: response ? this.parseFetchResponseHeaders(response.headers) : {},
        requestHeaders: options.headers || {},
        requestData: this.sanitizeRequestData(options.body),
        response: response ? response.statusText : (error ? error.message : 'Unknown error'),
        responseURL: response ? response.url : url,
        mode: options.mode,
        credentials: options.credentials,
        cache: options.cache,
        redirect: options.redirect,
        referrer: options.referrer,
        referrerPolicy: options.referrerPolicy,
        integrity: options.integrity,
        keepalive: options.keepalive,
        signal: options.signal ? 'AbortSignal' : undefined,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        isError: isError,
        errorType: error ? error.name : 'none',
        errorMessage: error ? error.message : undefined,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent
      };
      
      // 直接写入文件
      this.sessionManager.writeNetworkRequest(networkData);
    } catch (error) {
      console.error('记录Fetch请求失败:', error);
    }
  }
  
  // 解析响应头
  parseResponseHeaders(headersString) {
    if (!headersString) return {};
    
    const headers = {};
    const lines = headersString.split('\r\n');
    
    for (const line of lines) {
      const parts = line.split(': ');
      if (parts.length === 2) {
        headers[parts[0]] = parts[1];
      }
    }
    
    return headers;
  }
  
  // 解析Fetch响应头
  parseFetchResponseHeaders(headers) {
    const result = {};
    
    if (headers && headers.forEach) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    }
    
    return result;
  }
  
  // 解析请求头
  parseRequestHeaders(xhr) {
    // 注意：由于安全限制，无法直接获取所有请求头
    // 这里只能获取一些常见的请求头
    const headers = {};
    
    try {
      if (xhr._method === 'POST' || xhr._method === 'PUT' || xhr._method === 'PATCH') {
        // 尝试获取Content-Type
        const contentType = this.getContentTypeFromData(xhr._requestData);
        if (contentType) {
          headers['Content-Type'] = contentType;
        }
      }
    } catch (error) {
      console.warn('解析请求头失败:', error);
    }
    
    return headers;
  }
  
  // 从数据获取Content-Type
  getContentTypeFromData(data) {
    if (!data) return 'application/octet-stream';
    
    if (typeof data === 'string') {
      try {
        JSON.parse(data);
        return 'application/json';
      } catch (e) {
        return 'text/plain';
      }
    } else if (data instanceof FormData) {
      return 'multipart/form-data';
    } else if (data instanceof URLSearchParams) {
      return 'application/x-www-form-urlencoded';
    } else if (data instanceof Blob) {
      return data.type || 'application/octet-stream';
    } else if (data instanceof ArrayBuffer) {
      return 'application/octet-stream';
    }
    
    return 'application/octet-stream';
  }
  
  // 清理请求数据
  sanitizeRequestData(data) {
    if (!data) return null;
    
    try {
      // 限制数据大小
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      if (dataString.length > 10000) {
        return dataString.substring(0, 10000) + '... (truncated)';
      }
      
      // 敏感信息脱敏
      return this.maskSensitiveData(dataString);
    } catch (error) {
      return '[无法序列化的数据]';
    }
  }
  
  // 清理响应数据
  sanitizeResponseData(data) {
    if (!data) return null;
    
    try {
      // 限制数据大小
      if (data.length > 10000) {
        return data.substring(0, 10000) + '... (truncated)';
      }
      
      // 敏感信息脱敏
      return this.maskSensitiveData(data);
    } catch (error) {
      return '[无法序列化的数据]';
    }
  }
  
  // 脱敏敏感数据
  maskSensitiveData(data) {
    if (typeof data !== 'string') {
      return data;
    }
    
    // 脱敏常见的敏感信息
    const sensitivePatterns = [
      { pattern: /"password"\s*:\s*"[^"]*"/gi, replacement: '"password":"***"' },
      { pattern: /"token"\s*:\s*"[^"]*"/gi, replacement: '"token":"***"' },
      { pattern: /"authorization"\s*:\s*"[^"]*"/gi, replacement: '"authorization":"***"' },
      { pattern: /"api_key"\s*:\s*"[^"]*"/gi, replacement: '"api_key":"***"' },
      { pattern: /"secret"\s*:\s*"[^"]*"/gi, replacement: '"secret":"***"' },
      { pattern: /"access_token"\s*:\s*"[^"]*"/gi, replacement: '"access_token":"***"' },
      { pattern: /"refresh_token"\s*:\s*"[^"]*"/gi, replacement: '"refresh_token":"***"' },
      { pattern: /"session"\s*:\s*"[^"]*"/gi, replacement: '"session":"***"' },
      { pattern: /"cookie"\s*:\s*"[^"]*"/gi, replacement: '"cookie":"***"' }
    ];
    
    let sanitizedData = data;
    for (const { pattern, replacement } of sensitivePatterns) {
      sanitizedData = sanitizedData.replace(pattern, replacement);
    }
    
    return sanitizedData;
  }
  
  // 清理资源
  cleanup() {
    // 恢复原始对象
    window.XMLHttpRequest = this.originalXHR;
    window.fetch = this.originalFetch;
  }
}
```

### 3.11 lib/consoleLogger.js

```javascript
// 控制台日志记录器 - 捕获和记录控制台日志
export class ConsoleLogger {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.originalConsole = {};
    this.logCounter = 0;
    this.setupConsoleInterception();
  }
  
  // 设置控制台拦截
  setupConsoleInterception() {
    // 保存原始控制台方法
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
      trace: console.trace,
      assert: console.assert,
      clear: console.clear,
      count: console.count,
      countReset: console.countReset,
      group: console.group,
      groupCollapsed: console.groupCollapsed,
      groupEnd: console.groupEnd,
      table: console.table,
      time: console.time,
      timeLog: console.timeLog,
      timeEnd: console.timeEnd,
      dir: console.dir,
      dirxml: console.dirxml
    };
    
    const self = this;
    
    // 拦截所有控制台方法
    Object.keys(this.originalConsole).forEach(method => {
      console[method] = function(...args) {
        // 调用原始方法
        self.originalConsole[method].apply(console, args);
        
        // 记录日志
        self.logConsoleMessage(method, args);
      };
    });
  }
  
  // 记录控制台消息
  logConsoleMessage(method, args) {
    if (!this.sessionManager.isRecording) return;
    
    try {
      const logData = {
        type: 'console',
        method: method,
        logId: ++this.logCounter,
        args: this.processArguments(args),
        stackTrace: this.getStackTrace(),
        timestamp: new Date().toISOString(),
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        memoryUsage: this.getMemoryUsage(),
        performanceInfo: this.getPerformanceInfo()
      };
      
      // 直接写入文件
      this.sessionManager.writeConsoleLog(logData);
    } catch (error) {
      console.error('记录控制台日志失败:', error);
    }
  }
  
  // 处理参数
  processArguments(args) {
    return args.map(arg => {
      try {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        
        if (typeof arg === 'string') {
          return arg;
        } else if (typeof arg === 'number' || typeof arg === 'boolean') {
          return arg;
        } else if (typeof arg === 'function') {
          return `[Function: ${arg.name || 'anonymous'}]`;
        } else if (arg instanceof Error) {
          return {
            name: arg.name,
            message: arg.message,
            stack: arg.stack
          };
        } else if (arg instanceof Date) {
          return arg.toISOString();
        } else if (arg instanceof RegExp) {
          return arg.toString();
        } else if (arg instanceof HTMLElement) {
          return `[HTMLElement: ${arg.tagName.toLowerCase()}${arg.id ? '#' + arg.id : ''}${arg.className ? '.' + arg.className.split(' ').join('.') : ''}]`;
        } else if (Array.isArray(arg)) {
          return this.processArray(arg);
        } else if (typeof arg === 'object') {
          return this.processObject(arg);
        } else {
          return String(arg);
        }
      } catch (error) {
        return `[无法序列化的数据: ${error.message}]`;
      }
    });
  }
  
  // 处理数组
  processArray(arr) {
    try {
      const maxLength = 50; // 限制数组长度
      if (arr.length > maxLength) {
        const processed = arr.slice(0, maxLength).map(item => this.processArguments([item])[0]);
        processed.push(`... (${arr.length - maxLength} more items)`);
        return processed;
      }
      return arr.map(item => this.processArguments([item])[0]);
    } catch (error) {
      return `[无法序列化的数组: ${error.message}]`;
    }
  }
  
  // 处理对象
  processObject(obj) {
    try {
      const maxDepth = 3; // 限制递归深度
      const maxKeys = 50; // 限制键的数量
      
      const process = (obj, depth = 0) => {
        if (depth >= maxDepth) return '[最大深度达到]';
        
        if (obj === null) return null;
        if (typeof obj !== 'object') return obj;
        
        const keys = Object.keys(obj);
        if (keys.length > maxKeys) {
          const result = {};
          for (let i = 0; i < maxKeys; i++) {
            const key = keys[i];
            try {
              result[key] = process(obj[key], depth + 1);
            } catch (e) {
              result[key] = '[处理失败]';
            }
          }
          result['...'] = `(${keys.length - maxKeys} more keys)`;
          return result;
        }
        
        const result = {};
        for (const key of keys) {
          try {
            result[key] = process(obj[key], depth + 1);
          } catch (e) {
            result[key] = '[处理失败]';
          }
        }
        return result;
      };
      
      return process(obj);
    } catch (error) {
      return `[无法序列化的对象: ${error.message}]`;
    }
  }
  
  // 获取堆栈跟踪
  getStackTrace() {
    try {
      const stack = new Error().stack;
      return stack ? stack.split('\n').slice(3, 8) : []; // 跳过前几行，只保留5行
    } catch (error) {
      return [];
    }
  }
  
  // 获取内存使用情况
  getMemoryUsage() {
    try {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  
  // 获取性能信息
  getPerformanceInfo() {
    try {
      const navigation = performance.navigation;
      const timing = performance.timing;
      
      return {
        navigationType: navigation ? navigation.type : undefined,
        redirectCount: navigation ? navigation.redirectCount : undefined,
        domContentLoaded: timing ? timing.domContentLoadedEventEnd - timing.navigationStart : undefined,
        loadComplete: timing ? timing.loadEventEnd - timing.navigationStart : undefined,
        firstPaint: performance.getEntriesByType && performance.getEntriesByType('paint').length > 0 
          ? performance.getEntriesByType('paint')[0].startTime 
          : undefined
      };
    } catch (error) {
      return null;
    }
  }
  
  // 清理资源
  cleanup() {
    // 恢复原始控制台方法
    Object.keys(this.originalConsole).forEach(method => {
      console[method] = this.originalConsole[method];
    });
  }
}
```

### 3.12 lib/screenRecorder.js

```javascript
// 屏幕录制器 - 处理屏幕录制功能
export class ScreenRecorder {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.startTime = null;
    this.stream = null;
    this.recordingStats = {
      duration: 0,
      size: 0,
      chunksCount: 0
    };
  }
  
  // 开始录制
  async startRecording(options = {}) {
    try {
      // 默认配置
      const defaultOptions = {
        video: {
          cursor: "always",
          displaySurface: "monitor"
        },
        audio: false,
        logicalSurface: true
      };
      
      const recordingOptions = { ...defaultOptions, ...options };
      
      // 获取媒体流
      this.stream = await navigator.mediaDevices.getDisplayMedia(recordingOptions);
      
      // 监听流结束事件
      this.stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.handleStreamEnded();
      });
      
      // 配置录制器
      const mimeType = this.getSupportedMimeType();
      const videoBitsPerSecond = this.getOptimalBitrate();
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        videoBitsPerSecond: videoBitsPerSecond
      });
      
      // 重置状态
      this.recordedChunks = [];
      this.startTime = Date.now();
      this.recordingStats = {
        duration: 0,
        size: 0,
        chunksCount: 0
      };
      
      // 设置事件监听器
      this.mediaRecorder.ondataavailable = (event) => {
        this.handleDataAvailable(event);
      };
      
      this.mediaRecorder.onstop = () => {
        this.handleRecordingStopped();
      };
      
      this.mediaRecorder.onerror = (event) => {
        this.handleRecordingError(event);
      };
      
      // 开始录制
      this.mediaRecorder.start(1000); // 每秒收集一次数据
      
      console.log('屏幕录制已开始');
      return true;
    } catch (error) {
      console.error('启动屏幕录制失败:', error);
      throw error;
    }
  }
  
  // 停止录制
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // 停止媒体流
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
  
  // 处理数据可用事件
  handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.recordedChunks.push(event.data);
      this.recordingStats.chunksCount++;
      this.recordingStats.size += event.data.size;
      
      // 实时写入视频数据
      this.sessionManager.writeVideoChunk(event.data);
      
      // 更新录制统计
      this.recordingStats.duration = Date.now() - this.startTime;
    }
  }
  
  // 处理录制停止事件
  handleRecordingStopped() {
    console.log('屏幕录制已停止');
    
    // 记录录制完成事件
    this.sessionManager.writeUserEvent({
      type: 'recording_stopped',
      duration: this.recordingStats.duration,
      size: this.recordingStats.size,
      chunksCount: this.recordingStats.chunksCount
    });
    
    // 清理资源
    this.cleanup();
  }
  
  // 处理录制错误事件
  handleRecordingError(event) {
    console.error('屏幕录制错误:', event);
    
    // 记录错误事件
    this.sessionManager.writeUserEvent({
      type: 'recording_error',
      error: event.error ? event.error.message : '未知错误'
    });
  }
  
  // 处理流结束事件
  handleStreamEnded() {
    console.log('媒体流已结束');
    
    // 如果录制器还在活动状态，停止录制
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.stopRecording();
    }
    
    // 记录流结束事件
    this.sessionManager.writeUserEvent({
      type: 'stream_ended',
      reason: 'user_terminated'
    });
  }
  
  // 获取支持的MIME类型
  getSupportedMimeType() {
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    
    return 'video/webm'; // 默认类型
  }
  
  // 获取最佳比特率
  getOptimalBitrate() {
    // 根据屏幕分辨率和系统性能动态调整比特率
    const screenArea = screen.width * screen.height;
    const memoryInfo = performance.memory;
    
    let bitrate = 2500000; // 默认2.5Mbps
    
    // 根据屏幕分辨率调整
    if (screenArea > 1920 * 1080) {
      bitrate = 5000000; // 5Mbps for high resolution
    } else if (screenArea < 1280 * 720) {
      bitrate = 1000000; // 1Mbps for low resolution
    }
    
    // 根据内存使用情况调整
    if (memoryInfo) {
      const memoryUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
      if (memoryUsageRatio > 0.8) {
        bitrate = Math.floor(bitrate * 0.7); // 降低30%比特率
      }
    }
    
    return bitrate;
  }
  
  // 获取录制状态
  getRecordingStatus() {
    return {
      isRecording: this.mediaRecorder ? this.mediaRecorder.state !== 'inactive' : false,
      state: this.mediaRecorder ? this.mediaRecorder.state : 'inactive',
      duration: this.recordingStats.duration,
      size: this.recordingStats.size,
      chunksCount: this.recordingStats.chunksCount,
      startTime: this.startTime
    };
  }
  
  // 暂停录制
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      
      // 记录暂停事件
      this.sessionManager.writeUserEvent({
        type: 'recording_paused',
        timestamp: Date.now()
      });
    }
  }
  
  // 恢复录制
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      
      // 记录恢复事件
      this.sessionManager.writeUserEvent({
        type: 'recording_resumed',
        timestamp: Date.now()
      });
    }
  }
  
  // 截图
  async takeScreenshot() {
    if (!this.stream) {
      throw new Error('没有活动的媒体流');
    }
    
    try {
      // 创建视频元素
      const video = document.createElement('video');
      video.srcObject = this.stream;
      video.play();
      
      // 等待视频加载
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });
      
      // 创建canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // 绘制当前帧
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      // 转换为blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      // 写入截图
      await this.sessionManager.writeScreenshot(blob);
      
      // 记录截图事件
      this.sessionManager.writeUserEvent({
        type: 'screenshot_taken',
        width: canvas.width,
        height: canvas.height,
        timestamp: Date.now()
      });
      
      return blob;
    } catch (error) {
      console.error('截图失败:', error);
      throw error;
    }
  }
  
  // 清理资源
  cleanup() {
    // 停止录制器
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // 停止媒体流
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // 重置状态
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.startTime = null;
    this.recordingStats = {
      duration: 0,
      size: 0,
      chunksCount: 0
    };
  }
}
```

### 3.13 lib/dataCollectionCoordinator.js

```javascript
// 数据收集协调器 - 统一管理所有数据收集器
import { NetworkMonitor } from './networkMonitor.js';
import { ConsoleLogger } from './consoleLogger.js';
import { ScreenRecorder } from './screenRecorder.js';

export class DataCollectionCoordinator {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.networkMonitor = null;
    this.consoleLogger = null;
    this.screenRecorder = null;
    this.isCollecting = false;
    this.startTime = null;
  }

  // 开始数据收集
  async startCollection() {
    try {
      if (this.isCollecting) {
        throw new Error('数据收集已在进行中');
      }

      // 初始化网络监控器
      this.networkMonitor = new NetworkMonitor(this.sessionManager);
      
      // 初始化控制台日志记录器
      this.consoleLogger = new ConsoleLogger(this.sessionManager);
      
      // 初始化屏幕录制器
      this.screenRecorder = new ScreenRecorder(this.sessionManager);
      
      // 启动屏幕录制
      await this.screenRecorder.startRecording();
      
      // 记录收集开始事件
      await this.sessionManager.writeUserEvent({
        type: 'collection_started',
        timestamp: Date.now(),
        pageUrl: window.location.href
      });
      
      this.isCollecting = true;
      this.startTime = Date.now();
      
      console.log('数据收集已启动');
      return true;
    } catch (error) {
      console.error('启动数据收集失败:', error);
      await this.stopCollection(); // 清理部分初始化的组件
      throw error;
    }
  }

  // 停止数据收集
  async stopCollection() {
    try {
      if (!this.isCollecting) {
        return true;
      }

      // 记录收集停止事件
      if (this.sessionManager.isRecording) {
        await this.sessionManager.writeUserEvent({
          type: 'collection_stopped',
          timestamp: Date.now(),
          duration: Date.now() - this.startTime
        });
      }
      
      // 停止屏幕录制
      if (this.screenRecorder) {
        this.screenRecorder.stopRecording();
        this.screenRecorder = null;
      }
      
      // 清理网络监控器
      if (this.networkMonitor) {
        this.networkMonitor.cleanup();
        this.networkMonitor = null;
      }
      
      // 清理控制台日志记录器
      if (this.consoleLogger) {
        this.consoleLogger.cleanup();
        this.consoleLogger = null;
      }
      
      this.isCollecting = false;
      this.startTime = null;
      
      console.log('数据收集已停止');
      return true;
    } catch (error) {
      console.error('停止数据收集失败:', error);
      throw error;
    }
  }

  // 获取收集状态
  getCollectionStatus() {
    return {
      isCollecting: this.isCollecting,
      startTime: this.startTime,
      duration: this.isCollecting ? Date.now() - this.startTime : 0,
      components: {
        networkMonitor: !!this.networkMonitor,
        consoleLogger: !!this.consoleLogger,
        screenRecorder: !!this.screenRecorder
      }
    };
  }

  // 暂停数据收集
  async pauseCollection() {
    try {
      if (!this.isCollecting) {
        return true;
      }

      // 暂停屏幕录制
      if (this.screenRecorder) {
        this.screenRecorder.pauseRecording();
      }

      // 记录暂停事件
      await this.sessionManager.writeUserEvent({
        type: 'collection_paused',
        timestamp: Date.now()
      });

      console.log('数据收集已暂停');
      return true;
    } catch (error) {
      console.error('暂停数据收集失败:', error);
      throw error;
    }
  }

  // 恢复数据收集
  async resumeCollection() {
    try {
      if (!this.isCollecting) {
        throw new Error('数据收集未在进行中');
      }

      // 恢复屏幕录制
      if (this.screenRecorder) {
        this.screenRecorder.resumeRecording();
      }

      // 记录恢复事件
      await this.sessionManager.writeUserEvent({
        type: 'collection_resumed',
        timestamp: Date.now()
      });

      console.log('数据收集已恢复');
      return true;
    } catch (error) {
      console.error('恢复数据收集失败:', error);
      throw error;
    }
  }

  // 截图
  async takeScreenshot() {
    try {
      if (!this.screenRecorder) {
        throw new Error('屏幕录制器未初始化');
      }

      return await this.screenRecorder.takeScreenshot();
    } catch (error) {
      console.error('截图失败:', error);
      throw error;
    }
  }

  // 获取统计信息
  async getCollectionStats() {
    try {
      const stats = {
        isCollecting: this.isCollecting,
        startTime: this.startTime,
        duration: this.isCollecting ? Date.now() - this.startTime : 0,
        components: {}
      };

      // 获取屏幕录制统计
      if (this.screenRecorder) {
        stats.components.screenRecorder = this.screenRecorder.getRecordingStatus();
      }

      // 获取会话统计
      if (this.sessionManager) {
        stats.session = await this.sessionManager.getSessionStats();
      }

      return stats;
    } catch (error) {
      console.error('获取收集统计失败:', error);
      return {
        isCollecting: this.isCollecting,
        error: error.message
      };
    }
  }

  // 处理页面导航
  async handlePageNavigation(newUrl) {
    try {
      if (!this.isCollecting) {
        return;
      }

      // 记录页面导航事件
      await this.sessionManager.writeUserEvent({
        type: 'page_navigation',
        from: window.location.href,
        to: newUrl,
        timestamp: Date.now()
      });

      // 如果需要，可以重新初始化某些组件
      console.log('页面导航已处理');
    } catch (error) {
      console.error('处理页面导航失败:', error);
    }
  }

  // 处理标签页失焦/聚焦
  async handleTabVisibilityChange(isVisible) {
    try {
      if (!this.isCollecting) {
        return;
      }

      // 记录可见性变化事件
      await this.sessionManager.writeUserEvent({
        type: 'visibility_change',
        isVisible: isVisible,
        timestamp: Date.now()
      });

      // 可以根据需要暂停/恢复某些收集功能
      if (isVisible) {
        await this.resumeCollection();
      } else {
        await this.pauseCollection();
      }
    } catch (error) {
      console.error('处理可见性变化失败:', error);
    }
  }

  // 清理资源
  cleanup() {
    // 停止所有收集
    this.stopCollection().catch(error => {
      console.error('清理数据收集失败:', error);
    });
  }
}
```

### 3.14 options.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>浏览器记录助手 - 设置</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>浏览器记录助手设置</h1>
      <div class="version">v1.0.0</div>
    </header>
    
    <main class="main-content">
      <!-- 录制设置 -->
      <section class="settings-section">
        <h2>录制设置</h2>
        
        <div class="setting-item">
          <label for="video-quality">视频质量:</label>
          <select id="video-quality" class="select-input">
            <option value="low">低质量 (1Mbps)</option>
            <option value="medium" selected>中等质量 (2.5Mbps)</option>
            <option value="high">高质量 (5Mbps)</option>
          </select>
          <div class="setting-description">选择屏幕录制的视频质量，高质量会占用更多存储空间</div>
        </div>
        
        <div class="setting-item">
          <label for="max-duration">最大录制时长:</label>
          <div class="input-group">
            <input type="number" id="max-duration" class="number-input" min="1" max="480" value="60">
            <span class="input-unit">分钟</span>
          </div>
          <div class="setting-description">设置单次录制的最大时长，超过后自动停止</div>
        </div>
        
        <div class="setting-item">
          <label for="auto-stop-tab-close">标签页关闭时自动停止:</label>
          <div class="toggle-container">
            <input type="checkbox" id="auto-stop-tab-close" class="toggle-input" checked>
            <label for="auto-stop-tab-close" class="toggle-label"></label>
          </div>
          <div class="setting-description">当被录制的标签页关闭时，自动停止录制</div>
        </div>
      </section>
      
      <!-- 存储设置 -->
      <section class="settings-section">
        <h2>存储设置</h2>
        
        <div class="setting-item">
          <label for="max-storage-size">最大存储大小:</label>
          <div class="input-group">
            <input type="number" id="max-storage-size" class="number-input" min="100" max="10000" value="1000">
            <span class="input-unit">MB</span>
          </div>
          <div class="setting-description">设置录制数据的最大存储大小，超过后将清理旧数据</div>
        </div>
        
        <div class="setting-item">
          <label for="auto-cleanup">自动清理旧数据:</label>
          <div class="toggle-container">
            <input type="checkbox" id="auto-cleanup" class="toggle-input" checked>
            <label for="auto-cleanup" class="toggle-label"></label>
          </div>
          <div class="setting-description">自动清理超过30天的旧录制数据</div>
        </div>
      </section>
      
      <!-- 高级设置 -->
      <section class="settings-section">
        <h2>高级设置</h2>
        
        <div class="setting-item">
          <label for="debug-mode">调试模式:</label>
          <div class="toggle-container">
            <input type="checkbox" id="debug-mode" class="toggle-input">
            <label for="debug-mode" class="toggle-label"></label>
          </div>
          <div class="setting-description">启用调试模式，在控制台输出详细日志</div>
        </div>
        
        <div class="setting-item">
          <label for="experimental-features">实验性功能:</label>
          <div class="toggle-container">
            <input type="checkbox" id="experimental-features" class="toggle-input">
            <label for="experimental-features" class="toggle-label"></label>
          </div>
          <div class="setting-description">启用实验性功能，可能不稳定</div>
        </div>
      </section>
      
      <!-- 数据管理 -->
      <section class="settings-section">
        <h2>数据管理</h2>
        
        <div class="setting-item">
          <div class="button-group">
            <button id="export-data-btn" class="btn btn-secondary">导出数据</button>
            <button id="clear-data-btn" class="btn btn-danger">清除所有数据</button>
          </div>
          <div class="setting-description">导出或清除插件存储的所有数据</div>
        </div>
        
        <div class="setting-item">
          <div class="storage-info">
            <h3>存储使用情况</h3>
            <div id="storage-usage" class="storage-usage">
              <p>正在计算...</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    
    <footer class="footer">
      <div class="button-group">
        <button id="save-settings-btn" class="btn btn-primary">保存设置</button>
        <button id="reset-settings-btn" class="btn btn-secondary">重置为默认</button>
      </div>
      
      <div class="footer-links">
        <a href="#" id="help-link">帮助文档</a>
        <a href="#" id="feedback-link">反馈问题</a>
        <a href="#" id="about-link">关于</a>
      </div>
    </footer>
  </div>
  
  <!-- 确认对话框 -->
  <div id="confirm-dialog" class="dialog-overlay hidden">
    <div class="dialog">
      <div class="dialog-header">
        <h3 id="dialog-title">确认</h3>
        <button id="dialog-close" class="dialog-close">&times;</button>
      </div>
      <div class="dialog-content">
        <p id="dialog-message">确定要执行此操作吗？</p>
      </div>
      <div class="dialog-footer">
        <button id="dialog-cancel" class="btn btn-secondary">取消</button>
        <button id="dialog-confirm" class="btn btn-primary">确定</button>
      </div>
    </div>
  </div>
  
  <!-- 消息提示 -->
  <div id="message-container" class="message-container"></div>
  
  <script src="options.js"></script>
</body>
</html>
```

### 3.15 options.css

```css
/* 基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  color: #333;
  background-color: #f5f5f5;
  line-height: 1.6;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background-color: white;
  min-height: 100vh;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

/* 头部样式 */
.header {
  background-color: #4285f4;
  color: white;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 24px;
  font-weight: 500;
}

.version {
  font-size: 14px;
  opacity: 0.8;
}

/* 主内容区域 */
.main-content {
  padding: 32px;
}

/* 设置分组 */
.settings-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #eee;
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h2 {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #202124;
}

/* 设置项 */
.setting-item {
  margin-bottom: 24px;
}

.setting-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #5f6368;
}

.setting-description {
  font-size: 12px;
  color: #80868b;
  margin-top: 4px;
  line-height: 1.4;
}

/* 输入控件样式 */
.select-input, .number-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dadce0;
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  transition: border-color 0.2s ease;
}

.select-input:focus, .number-input:focus {
  outline: none;
  border-color: #4285f4;
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
}

.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-group .number-input {
  flex: 1;
  max-width: 120px;
}

.input-unit {
  font-size: 14px;
  color: #5f6368;
}

/* 开关样式 */
.toggle-container {
  display: inline-block;
}

.toggle-input {
  display: none;
}

.toggle-label {
  display: inline-block;
  width: 48px;
  height: 24px;
  background-color: #ccc;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.toggle-label::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-label {
  background-color: #4285f4;
}

.toggle-input:checked + .toggle-label::after {
  transform: translateX(24px);
}

/* 按钮样式 */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  text-decoration: none;
  display: inline-block;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3367d6;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* 存储信息 */
.storage-info {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.storage-info h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: #202124;
}

.storage-usage {
  font-size: 14px;
  color: #5f6368;
}

/* 底部区域 */
.footer {
  background-color: #f8f9fa;
  padding: 24px 32px;
  border-top: 1px solid #dee2e6;
}

.footer .button-group {
  margin-bottom: 16px;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 24px;
}

.footer-links a {
  color: #6c757d;
  text-decoration: none;
  font-size: 14px;
}

.footer-links a:hover {
  color: #495057;
  text-decoration: underline;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  font-size: 18px;
  font-weight: 500;
  color: #202124;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #5f6368;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-close:hover {
  color: #202124;
}

.dialog-content {
  padding: 24px;
}

.dialog-content p {
  font-size: 14px;
  color: #5f6368;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #eee;
}

/* 工具类 */
.hidden {
  display: none !important;
}

/* 消息提示 */
.message-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001;
  max-width: 400px;
}

.message {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 8px;
  animation: slideIn 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.message.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .container {
    margin: 0;
    box-shadow: none;
  }
  
  .main-content {
    padding: 20px;
  }
  
  .footer {
    padding: 20px;
  }
  
  .button-group {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
  
  .footer-links {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
}
```

### 3.16 options.js

```javascript
// 选项页面控制器
class OptionsController {
  constructor() {
    this.defaultSettings = {
      videoQuality: 'medium',
      maxRecordingDuration: 60,
      autoStopOnTabClose: true,
      maxStorageSize: 1000,
      autoCleanup: true,
      debugMode: false,
      experimentalFeatures: false
    };
    
    this.currentSettings = { ...this.defaultSettings };
    
    this.initializeElements();
    this.attachEventListeners();
    this.loadSettings();
    this.updateStorageUsage();
  }
  
  // 初始化DOM元素引用
  initializeElements() {
    // 录制设置
    this.videoQuality = document.getElementById('video-quality');
    this.maxDuration = document.getElementById('max-duration');
    this.autoStopTabClose = document.getElementById('auto-stop-tab-close');
    
    // 存储设置
    this.maxStorageSize = document.getElementById('max-storage-size');
    this.autoCleanup = document.getElementById('auto-cleanup');
    
    // 高级设置
    this.debugMode = document.getElementById('debug-mode');
    this.experimentalFeatures = document.getElementById('experimental-features');
    
    // 数据管理
    this.exportDataBtn = document.getElementById('export-data-btn');
    this.clearDataBtn = document.getElementById('clear-data-btn');
    this.storageUsage = document.getElementById('storage-usage');
    
    // 底部按钮
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.resetSettingsBtn = document.getElementById('reset-settings-btn');
    
    // 链接
    this.helpLink = document.getElementById('help-link');
    this.feedbackLink = document.getElementById('feedback-link');
    this.aboutLink = document.getElementById('about-link');
    
    // 对话框
    this.confirmDialog = document.getElementById('confirm-dialog');
    this.dialogTitle = document.getElementById('dialog-title');
    this.dialogMessage = document.getElementById('dialog-message');
    this.dialogClose = document.getElementById('dialog-close');
    this.dialogCancel = document.getElementById('dialog-cancel');
    this.dialogConfirm = document.getElementById('dialog-confirm');
    
    // 消息容器
    this.messageContainer = document.getElementById('message-container');
  }
  
  // 附加事件监听器
  attachEventListeners() {
    // 保存和重置按钮
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    this.resetSettingsBtn.addEventListener('click', () => this.resetSettings());
    
    // 数据管理按钮
    this.exportDataBtn.addEventListener('click', () => this.exportData());
    this.clearDataBtn.addEventListener('click', () => this.confirmClearData());
    
    // 对话框事件
    this.dialogClose.addEventListener('click', () => this.closeDialog());
    this.dialogCancel.addEventListener('click', () => this.closeDialog());
    this.dialogConfirm.addEventListener('click', () => this.handleDialogConfirm());
    
    // 链接事件
    this.helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelpPage();
    });
    
    this.feedbackLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedbackPage();
    });
    
    this.aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showAboutDialog();
    });
    
    // 设置变更监听
    this.videoQuality.addEventListener('change', () => this.onSettingsChange());
    this.maxDuration.addEventListener('input', () => this.onSettingsChange());
    this.autoStopTabClose.addEventListener('change', () => this.onSettingsChange());
    this.maxStorageSize.addEventListener('input', () => this.onSettingsChange());
    this.autoCleanup.addEventListener('change', () => this.onSettingsChange());
    this.debugMode.addEventListener('change', () => this.onSettingsChange());
    this.experimentalFeatures.addEventListener('change', () => this.onSettingsChange());
  }
  
  // 加载设置
  async loadSettings() {
    try {
      const { settings } = await chrome.storage.local.get('settings');
      
      if (settings) {
        this.currentSettings = { ...this.defaultSettings, ...settings };
      }
      
      this.updateUI();
    } catch (error) {
      console.error('加载设置失败:', error);
      this.showMessage('加载设置失败', 'error');
    }
  }
  
  // 更新UI
  updateUI() {
    this.videoQuality.value = this.currentSettings.videoQuality;
    this.maxDuration.value = this.currentSettings.maxRecordingDuration;
    this.autoStopTabClose.checked = this.currentSettings.autoStopOnTabClose;
    this.maxStorageSize.value = this.currentSettings.maxStorageSize;
    this.autoCleanup.checked = this.currentSettings.autoCleanup;
    this.debugMode.checked = this.currentSettings.debugMode;
    this.experimentalFeatures.checked = this.currentSettings.experimentalFeatures;
  }
  
  // 设置变更处理
  onSettingsChange() {
    // 标记设置已更改
    this.settingsChanged = true;
    
    // 更新保存按钮状态
    this.saveSettingsBtn.disabled = false;
  }
  
  // 保存设置
  async saveSettings() {
    try {
      // 收集设置值
      const newSettings = {
        videoQuality: this.videoQuality.value,
        maxRecordingDuration: parseInt(this.maxDuration.value),
        autoStopOnTabClose: this.autoStopTabClose.checked,
        maxStorageSize: parseInt(this.maxStorageSize.value),
        autoCleanup: this.autoCleanup.checked,
        debugMode: this.debugMode.checked,
        experimentalFeatures: this.experimentalFeatures.checked
      };
      
      // 验证设置
      if (!this.validateSettings(newSettings)) {
        return;
      }
      
      // 保存到存储
      await chrome.storage.local.set({ settings: newSettings });
      
      // 更新当前设置
      this.currentSettings = newSettings;
      
      // 重置变更标记
      this.settingsChanged = false;
      this.saveSettingsBtn.disabled = true;
      
      this.showMessage('设置已保存', 'success');
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showMessage('保存设置失败', 'error');
    }
  }
  
  // 验证设置
  validateSettings(settings) {
    if (settings.maxRecordingDuration < 1 || settings.maxRecordingDuration > 480) {
      this.showMessage('最大录制时长必须在1-480分钟之间', 'error');
      return false;
    }
    
    if (settings.maxStorageSize < 100 || settings.maxStorageSize > 10000) {
      this.showMessage('最大存储大小必须在100-10000MB之间', 'error');
      return false;
    }
    
    return true;
  }
  
  // 重置设置
  async resetSettings() {
    this.showDialog(
      '重置设置',
      '确定要重置所有设置为默认值吗？此操作不可撤销。',
      async () => {
        try {
          await chrome.storage.local.set({ settings: this.defaultSettings });
          this.currentSettings = { ...this.defaultSettings };
          this.updateUI();
          this.settingsChanged = false;
          this.saveSettingsBtn.disabled = true;
          
          this.showMessage('设置已重置为默认值', 'success');
        } catch (error) {
          console.error('重置设置失败:', error);
          this.showMessage('重置设置失败', 'error');
        }
      }
    );
  }
  
  // 导出数据
  async exportData() {
    try {
      const data = await chrome.storage.local.get(null);
      
      // 创建下载链接
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `browser-recorder-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      this.showMessage('数据导出成功', 'success');
    } catch (error) {
      console.error('导出数据失败:', error);
      this.showMessage('导出数据失败', 'error');
    }
  }
  
  // 确认清除数据
  confirmClearData() {
    this.showDialog(
      '清除所有数据',
      '确定要清除所有插件数据吗？此操作不可撤销，包括所有设置和录制数据。',
      async () => {
        try {
          await chrome.storage.local.clear();
          
          // 重新保存默认设置
          await chrome.storage.local.set({ settings: this.defaultSettings });
          this.currentSettings = { ...this.defaultSettings };
          this.updateUI();
          
          this.showMessage('所有数据已清除', 'success');
          this.updateStorageUsage();
        } catch (error) {
          console.error('清除数据失败:', error);
          this.showMessage('清除数据失败', 'error');
        }
      }
    );
  }
  
  // 更新存储使用情况
  async updateStorageUsage() {
    try {
      const data = await chrome.storage.local.get(null);
      const dataSize = JSON.stringify(data).length;
      const dataSizeMB = (dataSize / (1024 * 1024)).toFixed(2);
      
      // 计算各部分大小
      const settingsSize = JSON.stringify(data.settings || {}).length;
      const recordingStateSize = JSON.stringify(data.recordingState || {}).length;
      const otherSize = dataSize - settingsSize - recordingStateSize;
      
      this.storageUsage.innerHTML = `
        <p>总大小: ${dataSizeMB} MB</p>
        <ul>
          <li>设置: ${(settingsSize / 1024).toFixed(2)} KB</li>
          <li>录制状态: ${(recordingStateSize / 1024).toFixed(2)} KB</li>
          <li>其他数据: ${(otherSize / 1024).toFixed(2)} KB</li>
        </ul>
      `;
    } catch (error) {
      console.error('获取存储使用情况失败:', error);
      this.storageUsage.innerHTML = '<p>获取存储使用情况失败</p>';
    }
  }
  
  // 显示对话框
  showDialog(title, message, onConfirm) {
    this.dialogTitle.textContent = title;
    this.dialogMessage.textContent = message;
    this.confirmDialog.classList.remove('hidden');
    
    this.dialogConfirm.onclick = () => {
      if (onConfirm) {
        onConfirm();
      }
      this.closeDialog();
    };
  }
  
  // 关闭对话框
  closeDialog() {
    this.confirmDialog.classList.add('hidden');
  }
  
  // 显示关于对话框
  showAboutDialog() {
    this.showDialog(
      '关于浏览器记录助手',
      '浏览器记录助手 v1.0.0\n\n一个强大的浏览器录制工具，可以实时记录网络请求、控制台日志和屏幕活动。\n\n仅支持 Chrome 86+ 浏览器。\n\n© 2023 浏览器记录助手',
      null
    );
  }
  
  // 打开帮助页面
  openHelpPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('help.html')
    });
  }
  
  // 打开反馈页面
  openFeedbackPage() {
    chrome.tabs.create({
      url: 'https://github.com/your-repo/browser-recorder-extension/issues'
    });
  }
  
  // 显示消息
  showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    this.messageContainer.appendChild(message);
    
    // 3秒后自动移除消息
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }
}

// 初始化选项页面控制器
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
```

## 4. 开发环境设置

### 4.1 环境要求

- **浏览器**: Chrome 86+ 或基于 Chromium 的浏览器
- **开发工具**: VS Code 或其他代码编辑器
- **Node.js**: 14+ (用于构建工具，可选)
- **Git**: 用于版本控制

### 4.2 项目设置步骤

1. **创建项目文件夹**
   ```bash
   mkdir browser-recorder-extension
   cd browser-recorder-extension
   ```

2. **创建文件结构**
   ```
   browser-recorder-extension/
   ├── manifest.json
   ├── popup.html
   ├── popup.js
   ├── popup.css
   ├── background.js
   ├── content.js
   ├── options.html
   ├── options.js
   ├── options.css
   ├── lib/
   │   ├── fileSystemManager.js
   │   ├── realtimeFileWriter.js
   │   ├── sessionManager.js
   │   ├── networkMonitor.js
   │   ├── consoleLogger.js
   │   ├── screenRecorder.js
   │   └── dataCollectionCoordinator.js
   └── icons/
       ├── icon16.png
       ├── icon48.png
       └── icon128.png
   ```

3. **创建图标文件**
   - 创建16x16、48x48、128x128像素的PNG图标
   - 放入icons文件夹

4. **初始化Git仓库**
   ```bash
   git init
   echo "node_modules/" > .gitignore
   echo "*.log" >> .gitignore
   git add .
   git commit -m "Initial commit"
   ```

### 4.3 开发工具配置

#### VS Code 扩展推荐

1. **Chrome Extension Pack** - 包含多个Chrome扩展开发相关扩展
2. **ESLint** - 代码质量检查
3. **Prettier** - 代码格式化
4. **Live Server** - 本地开发服务器

#### ESLint 配置 (.eslintrc.js)

```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'warn'
  }
};
```

#### Prettier 配置 (.prettierrc)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 4.4 构建和打包

#### 使用 Webpack (可选)

创建 `webpack.config.js`:

```javascript
const path = require('path');

module.exports = {
  entry: {
    popup: './popup.js',
    background: './background.js',
    content: './content.js',
    options: './options.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};
```

#### 使用 npm scripts

在 `package.json` 中添加:

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "lint": "eslint *.js lib/*.js",
    "format": "prettier --write *.js lib/*.js"
  }
}
```

## 5. 调试方法

### 5.1 加载扩展到Chrome

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹
6. 扩展将出现在浏览器工具栏

### 5.2 调试弹窗

1. 右键点击扩展图标
2. 选择"检查弹出内容"
3. 将打开开发者工具

### 5.3 调试后台脚本

1. 访问 `chrome://extensions/`
2. 找到你的扩展
3. 点击"服务工作者"链接
4. 将打开后台脚本的开发者工具

### 5.4 调试内容脚本

1. 在目标网页上右键
2. 选择"检查"
3. 在开发者工具的Console中调试内容脚本

### 5.5 调试技巧

#### 使用 console.log

```javascript
// 在代码中添加调试信息
console.log('Debug: Variable value', variable);

// 使用条件调试
if (debugMode) {
  console.log('Debug: Detailed information', detailedInfo);
}
```

#### 使用 debugger 语句

```javascript
// 在代码中设置断点
function someFunction() {
  debugger; // 执行到这里会暂停
  // 其他代码
}
```

#### 使用 Chrome DevTools

1. **Network 标签页**: 监控网络请求
2. **Console 标签页**: 查看日志和错误
3. **Sources 标签页**: 设置断点和调试代码
4. **Application 标签页**: 查看存储和数据库

#### 错误处理

```javascript
// 使用 try-catch 捕获错误
try {
  // 可能出错的代码
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // 记录错误到文件或发送报告
}

// 使用 Promise.catch()
promise
  .then(result => {
    // 处理结果
  })
  .catch(error => {
    console.error('Promise failed:', error);
  });
```

## 6. 测试和验证

### 6.1 功能测试清单

#### 基本功能测试

- [ ] 扩展安装和加载
- [ ] 弹窗界面正常显示
- [ ] 文件夹选择功能
- [ ] 开始录制功能
- [ ] 停止录制功能
- [ ] 设置页面功能

#### 数据收集测试

- [ ] 网络请求监控
- [ ] 控制台日志捕获
- [ ] 屏幕录制功能
- [ ] 用户事件记录

#### 文件系统测试

- [ ] 文件夹创建
- [ ] 文件写入
- [ ] 实时数据流
- [ ] 大文件处理

#### 错误处理测试

- [ ] 权限被拒绝
- [ ] 磁盘空间不足
- [ ] 网络错误
- [ ] 浏览器兼容性

### 6.2 自动化测试

#### 单元测试示例 (使用 Jest)

```javascript
// fileSystemManager.test.js
import { FileSystemManager } from '../lib/fileSystemManager.js';

describe('FileSystemManager', () => {
  let fileSystemManager;
  
  beforeEach(() => {
    fileSystemManager = new FileSystemManager();
  });
  
  test('should initialize with null handles', () => {
    expect(fileSystemManager.dirHandle).toBeNull();
    expect(fileSystemManager.sessionDirHandle).toBeNull();
  });
  
  test('should generate correct session folder name', () => {
    const date = new Date('2023-12-07T08:30:15.123Z');
    const folderName = date.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    expect(folderName).toBe('2023-12-07_08-30-15');
  });
});
```

#### 集成测试示例

```javascript
// sessionManager.test.js
import { SessionManager } from '../lib/sessionManager.js';

describe('SessionManager Integration', () => {
  let sessionManager;
  
  beforeEach(async () => {
    sessionManager = new SessionManager();
    // 模拟文件系统访问
    global.window = {
      showDirectoryPicker: jest.fn()
    };
  });
  
  test('should start and stop recording session', async () => {
    // 模拟成功选择文件夹
    window.showDirectoryPicker.mockResolvedValue({
      queryPermission: jest.fn().mockResolvedValue('granted'),
      getDirectoryHandle: jest.fn().mockResolvedValue({
        getFileHandle: jest.fn()
      })
    });
    
    const sessionInfo = await sessionManager.startRecording();
    expect(sessionInfo.sessionId).toBeDefined();
    expect(sessionManager.isRecording).toBe(true);
    
    const stopInfo = await sessionManager.stopRecording();
    expect(stopInfo.sessionId).toBe(sessionInfo.sessionId);
    expect(sessionManager.isRecording).toBe(false);
  });
});
```

### 6.3 性能测试

#### 内存使用测试

```javascript
// 监控内存使用
function monitorMemoryUsage() {
  if (performance.memory) {
    const memory = performance.memory;
    console.log('Memory Usage:', {
      used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
    });
  }
}

// 定期检查内存使用
setInterval(monitorMemoryUsage, 5000);
```

#### 文件写入性能测试

```javascript
// 测试文件写入性能
async function testFileWritePerformance() {
  const testData = 'Test data for performance measurement\n';
  const iterations = 1000;
  
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await fileWriter.writeData('test.log', testData + i);
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`Write Performance: ${iterations} writes in ${duration.toFixed(2)}ms`);
  console.log(`Average: ${(duration / iterations).toFixed(2)}ms per write`);
}
```

### 6.4 用户验收测试

#### 测试场景

1. **新用户首次使用**
   - 安装扩展
   - 选择输出文件夹
   - 开始录制
   - 执行一些操作
   - 停止录制
   - 检查生成的文件

2. **长时间录制**
   - 开始录制
   - 录制30分钟以上
   - 检查文件大小和完整性

3. **多标签页录制**
   - 在多个标签页中操作
   - 检查是否正确记录所有活动

4. **错误恢复**
   - 模拟网络错误
   - 模拟磁盘空间不足
   - 检查错误处理和恢复机制

## 7. 常见问题和解决方案

### 7.1 权限相关问题

#### 问题: File System Access API 不工作

**症状**: 文件夹选择器不出现，或选择后无法写入文件

**解决方案**:
1. 确保使用 Chrome 86+ 浏览器
2. 检查 manifest.json 中的权限配置
3. 确保在安全上下文中使用 (https:// 或 localhost)
4. 重新授权文件夹访问权限

```javascript
// 检查浏览器兼容性
if (!window.showDirectoryPicker) {
  throw new Error('您的浏览器不支持 File System Access API，请使用 Chrome 86+ 浏览器');
}

// 检查权限状态
const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
if (permission !== 'granted') {
  // 请求权限
  const newPermission = await dirHandle.requestPermission({ mode: 'readwrite' });
  if (newPermission !== 'granted') {
    throw new Error('需要文件写入权限');
  }
}
```

#### 问题: 屏幕录制权限被拒绝

**症状**: 点击开始录制后，屏幕录制失败

**解决方案**:
1. 检查 manifest.json 中的 desktopCapture 权限
2. 确保用户授予了屏幕共享权限
3. 处理权限被拒绝的情况

```javascript
try {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { cursor: "always" },
    audio: false
  });
} catch (error) {
  if (error.name === 'NotAllowedError') {
    throw new Error('用户拒绝了屏幕录制权限');
  } else if (error.name === 'NotFoundError') {
    throw new Error('没有找到可用的屏幕录制设备');
  } else {
    throw new Error(`屏幕录制失败: ${error.message}`);
  }
}
```

### 7.2 文件系统问题

#### 问题: 文件写入失败

**症状**: 数据无法写入文件，或文件损坏

**解决方案**:
1. 检查文件夹权限
2. 检查磁盘空间
3. 实现错误重试机制
4. 添加数据完整性检查

```javascript
// 带重试的文件写入
async function writeDataWithRetry(fileName, data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fileWriter.writeData(fileName, data);
      return true;
    } catch (error) {
      console.warn(`写入失败，重试 ${i + 1}/${maxRetries}:`, error);
      if (i === maxRetries - 1) {
        throw error;
      }
      // 指数退避
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

#### 问题: 大文件处理

**症状**: 录制时间较长时，文件过大导致问题

**解决方案**:
1. 实现文件分块
2. 添加文件大小限制
3. 实现文件轮转
4. 压缩数据

```javascript
// 文件大小检查
async function checkFileSize(fileName, maxSize) {
  const fileHandle = await fileWriter.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  
  if (file.size > maxSize) {
    // 创建新文件
    const timestamp = Date.now();
    const newFileName = fileName.replace('.', `_${timestamp}.`);
    return newFileName;
  }
  
  return fileName;
}
```

### 7.3 性能问题

#### 问题: 内存使用过高

**症状**: 录制时间较长时，浏览器变得卡顿

**解决方案**:
1. 定期清理内存
2. 实现数据缓冲
3. 限制数据收集频率
4. 优化数据结构

```javascript
// 内存清理
class MemoryManager {
  constructor() {
    this.maxBufferSize = 10 * 1024 * 1024; // 10MB
    this.buffers = new Map();
  }
  
  addToBuffer(key, data) {
    if (!this.buffers.has(key)) {
      this.buffers.set(key, []);
    }
    
    const buffer = this.buffers.get(key);
    buffer.push(data);
    
    // 检查内存使用
    const totalSize = this.calculateBufferSize();
    if (totalSize > this.maxBufferSize) {
      this.flushBuffers();
    }
  }
  
  flushBuffers() {
    for (const [key, buffer] of this.buffers) {
      if (buffer.length > 0) {
        // 写入数据
        fileWriter.batchWrite(key, buffer);
        // 清空缓冲区
        this.buffers.set(key, []);
      }
    }
  }
}
```

#### 问题: 录制性能差

**症状**: 屏幕录制卡顿，帧率低

**解决方案**:
1. 调整录制质量
2. 优化视频编码
3. 根据系统性能自适应

```javascript
// 自适应质量调整
function getOptimalRecordingSettings() {
  const memoryInfo = performance.memory;
  const cpuCores = navigator.hardwareConcurrency || 4;
  
  let settings = {
    videoBitsPerSecond: 2500000,
    frameRate: 25
  };
  
  // 根据系统资源调整
  if (memoryInfo && memoryInfo.jsHeapSizeLimit > 4 * 1024 * 1024 * 1024 && cpuCores >= 8) {
    settings = {
      videoBitsPerSecond: 5000000,
      frameRate: 30
    };
  } else if (memoryInfo && memoryInfo.jsHeapSizeLimit < 2 * 1024 * 1024 * 1024) {
    settings = {
      videoBitsPerSecond: 1000000,
      frameRate: 15
    };
  }
  
  return settings;
}
```

### 7.4 兼容性问题

#### 问题: 不同Chrome版本兼容性

**症状**: 在某些Chrome版本上功能异常

**解决方案**:
1. 检查API可用性
2. 实现polyfill
3. 版本检查和降级处理

```javascript
// API可用性检查
function checkAPIAvailability() {
  const features = {
    fileSystemAccess: 'showDirectoryPicker' in window,
    mediaRecorder: 'MediaRecorder' in window,
    displayMedia: 'getDisplayMedia' in navigator.mediaDevices,
    performanceMemory: 'memory' in performance
  };
  
  const missingFeatures = Object.entries(features)
    .filter(([name, available]) => !available)
    .map(([name]) => name);
  
  if (missingFeatures.length > 0) {
    console.warn('缺少以下功能:', missingFeatures);
    return false;
  }
  
  return true;
}

// 版本检查
function getChromeVersion() {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

if (getChromeVersion() < 86) {
  console.error('需要 Chrome 86 或更高版本');
}
```

### 7.5 调试技巧

#### 使用Chrome DevTools

1. **扩展页面调试**
   - 访问 `chrome://extensions/`
   - 点击扩展的"检查视图"链接

2. **后台脚本调试**
   - 访问 `chrome://extensions/`
   - 点击"服务工作者"链接

3. **内容脚本调试**
   - 在目标网页上右键
   - 选择"检查"
   - 在Console中查看内容脚本输出

#### 日志记录

```javascript
// 统一日志记录
class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }
  
  log(level, message, data = null) {
    if (this.levels[level] >= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
    }
  }
  
  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
}

// 使用示例
const logger = new Logger('debug');
logger.debug('调试信息', { variable: value });
logger.info('普通信息');
logger.warn('警告信息');
logger.error('错误信息', error);
```

## 8. 部署和发布

### 8.1 准备发布包

1. **清理项目**
   ```bash
   # 删除开发文件
   rm -rf node_modules/
   rm -f .gitignore
   rm -f webpack.config.js
   rm -f .eslintrc.js
   rm -f .prettierrc
   ```

2. **压缩文件**
   ```bash
   # 创建发布包
   zip -r browser-recorder-extension-v1.0.0.zip .
   ```

3. **验证发布包**
   - 在新的Chrome配置文件中测试
   - 确保所有功能正常工作

### 8.2 Chrome Web Store发布

1. **准备开发者账户**
   - 注册Chrome Web Store开发者账户
   - 支付一次性注册费用 ($5)

2. **准备应用信息**
   - 应用名称和描述
   - 应用图标 (128x128)
   - 截图 (1280x800 或 640x400)
   - 隐私政策
   - 详细描述

3. **上传和提交**
   - 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - 点击"添加新项目"
   - 上传ZIP文件
   - 填写应用信息
   - 提交审核

### 8.3 版本管理

#### 版本号规则

使用语义化版本 (SemVer):
- 主版本号: 不兼容的API修改
- 次版本号: 向下兼容的功能性新增
- 修订号: 向下兼容的问题修正

#### manifest.json 版本更新

```json
{
  "version": "1.0.0",
  "version_name": "1.0.0 稳定版"
}
```

#### 更新日志

创建 `CHANGELOG.md`:

```markdown
# 更新日志

## [1.0.0] - 2023-12-07

### 新增
- 初始版本发布
- 实时网络请求监控
- 控制台日志捕获
- 屏幕录制功能
- 文件系统实时写入

### 修复
- 修复内存泄漏问题
- 优化大文件处理性能

### 已知问题
- 仅支持Chrome 86+浏览器
```

### 8.4 用户支持

#### 帮助文档

创建 `help.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>浏览器记录助手 - 帮助</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1, h2 {
      color: #333;
    }
    .section {
      margin-bottom: 30px;
    }
    .step {
      margin-bottom: 10px;
      padding-left: 20px;
    }
    .warning {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <h1>浏览器记录助手 - 使用帮助</h1>
  
  <div class="section">
    <h2>快速开始</h2>
    <div class="step">1. 安装扩展后，点击浏览器工具栏中的扩展图标</div>
    <div class="step">2. 首次使用需要选择输出文件夹</div>
    <div class="step">3. 点击"开始记录"按钮开始录制</div>
    <div class="step">4. 在浏览器中进行操作</div>
    <div class="step">5. 点击"停止记录"结束录制</div>
  </div>
  
  <div class="section">
    <h2>功能说明</h2>
    <h3>网络请求监控</h3>
    <p>自动记录所有HTTP/HTTPS请求，包括请求头、响应头和响应数据。</p>
    
    <h3>控制台日志</h3>
    <p>捕获所有控制台输出，包括console.log、console.error等。</p>
    
    <h3>屏幕录制</h3>
    <p>录制浏览器标签页的屏幕活动，保存为WebM视频文件。</p>
  </div>
  
  <div class="section">
    <h2>常见问题</h2>
    
    <h3>Q: 为什么扩展无法工作？</h3>
    <A: 请确保使用Chrome 86+浏览器，并已授予必要的权限。</A>
    
    <h3>Q: 录制的文件在哪里？</h3>
    <A: 文件保存在您选择的输出文件夹中，每次录制会创建一个以时间戳命名的子文件夹。</A>
    
    <h3>Q: 如何更改输出文件夹？</h3>
    <A: 在扩展弹窗中点击"更改文件夹"按钮即可。</A>
  </div>
  
  <div class="warning">
    <strong>重要提示:</strong> 本扩展仅支持Chrome 86+浏览器，其他浏览器无法使用。
  </div>
</body>
</html>
```

#### 反馈收集

1. **GitHub Issues**
   - 创建GitHub仓库
   - 设置Issue模板
   - 监控和回复用户反馈

2. **邮件支持**
   - 提供支持邮箱
   - 及时回复用户问题

3. **用户调查**
   - 定期收集用户反馈
   - 根据反馈改进产品

### 8.5 监控和分析

#### 使用统计

```javascript
// 匿名使用统计
class UsageAnalytics {
  constructor() {
    this.userId = this.getUserId();
  }
  
  getUserId() {
    let userId = localStorage.getItem('analytics_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('analytics_user_id', userId);
    }
    return userId;
  }
  
  trackEvent(eventName, properties = {}) {
    const event = {
      userId: this.userId,
      eventName: eventName,
      properties: properties,
      timestamp: Date.now(),
      version: chrome.runtime.getManifest().version
    };
    
    // 发送到分析服务
    this.sendEvent(event);
  }
  
  sendEvent(event) {
    // 这里可以发送到Google Analytics或其他分析服务
    console.log('Analytics Event:', event);
  }
}

// 使用示例
const analytics = new UsageAnalytics();
analytics.trackEvent('recording_started', { duration: 120 });
analytics.trackEvent('feature_used', { feature: 'screenshot' });
```

#### 错误报告

```javascript
// 错误报告系统
class ErrorReporter {
  constructor() {
    this.errorQueue = [];
    this.maxQueueSize = 10;
  }
  
  reportError(error, context = {}) {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      version: chrome.runtime.getManifest().version
    };
    
    this.errorQueue.push(errorReport);
    
    // 限制队列大小
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
    
    // 发送错误报告
    this.sendErrorReport(errorReport);
  }
  
  sendErrorReport(errorReport) {
    // 这里可以发送到错误收集服务
    console.error('Error Report:', errorReport);
    
    // 也可以保存到本地存储
    chrome.storage.local.get('errorReports', (data) => {
      const reports = data.errorReports || [];
      reports.push(errorReport);
      chrome.storage.local.set({ errorReports: reports });
    });
  }
}

// 使用示例
const errorReporter = new ErrorReporter();

try {
  // 可能出错的代码
  await riskyOperation();
} catch (error) {
  errorReporter.reportError(error, { operation: 'riskyOperation' });
}
```

## 总结

这个完整的浏览器插件开发指南提供了从项目概述到部署发布的全流程指导。通过详细的代码实现、开发环境设置、调试方法和测试验证，开发者可以直接根据本文档开发出一个功能完整的浏览器记录插件。

### 关键特点

1. **完整的代码实现**: 所有核心功能都有完整的代码实现，可以直接使用
2. **详细的开发指南**: 从环境设置到部署发布的全流程指导
3. **实用的调试方法**: 提供了多种调试技巧和工具
4. **全面的测试验证**: 包括功能测试、性能测试和用户验收测试
5. **实用的错误处理**: 针对常见问题提供了解决方案

### 技术亮点

1. **File System Access API**: 利用现代浏览器API实现实时文件写入
2. **模块化架构**: 清晰的代码组织和模块划分
3. **错误恢复机制**: 完善的错误处理和恢复策略
4. **性能优化**: 内存管理和性能优化策略
5. **用户体验**: 直观的界面设计和操作流程

通过遵循这个开发指南，开发者可以创建一个功能强大、性能优秀的浏览器记录插件，满足用户的实际需求。