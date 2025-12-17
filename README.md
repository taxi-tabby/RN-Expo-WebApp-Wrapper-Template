# 리엑트네이티브 + EXPO + 웹앱 래퍼 템플릿


## 환경 설정
```
constants\app-config.ts 에서 가능
```

## 테마 설정
```
constants\theme.ts 에서 가능
```

## 스플레시 화면
```
components\custom-splash.tsx 에서 구성됨
(환경설정의 영향받음)
```

## 오프라인 화면
```
components\offline-screen.tsx 에서 구성됨
(환경설정의 영향받음)
```


---


## 브릿지 시스템

```text
웹 → 앱: app://액션명
앱 → 웹: native://액션명
```

### 통신 방향별 함수 관계

| 방향 | 송신 측 | 수신 측 | 설명 |
|------|--------|--------|------|
| **웹 → 앱** | `AppBridge.send()` | `registerHandler()` | 단방향 전송 (응답 없음) |
| **웹 → 앱** | `AppBridge.call()` | `registerHandler()` | 요청 후 응답 대기 (Promise) |
| **앱 → 웹** | `sendToWeb()` | `AppBridge.on()` | 단방향 전송 (응답 없음) |
| **앱 → 웹** | `sendToWeb()` | `AppBridge.once()` | 단방향 전송 (한 번만 수신) |
| **앱 → 웹** | `sendToWeb()` | `AppBridge.waitFor()` | 타임아웃까지 대기 (Promise) |
| **앱 → 웹** | `callWeb()` | `AppBridge.on()` | 요청 후 응답 대기 (Promise) |


---


### 웹 (JavaScript)

#### 사용 예시
```javascript
// 앱 환경 체크
if (window.AppBridge?.isApp()) {
  
  // 1. 단방향 전송 (응답 없음)
  AppBridge.send('showToast', { message: '안녕하세요!' });
  AppBridge.send('vibrate');
  
  // 2. 요청 후 응답 대기
  const appInfo = await AppBridge.call('getAppInfo');
  const deviceInfo = await AppBridge.call('getDeviceInfo');
  
  // 3. 앱에서 오는 메시지 수신
  AppBridge.on('customEvent', (payload) => {
    console.log('앱에서 받은 데이터:', payload);
  });
}
```

#### AppBridge 메서드

| 메서드 | 설명 |
|--------|------|
| `send(action, payload)` | 앱으로 메시지 전송 (응답 없음) |
| `call(action, payload, timeout)` | 앱으로 메시지 전송 후 응답 대기 (Promise 반환) |
| `on(action, callback)` | 앱에서 온 메시지 리스너 등록 (`*`로 모든 메시지 수신 가능) |
| `once(action, callback)` | 한 번만 메시지 수신 후 자동 해제 |
| `waitFor(action, timeout)` | 특정 메시지를 타임아웃까지 대기 (Promise 반환) |
| `off(action, callback)` | 등록된 리스너 해제 |
| `isApp()` | 앱 환경인지 체크 (ReactNativeWebView 존재 여부) |

#### TypeScript 타입 정의

타입스크립트의 경우 타입이 없어 에러가 날 수 있음. 아래와 같이 정의 파일을 만들어 해결.

```typescript
// globals.d.ts

interface AppBridge {
  /** 앱으로 메시지 전송 (응답 없음) */
  send(action: string, payload?: Record<string, unknown>): void;
  
  /** 앱으로 메시지 전송 후 응답 대기 */
  call<T = unknown>(action: string, payload?: Record<string, unknown>, timeout?: number): Promise<T>;
  
  /** 앱에서 온 메시지 리스너 등록 ('*'로 모든 메시지 수신 가능) */
  on(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** 한 번만 메시지 수신 후 자동 해제 */
  once(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** 특정 메시지를 타임아웃까지 대기 (Promise 반환) (once의 promise 버전) */
  waitFor<T = unknown>(action: string, timeout?: number): Promise<{ payload: T; message: unknown }>;
  
  /** 등록된 리스너 해제 */
  off(action: string, callback?: (payload: unknown, message?: unknown) => void): void;
  
  /** 앱 환경인지 체크 */
  isApp(): boolean;
  
  /** 버전 */
  version: string;
}

interface Window {
  AppBridge?: AppBridge;
}
```


---


### React Native (앱)

#### 사용 예시
```javascript
import { registerHandler, sendToWeb } from '@/lib/bridge';

// 웹에서 호출할 핸들러 등록
registerHandler('myCustomAction', (payload, respond) => {
  console.log('받은 데이터:', payload);
  respond({ result: 'success' });
});

// 타임아웃 옵션으로 핸들러 등록 (5초 내 응답 없으면 자동 에러)
registerHandler('heavyTask', async (payload, respond) => {
  const result = await doSomething();
  respond(result);
}, { timeout: 5000 });

// 한 번만 실행되는 핸들러
registerHandler('oneTimeAction', (payload, respond) => {
  respond({ done: true });
}, { once: true });

// 앱에서 웹으로 메시지 전송 (웹에서 on 메서드로 대기)
sendToWeb('notification', { title: '알림', body: '내용' });
```

#### 브릿지 함수

| 함수 | 설명 |
|------|------|
| `setBridgeWebView(webView)` | WebView 인스턴스 설정 (필수, 브릿지 연결용) |
| `registerHandler(action, handler, options?)` | 웹에서 호출할 핸들러 등록. options: `{ timeout?, once? }` |
| `unregisterHandler(action)` | 등록된 핸들러 해제 |
| `clearHandlers()` | 모든 핸들러 해제 |
| `handleBridgeMessage(messageData)` | 웹에서 온 메시지 처리 (WebView onMessage에서 사용) |
| `sendToWeb(action, payload)` | 앱에서 웹으로 메시지 전송 |
| `callWeb(action, payload, timeout)` | 앱에서 웹으로 요청 후 응답 대기 (Promise) |
| `registerBuiltInHandlers()` | 기본 내장 핸들러 일괄 등록 |


---


### 기본 내장 핸들러 (Built-in Handlers)

| 액션명 | 페이로드 | 응답 | 설명 |
|--------|----------|------|------|
| `getDeviceInfo` | - | `{ platform, version, isTV }` | 디바이스 정보 조회 |
| `getAppInfo` | - | `{ name, version, bundleId }` | 앱 정보 조회 |
| `showToast` | `{ message, duration? }` | - | 토스트 메시지 표시 (iOS: Alert) |
| `vibrate` | `{ pattern?: number[] }` | - | 진동 발생 |
| `copyToClipboard` | `{ text }` | `{ success }` | 클립보드에 텍스트 복사 |
| `getClipboard` | - | `{ success, text }` | 클립보드 텍스트 읽기 |
| `openExternalUrl` | `{ url }` | `{ success }` | 외부 URL 열기 |
| `goBack` | - | - | WebView 뒤로가기 |
| `goForward` | - | - | WebView 앞으로가기 |
| `reload` | - | - | WebView 새로고침 |
| `hideSplash` | - | - | 스플래시 화면 숨기기 |


---


## 빌드

```
윈도우는 build.bat 사용하여 대화형으로 빌드함(편의성 때문)

맥은 모르겠다.. 내가 당장은 확인할 수 없네.
```