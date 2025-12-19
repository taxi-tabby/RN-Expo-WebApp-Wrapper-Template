/**
 * WebView 브릿지 시스템
 * 웹 ↔ 앱 양방향 통신을 위한 범용 핸들러
 */

import type { WebView } from 'react-native-webview';

// 메시지 타입 정의
export interface BridgeMessage<T = unknown> {
  // 프로토콜: 'app://액션명' 형태
  protocol: string;
  // 액션명 (protocol에서 파싱)
  action: string;
  // 페이로드 데이터
  payload?: T;
  // 요청 ID (응답 매칭용)
  requestId?: string;
  // 타임스탬프
  timestamp?: number;
}

export interface BridgeResponse<T = unknown> {
  requestId: string;
  success: boolean;
  data?: T;
  error?: string;
}

// 핸들러 타입
export type BridgeHandler<T = unknown, R = unknown> = (
  payload: T,
  respond: (data: R) => void
) => void | Promise<void>;

// 핸들러 레지스트리
const handlers: Map<string, BridgeHandler> = new Map();

// WebView 인스턴스 참조
let webViewInstance: WebView | null = null;

/**
 * WebView 인스턴스 설정
 */
export const setBridgeWebView = (webView: WebView | null) => {
  webViewInstance = webView;
};

// 핸들러 옵션 타입
export interface HandlerOptions {
  /** 응답 타임아웃 (ms). 설정 시 응답이 없으면 자동 에러 응답 */
  timeout?: number;
  /** 한 번만 실행 후 자동 해제 */
  once?: boolean;
}

/**
 * 핸들러 등록
 * @param action 액션명 (예: 'getDeviceInfo', 'showToast')
 * @param handler 핸들러 함수
 * @param options 핸들러 옵션 (timeout, once)
 */
export const registerHandler = <T = unknown, R = unknown>(
  action: string,
  handler: BridgeHandler<T, R>,
  options?: HandlerOptions
) => {
  const wrappedHandler: BridgeHandler = (payload, respond) => {
    let responded = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 타임아웃 설정
    if (options?.timeout) {
      timer = setTimeout(() => {
        if (!responded) {
          responded = true;
          respond({ success: false, error: `Handler timeout: ${action}` });
        }
      }, options.timeout);
    }

    // 응답 함수 래핑
    const wrappedRespond = (data: unknown) => {
      if (responded) return;
      responded = true;
      if (timer) clearTimeout(timer);
      respond(data);
    };

    // once 옵션
    if (options?.once) {
      handlers.delete(action);
    }

    handler(payload as T, wrappedRespond as (data: R) => void);
  };

  handlers.set(action, wrappedHandler);
  console.log(`[Bridge] Handler registered: ${action}`, options || '');
};

/**
 * 핸들러 해제
 */
export const unregisterHandler = (action: string) => {
  handlers.delete(action);
  console.log(`[Bridge] Handler unregistered: ${action}`);
};

/**
 * 모든 핸들러 해제
 */
export const clearHandlers = () => {
  handlers.clear();
};

/**
 * 웹에서 온 메시지 처리
 */
export const handleBridgeMessage = (messageData: string): boolean => {
  try {
    const data = JSON.parse(messageData);
    
    // app:// 프로토콜 체크
    if (!data.protocol || !data.protocol.startsWith('app://')) {
      return false; // 브릿지 메시지가 아님
    }

    const action = data.protocol.replace('app://', '');
    const message: BridgeMessage = {
      ...data,
      action,
      timestamp: data.timestamp || Date.now(),
    };

    console.log(`[Bridge] Received: ${action}`, message.payload);

    const handler = handlers.get(action);
    if (handler) {
      // 응답 함수 생성
      const respond = (responseData: unknown) => {
        if (message.requestId) {
          sendToWeb('bridgeResponse', {
            requestId: message.requestId,
            success: true,
            data: responseData,
          });
        }
      };

      try {
        handler(message.payload, respond);
      } catch (error) {
        console.error(`[Bridge] Handler error: ${action}`, error);
        if (message.requestId) {
          sendToWeb('bridgeResponse', {
            requestId: message.requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } else {
      console.warn(`[Bridge] No handler for action: ${action}`);
      if (message.requestId) {
        sendToWeb('bridgeResponse', {
          requestId: message.requestId,
          success: false,
          error: `Unknown action: ${action}`,
        });
      }
    }

    return true; // 브릿지 메시지 처리됨
  } catch {
    return false; // JSON 파싱 실패 = 브릿지 메시지 아님
  }
};

/**
 * 앱에서 웹으로 메시지 전송
 */
export const sendToWeb = <T = unknown>(action: string, payload?: T) => {
  if (!webViewInstance) {
    console.warn('[Bridge] WebView not available');
    return;
  }

  const message = {
    protocol: `native://${action}`,
    action,
    payload,
    timestamp: Date.now(),
  };

  const script = `
    (function() {
      window.dispatchEvent(new CustomEvent('nativeMessage', { 
        detail: ${JSON.stringify(message)} 
      }));
      if (window.onNativeMessage) {
        window.onNativeMessage(${JSON.stringify(message)});
      }
    })();
    true;
  `;

  webViewInstance.injectJavaScript(script);
  console.log(`[Bridge] Sent to web: ${action}`, payload);
};

/**
 * 웹에서 앱 함수 호출 후 Promise로 응답 대기 (앱에서 웹으로 요청)
 */
export const callWeb = <T = unknown, R = unknown>(
  action: string,
  payload?: T,
  timeout = 10000
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 타임아웃 설정
    const timer = setTimeout(() => {
      reject(new Error(`Request timeout: ${action}`));
    }, timeout);

    // 일회성 응답 핸들러 등록
    const responseHandler = `__response_${requestId}`;
    registerHandler(responseHandler, (response: BridgeResponse<R>) => {
      clearTimeout(timer);
      unregisterHandler(responseHandler);
      if (response.success) {
        resolve(response.data as R);
      } else {
        reject(new Error(response.error || 'Unknown error'));
      }
    });

    // 웹으로 요청 전송
    sendToWeb(action, { ...payload as object, requestId, responseAction: responseHandler });
  });
};

// 기본 내장 핸들러들
export const registerBuiltInHandlers = () => {
  // 디바이스 정보 요청 (expo-device 사용 - 프로덕션 빌드에서도 동작)
  registerHandler('getDeviceInfo', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      const Device = await import('expo-device');
      
      respond({
        platform: Platform.OS,
        version: Platform.Version,
        isTV: Platform.isTV,
        // expo-device 추가 정보
        brand: Device.brand ?? null,
        modelName: Device.modelName ?? null,
        deviceName: Device.deviceName ?? null, // Android 13+에서는 null일 수 있음
        osName: Device.osName ?? null,
        osVersion: Device.osVersion ?? null,
        deviceType: Device.deviceType ?? null,
        isDevice: Device.isDevice ?? null,
      });
    } catch (error) {
      console.error('[Bridge] getDeviceInfo error:', error);
      respond({
        error: 'Failed to get device info',
        platform: null,
        version: null,
      });
    }
  });

  // 앱 정보 요청 (expo-application 사용 - 프로덕션 빌드에서도 동작)
  registerHandler('getAppInfo', async (_payload, respond) => {
    try {
      const Application = await import('expo-application');
      respond({
        name: Application.applicationName ?? null,
        version: Application.nativeApplicationVersion ?? null,
        buildVersion: Application.nativeBuildVersion ?? null,
        bundleId: Application.applicationId ?? null,
      });
    } catch (error) {
      console.error('[Bridge] getAppInfo error:', error);
      respond({
        error: 'Failed to get app info',
        name: null,
        version: null,
      });
    }
  });

  // 토스트 메시지 (Android: Toast, iOS: Alert)
  registerHandler<{ message: string; duration?: 'short' | 'long' }>('showToast', async ({ message, duration = 'short' }) => {
    const { ToastAndroid, Platform, Alert } = await import('react-native');
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, duration === 'long' ? ToastAndroid.LONG : ToastAndroid.SHORT);
    } else {
      // iOS는 Toast가 없으므로 Alert 사용 (자동 닫힘 없음)
      Alert.alert('', message);
    }
  });

  // 진동
  registerHandler<{ pattern?: number[] }>('vibrate', async ({ pattern }) => {
    const { Vibration } = await import('react-native');
    if (pattern) {
      Vibration.vibrate(pattern);
    } else {
      Vibration.vibrate();
    }
  });

  // 클립보드 복사 (expo-clipboard 필요: npx expo install expo-clipboard)
  registerHandler<{ text: string }>('copyToClipboard', async ({ text }, respond) => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      respond({ success: true });
    } catch (error) {
      respond({ success: false, error: 'Clipboard not available' });
    }
  });

  // 클립보드 읽기
  registerHandler('getClipboard', async (_payload, respond) => {
    try {
      const Clipboard = await import('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      respond({ success: true, text });
    } catch (error) {
      respond({ success: false, error: 'Clipboard not available' });
    }
  });

  // 외부 URL 열기
  registerHandler<{ url: string }>('openExternalUrl', async ({ url }, respond) => {
    const { Linking } = await import('react-native');
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      respond({ success: true });
    } else {
      respond({ success: false, error: 'Cannot open URL' });
    }
  });

  // 뒤로가기
  registerHandler('goBack', () => {
    webViewInstance?.goBack();
  });

  // 앞으로가기
  registerHandler('goForward', () => {
    webViewInstance?.goForward();
  });

  // 새로고침
  registerHandler('reload', () => {
    webViewInstance?.reload();
  });

  // 스플래시 숨기기
  registerHandler('hideSplash', async () => {
    const { hideSplashScreen } = await import('@/app/_layout');
    hideSplashScreen();
  });

  // 화면 방향 조회
  registerHandler('getOrientation', async (_payload, respond) => {
    try {
      const ScreenOrientation = await import('expo-screen-orientation');
      const orientation = await ScreenOrientation.getOrientationAsync();
      const lockState = await ScreenOrientation.getOrientationLockAsync();
      
      // orientation 숫자를 문자열로 변환
      const orientationMap: Record<number, string> = {
        [ScreenOrientation.Orientation.UNKNOWN]: 'unknown',
        [ScreenOrientation.Orientation.PORTRAIT_UP]: 'portrait-up',
        [ScreenOrientation.Orientation.PORTRAIT_DOWN]: 'portrait-down',
        [ScreenOrientation.Orientation.LANDSCAPE_LEFT]: 'landscape-left',
        [ScreenOrientation.Orientation.LANDSCAPE_RIGHT]: 'landscape-right',
      };
      
      // lock 상태를 문자열로 변환
      const lockMap: Record<number, string> = {
        [ScreenOrientation.OrientationLock.DEFAULT]: 'default',
        [ScreenOrientation.OrientationLock.ALL]: 'all',
        [ScreenOrientation.OrientationLock.PORTRAIT]: 'portrait',
        [ScreenOrientation.OrientationLock.PORTRAIT_UP]: 'portrait-up',
        [ScreenOrientation.OrientationLock.PORTRAIT_DOWN]: 'portrait-down',
        [ScreenOrientation.OrientationLock.LANDSCAPE]: 'landscape',
        [ScreenOrientation.OrientationLock.LANDSCAPE_LEFT]: 'landscape-left',
        [ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT]: 'landscape-right',
      };

      respond({
        success: true,
        orientation: orientationMap[orientation] || 'unknown',
        lock: lockMap[lockState] || 'unknown',
        raw: { orientation, lockState },
      });
    } catch (error) {
      respond({ success: false, error: 'Screen orientation not available' });
    }
  });

  // 화면 방향 설정
  registerHandler<{ mode: 'portrait' | 'landscape' | 'auto' | 'portrait-up' | 'portrait-down' | 'landscape-left' | 'landscape-right' }>(
    'setOrientation',
    async ({ mode }, respond) => {
      try {
        const ScreenOrientation = await import('expo-screen-orientation');
        
        const lockMap: Record<string, number> = {
          'auto': ScreenOrientation.OrientationLock.DEFAULT,
          'all': ScreenOrientation.OrientationLock.ALL,
          'portrait': ScreenOrientation.OrientationLock.PORTRAIT,
          'portrait-up': ScreenOrientation.OrientationLock.PORTRAIT_UP,
          'portrait-down': ScreenOrientation.OrientationLock.PORTRAIT_DOWN,
          'landscape': ScreenOrientation.OrientationLock.LANDSCAPE,
          'landscape-left': ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
          'landscape-right': ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
        };

        const lockValue = lockMap[mode];
        if (lockValue === undefined) {
          respond({ success: false, error: `Invalid mode: ${mode}. Use: auto, portrait, landscape, portrait-up, portrait-down, landscape-left, landscape-right` });
          return;
        }

        await ScreenOrientation.lockAsync(lockValue);
        respond({ success: true, mode });
      } catch (error) {
        respond({ success: false, error: error instanceof Error ? error.message : 'Failed to set orientation' });
      }
    }
  );

  // 화면 방향 잠금 해제 (자동 회전 활성화)
  registerHandler('unlockOrientation', async (_payload, respond) => {
    try {
      const ScreenOrientation = await import('expo-screen-orientation');
      await ScreenOrientation.unlockAsync();
      respond({ success: true });
    } catch (error) {
      respond({ success: false, error: 'Failed to unlock orientation' });
    }
  });

  // ========== 상태바 (Status Bar) ==========
  // 저장된 상태바 상태
  let savedStatusBarState: { hidden: boolean; style: 'default' | 'light-content' | 'dark-content'; color?: string } | null = null;

  // 상태바 상태 조회
  registerHandler('getStatusBar', async (_payload, respond) => {
    try {
      // React Native StatusBar는 상태 조회 API가 없어서 저장된 값 반환
      respond({
        success: true,
        saved: savedStatusBarState,
        note: 'StatusBar API does not provide current state query. Returns last saved state.',
      });
    } catch (error) {
      respond({ success: false, error: 'Failed to get status bar state' });
    }
  });

  // 상태바 설정
  registerHandler<{ 
    hidden?: boolean; 
    style?: 'default' | 'light-content' | 'dark-content';
    color?: string;
    animated?: boolean;
  }>('setStatusBar', async ({ hidden, style, color, animated = true }, respond) => {
    try {
      const { StatusBar, Platform } = await import('react-native');
      
      // 현재 상태 저장 (첫 호출 시)
      if (!savedStatusBarState) {
        savedStatusBarState = { hidden: false, style: 'default' };
      }
      
      if (hidden !== undefined) {
        StatusBar.setHidden(hidden, animated ? 'fade' : 'none');
        savedStatusBarState.hidden = hidden;
      }
      
      if (style) {
        StatusBar.setBarStyle(style, animated);
        savedStatusBarState.style = style;
      }
      
      if (color && Platform.OS === 'android') {
        StatusBar.setBackgroundColor(color, animated);
        savedStatusBarState.color = color;
      }
      
      respond({ success: true, hidden, style, color });
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to set status bar' });
    }
  });

  // 상태바 원래 상태로 복원
  registerHandler('restoreStatusBar', async (_payload, respond) => {
    try {
      const { StatusBar, Platform } = await import('react-native');
      
      if (savedStatusBarState) {
        StatusBar.setHidden(savedStatusBarState.hidden, 'fade');
        StatusBar.setBarStyle(savedStatusBarState.style, true);
        if (savedStatusBarState.color && Platform.OS === 'android') {
          StatusBar.setBackgroundColor(savedStatusBarState.color, true);
        }
        respond({ success: true, restored: savedStatusBarState });
      } else {
        // 기본값으로 복원
        StatusBar.setHidden(false, 'fade');
        StatusBar.setBarStyle('default', true);
        respond({ success: true, restored: { hidden: false, style: 'default' } });
      }
    } catch (error) {
      respond({ success: false, error: 'Failed to restore status bar' });
    }
  });

  // ========== 네비게이션 바 (Android Navigation Bar) ==========
  // 저장된 네비게이션 바 상태
  let savedNavigationBarState: { visible: boolean; color?: string; buttonStyle?: 'light' | 'dark' } | null = null;

  // 네비게이션 바 상태 조회 (Android 전용)
  registerHandler('getNavigationBar', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const NavigationBar = await import('expo-navigation-bar');
      const visibility = await NavigationBar.getVisibilityAsync();
      const buttonStyle = await NavigationBar.getButtonStyleAsync();
      const backgroundColor = await NavigationBar.getBackgroundColorAsync();
      
      respond({
        success: true,
        visible: visibility === 'visible',
        buttonStyle,
        backgroundColor,
        saved: savedNavigationBarState,
      });
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to get navigation bar state' });
    }
  });

  // 네비게이션 바 설정 (Android 전용) - 통합 설정
  registerHandler<{ 
    visible?: boolean; 
    color?: string; 
    buttonStyle?: 'light' | 'dark';
    behavior?: 'overlay-swipe' | 'inset-swipe' | 'inset-touch';
  }>('setNavigationBar', async ({ visible, color, buttonStyle, behavior = 'overlay-swipe' }, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const NavigationBar = await import('expo-navigation-bar');
      
      // 현재 상태 저장 (첫 호출 시)
      if (!savedNavigationBarState) {
        savedNavigationBarState = {
          visible: (await NavigationBar.getVisibilityAsync()) === 'visible',
          buttonStyle: await NavigationBar.getButtonStyleAsync(),
          color: await NavigationBar.getBackgroundColorAsync(),
        };
      }
      
      if (visible !== undefined) {
        if (!visible) {
          await NavigationBar.setBehaviorAsync(behavior);
        }
        await NavigationBar.setVisibilityAsync(visible ? 'visible' : 'hidden');
      }
      
      if (color) {
        await NavigationBar.setBackgroundColorAsync(color);
      }
      
      if (buttonStyle) {
        await NavigationBar.setButtonStyleAsync(buttonStyle);
      }
      
      respond({ success: true, visible, color, buttonStyle });
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to set navigation bar' });
    }
  });

  // 네비게이션 바 원래 상태로 복원 (Android 전용)
  registerHandler('restoreNavigationBar', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const NavigationBar = await import('expo-navigation-bar');
      
      if (savedNavigationBarState) {
        await NavigationBar.setVisibilityAsync(savedNavigationBarState.visible ? 'visible' : 'hidden');
        if (savedNavigationBarState.color) {
          await NavigationBar.setBackgroundColorAsync(savedNavigationBarState.color);
        }
        if (savedNavigationBarState.buttonStyle) {
          await NavigationBar.setButtonStyleAsync(savedNavigationBarState.buttonStyle);
        }
        respond({ success: true, restored: savedNavigationBarState });
      } else {
        // 기본값으로 복원
        await NavigationBar.setVisibilityAsync('visible');
        respond({ success: true, restored: { visible: true } });
      }
    } catch (error) {
      respond({ success: false, error: 'Failed to restore navigation bar' });
    }
  });

  console.log('[Bridge] Built-in handlers registered');
};
