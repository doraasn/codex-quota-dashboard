# Codex Quota Dashboard

一个为 Windows 11 设计的轻量 Codex 额度和 DeepSeek 余额悬浮窗。

## 功能

- 始终显示 5 小时额度和周额度
- 每 5 秒通过本机 `codex.exe app-server` 主动读取一次额度
- 每 5 秒读取一次 DeepSeek 账户余额，API Key 来自项目配置文件
- 显示重置时间和周重置次数
- 自由拖动并记住位置
- 可放置在任务栏区域，失焦或移动结束时按需恢复顶层状态
- 托盘支持手动刷新和退出
- 双击悬浮窗手动刷新，刷新时显示圆环动画
- 悬浮窗右键退出

Codex 额度只调用本机 JSON-RPC 方法 `account/rateLimits/read`，不抓取网页、Cookie 或浏览器数据。DeepSeek 余额调用官方 `GET /user/balance` 接口，只读取账户余额。

## DeepSeek API Key

DeepSeek API Key 放到项目配置文件：

```text
C:\Projects\codex-quota-dashboard\config\deepseek.json
```

程序自身的位置、缓存等运行数据放在项目的 `data` 目录，不再使用 `%LOCALAPPDATA%\CodexQuotaDashboard`。

文件内容：

```json
{
  "apiKey": "你的 DeepSeek API Key"
}
```

可选自定义 DeepSeek API Base URL：

```json
{
  "apiKey": "你的 DeepSeek API Key",
  "baseUrl": "https://api.deepseek.com"
}
```

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

产物位于 `release/CodexQuotaDashboard-1.0.5-x64.exe`。
