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


## URL 필터링

`allowedUrlPatterns`에 허용할 URL 패턴 설정. 허용되지 않은 URL은 외부 브라우저로 열림.

```typescript
allowedUrlPatterns: [
  'https://example.com',     // 정확한 도메인
  'https://*.example.com',   // 와일드카드 (서브도메인)
],
// 빈 배열이면 모든 URL 허용
```


---


## 브릿지 시스템

```text
웹 → 앱: app://액션명
앱 → 웹: native://액션명
```


### TypeScript 타입 정의 (웹 측)

타입스크립트의 경우 타입이 없어 에러가 날 수 있음. 아래 방법 중 하나를 선택하여 해결.


#### 방법 A: 타입 패키지 설치 (권장)

```bash
npm install rn-webwrapper-bridge-types --save-dev
```

`tsconfig.json`의 `compilerOptions.types`에 패키지명을 추가합니다.

```json
{
  "compilerOptions": {
    "types": ["rn-webwrapper-bridge-types"]
  }
}
```


#### 방법 B: import 사용

앱의 진입점 파일(예: `main.ts`, `app.tsx`)에서 한 번만 import하면 됩니다.

```typescript
import 'rn-webwrapper-bridge-types';
```


#### 방법 C: 수동 타입 선언

프로젝트에 직접 타입 정의 파일을 생성합니다.

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

| 액션명 | 페이로드 | 응답 | Android | iOS | 설명 |
|--------|----------|------|:-------:|:---:|------|
| `getDeviceInfo` | - | `{ platform, version, isTV, brand, modelName, deviceName, osName, osVersion, deviceType, isDevice }` | ✅ | ✅ | 디바이스 정보 조회 |
| `getAppInfo` | - | `{ name, version, buildVersion, bundleId }` | ✅ | ✅ | 앱 정보 조회 |
| `showToast` | `{ message, duration? }` | - | ✅ | ⚠️ | 토스트 메시지 (iOS: Alert) |
| `vibrate` | `{ pattern?: number[] }` | - | ✅ | ✅ | 진동 발생 |
| `copyToClipboard` | `{ text }` | `{ success }` | ✅ | ✅ | 클립보드에 텍스트 복사 |
| `getClipboard` | - | `{ success, text }` | ✅ | ✅ | 클립보드 텍스트 읽기 |
| `openExternalUrl` | `{ url }` | `{ success }` | ✅ | ✅ | 외부 URL 열기 |
| `goBack` | - | - | ✅ | ✅ | WebView 뒤로가기 |
| `goForward` | - | - | ✅ | ✅ | WebView 앞으로가기 |
| `reload` | - | - | ✅ | ✅ | WebView 새로고침 |
| `hideSplash` | - | - | ✅ | ✅ | 스플래시 화면 숨기기 |
| `getOrientation` | - | `{ success, orientation, lock }` | ✅ | ✅ | 화면 방향 상태 조회 |
| `setOrientation` | `{ mode }` | `{ success, mode }` | ✅ | ✅ | 화면 방향 설정 |
| `unlockOrientation` | - | `{ success }` | ✅ | ✅ | 화면 방향 잠금 해제 |
| `getStatusBar` | - | `{ success, saved }` | ✅ | ✅ | 상태바 상태 조회 |
| `setStatusBar` | `{ hidden?, style?, color?, animated? }` | `{ success }` | ✅ | ⚠️ | 상태바 설정 (color: Android만) |
| `restoreStatusBar` | - | `{ success, restored }` | ✅ | ✅ | 상태바 원래 상태로 복원 |
| `getNavigationBar` | - | `{ success, visible, buttonStyle, backgroundColor }` | ✅ | ❌ | 네비바 상태 조회 |
| `setNavigationBar` | `{ visible?, color?, buttonStyle?, behavior? }` | `{ success }` | ✅ | ❌ | 네비바 설정 |
| `restoreNavigationBar` | - | `{ success, restored }` | ✅ | ❌ | 네비바 원래 상태로 복원 |
| `getScreenPinning` | - | `{ success, isPinned, lockTaskModeState }` | ✅ | ❌ | 앱 고정 상태 조회 |
| `startScreenPinning` | - | `{ success }` | ✅ | ❌ | 앱 고정 시작 |
| `stopScreenPinning` | - | `{ success }` | ✅ | ❌ | 앱 고정 해제 |
| `getKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | 화면 절전 방지 상태 조회 |
| `activateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | 화면 절전 방지 활성화 |
| `deactivateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | 화면 절전 방지 비활성화 |
| `checkCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | 카메라 권한 확인 |
| `requestCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | 카메라 권한 요청 |
| `takePhoto` | `{ facing? }` | `{ success, base64, width, height, facing }` | ✅ | ✅ | 사진 촬영 (1프레임, facing: 'front'\|'back', 기본값: 'back') |
| `startCamera` | `{ facing?, fps?, quality?, maxWidth?, maxHeight? }` | `{ success, isActive, facing, isRecording, isStreaming }` | ✅ | ✅ | 카메라 스트리밍 시작 (실시간 프레임 전송) |
| `stopCamera` | - | `{ success }` | ✅ | ✅ | 카메라 스트리밍 종료 |
| `getCameraStatus` | - | `{ isStreaming, facing, hasCamera }` | ✅ | ✅ | 카메라 상태 조회 |
| `checkMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | 마이크 권한 확인 |
| `requestMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | 마이크 권한 요청 |
| `startRecording` | `{ sampleRate?, chunkSize? }` | `{ success }` | ✅ | ✅ | 음성 녹음 시작 (실시간 오디오 스트리밍) |
| `stopRecording` | - | `{ success }` | ✅ | ✅ | 음성 녹음 중지 |
| `getMicrophoneStatus` | - | `{ success, isStreaming, hasMicrophone }` | ✅ | ✅ | 마이크 상태 조회 |

**startCamera 파라미터:**
- `facing`: 카메라 방향 ('front' | 'back', 기본값: 'back')
- `fps`: 프레임레이트 (1-30, 기본값: 10)
- `quality`: JPEG 품질 (1-100, 기본값: 30)
- `maxWidth`: 최대 너비 (px, 미지정시 원본 유지)
- `maxHeight`: 최대 높이 (px, 미지정시 원본 유지)

**startRecording 파라미터:**
- `sampleRate`: 샘플레이트 (8000-48000, 기본값: 44100)
- `chunkSize`: 청크 크기 (512-8192 bytes, 기본값: 2048, 약 23ms 지연)

**카메라 이벤트:**
- `onCameraFrame`: 카메라 프레임 수신 (startCamera 후 자동 발생)
  - 페이로드: `{ type: 'cameraFrame', base64, width, height, frameNumber, timestamp }`
  - 프레임레이트는 startCamera의 fps 파라미터로 설정

**마이크 이벤트:**
- `onAudioChunk`: 오디오 청크 수신 (startRecording 후 자동 발생)
  - 페이로드: `{ type: 'audioChunk', base64, chunkSize, chunkNumber, timestamp, sampleRate, encoding }`
  - 실시간 PCM 16bit 오디오 데이터 전송 (44.1kHz)

> ✅ 지원 | ⚠️ 부분 지원 | ❌ 미지원


---


## 플러그인 모듈 설치 및 적용

### 개요

이 프로젝트는 기본 내장 핸들러 외에도 외부 플러그인 모듈을 통해 기능을 확장할 수 있습니다. 현재 사용 가능한 플러그인:

- `rnww-plugin-camera`: 카메라 기능 (사진 촬영, 실시간 스트리밍)
- `rnww-plugin-microphone`: 마이크 기능 (음성 녹음, 실시간 오디오 스트리밍)
- `rnww-plugin-screen-pinning`: 앱 고정 기능 (Android 전용)

> **참고:** 이 템플릿은 위의 3개 플러그인이 기본으로 설치되어 있습니다. 불필요한 경우 `package.json`에서 해당 플러그인을 제거하고 `lib/bridges/index.ts`에서 관련 핸들러 등록 코드를 삭제하면 됩니다.


### 1. 플러그인 패키지 설치

템플릿에 기본 포함되어 있지만, 새로운 프로젝트에 추가하려면:

```bash
npm install rnww-plugin-camera rnww-plugin-microphone rnww-plugin-screen-pinning
```


### 2. 플러그인 설정 스크립트 (`scripts/setup-plugins.js`)

플러그인 패키지는 Expo 모듈 autolinking이 작동하도록 특정 파일들을 package root로 복사해야 합니다. 이미 `scripts/setup-plugins.js` 스크립트가 준비되어 있으며, 다음 작업을 자동으로 수행합니다:

- `expo-module.config.json` 파일을 package root로 복사
- `android/`, `ios/` 폴더를 package root로 복사

**주의:** 이 스크립트는 `npm install` 후 자동으로 실행되며 (`postinstall` hook), 빌드 전에도 `build.bat`에서 자동으로 실행됩니다.


### 3. Bridge Adapter 생성

플러그인을 사용하려면 `lib/bridges/` 폴더에 bridge adapter를 생성해야 합니다.

#### 예시: 마이크 플러그인 (`lib/bridges/microphone/index.ts`)

```typescript
import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';
import { registerMicrophoneHandlers as pluginRegisterMicrophoneHandlers } from 'rnww-plugin-microphone';

/**
 * 마이크 관련 핸들러
 */
export const registerMicrophoneHandlers = () => {
  pluginRegisterMicrophoneHandlers({
    bridge: { registerHandler, sendToWeb },
    platform: { OS: Platform.OS }
  });
};
```

**중요 포인트:**

1. **플러그인 함수 import:** 플러그인이 export하는 register 함수를 import합니다
   - 카메라: `registerCameraHandlers`
   - 마이크: `registerMicrophoneHandlers`
   - 스크린 피닝: `registerScreenPinningHandlers`

2. **Bridge 객체 전달:** 프로젝트의 `registerHandler`, `sendToWeb` 등 함수를 객체로 전달합니다.


### 4. 전역 핸들러 등록에 추가

`lib/bridges/index.ts`에 새로운 핸들러를 추가합니다:

```typescript
import { registerCameraHandlers } from './camera';
import { registerMicrophoneHandlers } from './microphone';
import { registerScreenPinningHandlers } from './screen-pinning';
// ... 기타 핸들러 imports

export const registerBuiltInHandlers = () => {
  registerCameraHandlers();
  registerMicrophoneHandlers();
  registerScreenPinningHandlers();
  // ... 기타 핸들러 호출
};
```

---


## 빌드

```
윈도우는 build.bat 사용하여 대화형으로 빌드함(편의성 때문)

맥은 모르겠다.. 내가 당장은 확인할 수 없네.
```