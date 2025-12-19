# React Native + EXPO + WebApp 包装器模板


## 环境配置
```
在 constants\app-config.ts 中配置
```

## 主题设置
```
在 constants\theme.ts 中配置
```

## 启动画面
```
在 components\custom-splash.tsx 中配置
（受环境配置影响）
```

## 离线页面
```
在 components\offline-screen.tsx 中配置
（受环境配置影响）
```


---


## URL过滤

在`allowedUrlPatterns`中设置允许的URL模式。不允许的URL将在外部浏览器中打开。

```typescript
allowedUrlPatterns: [
  'https://example.com',     // 精确域名
  'https://*.example.com',   // 通配符（子域名）
],
// 空数组允许所有URL
```


---


## 桥接系统

```text
Web → App: app://动作名
App → Web: native://动作名
```


### TypeScript 类型定义（Web 端）

TypeScript 可能因缺少类型而报错。选择以下方法之一来解决。


#### 方法 A: 安装类型包（推荐）

```bash
npm install rn-webwrapper-bridge-types --save-dev
```

在 `tsconfig.json` 的 `compilerOptions.types` 中添加包名。

```json
{
  "compilerOptions": {
    "types": ["rn-webwrapper-bridge-types"]
  }
}
```


#### 方法 B: 使用 import

在应用的入口文件（例如: `main.ts`、`app.tsx`）中导入一次即可。

```typescript
import 'rn-webwrapper-bridge-types';
```


#### 方法 C: 手动类型声明

在项目中直接创建类型定义文件。

```typescript
// globals.d.ts

interface AppBridge {
  /** 向应用发送消息（无响应） */
  send(action: string, payload?: Record<string, unknown>): void;
  
  /** 向应用发送消息并等待响应 */
  call<T = unknown>(action: string, payload?: Record<string, unknown>, timeout?: number): Promise<T>;
  
  /** 注册来自应用的消息监听器（'*' 接收所有消息） */
  on(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** 仅接收一次消息，然后自动注销 */
  once(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** 等待特定消息直到超时（once 的 Promise 版本） */
  waitFor<T = unknown>(action: string, timeout?: number): Promise<{ payload: T; message: unknown }>;
  
  /** 注销监听器 */
  off(action: string, callback?: (payload: unknown, message?: unknown) => void): void;
  
  /** 检查是否在应用环境中运行 */
  isApp(): boolean;
  
  /** 版本 */
  version: string;
}

interface Window {
  AppBridge?: AppBridge;
}
```


---


### 按通信方向的函数关系

| 方向 | 发送方 | 接收方 | 说明 |
|------|--------|--------|------|
| **Web → App** | `AppBridge.send()` | `registerHandler()` | 单向传输（无响应） |
| **Web → App** | `AppBridge.call()` | `registerHandler()` | 请求并等待响应（Promise） |
| **App → Web** | `sendToWeb()` | `AppBridge.on()` | 单向传输（无响应） |
| **App → Web** | `sendToWeb()` | `AppBridge.once()` | 单向传输（仅接收一次） |
| **App → Web** | `sendToWeb()` | `AppBridge.waitFor()` | 等待直到超时（Promise） |
| **App → Web** | `callWeb()` | `AppBridge.on()` | 请求并等待响应（Promise） |


---


### Web (JavaScript)

#### 使用示例
```javascript
// 检查应用环境
if (window.AppBridge?.isApp()) {
  
  // 1. 单向传输（无响应）
  AppBridge.send('showToast', { message: '你好！' });
  AppBridge.send('vibrate');
  
  // 2. 请求并等待响应
  const appInfo = await AppBridge.call('getAppInfo');
  const deviceInfo = await AppBridge.call('getDeviceInfo');
  
  // 3. 接收来自应用的消息
  AppBridge.on('customEvent', (payload) => {
    console.log('从应用接收的数据:', payload);
  });
}
```

#### AppBridge 方法

| 方法 | 说明 |
|------|------|
| `send(action, payload)` | 向应用发送消息（无响应） |
| `call(action, payload, timeout)` | 向应用发送消息并等待响应（返回 Promise） |
| `on(action, callback)` | 注册来自应用的消息监听器（`*` 接收所有消息） |
| `once(action, callback)` | 仅接收一次消息，然后自动注销 |
| `waitFor(action, timeout)` | 等待特定消息直到超时（返回 Promise） |
| `off(action, callback)` | 注销监听器 |
| `isApp()` | 检查是否在应用环境中运行（ReactNativeWebView 存在性） |


---


### React Native (应用)

#### 使用示例
```javascript
import { registerHandler, sendToWeb } from '@/lib/bridge';

// 注册 Web 调用的处理器
registerHandler('myCustomAction', (payload, respond) => {
  console.log('接收到的数据:', payload);
  respond({ result: 'success' });
});

// 使用超时选项注册处理器（5秒内无响应则自动报错）
registerHandler('heavyTask', async (payload, respond) => {
  const result = await doSomething();
  respond(result);
}, { timeout: 5000 });

// 一次性处理器
registerHandler('oneTimeAction', (payload, respond) => {
  respond({ done: true });
}, { once: true });

// 从应用向 Web 发送消息（Web 使用 on 方法监听）
sendToWeb('notification', { title: '通知', body: '内容' });
```

#### 桥接函数

| 函数 | 说明 |
|------|------|
| `setBridgeWebView(webView)` | 设置 WebView 实例（桥接连接必需） |
| `registerHandler(action, handler, options?)` | 注册 Web 调用的处理器。options: `{ timeout?, once? }` |
| `unregisterHandler(action)` | 注销处理器 |
| `clearHandlers()` | 注销所有处理器 |
| `handleBridgeMessage(messageData)` | 处理来自 Web 的消息（在 WebView onMessage 中使用） |
| `sendToWeb(action, payload)` | 从应用向 Web 发送消息 |
| `callWeb(action, payload, timeout)` | 从应用向 Web 发送请求并等待响应（Promise） |
| `registerBuiltInHandlers()` | 一次性注册所有内置处理器 |


---


### 内置处理器

| 动作 | 载荷 | 响应 | Android | iOS | 说明 |
|------|------|------|:-------:|:---:|------|
| `getDeviceInfo` | - | `{ platform, version, isTV, brand, modelName, deviceName, osName, osVersion, deviceType, isDevice }` | ✅ | ✅ | 获取设备信息 |
| `getAppInfo` | - | `{ name, version, buildVersion, bundleId }` | ✅ | ✅ | 获取应用信息 |
| `showToast` | `{ message, duration? }` | - | ✅ | ⚠️ | Toast 消息 (iOS: Alert) |
| `vibrate` | `{ pattern?: number[] }` | - | ✅ | ✅ | 触发振动 |
| `copyToClipboard` | `{ text }` | `{ success }` | ✅ | ✅ | 复制到剪贴板 |
| `getClipboard` | - | `{ success, text }` | ✅ | ✅ | 从剪贴板读取 |
| `openExternalUrl` | `{ url }` | `{ success }` | ✅ | ✅ | 打开外部 URL |
| `goBack` | - | - | ✅ | ✅ | WebView 后退 |
| `goForward` | - | - | ✅ | ✅ | WebView 前进 |
| `reload` | - | - | ✅ | ✅ | WebView 重新加载 |
| `hideSplash` | - | - | ✅ | ✅ | 隐藏启动画面 |
| `getOrientation` | - | `{ success, orientation, lock }` | ✅ | ✅ | 获取屏幕方向状态 |
| `setOrientation` | `{ mode }` | `{ success, mode }` | ✅ | ✅ | 设置屏幕方向 |
| `unlockOrientation` | - | `{ success }` | ✅ | ✅ | 解锁屏幕方向 |
| `getStatusBar` | - | `{ success, saved }` | ✅ | ✅ | 获取状态栏状态 |
| `setStatusBar` | `{ hidden?, style?, color?, animated? }` | `{ success }` | ✅ | ⚠️ | 设置状态栏 (color: 仅Android) |
| `restoreStatusBar` | - | `{ success, restored }` | ✅ | ✅ | 恢复状态栏 |
| `getNavigationBar` | - | `{ success, visible, buttonStyle, backgroundColor }` | ✅ | ❌ | 获取导航栏状态 |
| `setNavigationBar` | `{ visible?, color?, buttonStyle?, behavior? }` | `{ success }` | ✅ | ❌ | 设置导航栏 |
| `restoreNavigationBar` | - | `{ success, restored }` | ✅ | ❌ | 恢复导航栏 |

> ✅ 支持 | ⚠️ 部分支持 | ❌ 不支持


---


## 构建

```
Windows：使用 build.bat 进行交互式构建（方便使用）

Mac：尚未验证。
```
