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

#### TypeScript Type Definition

TypeScript may throw errors due to missing types. Choose one of the following methods to resolve.


##### Method A: Install Type Package (Recommended)

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


##### Method B: Using import

Import once in your app's entry point file (e.g., `main.ts`, `app.tsx`).

```typescript
import 'rn-webwrapper-bridge-types';
```


##### Method C: Manual Type Declaration

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

| Action | Payload | Response | Description |
|--------|---------|----------|-------------|
| `getDeviceInfo` | - | `{ platform, version, isTV }` | Get device information |
| `getAppInfo` | - | `{ name, version, bundleId }` | Get app information |
| `showToast` | `{ message, duration? }` | - | Show toast message (iOS: Alert) |
| `vibrate` | `{ pattern?: number[] }` | - | Trigger vibration |
| `copyToClipboard` | `{ text }` | `{ success }` | Copy text to clipboard |
| `getClipboard` | - | `{ success, text }` | Read text from clipboard |
| `openExternalUrl` | `{ url }` | `{ success }` | Open external URL |
| `goBack` | - | - | WebView go back |
| `goForward` | - | - | WebView go forward |
| `reload` | - | - | WebView reload |
| `hideSplash` | - | - | Hide splash screen |


---


## Build

```
Windows: Use build.bat for interactive build (for convenience)

Mac: Not verified yet.
```
