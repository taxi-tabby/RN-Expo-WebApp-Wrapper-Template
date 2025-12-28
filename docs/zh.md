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
| `getScreenPinning` | - | `{ success, isPinned, lockTaskModeState }` | ✅ | ❌ | 获取应用固定状态 |
| `startScreenPinning` | - | `{ success }` | ✅ | ❌ | 开始应用固定 |
| `stopScreenPinning` | - | `{ success }` | ✅ | ❌ | 停止应用固定 |
| `getKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | 获取屏幕常亮状态 |
| `activateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | 激活屏幕常亮 |
| `deactivateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | 停用屏幕常亮 |
| `checkCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | 检查相机权限 |
| `requestCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | 请求相机权限 |
| `takePhoto` | `{ facing? }` | `{ success, base64, width, height, facing }` | ✅ | ✅ | 拍照 (1帧, facing: 'front'|'back', 默认值: 'back') |
| `startCamera` | `{ facing?, fps?, quality?, maxWidth?, maxHeight? }` | `{ success, isActive, facing, isRecording, isStreaming }` | ✅ | ✅ | 启动相机流 (实时帧传输) |
| `stopCamera` | - | `{ success }` | ✅ | ✅ | 停止相机流 |
| `getCameraStatus` | - | `{ isStreaming, facing, hasCamera }` | ✅ | ✅ | 获取相机状态 |
| `checkMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | 检查麦克风权限 |
| `requestMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | 请求麦克风权限 |
| `startRecording` | `{ sampleRate?, chunkSize? }` | `{ success }` | ✅ | ✅ | 开始录音 (实时流) |
| `stopRecording` | - | `{ success }` | ✅ | ✅ | 停止录音 |
| `getMicrophoneStatus` | - | `{ success, isStreaming, hasMicrophone }` | ✅ | ✅ | 获取麦克风状态 |

**startCamera参数：**
- `facing`: 相机方向 ('front' | 'back', 默认值: 'back')
- `fps`: 帧率 (1-30, 默认值: 10)
- `quality`: JPEG质量 (1-100, 默认值: 30)
- `maxWidth`: 最大宽度 (px, 未指定时保持原始)
- `maxHeight`: 最大高度 (px, 未指定时保持原始)

**startRecording参数：**
- `sampleRate`: 采样率 (8000-48000, 默认值: 44100)
- `chunkSize`: 块大小 (512-8192 bytes, 默认值: 2048, 约23ms延迟)

**相机事件：**
- `onCameraFrame`: 接收相机帧 (startCamera后自动触发)
  - 负载: `{ type: 'cameraFrame', base64, width, height, frameNumber, timestamp }`
  - 帧率由startCamera的fps参数设置

**麦克风事件：**
- `onAudioChunk`: 接收音频块 (startRecording后自动触发)
  - 负载: `{ type: 'audioChunk', base64, chunkSize, chunkNumber, timestamp, sampleRate, encoding }`
  - 实时PCM 16bit音频数据 (44.1kHz)

> ✅ 支持 | ⚠️ 部分支持 | ❌ 不支持


---


## 插件模块安装和配置

### 概述

除了内置处理程序外，该项目还可以通过外部插件模块扩展功能。当前可用的插件：

- `rnww-plugin-camera`: 相机功能（拍照、实时流）
- `rnww-plugin-microphone`: 麦克风功能（录音、实时音频流）
- `rnww-plugin-screen-pinning`: 应用固定功能（仅限Android）

> **注意:** 此模板默认安装了上述3个插件。如果不需要，可以从`package.json`中删除它们，并从`lib/bridges/index.ts`中删除相关的处理程序注册代码。


### 1. 插件包安装

模板中默认包含，但要添加到新项目：

```bash
npm install rnww-plugin-camera rnww-plugin-microphone rnww-plugin-screen-pinning
```


### 2. 插件设置脚本 (`scripts/setup-plugins.js`)

插件包需要将特定文件复制到包根目录才能使Expo模块自动链接工作。`scripts/setup-plugins.js`脚本已准备好，自动执行以下操作：

- 将`expo-module.config.json`复制到包根目录
- 将`android/`、`ios/`文件夹复制到包根目录
- 删除无效的模块文件夹（例如：麦克风插件的android文件夹中的相机模块）

**注意:** 此脚本在`npm install`后自动运行（通过`postinstall`钩子），并且在`build.bat`中的构建之前也会运行。


### 3. 创建Bridge适配器

要使用插件，需要在`lib/bridges/`文件夹中创建bridge适配器。

#### 示例: 麦克风插件 (`lib/bridges/microphone/index.ts`)

```typescript
import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';
import { registerMicrophoneHandlers as pluginRegisterMicrophoneHandlers } from 'rnww-plugin-microphone';

/**
 * 麦克风相关处理程序
 */
export const registerMicrophoneHandlers = () => {
  pluginRegisterMicrophoneHandlers({
    bridge: { registerHandler, sendToWeb },
    platform: { OS: Platform.OS }
  });
};
```

**关键要点:**

1. **导入插件函数:** 导入插件导出的register函数
   - 相机: `registerCameraHandlers`
   - 麦克风: `registerMicrophoneHandlers`
   - 屏幕固定: `registerScreenPinningHandlers`

2. **传递bridge对象:** 将项目的`registerHandler`和`sendToWeb`函数作为bridge对象传递

3. **platform对象格式:** 必须以`platform: { OS: Platform.OS }`格式传递
   - ❌ 错误: `platform: Platform.OS` 或 `platform: Platform.OS as any`
   - ✅ 正确: `platform: { OS: Platform.OS }`

4. **类型定义:** 插件需要此接口：
   ```typescript
   interface Config {
     bridge: {
       registerHandler: (action: string, handler: Function) => void;
       sendToWeb: (action: string, payload?: any) => void;
     };
     platform: {
       OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
     };
     logger?: {
       log: (...args: any[]) => void;
       warn: (...args: any[]) => void;
       error: (...args: any[]) => void;
     };
   }
   ```


### 4. 添加到全局处理程序注册

在`lib/bridges/index.ts`中添加新处理程序：

```typescript
import { registerCameraHandlers } from './camera';
import { registerMicrophoneHandlers } from './microphone';
import { registerScreenPinningHandlers } from './screen-pinning';
// ... 其他处理程序导入

export const registerBuiltInHandlers = () => {
  registerCameraHandlers();
  registerMicrophoneHandlers();
  registerScreenPinningHandlers();
  // ... 其他处理程序调用
};
```


### 5. 构建和测试

1. **验证插件设置:**
   ```bash
   node scripts/setup-plugins.js
   ```

2. **构建:**
   ```bash
   # Windows
   build.bat
   
   # 或手动
   npx expo prebuild --clean
   cd android
   .\gradlew assembleRelease
   ```

3. **验证自动链接:**
   检查构建日志中的消息：
   ```
   › Skipped autolinking: expo-modules-core, rnww-plugin-camera, rnww-plugin-microphone, rnww-plugin-screen-pinning
   ```


### 6. Web中的使用

使用`AppBridge`从Web调用插件提供的处理程序：

```javascript
// 请求麦克风权限
const result = await AppBridge.call('requestMicrophonePermission');
console.log('权限状态:', result.granted);

// 开始录音
await AppBridge.call('startRecording', {
  sampleRate: 44100,
  chunkSize: 2048
});

// 接收音频块
AppBridge.on('onAudioChunk', (payload) => {
  console.log('音频数据:', payload.base64);
});

// 停止录音
await AppBridge.call('stopRecording');
```


### 故障排除

#### 1. "Unknown action: startRecording" 错误

- **原因:** 处理程序未正确注册
- **解决方案:**
  1. 检查`platform`对象格式: `{ OS: Platform.OS }`
  2. 验证register函数调用已添加到`lib/bridges/index.ts`
  3. 确认`components/webview-container.tsx`中调用了`registerBuiltInHandlers()`

#### 2. 构建失败: "Unresolved reference: CameraModule"

- **原因:** 插件包中包含无效的模块文件
- **解决方案:** 运行`scripts/setup-plugins.js`删除无效文件

#### 3. 自动链接不工作

- **原因:** `expo-module.config.json`、`android/`、`ios/`文件夹不在包根目录中
- **解决方案:** 运行`scripts/setup-plugins.js`或重新运行`npm install`


---


## 构建

```
Windows：使用 build.bat 进行交互式构建（方便使用）

Mac：尚未验证。
```
