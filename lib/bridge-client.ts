/**
 * 웹에서 사용할 브릿지 클라이언트 코드
 * 이 코드를 웹사이트에 포함시키거나 injectedJavaScript로 주입
 */

export const BRIDGE_CLIENT_SCRIPT = `
(function() {
  // 이미 초기화되었으면 스킵
  if (window.AppBridge) return;

  // 응답 대기 맵
  const pendingRequests = new Map();

  // 앱 브릿지 객체
  window.AppBridge = {
    /**
     * 앱으로 메시지 전송 (응답 없음)
     * @param {string} action - 액션명
     * @param {object} payload - 데이터
     */
    send: function(action, payload) {
      const message = {
        protocol: 'app://' + action,
        payload: payload || {},
        timestamp: Date.now()
      };
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    },

    /**
     * 앱으로 메시지 전송 후 응답 대기
     * @param {string} action - 액션명
     * @param {object} payload - 데이터
     * @param {number} timeout - 타임아웃 (ms)
     * @returns {Promise}
     */
    call: function(action, payload, timeout) {
      timeout = timeout || 10000;
      
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
          payload: payload || {},
          requestId: requestId,
          timestamp: Date.now()
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
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
      // 응답 메시지 처리
      if (message.action === 'bridgeResponse') {
        this._handleResponse(message.payload);
        return;
      }

      // 리스너 호출
      if (this._listeners) {
        // 특정 액션 리스너
        if (this._listeners[message.action]) {
          this._listeners[message.action].forEach(function(cb) {
            try { cb(message.payload, message); } catch(e) { console.error(e); }
          });
        }
        // 와일드카드 리스너
        if (this._listeners['*']) {
          this._listeners['*'].forEach(function(cb) {
            try { cb(message.payload, message); } catch(e) { console.error(e); }
          });
        }
      }
    },

    // 앱 환경 체크
    isApp: function() {
      return !!window.ReactNativeWebView;
    },

    // 버전
    version: '1.0.0'
  };

  // 앱에서 온 메시지 수신 리스너
  window.addEventListener('nativeMessage', function(e) {
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

/**
 * 사용 예시 (웹에서):
 * 
 * // 앱 환경 체크
 * if (window.AppBridge?.isApp()) {
 *   // 앱 정보 가져오기
 *   const appInfo = await AppBridge.call('getAppInfo');
 *   console.log(appInfo);
 * 
 *   // 토스트 메시지 표시 (응답 필요없음)
 *   AppBridge.send('showToast', { message: '안녕하세요!' });
 * 
 *   // 진동
 *   AppBridge.send('vibrate');
 * 
 *   // 클립보드 복사
 *   await AppBridge.call('copyToClipboard', { text: '복사할 텍스트' });
 * 
 *   // 외부 URL 열기
 *   await AppBridge.call('openExternalUrl', { url: 'https://google.com' });
 * 
 *   // 앱에서 오는 메시지 수신
 *   AppBridge.on('customEvent', (payload) => {
 *     console.log('앱에서 받은 데이터:', payload);
 *   });
 * 
 *   // 모든 메시지 수신
 *   AppBridge.on('*', (payload, message) => {
 *     console.log('Action:', message.action, 'Payload:', payload);
 *   });
 * }
 */
