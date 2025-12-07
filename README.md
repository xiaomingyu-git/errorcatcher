# ErrorCatcher - 浏览器记录插件

## 项目概述

ErrorCatcher 是一个功能强大的浏览器记录插件，旨在帮助开发者实时记录和调试浏览器活动。该插件能够实时记录网络请求、控制台日志和屏幕录像，并将数据流式保存到本地文件夹。

## 功能特点

- 🌐 **网络请求监控** - 实时捕获所有HTTP/HTTPS请求和响应
- 📝 **控制台日志记录** - 捕获所有控制台输出，包括日志、警告和错误
- 🎥 **屏幕录制** - 录制浏览器标签页的屏幕活动
- 💾 **实时数据流** - 数据实时流式写入本地文件夹，不在点击停止时才开始写入
- 📁 **会话管理** - 每次记录创建独立的时间戳文件夹
- 🔒 **数据安全** - 敏感信息自动脱敏处理

## 技术规格

- **浏览器兼容性**: Chrome 86+ (使用 File System Access API)
- **开发语言**: JavaScript (ES6+)
- **架构模式**: 模块化设计，Service Worker + Content Scripts
- **文件格式**: JSON (日志), WebM (视频)

## 项目结构

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
├── lib/                          # 核心库文件
│   ├── fileSystemManager.js      # 文件系统管理器
│   ├── realtimeFileWriter.js     # 实时文件写入器
│   ├── sessionManager.js         # 会话管理器
│   ├── networkMonitor.js         # 网络请求监控
│   ├── consoleLogger.js          # 控制台日志捕获
│   ├── screenRecorder.js         # 屏幕录制器
│   └── dataCollectionCoordinator.js # 数据收集协调器
├── icons/                        # 图标文件
│   ├── icon16.png               # 16x16图标
│   ├── icon48.png               # 48x48图标
│   └── icon128.png              # 128x128图标
└── README.md                     # 项目说明文档
```

## 快速开始

### 安装要求

- Chrome 86+ 或基于 Chromium 的浏览器
- 足够的磁盘空间用于存储录制数据

### 安装步骤

1. 克隆或下载此项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹
6. 扩展将出现在浏览器工具栏中

### 使用方法

1. 点击浏览器工具栏中的扩展图标
2. 首次使用需要选择输出文件夹
3. 点击"开始记录"按钮开始录制
4. 在浏览器中进行需要记录的操作
5. 点击"停止记录"结束录制
6. 录制数据将保存在选择的文件夹中

## 开发文档

详细的开发文档请参考 [`browser-extension-architecture.md`](./browser-extension-architecture.md)，该文档包含：

- 完整的代码实现
- 开发环境设置
- 调试方法
- 测试和验证
- 常见问题和解决方案
- 部署和发布指南

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系我们。