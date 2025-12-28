# React Native + EXPO + WebApp ラッパーテンプレート


## 環境設定
```
constants\app-config.ts で設定可能
```

## テーマ設定
```
constants\theme.ts で設定可能
```

## スプラッシュ画面
```
components\custom-splash.tsx で構成
（環境設定の影響を受ける）
```

## オフライン画面
```
components\offline-screen.tsx で構成
（環境設定の影響を受ける）
```


---


## URLフィルタリング

`allowedUrlPatterns`で許可するURLパターンを設定。許可されていないURLは外部ブラウザで開く。

```typescript
allowedUrlPatterns: [
  'https://example.com',     // 正確なドメイン
  'https://*.example.com',   // ワイルドカード（サブドメイン）
],
// 空の配列は全てのURLを許可
```


---


## ブリッジシステム

```text
Web → App: app://アクション名
App → Web: native://アクション名
```


### TypeScript 型定義（Web 側）

TypeScript では型がないためエラーが発生する可能性があります。以下の方法のいずれかを選択して解決します。


#### 方法 A: 型パッケージのインストール（推奨）

```bash
npm install rn-webwrapper-bridge-types --save-dev
```

`tsconfig.json`の`compilerOptions.types`にパッケージ名を追加します。

```json
{
  "compilerOptions": {
    "types": ["rn-webwrapper-bridge-types"]
  }
}
```


#### 方法 B: import を使用

アプリのエントリーポイントファイル（例: `main.ts`、`app.tsx`）で一度だけインポートします。

```typescript
import 'rn-webwrapper-bridge-types';
```


#### 方法 C: 手動型宣言

プロジェクトに直接型定義ファイルを作成します。

```typescript
// globals.d.ts

interface AppBridge {
  /** アプリにメッセージを送信（レスポンスなし） */
  send(action: string, payload?: Record<string, unknown>): void;
  
  /** アプリにメッセージを送信しレスポンスを待機 */
  call<T = unknown>(action: string, payload?: Record<string, unknown>, timeout?: number): Promise<T>;
  
  /** アプリからのメッセージリスナーを登録（'*' で全メッセージ受信可能） */
  on(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** 一度だけメッセージを受信し自動解除 */
  once(action: string, callback: (payload: unknown, message?: unknown) => void): void;
  
  /** 特定のメッセージをタイムアウトまで待機（once の Promise 版） */
  waitFor<T = unknown>(action: string, timeout?: number): Promise<{ payload: T; message: unknown }>;
  
  /** リスナーを解除 */
  off(action: string, callback?: (payload: unknown, message?: unknown) => void): void;
  
  /** アプリ環境かチェック */
  isApp(): boolean;
  
  /** バージョン */
  version: string;
}

interface Window {
  AppBridge?: AppBridge;
}
```


---


### 通信方向別の関数関係

| 方向 | 送信側 | 受信側 | 説明 |
|------|--------|--------|------|
| **Web → App** | `AppBridge.send()` | `registerHandler()` | 単方向送信（レスポンスなし） |
| **Web → App** | `AppBridge.call()` | `registerHandler()` | リクエスト後レスポンス待機（Promise） |
| **App → Web** | `sendToWeb()` | `AppBridge.on()` | 単方向送信（レスポンスなし） |
| **App → Web** | `sendToWeb()` | `AppBridge.once()` | 単方向送信（一度だけ受信） |
| **App → Web** | `sendToWeb()` | `AppBridge.waitFor()` | タイムアウトまで待機（Promise） |
| **App → Web** | `callWeb()` | `AppBridge.on()` | リクエスト後レスポンス待機（Promise） |


---


### Web (JavaScript)

#### 使用例
```javascript
// アプリ環境チェック
if (window.AppBridge?.isApp()) {
  
  // 1. 単方向送信（レスポンスなし）
  AppBridge.send('showToast', { message: 'こんにちは！' });
  AppBridge.send('vibrate');
  
  // 2. リクエスト後レスポンス待機
  const appInfo = await AppBridge.call('getAppInfo');
  const deviceInfo = await AppBridge.call('getDeviceInfo');
  
  // 3. アプリからのメッセージ受信
  AppBridge.on('customEvent', (payload) => {
    console.log('アプリから受信したデータ:', payload);
  });
}
```

#### AppBridge メソッド

| メソッド | 説明 |
|----------|------|
| `send(action, payload)` | アプリにメッセージを送信（レスポンスなし） |
| `call(action, payload, timeout)` | アプリにメッセージを送信しレスポンスを待機（Promise を返す） |
| `on(action, callback)` | アプリからのメッセージリスナーを登録（`*` で全メッセージ受信可能） |
| `once(action, callback)` | 一度だけメッセージを受信し自動解除 |
| `waitFor(action, timeout)` | 特定のメッセージをタイムアウトまで待機（Promise を返す） |
| `off(action, callback)` | リスナーを解除 |
| `isApp()` | アプリ環境かチェック（ReactNativeWebView の存在確認） |


---


### React Native (アプリ)

#### 使用例
```javascript
import { registerHandler, sendToWeb } from '@/lib/bridge';

// Web から呼び出すハンドラーを登録
registerHandler('myCustomAction', (payload, respond) => {
  console.log('受信したデータ:', payload);
  respond({ result: 'success' });
});

// タイムアウトオプション付きでハンドラーを登録（5秒以内にレスポンスがなければ自動エラー）
registerHandler('heavyTask', async (payload, respond) => {
  const result = await doSomething();
  respond(result);
}, { timeout: 5000 });

// 一度だけ実行されるハンドラー
registerHandler('oneTimeAction', (payload, respond) => {
  respond({ done: true });
}, { once: true });

// アプリから Web にメッセージを送信（Web は on メソッドで待機）
sendToWeb('notification', { title: '通知', body: '内容' });
```

#### ブリッジ関数

| 関数 | 説明 |
|------|------|
| `setBridgeWebView(webView)` | WebView インスタンスを設定（ブリッジ接続に必須） |
| `registerHandler(action, handler, options?)` | Web から呼び出すハンドラーを登録。options: `{ timeout?, once? }` |
| `unregisterHandler(action)` | ハンドラーを解除 |
| `clearHandlers()` | 全てのハンドラーを解除 |
| `handleBridgeMessage(messageData)` | Web からのメッセージを処理（WebView の onMessage で使用） |
| `sendToWeb(action, payload)` | アプリから Web にメッセージを送信 |
| `callWeb(action, payload, timeout)` | アプリから Web にリクエストを送信しレスポンスを待機（Promise） |
| `registerBuiltInHandlers()` | 全ての組み込みハンドラーを一括登録 |


---


### 組み込みハンドラー

| アクション | ペイロード | レスポンス | Android | iOS | 説明 |
|------------|------------|------------|:-------:|:---:|------|
| `getDeviceInfo` | - | `{ platform, version, isTV, brand, modelName, deviceName, osName, osVersion, deviceType, isDevice }` | ✅ | ✅ | デバイス情報を取得 |
| `getAppInfo` | - | `{ name, version, buildVersion, bundleId }` | ✅ | ✅ | アプリ情報を取得 |
| `showToast` | `{ message, duration? }` | - | ✅ | ⚠️ | トースト (iOS: Alert) |
| `vibrate` | `{ pattern?: number[] }` | - | ✅ | ✅ | バイブレーションを発生 |
| `copyToClipboard` | `{ text }` | `{ success }` | ✅ | ✅ | クリップボードにコピー |
| `getClipboard` | - | `{ success, text }` | ✅ | ✅ | クリップボードから読み取り |
| `openExternalUrl` | `{ url }` | `{ success }` | ✅ | ✅ | 外部 URL を開く |
| `goBack` | - | - | ✅ | ✅ | WebView 戻る |
| `goForward` | - | - | ✅ | ✅ | WebView 進む |
| `reload` | - | - | ✅ | ✅ | WebView 再読み込み |
| `hideSplash` | - | - | ✅ | ✅ | スプラッシュを非表示 |
| `getOrientation` | - | `{ success, orientation, lock }` | ✅ | ✅ | 画面の向き状態を取得 |
| `setOrientation` | `{ mode }` | `{ success, mode }` | ✅ | ✅ | 画面の向きを設定 |
| `unlockOrientation` | - | `{ success }` | ✅ | ✅ | 向きロックを解除 |
| `getStatusBar` | - | `{ success, saved }` | ✅ | ✅ | ステータスバー状態を取得 |
| `setStatusBar` | `{ hidden?, style?, color?, animated? }` | `{ success }` | ✅ | ⚠️ | ステータスバー設定 (color: Android のみ) |
| `restoreStatusBar` | - | `{ success, restored }` | ✅ | ✅ | ステータスバーを復元 |
| `getNavigationBar` | - | `{ success, visible, buttonStyle, backgroundColor }` | ✅ | ❌ | ナビバー状態を取得 |
| `setNavigationBar` | `{ visible?, color?, buttonStyle?, behavior? }` | `{ success }` | ✅ | ❌ | ナビバーを設定 |
| `restoreNavigationBar` | - | `{ success, restored }` | ✅ | ❌ | ナビバーを復元 |
| `getScreenPinning` | - | `{ success, isPinned, lockTaskModeState }` | ✅ | ❌ | アプリ固定状態を取得 |
| `startScreenPinning` | - | `{ success }` | ✅ | ❌ | アプリ固定を開始 |
| `stopScreenPinning` | - | `{ success }` | ✅ | ❌ | アプリ固定を停止 |
| `getKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | スリープ防止状態を取得 |
| `activateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | スリープ防止を有効化 |
| `deactivateKeepAwake` | - | `{ success, isActive }` | ✅ | ✅ | スリープ防止を無効化 |
| `checkCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | カメラ権限を確認 |
| `requestCameraPermission` | - | `{ success, granted, status }` | ✅ | ✅ | カメラ権限を要求 |
| `takePhoto` | `{ facing? }` | `{ success, base64, width, height, facing }` | ✅ | ✅ | 写真を撮影 (1フレーム, facing: 'front'|'back', デフォルト: 'back') |
| `startCamera` | `{ facing?, fps?, quality?, maxWidth?, maxHeight? }` | `{ success, isActive, facing, isRecording, isStreaming }` | ✅ | ✅ | カメラストリーミングを起動 (リアルタイムフレーム送信) |
| `stopCamera` | - | `{ success }` | ✅ | ✅ | カメラストリーミングを停止 |
| `getCameraStatus` | - | `{ isStreaming, facing, hasCamera }` | ✅ | ✅ | カメラ状態を取得 |
| `checkMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | マイク権限を確認 |
| `requestMicrophonePermission` | - | `{ success, granted, status }` | ✅ | ✅ | マイク権限を要求 |
| `startRecording` | `{ sampleRate?, chunkSize? }` | `{ success }` | ✅ | ✅ | 音声録音を開始 (リアルタイムストリーミング) |
| `stopRecording` | - | `{ success }` | ✅ | ✅ | 音声録音を停止 |
| `getMicrophoneStatus` | - | `{ success, isStreaming, hasMicrophone }` | ✅ | ✅ | マイク状態を取得 |

**startCameraパラメータ:**
- `facing`: カメラ方向 ('front' | 'back', デフォルト: 'back')
- `fps`: フレームレート (1-30, デフォルト: 10)
- `quality`: JPEG品質 (1-100, デフォルト: 30)
- `maxWidth`: 最大幅 (px, 未指定の場合は元のまま)
- `maxHeight`: 最大高さ (px, 未指定の場合は元のまま)

**startRecordingパラメータ:**
- `sampleRate`: サンプルレート (8000-48000, デフォルト: 44100)
- `chunkSize`: チャンクサイズ (512-8192 bytes, デフォルト: 2048, 約23ms遅延)

**カメライベント:**
- `onCameraFrame`: カメラフレームを受信 (startCamera後に自動発生)
  - ペイロード: `{ type: 'cameraFrame', base64, width, height, frameNumber, timestamp }`
  - フレームレートはstartCameraのfpsパラメータで設定

**マイクイベント:**
- `onAudioChunk`: オーディオチャンク受信 (startRecording後に自動発生)
  - ペイロード: `{ type: 'audioChunk', base64, chunkSize, chunkNumber, timestamp, sampleRate, encoding }`
  - リアルタイムPCM 16bitオーディオデータ (44.1kHz)

> ✅ 対応 | ⚠️ 一部対応 | ❌ 非対応


---


## プラグインモジュールのインストールと設定

### 概要

このプロジェクトは、組み込みハンドラに加えて、外部プラグインモジュールで機能を拡張できます。現在利用可能なプラグイン：

- `rnww-plugin-camera`: カメラ機能（写真撮影、リアルタイムストリーミング）
- `rnww-plugin-microphone`: マイク機能（音声録音、リアルタイムオーディオストリーミング）
- `rnww-plugin-screen-pinning`: アプリ固定機能（Android専用）

> **注意:** このテンプレートには上記3つのプラグインがデフォルトでインストールされています。不要な場合は、`package.json`から削除し、`lib/bridges/index.ts`から関連するハンドラ登録コードを削除してください。


### 1. プラグインパッケージのインストール

テンプレートにデフォルトで含まれていますが、新しいプロジェクトに追加する場合：

```bash
npm install rnww-plugin-camera rnww-plugin-microphone rnww-plugin-screen-pinning
```


### 2. プラグイン設定スクリプト (`scripts/setup-plugins.js`)

プラグインパッケージは、Expoモジュールの自動リンクが機能するように、特定のファイルをパッケージルートにコピーする必要があります。`scripts/setup-plugins.js`スクリプトがすでに用意されており、次の作業を自動的に実行します：

- `expo-module.config.json`をパッケージルートにコピー
- `android/`、`ios/`フォルダをパッケージルートにコピー
- 無効なモジュールフォルダを削除（例：マイクプラグインのandroidフォルダ内のカメラモジュール）

**注意:** このスクリプトは`npm install`後に自動的に実行され（`postinstall`フック）、`build.bat`のビルド前にも実行されます。


### 3. Bridgeアダプタの作成

プラグインを使用するには、`lib/bridges/`フォルダにbridgeアダプタを作成する必要があります。

#### 例: マイクプラグイン (`lib/bridges/microphone/index.ts`)

```typescript
import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';
import { registerMicrophoneHandlers as pluginRegisterMicrophoneHandlers } from 'rnww-plugin-microphone';

/**
 * マイク関連ハンドラ
 */
export const registerMicrophoneHandlers = () => {
  pluginRegisterMicrophoneHandlers({
    bridge: { registerHandler, sendToWeb },
    platform: { OS: Platform.OS }
  });
};
```

**重要なポイント:**

1. **プラグイン関数のインポート:** プラグインがエクスポートするregister関数をインポート
   - カメラ: `registerCameraHandlers`
   - マイク: `registerMicrophoneHandlers`
   - スクリーン固定: `registerScreenPinningHandlers`

2. **bridgeオブジェクトの渡し方:** プロジェクトの`registerHandler`と`sendToWeb`関数をbridgeオブジェクトとして渡す

3. **platformオブジェクトの形式:** `platform: { OS: Platform.OS }`の形式で渡す必要があります
   - ❌ 間違い: `platform: Platform.OS` または `platform: Platform.OS as any`
   - ✅ 正しい: `platform: { OS: Platform.OS }`

4. **型定義:** プラグインは次のインターフェースを要求します：
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


### 4. グローバルハンドラ登録に追加

`lib/bridges/index.ts`に新しいハンドラを追加：

```typescript
import { registerCameraHandlers } from './camera';
import { registerMicrophoneHandlers } from './microphone';
import { registerScreenPinningHandlers } from './screen-pinning';
// ... その他のハンドラのインポート

export const registerBuiltInHandlers = () => {
  registerCameraHandlers();
  registerMicrophoneHandlers();
  registerScreenPinningHandlers();
  // ... その他のハンドラ呼び出し
};
```


### 5. ビルドとテスト

1. **プラグイン設定の確認:**
   ```bash
   node scripts/setup-plugins.js
   ```

2. **ビルド:**
   ```bash
   # Windows
   build.bat
   
   # または手動で
   npx expo prebuild --clean
   cd android
   .\gradlew assembleRelease
   ```

3. **自動リンクの確認:**
   ビルドログで次のメッセージを確認：
   ```
   › Skipped autolinking: expo-modules-core, rnww-plugin-camera, rnww-plugin-microphone, rnww-plugin-screen-pinning
   ```


### 6. Webでの使用

プラグインが提供するハンドラを`AppBridge`を使用してWebから呼び出します：

```javascript
// マイク権限のリクエスト
const result = await AppBridge.call('requestMicrophonePermission');
console.log('権限ステータス:', result.granted);

// 録音開始
await AppBridge.call('startRecording', {
  sampleRate: 44100,
  chunkSize: 2048
});

// オーディオチャンクの受信
AppBridge.on('onAudioChunk', (payload) => {
  console.log('オーディオデータ:', payload.base64);
});

// 録音停止
await AppBridge.call('stopRecording');
```


### トラブルシューティング

#### 1. "Unknown action: startRecording" エラー

- **原因:** ハンドラが正しく登録されていない
- **解決方法:**
  1. `platform`オブジェクトの形式を確認: `{ OS: Platform.OS }`
  2. `lib/bridges/index.ts`にregister関数の呼び出しが追加されているか確認
  3. `components/webview-container.tsx`で`registerBuiltInHandlers()`が呼び出されているか確認

#### 2. ビルド失敗: "Unresolved reference: CameraModule"

- **原因:** プラグインパッケージに無効なモジュールファイルが含まれている
- **解決方法:** `scripts/setup-plugins.js`を実行して無効なファイルを削除

#### 3. 自動リンクが機能しない

- **原因:** `expo-module.config.json`、`android/`、`ios/`フォルダがパッケージルートにない
- **解決方法:** `scripts/setup-plugins.js`を実行するか、`npm install`を再実行


---


## ビルド

```
Windows：build.bat を使用して対話型ビルド（利便性のため）

Mac：まだ確認していません。
```
