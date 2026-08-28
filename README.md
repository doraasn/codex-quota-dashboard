# Codex Quota Dashboard

一个为 Windows 11 设计的轻量 Codex 额度悬浮窗。

## 功能

- 始终显示 5 小时额度和周额度
- 每 5 秒通过本机 `codex.exe app-server` 主动读取一次额度
- 显示重置时间和周重置次数
- 自由拖动并记住位置
- 可放置在任务栏区域，失焦或移动结束时按需恢复顶层状态
- 托盘支持手动刷新、跟随 Codex 启动和退出
- 悬浮窗右键退出

程序只调用本机 JSON-RPC 方法 `account/rateLimits/read`，不抓取网页、Cookie 或浏览器数据。

## 开发

```powershell
npm install
npm run verify
npm start
```

## 构建单文件 EXE

```powershell
npm run dist
```

产物位于 `release/CodexQuotaDashboard-1.0.1-x64.exe`。
