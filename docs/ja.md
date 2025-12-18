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

| アクション | ペイロード | レスポンス | 説明 |
|------------|------------|------------|------|
| `getDeviceInfo` | - | `{ platform, version, isTV }` | デバイス情報を取得 |
| `getAppInfo` | - | `{ name, version, bundleId }` | アプリ情報を取得 |
| `showToast` | `{ message, duration? }` | - | トーストメッセージを表示（iOS: Alert） |
| `vibrate` | `{ pattern?: number[] }` | - | バイブレーションを発生 |
| `copyToClipboard` | `{ text }` | `{ success }` | テキストをクリップボードにコピー |
| `getClipboard` | - | `{ success, text }` | クリップボードからテキストを読み取り |
| `openExternalUrl` | `{ url }` | `{ success }` | 外部 URL を開く |
| `goBack` | - | - | WebView 戻る |
| `goForward` | - | - | WebView 進む |
| `reload` | - | - | WebView 再読み込み |
| `hideSplash` | - | - | スプラッシュ画面を非表示 |
| `getOrientation` | - | `{ success, orientation, lock }` | 画面の向き状態を取得 |
| `setOrientation` | `{ mode }` | `{ success, mode }` | 画面の向きを設定 |
| `unlockOrientation` | - | `{ success }` | 画面の向きロックを解除（自動回転） |


---


## ビルド

```
Windows：build.bat を使用して対話型ビルド（利便性のため）

Mac：まだ確認していません。
```
