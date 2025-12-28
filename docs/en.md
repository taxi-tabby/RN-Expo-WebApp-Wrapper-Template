# React Native + EXPO + WebApp Wrapper Template


## Configuration
```
Available in constants\app-config.ts
```

## Theme Settings
```
Available in constants\theme.ts
```

## Splash Screen
```
Configured in components\custom-splash.tsx
(Affected by configuration)
```

## Offline Screen
```
Configured in components\offline-screen.tsx
(Affected by configuration)
```


---


## URL Filtering

Set allowed URL patterns in `allowedUrlPatterns`. Non-allowed URLs open in external browser.

```typescript
allowedUrlPatterns: [
  'https://example.com',     // Exact domain
  'https://*.example.com',   // Wildcard (subdomains)
],
// Empty array allows all URLs
```


---


## Bridge System

```text
Web → App: app://actionName
App → Web: native://actionName
```


### TypeScript Type Definition (Web Side)

TypeScript may throw errors due to missing types. Choose one of the following methods to resolve.


#### Method A: Install Type Package (Recommended)

```bash
npm install rn-webwrapper-bridge-types --save-dev
```

Add the package name to `compilerOptions.types` in `tsconfig.json`.

```json
{
  "compilerOptions": {
    "types": ["rn-webwrapper-bridge-types"]
  }
}
```


#### Method B: Using import

Import once in your app's entry point file (e.g., `main.ts`, `app.tsx`).

```typescript
import 'rn-webwrapper-bridge-types';
```


#### Method C: Manual Type Declaration

Create a type definition file directly in your project.

```typescript
// globals.d.ts

interface AppBridge {
  /** Send message to app (no response) */
  send(action: string, payload?: Record<string, unknown>): void;
  
  /** Send message to app and wait for response */
  call<T = unknown>(action: string, payload?: Record<string, unknown>, timeout?: number): Promise<T>;
  
  /** Register listener for messages from app ('*' to receive all messages) */
  on(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** Receive message only once, then auto-unregister */
  once(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** Wait for specific message until timeout (Promise version of once) */
  waitFor<T = unknown>(action: string, timeout?: number): Promise<{ payload: T; message: unknown }>;
  
  /** Unregister listener */
  off(action: string, callback?: (payload: unknown, message?: unknown) => void): void;
  
  /** Check if running in app environment */
  isApp(): boolean;
  
  /** Version */
  version: string;
}

interface Window {
  AppBridge?: AppBridge;
}
```


---


### Function Relationships by Communication Direction

| Direction | Sender | Receiver | Description |
|-----------|--------|----------|-------------|
| **Web → App** | `AppBridge.send()` | `registerHandler()` | One-way transmission (no response) |
| **Web → App** | `AppBridge.call()` | `registerHandler()` | Request and wait for response (Promise) |
| **App → Web** | `sendToWeb()` | `AppBridge.on()` | One-way transmission (no response) |
| **App → Web** | `sendToWeb()` | `AppBridge.once()` | One-way transmission (receive only once) |
| **App → Web** | `sendToWeb()` | `AppBridge.waitFor()` | Wait until timeout (Promise) |
| **App → Web** | `callWeb()` | `AppBridge.on()` | Request and wait for response (Promise) |


---


### Web (JavaScript)

#### Usage Example
```javascript
// Check app environment
if (window.AppBridge?.isApp()) {
  
  // 1. One-way transmission (no response)
  AppBridge.send('showToast', { message: 'Hello!' });
  AppBridge.send('vibrate');
  
  // 2. Request and wait for response
  const appInfo = await AppBridge.call('getAppInfo');
  const deviceInfo = await AppBridge.call('getDeviceInfo');
  
  // 3. Receive messages from app
  AppBridge.on('customEvent', (payload) => {
    console.log('Data received from app:', payload);
  });
}
```

#### AppBridge Methods

| Method | Description |
|--------|-------------|
| `send(action, payload)` | Send message to app (no response) |
| `call(action, payload, timeout)` | Send message to app and wait for response (returns Promise) |
| `on(action, callback)` | Register listener for messages from app (`*` to receive all messages) |
| `once(action, callback)` | Receive message only once, then auto-unregister |
| `waitFor(action, timeout)` | Wait for specific message until timeout (returns Promise) |
| `off(action, callback)` | Unregister listener |
| `isApp()` | Check if running in app environment (ReactNativeWebView existence) |


---


### React Native (App)

#### Usage Example
```javascript
import { registerHandler, sendToWeb } from '@/lib/bridge';

// Register handler for web calls
registerHandler('myCustomAction', (payload, respond) => {
  console.log('Received data:', payload);
  respond({ result: 'success' });
});

// Register handler with timeout option (auto error if no response within 5 seconds)
registerHandler('heavyTask', async (payload, respond) => {
  const result = await doSomething();
  respond(result);
}, { timeout: 5000 });

// One-time handler
registerHandler('oneTimeAction', (payload, respond) => {
  respond({ done: true });
}, { once: true });

// Send message from app to web (web listens with on method)
sendToWeb('notification', { title: 'Notification', body: 'Content' });
```

#### Bridge Functions

| Function | Description |
|----------|-------------|
| `setBridgeWebView(webView)` | Set WebView instance (required for bridge connection) |
| `registerHandler(action, handler, options?)` | Register handler for web calls. options: `{ timeout?, once? }` |
| `unregisterHandler(action)` | Unregister handler |
| `clearHandlers()` | Unregister all handlers |
| `handleBridgeMessage(messageData)` | Process messages from web (used in WebView onMessage) |
| `sendToWeb(action, payload)` | Send message from app to web |
| `callWeb(action, payload, timeout)` | Send request from app to web and wait for response (Promise) |
| `registerBuiltInHandlers()` | Register all built-in handlers at once |


---


### Built-in Handlers

| Action | Payload | Response | Android | iOS | Description |
|--------|---------|----------|:-------:|:---:|-------------|
| `getDeviceInfo` | - | `{ platform, version, isTV, brand, modelName, deviceName, osName, osVersion, deviceType, isDevice }` | ✅ | ✅ | Get device information |
| `getAppInfo` | - | `{ name, version, buildVersion, bundleId }` | ✅ | ✅ | Get app information |
| `showToast` | `{ message, duration? }` | - | ✅ | ⚠️ | Toast message (iOS: Alert) |
| `vibrate` | `{ pattern?: number[] }` | - | ✅ | ✅ | Trigger vibration |
| `copyToClipboard` | `{ text }` | `{ success }` | ✅ | ✅ | Copy text to clipboard |
| `getClipboard` | - | `{ success, text }` | ✅ | ✅ | Read text from clipboard |
| `openExternalUrl` | `{ url }` | `{ success }` | ✅ | ✅ | Open external URL |
| `goBack` | - | - | ✅ | ✅ | WebView go back |
| `goForward` | - | - | ✅ | ✅ | WebView go forward |
| `reload` | - | - | ✅ | ✅ | WebView reload |
| `hideSplash` | - | - | ✅ | ✅ | Hide splash screen |
| `getOrientation` | - | `{ success, orientation, lock }` | ✅ | ✅ | Get screen orientation status |
| `setOrientation` | `{ mode }` | `{ success, mode }` | ✅ | ✅ | Set screen orientation |
| `unlockOrientation` | - | `{ success }` | ✅ | ✅ | Unlock orientation |
| `getStatusBar` | - | `{ success, saved }` | ✅ | ✅ | Get status bar state |
| `setStatusBar` | `{ hidden?, style?, color?, animated? }` | `{ success }` | ✅ | ⚠️ | Set status bar (color: Android only) |
| `restoreStatusBar` | - | `{ success, restored }` | ✅ | ✅ | Restore status bar to original |
| `getNavigationBar` | - | `{ success, visible, buttonStyle, backgroundColor }` | ✅ | ❌ | Get navigation bar state |
| `setNavigationBar` | `{ visible?, color?, buttonStyle?, behavior? }` | `{ success }` | ✅ | ❌ | Set navigation bar |
| `restoreNavigationBar` | - | `{ success, restored }` | ✅ | ❌ | Restore navigation bar |
| `getScreenPinning` | - | `{ success, isPinned, lockTaskModeState }` | ✅ | ❌ | Get screen pinning status |
| `startScreenPinning` | - | `{ success }` | ✅ | ❌ | Start screen pinning |
| `stopScreenPinning` | - | `{ success }` | ✅ | ❌ | Stop screen pinning |
| `getKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | Get keep awake status |
| `activateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | Activate keep awake |
| `deactivateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | Deactivate keep awake |
| `checkCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | Check camera permission |
| `requestCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | Request camera permission |
| `takePhoto` | `{ facing? }` | `{ success, base64, width, height, facing }` | ✅ | ✅ | Take photo (1 frame, facing: 'front'\|'back', default: 'back') |
| `startCamera` | `{ facing?, fps?, quality?, maxWidth?, maxHeight? }` | `{ success, isActive, facing, isRecording, isStreaming }` | ✅ | ✅ | Start camera streaming (real-time frame transmission) |
| `stopCamera` | - | `{ success }` | ✅ | ✅ | Stop camera streaming |
| `getCameraStatus` | - | `{ isStreaming, facing, hasCamera }` | ✅ | ✅ | Get camera status |
| `checkMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | Check microphone permission |
| `requestMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | Request microphone permission |
| `startRecording` | `{ sampleRate?, chunkSize? }` | `{ success }` | ✅ | ✅ | Start audio recording (real-time streaming) |
| `stopRecording` | - | `{ success }` | ✅ | ✅ | Stop audio recording |
| `getMicrophoneStatus` | - | `{ success, isStreaming, hasMicrophone }` | ✅ | ✅ | Get microphone status |

**startCamera Parameters:**
- `facing`: Camera direction ('front' | 'back', default: 'back')
- `fps`: Frame rate (1-30, default: 10)
- `quality`: JPEG quality (1-100, default: 30)
- `maxWidth`: Maximum width (px, original if not specified)
- `maxHeight`: Maximum height (px, original if not specified)

**startRecording Parameters:**
- `sampleRate`: Sample rate (8000-48000, default: 44100)
- `chunkSize`: Chunk size (512-8192 bytes, default: 2048, ~23ms latency)

**Camera Events:**
- `onCameraFrame`: Receive camera frames (auto-triggered after startCamera)
  - Payload: `{ type: 'cameraFrame', base64, width, height, frameNumber, timestamp }`
  - Frame rate is set by startCamera fps parameter

**Microphone Events:**
- `onAudioChunk`: Receive audio chunks (auto-triggered after startRecording)
  - Payload: `{ type: 'audioChunk', base64, chunkSize, chunkNumber, timestamp, sampleRate, encoding }`
  - Real-time PCM 16bit audio data (44.1kHz)

> ✅ Supported | ⚠️ Partial | ❌ Not supported


---


## Plugin Module Installation and Configuration

### Overview

This project can be extended with external plugin modules in addition to built-in handlers. Currently available plugins:

- `rnww-plugin-camera`: Camera functionality (photo capture, real-time streaming)
- `rnww-plugin-microphone`: Microphone functionality (audio recording, real-time audio streaming)
- `rnww-plugin-screen-pinning`: Screen pinning functionality (Android only)

> **Note:** This template comes with these 3 plugins pre-installed. If not needed, remove them from `package.json` and delete related handler registration code from `lib/bridges/index.ts`.


### 1. Plugin Package Installation

Included by default in template, but to add to a new project:

```bash
npm install rnww-plugin-camera rnww-plugin-microphone rnww-plugin-screen-pinning
```


### 2. Plugin Setup Script (`scripts/setup-plugins.js`)

Plugin packages require specific files to be copied to the package root for Expo module autolinking. The `scripts/setup-plugins.js` script is already prepared and automatically performs:

- Copy `expo-module.config.json` to package root
- Copy `android/`, `ios/` folders to package root
- Remove invalid module folders (e.g., camera module in microphone plugin's android folder)

**Note:** This script runs automatically after `npm install` (via `postinstall` hook) and before builds in `build.bat`.


### 3. Create Bridge Adapter

To use plugins, create a bridge adapter in the `lib/bridges/` folder.

#### Example: Microphone Plugin (`lib/bridges/microphone/index.ts`)

```typescript
import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';
import { registerMicrophoneHandlers as pluginRegisterMicrophoneHandlers } from 'rnww-plugin-microphone';

/**
 * Microphone handlers
 */
export const registerMicrophoneHandlers = () => {
  pluginRegisterMicrophoneHandlers({
    bridge: { registerHandler, sendToWeb },
    platform: { OS: Platform.OS }
  });
};
```

**Key Points:**

1. **Import plugin function:** Import the register function exported by the plugin
   - Camera: `registerCameraHandlers`
   - Microphone: `registerMicrophoneHandlers`
   - Screen Pinning: `registerScreenPinningHandlers`

2. **Pass bridge object:** Pass your project's `registerHandler` and `sendToWeb` functions as bridge object

3. **Platform object format:** Must pass as `platform: { OS: Platform.OS }`
   - ❌ Wrong: `platform: Platform.OS` or `platform: Platform.OS as any`
   - ✅ Correct: `platform: { OS: Platform.OS }`

4. **Type definition:** Plugins require this interface:
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


### 4. Add to Global Handler Registration

Add new handlers to `lib/bridges/index.ts`:

```typescript
import { registerCameraHandlers } from './camera';
import { registerMicrophoneHandlers } from './microphone';
import { registerScreenPinningHandlers } from './screen-pinning';
// ... other handler imports

export const registerBuiltInHandlers = () => {
  registerCameraHandlers();
  registerMicrophoneHandlers();
  registerScreenPinningHandlers();
  // ... other handler calls
};
```


### 5. Build and Test

1. **Verify plugin setup:**
   ```bash
   node scripts/setup-plugins.js
   ```

2. **Build:**
   ```bash
   # Windows
   build.bat
   
   # Or manually
   npx expo prebuild --clean
   cd android
   .\gradlew assembleRelease
   ```

3. **Verify autolinking:**
   Check build logs for:
   ```
   › Skipped autolinking: expo-modules-core, rnww-plugin-camera, rnww-plugin-microphone, rnww-plugin-screen-pinning
   ```


### 6. Usage in Web

Call plugin-provided handlers from web using `AppBridge`:

```javascript
// Request microphone permission
const result = await AppBridge.call('requestMicrophonePermission');
console.log('Permission status:', result.granted);

// Start recording
await AppBridge.call('startRecording', {
  sampleRate: 44100,
  chunkSize: 2048
});

// Receive audio chunks
AppBridge.on('onAudioChunk', (payload) => {
  console.log('Audio data:', payload.base64);
});

// Stop recording
await AppBridge.call('stopRecording');
```


### Troubleshooting

#### 1. "Unknown action: startRecording" Error

- **Cause:** Handlers not properly registered
- **Solution:**
  1. Check `platform` object format: `{ OS: Platform.OS }`
  2. Verify register function call added to `lib/bridges/index.ts`
  3. Confirm `registerBuiltInHandlers()` called in `components/webview-container.tsx`

#### 2. Build Failure: "Unresolved reference: CameraModule"

- **Cause:** Invalid module files included in plugin package
- **Solution:** Run `scripts/setup-plugins.js` to remove invalid files

#### 3. Autolinking Not Working

- **Cause:** `expo-module.config.json`, `android/`, `ios/` folders not in package root
- **Solution:** Run `scripts/setup-plugins.js` or re-run `npm install`


---


## Build

```
Windows: Use build.bat for interactive build (for convenience)

Mac: Not verified yet.
```
