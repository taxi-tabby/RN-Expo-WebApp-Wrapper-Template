/**
 * WebView 브릿지 시스템
 * 웹 ↔ 앱 양방향 통신을 위한 범용 핸들러
 */

import type { WebView } from 'react-native-webview';
import { getSecurityToken } from './bridge-client';

// base64 디코딩 헬퍼
const decodeBase64Data = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  // base64 인코딩된 데이터 처리
  if (data.__type === 'base64' && data.data) {
    return {
      type: 'base64',
      data: data.data,
      mimeType: data.mimeType,
      name: data.name,
      size: data.size,
      // 필요시 Buffer로 변환 가능
      toBuffer: () => Buffer.from(data.data, 'base64')
    };
  }

  // 재귀적으로 객체 처리
  const processed: any = Array.isArray(data) ? [] : {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      processed[key] = decodeBase64Data(data[key]);
    }
  }
  return processed;
};

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

/**
 * WebView 인스턴스 가져오기
 */
export const getWebViewInstance = () => webViewInstance;

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

    // 보안 토큰 검증 (외부에서 보낸 메시지 차단)
    if (data.__token !== getSecurityToken()) {
      console.warn('[Bridge] Invalid security token. Message rejected.');
      return false;
    }

    const action = data.protocol.replace('app://', '');
    
    // base64 데이터 디코딩
    const decodedPayload = decodeBase64Data(data.payload);
    
    const message: BridgeMessage = {
      ...data,
      action,
      payload: decodedPayload,
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
  console.log(`[Bridge] sendToWeb called - action: ${action}, webView: ${webViewInstance ? 'available' : 'NULL'}`);
  
  if (!webViewInstance) {
    console.error('[Bridge] ⚠️⚠️⚠️ WebView is NULL! Cannot send to web!');
    console.error(`[Bridge] - action: ${action}`);
    console.error(`[Bridge] - payload type: ${typeof payload}`);
    return;
  }

  const message = {
    protocol: `native://${action}`,
    action,
    payload,
    timestamp: Date.now(),
  };

  // JSON.stringify를 한 번만 실행하여 최적화
  const messageJSON = JSON.stringify(message);

  // IIFE로 즉시 실행 후 메모리에서 제거됨
  // 이벤트만 발생시키고 코드는 GC됨
  const script = `(function(){console.log('[Bridge-Inject] Sending message, action: ${action}');var msg=${messageJSON};console.log('[Bridge-Inject] Message object:', msg);var e=new CustomEvent('nativeMessage',{detail:msg});window.dispatchEvent(e);console.log('[Bridge-Inject] Event dispatched');window.onNativeMessage&&window.onNativeMessage(msg)})();true;`;

  webViewInstance.injectJavaScript(script);
  
  // 로그 출력 조건: base64 데이터나 cameraFrame 같은 대용량 데이터는 로그 제외
  const shouldLog = !action.includes('cameraFrame') && 
    !messageJSON.includes('base64');
  
  if (shouldLog) {
    console.log(`[Bridge] ✓ Sent to web: ${action}`, payload);
  } else {
    // cameraFrame도 첫 10개는 로그 출력
    if (action.includes('cameraFrame') || action.includes('cameraStream')) {
      console.log(`[Bridge] ✓ Frame sent to web via action: '${action}' (payload size: ${messageJSON.length} bytes)`);
    }
  }
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
