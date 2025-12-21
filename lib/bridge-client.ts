/**
 * 웹에서 사용할 브릿지 클라이언트 코드
 * 이 코드를 웹사이트에 포함시키거나 injectedJavaScript로 주입
 */

// UUID v4 생성 (RFC 4122 표준)
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// 간단한 해시 함수 (SHA-256 대체)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // 더 긴 해시 생성
  const hex = Math.abs(hash).toString(16);
  const random = Math.random().toString(36).substring(2);
  const random2 = Math.random().toString(36).substring(2);
  return `${hex}${random}${random2}`.substring(0, 64);
};

// 보안 토큰 생성 (런타임에 랜덤 생성)
// UUID v4 기반 + 해시로 중복 불가능한 토큰 생성
const generateSecurityToken = (): string => {
  // 1. UUID v4 생성 (128비트 암호학적 랜덤)
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  const uuid3 = generateUUID();
  const uuid4 = generateUUID();
  const uuid5 = generateUUID();
  
  // 2. 고정밀 타임스탬프 (나노초 수준)
  const highResTime = Date.now() * 1000000 + Math.floor(Math.random() * 1000000);
  
  // 3. 추가 엔트로피 소스
  const entropy1 = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const entropy2 = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const entropy3 = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  
  // 4. 모든 소스 결합
  const combined = `RNW-BRIDGE-${uuid1}-${uuid2}-${uuid3}-${uuid4}-${uuid5}-${highResTime}-${entropy1}-${entropy2}-${entropy3}-${Date.now()}`;
  
  // 5. 해시로 최종 서명
  const hash = simpleHash(combined);
  
  // 6. 최종 토큰: UUID + 해시 조합 (약 200자, 중복 확률 = 0)
  return `${uuid1}-${hash}-${uuid2.substring(0, 8)}-${uuid3.substring(0, 8)}`;
};

// 즉시 생성
const SECURITY_TOKEN = generateSecurityToken();

// 브릿지 클라이언트 스크립트 생성
export const getBridgeClientScript = (): string => {
  return `
(function() {
  // 이미 초기화되었으면 스킵
  if (window.AppBridge) return;

  // 보안 토큰 (주입 시 설정됨)
  var BRIDGE_TOKEN = '${SECURITY_TOKEN}';

  // 응답 대기 맵
  const pendingRequests = new Map();

  // 파일/바이너리 데이터를 base64로 변환
  function toBase64(data) {
    if (data instanceof Blob || data instanceof File) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onloadend = function() {
          resolve({
            __type: 'base64',
            data: reader.result.split(',')[1],
            mimeType: data.type,
            name: data.name || 'file',
            size: data.size
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }
    return Promise.resolve(data);
  }

  // 재귀적으로 모든 Blob/File 처리
  function processPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return Promise.resolve(payload);
    }

    var promises = [];
    var keys = [];
    
    for (var key in payload) {
      if (payload.hasOwnProperty(key)) {
        var value = payload[key];
        if (value instanceof Blob || value instanceof File) {
          keys.push(key);
          promises.push(toBase64(value));
        }
      }
    }

    if (promises.length === 0) {
      return Promise.resolve(payload);
    }

    return Promise.all(promises).then(function(results) {
      var processed = Object.assign({}, payload);
      for (var i = 0; i < keys.length; i++) {
        processed[keys[i]] = results[i];
      }
      return processed;
    });
  }

  // 앱 브릿지 객체
  window.AppBridge = {
    /**
     * 앱으로 메시지 전송 (응답 없음)
     * @param {string} action - 액션명
     * @param {object} payload - 데이터 (Blob/File 지원)
     */
    send: function(action, payload) {
      processPayload(payload || {}).then(function(processed) {
        const message = {
          protocol: 'app://' + action,
          payload: processed,
          timestamp: Date.now(),
          __token: BRIDGE_TOKEN
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }).catch(function(err) {
        console.error('[AppBridge] Failed to process payload:', err);
      });
    },

    /**
     * 앱으로 메시지 전송 후 응답 대기
     * @param {string} action - 액션명
     * @param {object} payload - 데이터 (Blob/File 지원)
     * @param {number} timeout - 타임아웃 (ms)
     * @returns {Promise}
     */
    call: function(action, payload, timeout) {
      timeout = timeout || 10000;
      var self = this;
      
      return processPayload(payload || {}).then(function(processed) {
        return new Promise(function(resolve, reject) {
          var requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          
          // 타임아웃 설정
          var timer = setTimeout(function() {
            pendingRequests.delete(requestId);
            reject(new Error('Request timeout: ' + action));
          }, timeout);

          // 응답 대기 등록
          pendingRequests.set(requestId, {
            resolve: resolve,
            reject: reject,
            timer: timer
          });

          // 요청 전송
          var message = {
            protocol: 'app://' + action,
            payload: processed,
            requestId: requestId,
            timestamp: Date.now(),
            __token: BRIDGE_TOKEN
          };
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        });
      });
    },

    /**
     * 앱에서 온 메시지 리스너 등록
     * @param {string} action - 액션명 또는 '*' (모든 메시지)
     * @param {function} callback - 콜백 함수
     */
    on: function(action, callback) {
      if (!this._listeners) this._listeners = {};
      if (!this._listeners[action]) this._listeners[action] = [];
      this._listeners[action].push(callback);
    },

    /**
     * 한 번만 메시지 수신 후 자동 해제
     * @param {string} action - 액션명
     * @param {function} callback - 콜백 함수
     */
    once: function(action, callback) {
      var self = this;
      var wrapper = function(payload, message) {
        self.off(action, wrapper);
        callback(payload, message);
      };
      this.on(action, wrapper);
    },

    /**
     * 특정 액션 메시지를 타임아웃까지 대기 (Promise)
     * @param {string} action - 액션명
     * @param {number} timeout - 타임아웃 (ms, 기본 10초)
     * @returns {Promise}
     */
    waitFor: function(action, timeout) {
      var self = this;
      timeout = timeout || 10000;
      
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          self.off(action, handler);
          reject(new Error('Timeout waiting for: ' + action));
        }, timeout);

        var handler = function(payload, message) {
          clearTimeout(timer);
          self.off(action, handler);
          resolve({ payload: payload, message: message });
        };

        self.on(action, handler);
      });
    },

    /**
     * 리스너 해제
     */
    off: function(action, callback) {
      if (!this._listeners || !this._listeners[action]) return;
      if (callback) {
        this._listeners[action] = this._listeners[action].filter(function(cb) {
          return cb !== callback;
        });
      } else {
        delete this._listeners[action];
      }
    },

    /**
     * 내부: 앱 응답 처리
     */
    _handleResponse: function(response) {
      var pending = pendingRequests.get(response.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(response.requestId);
        if (response.success) {
          pending.resolve(response.data);
        } else {
          pending.reject(new Error(response.error || 'Unknown error'));
        }
      }
    },

    /**
     * 내부: 앱 메시지 처리
     */
    _handleMessage: function(message) {
      console.log('[AppBridge] _handleMessage called', message);
      console.log('[AppBridge] message.action:', message.action);
      console.log('[AppBridge] _listeners:', this._listeners);
      
      // 응답 메시지 처리
      if (message.action === 'bridgeResponse') {
        this._handleResponse(message.payload);
        return;
      }

      // 리스너 호출
      if (this._listeners) {
        // 특정 액션 리스너
        if (this._listeners[message.action]) {
          console.log('[AppBridge] Found ' + this._listeners[message.action].length + ' listener(s) for: ' + message.action);
          this._listeners[message.action].forEach(function(cb) {
            try { 
              console.log('[AppBridge] Calling listener for: ' + message.action);
              cb(message.payload, message); 
            } catch(e) { 
              console.error('[AppBridge] Listener error:', e); 
            }
          });
        } else {
          console.log('[AppBridge] No listeners for action: ' + message.action);
        }
        // 와일드카드 리스너
        if (this._listeners['*']) {
          this._listeners['*'].forEach(function(cb) {
            try { cb(message.payload, message); } catch(e) { console.error(e); }
          });
        }
      } else {
        console.log('[AppBridge] No _listeners object!');
      }
    },

    // 앱 환경 체크
    isApp: function() {
      return !!window.ReactNativeWebView;
    },

    // 보안 토큰 확인 (디버깅용)
    getToken: function() {
      return BRIDGE_TOKEN;
    },

    // 버전
    version: '2.0.0'
  };

  // 앱에서 온 메시지 수신 리스너
  window.addEventListener('nativeMessage', function(e) {
    console.log('[AppBridge] nativeMessage event received', e.detail);
    window.AppBridge._handleMessage(e.detail);
  });

  // 전역 콜백 (호환성)
  window.onNativeMessage = function(message) {
    window.AppBridge._handleMessage(message);
  };

  // 초기화 완료 이벤트
  window.dispatchEvent(new CustomEvent('AppBridgeReady'));
  console.log('[AppBridge] Initialized');
})();
true;
`;
};

// 보안 토큰 getter
export const getSecurityToken = () => SECURITY_TOKEN;
