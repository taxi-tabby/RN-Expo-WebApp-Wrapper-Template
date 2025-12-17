# 리엑트네이티브 + EXPO + 웹앱 래퍼


## 환경 설정
```
constants\app-config.ts 에서 가능
```

## 테마 설정
```
constants\theme.ts 에서 가능
```

##  브릿지 시스템

```text
웹 → 앱: app://액션명
앱 → 웹: native://액션명
```

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


### 커스텀 핸들러 추가
```javascript
import { registerHandler, sendToWeb } from '@/lib/bridge';

// 핸들러 등록
registerHandler('myCustomAction', (payload, respond) => {
  console.log('받은 데이터:', payload);
  respond({ result: 'success' });
});

// 앱에서 웹으로 메시지 전송
sendToWeb('notification', { title: '알림', body: '내용' });
```