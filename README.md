# Codex Quota Dashboard

一个为 Windows 11 设计的轻量 Codex 额度和 DeepSeek 余额悬浮窗。

## 功能

- 始终显示 5 小时额度和周额度
- 每 5 秒通过本机 `codex.exe app-server` 主动读取一次额度
- 每 5 秒读取一次 DeepSeek 账户余额，API Key 来自项目配置文件
- DeepSeek 下方显示今日已消费金额（需要平台登录态 userToken）
- DeepSeek 圆环按当天余额消耗逐渐留白，并在本地保存最近 31 天的起始余额
- Codex 切换账号后自动重连并刷新，无需重新打开悬浮窗
- 显示重置时间和周重置次数
- 自由拖动并记住位置
- 可放置在任务栏区域，失焦或移动结束时按需恢复顶层状态
- 托盘支持手动刷新和退出
- 双击悬浮窗手动刷新，刷新时显示圆环动画
- 悬浮窗右键退出

Codex 额度只调用本机 JSON-RPC 方法 `account/rateLimits/read`，不抓取网页、Cookie 或浏览器数据。DeepSeek 余额调用官方 `GET /user/balance` 接口，只读取账户余额。

Codex 当前只维护一个活动登录账户，也没有提供可枚举多个已登录账户的接口，因此悬浮窗不自行保存多份登录 Token。切换 Codex 账号后，悬浮窗会检测本地认证状态变化并自动重建连接。初始化、读取超时或失败时也会自动重连，并将不含账号、额度原文和凭据的诊断事件写入 `data/diagnostics.log`。

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

## 今日消费（可选）

官方 API 没有“今日已消费”接口，悬浮窗使用 DeepSeek 平台网页后台的私有用量接口统计当天消费，因此需要在配置文件里额外加登录态 `userToken`：

```json
{
  "apiKey": "你的 DeepSeek API Key",
  "userToken": "platform.deepseek.com 登录态 userToken"
}
```

获取方式：登录 [platform.deepseek.com](https://platform.deepseek.com) 后，按 F12 打开控制台，执行 `localStorage.getItem("userToken")`，把返回值填到上面的 `userToken` 字段。该 Token 只保存在本地配置文件（已被 gitignore，不会提交），权限与平台账号登录态相当，请勿外传；失效后重新获取即可。

今日消费每 60 秒刷新一次（余额仍每 5 秒刷新），接口为平台私有接口，可能随时变更；接口失败或未配置 Token 时，DeepSeek 下方会使用本地余额变化估算，不影响余额显示。

每天首次成功读取 DeepSeek 余额时，程序会将当天起始金额记录到 `data/deepseek-daily.json`。后续余额下降会累计为当日估算消费，圆环按“当前余额 / 当前余额与今日消费之和”逐渐留白。平台今日消费接口可用时优先显示平台数据；接口失效或未配置 `userToken` 时显示 `今日约 ¥X`，估算从当天首次记录开始。

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

产物位于 `release/CodexQuotaDashboard-1.0.8-x64.exe`。
