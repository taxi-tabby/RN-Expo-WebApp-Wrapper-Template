/**
 * WebView 컨테이너 컴포넌트
 * 단일 웹 세션을 유지하며 전역 상태와 연동
 */

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewProgressEvent,
} from 'react-native-webview/lib/WebViewTypes';

import DebugOverlay, { debugLog, DebugOverlayRef } from '@/components/debug-overlay';
import { APP_CONFIG } from '@/constants/app-config';
import {
  handleBridgeMessage,
  setBridgeWebView
} from '@/lib/bridge';
import { getBridgeClientScript } from '@/lib/bridge-client';
import { registerBuiltInHandlers } from '@/lib/bridges';

// 브릿지 스크립트 즉시 생성
const BRIDGE_CLIENT_SCRIPT = getBridgeClientScript();

// WebView 인스턴스를 전역에서 접근 가능하도록 (네비게이션 제어용)
export let webViewRef: React.RefObject<WebView | null>;

// 로딩 타임아웃 (ms)
const LOADING_TIMEOUT = 30000;

interface WebViewError {
  code: number;
  description: string;
  url: string;
}

export default function WebViewContainer() {
  const ref = useRef<WebView>(null);
  const debugOverlayRef = useRef<DebugOverlayRef>(null);
  webViewRef = ref;

  // 초기 로딩 상태만 관리 (SPA 내부 네비게이션에서는 스피너 표시 안 함)
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState<WebViewError | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string>(APP_CONFIG.webview.baseUrl);
  const [webViewKey, setWebViewKey] = useState(1); // WebView 재생성용 키
  const [cacheMode, setCacheMode] = useState(true); // 캐시 사용 여부
  const [showDebugStatus, setShowDebugStatus] = useState(false); // 디버그 상태바 표시
  const hasLoadedOnce = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadStartTime = useRef<number>(0);
  const emptyBodyRetryCount = useRef(0); // 빈 body 재시도 카운터
  const MAX_EMPTY_BODY_RETRIES = 2; // 일반 재시도 횟수

  const { webview, theme, debug } = APP_CONFIG;

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    loadStartTime.current = Date.now();
    debugLog('info', '앱 시작', `URL: ${webview.baseUrl}`);
  }, []);

  /**
   * URL이 허용된 패턴과 일치하는지 확인
   * allowedUrlPatterns에 정의된 패턴과 매칭
   * - 와일드카드(*) 지원: https://*.example.com
   * - 정확한 도메인 매칭: https://example.com
   */
  const isUrlAllowed = useCallback((url: string): boolean => {
    const patterns = webview.allowedUrlPatterns as readonly string[];
    
    // 패턴이 비어있으면 모든 URL 허용
    if (!patterns || patterns.length === 0) {
      return true;
    }

    // 특수 스킴은 항상 허용 (javascript:, about:, data: 등)
    const specialSchemes = ['javascript:', 'about:', 'data:', 'blob:'];
    if (specialSchemes.some(scheme => url.startsWith(scheme))) {
      return true;
    }

    // 브릿지 프로토콜은 항상 허용
    if (url.startsWith('app://')) {
      return true;
    }

    // 각 패턴과 매칭 확인
    return patterns.some(pattern => {
      // 와일드카드 패턴을 정규표현식으로 변환
      // https://*.example.com -> https://[^/]+\.example\.com
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 특수문자 이스케이프
        .replace(/\\\*/g, '[^/]+'); // * -> [^/]+ (슬래시 제외 모든 문자)
      
      const regex = new RegExp(`^${regexPattern}`, 'i');
      return regex.test(url);
    });
  }, [webview.allowedUrlPatterns]);

  /**
   * URL 요청 처리
   * - 허용된 URL: WebView 내에서 로드
   * - 허용되지 않은 URL: 외부 브라우저로 열기
   */
  const handleShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest): boolean => {
    const { url } = request;
    
    // 허용된 URL이면 WebView에서 로드
    if (isUrlAllowed(url)) {
      return true;
    }

    // 허용되지 않은 URL은 외부 브라우저로 열기
    console.log('[WebView] Opening external URL:', url);
    Linking.openURL(url).catch(err => {
      console.error('[WebView] Failed to open URL:', err);
    });
    
    // WebView에서는 로드하지 않음
    return false;
  }, [isUrlAllowed]);

  // 브릿지 초기화 (최초 1회)
  useEffect(() => {
    registerBuiltInHandlers();
  }, []);

  // WebView ref 설정
  useEffect(() => {
    setBridgeWebView(ref.current);
    return () => setBridgeWebView(null);
  }, []);

  // 디버그 상태바 표시 (2초 후 자동 숨김)
  const showDebugStatusBar = useCallback(() => {
    if (!debug.enabled) return;
    
    // 기존 타이머 클리어
    if (debugStatusTimerRef.current) {
      clearTimeout(debugStatusTimerRef.current);
    }
    
    setShowDebugStatus(true);
    debugStatusTimerRef.current = setTimeout(() => {
      setShowDebugStatus(false);
    }, 2000);
  }, [debug.enabled]);

  // 로딩 타임아웃 클리어
  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  // 로딩 타임아웃 설정
  const startLoadingTimeout = useCallback(() => {
    clearLoadingTimeout();
    loadingTimeoutRef.current = setTimeout(() => {
      if (!hasLoadedOnce.current) {
        debugLog('error', '⚠️ 타임아웃!', `${LOADING_TIMEOUT}ms 초과`);
        console.warn('[WebView] Loading timeout');
        setError({
          code: -1,
          description: '페이지 로딩 시간이 초과되었습니다.',
          url: webview.baseUrl,
        });
        setIsInitialLoading(false);
        // 스플래시도 숨김
        import('@/app/_layout').then(({ hideSplashScreen }) => {
          hideSplashScreen();
        });
      }
    }, LOADING_TIMEOUT);
  }, [clearLoadingTimeout, webview.baseUrl]);

  // 컴포넌트 언마운트 시 타임아웃 클리어
  useEffect(() => {
    return () => clearLoadingTimeout();
  }, [clearLoadingTimeout]);

  // Android 하드웨어 뒤로가기 버튼 처리
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && ref.current) {
          ref.current.goBack();
          return true;
        }
        return false;
      });

      return () => backHandler.remove();
    }, [canGoBack])
  );

  // 네비게이션 상태 변경 핸들러
  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (navState.url) {
      setCurrentUrl(navState.url);
      debugLog('nav', '📍 URL 변경', navState.url);
    }
  }, []);

  // 로드 시작 - 초기 로딩 시에만 스피너 표시
  const handleLoadStart = useCallback((syntheticEvent: any) => {
    loadStartTime.current = Date.now();
    const url = syntheticEvent?.nativeEvent?.url || currentUrl;
    debugLog('event', '🚀 로드 시작', url);
    
    if (!hasLoadedOnce.current) {
      setIsInitialLoading(true);
      startLoadingTimeout();
    }
    setError(null);
  }, [startLoadingTimeout]);

  // 로드 진행률 핸들러
  const handleLoadProgress = useCallback((event: WebViewProgressEvent) => {
    const progress = Math.round(event.nativeEvent.progress * 100);
    setLoadProgress(progress);
    showDebugStatusBar();
  }, [showDebugStatusBar]);

  // 스플래시 숨기기 헬퍼
  const doHideSplash = useCallback(() => {
    clearLoadingTimeout(); // 타임아웃 클리어
    const { minDisplayTime } = APP_CONFIG.splash;
    setTimeout(() => {
      import('@/app/_layout').then(({ hideSplashScreen }) => {
        hideSplashScreen();
      });
    }, minDisplayTime);
  }, [clearLoadingTimeout]);

  // 로드 완료
  const handleLoadEnd = useCallback(() => {
    clearLoadingTimeout();
    const loadTime = Date.now() - loadStartTime.current;
    debugLog('success', '✅ 로드 완료', `${loadTime}ms`);
    
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      setIsInitialLoading(false);
      doHideSplash();
    }
    
    showDebugStatusBar();
  }, [doHideSplash, clearLoadingTimeout, showDebugStatusBar]);

  // 웹에서 보내는 메시지 처리
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const messageData = event.nativeEvent.data;

    // 브릿지 메시지 처리 시도
    if (handleBridgeMessage(messageData)) {
      return;
    }

    try {
      const data = JSON.parse(messageData);
      
      // DOM 상태 체크 (빈 화면 자동 복구용)
      if (data.type === 'DEBUG_DOM_STATE') {
        // body가 비어있을 때만 로그 & 재로드
        if (data.bodyLength === 0) {
          emptyBodyRetryCount.current += 1;
          debugLog('warn', `⚠️ 빈 화면! (${emptyBodyRetryCount.current}차)`);
          
          if (emptyBodyRetryCount.current <= MAX_EMPTY_BODY_RETRIES) {
            // 1~2차: 일반 재로드
            setTimeout(() => ref.current?.reload(), 500);
          } else if (emptyBodyRetryCount.current === MAX_EMPTY_BODY_RETRIES + 1) {
            // 3차: 캐시 삭제 후 WebView 재생성
            debugLog('warn', '🗑️ 캐시 삭제 후 재시작...');
            emptyBodyRetryCount.current = 0;
            hasLoadedOnce.current = false;
            setIsInitialLoading(true);
            setCacheMode(false);
            setWebViewKey(prev => prev + 1);
            setTimeout(() => setCacheMode(true), 3000);
          }
        } else if (data.bodyLength > 0) {
          // 정상 로드되면 카운터 리셋
          emptyBodyRetryCount.current = 0;
        }
        return;
      }
      
      // 디버그: JS 에러
      if (data.type === 'JS_ERROR') {
        debugLog('error', '⚠️ JS 에러', `${data.message}`);
        return;
      }
      
      if (data.type === 'HYDRATION_COMPLETE' || data.type === 'PAGE_READY') {
        debugLog('success', `✅ ${data.type}`);
        if (!hasLoadedOnce.current) {
          hasLoadedOnce.current = true;
          setIsInitialLoading(false);
          doHideSplash();
        }
      }
    } catch {
      // JSON이 아닌 메시지는 무시
    }
  }, [doHideSplash]);

  // 에러 처리 - 에러 시에도 스플래시 숨김
  const handleError = useCallback((event: WebViewErrorEvent) => {
    clearLoadingTimeout();
    const { nativeEvent } = event;
    debugLog('error', '❌ WebView 에러', `${nativeEvent.code}: ${nativeEvent.description}`);
    console.error('[WebView] Error:', nativeEvent.code, nativeEvent.description);
    setError({
      code: nativeEvent.code,
      description: nativeEvent.description,
      url: nativeEvent.url,
    });
    setIsInitialLoading(false);
    doHideSplash();
  }, [doHideSplash, clearLoadingTimeout]);

  // HTTP 에러 처리 (404, 500 등)
  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    const { nativeEvent } = event;
    const statusCode = nativeEvent.statusCode;
    debugLog('error', `❌ HTTP ${statusCode}`, nativeEvent.url);
    console.error('[WebView] HTTP Error:', statusCode, nativeEvent.url);
    
    // 4xx, 5xx 에러만 처리
    if (statusCode >= 400) {
      clearLoadingTimeout();
      setError({
        code: statusCode,
        description: `HTTP 오류 ${statusCode}`,
        url: nativeEvent.url,
      });
      setIsInitialLoading(false);
      doHideSplash();
    }
  }, [doHideSplash, clearLoadingTimeout]);

  // 렌더 프로세스 종료 핸들러
  const handleRenderProcessGone = useCallback(() => {
    debugLog('error', '❌ 렌더 프로세스 종료!', '재로드...');
    console.warn('[WebView] Render process gone, reloading...');
    ref.current?.reload();
  }, []);

  // 컨텐츠 프로세스 종료 핸들러 (iOS)
  const handleContentProcessDidTerminate = useCallback(() => {
    debugLog('error', '❌ 컨텐츠 프로세스 종료!', '재로드...');
    console.warn('[WebView] Content process terminated, reloading...');
    ref.current?.reload();
  }, []);

  // 재시도 핸들러
  const handleRetry = useCallback(() => {
    hasLoadedOnce.current = false;
    emptyBodyRetryCount.current = 0;
    setError(null);
    setIsInitialLoading(true);
    ref.current?.reload();
  }, []);

  // 에러 타입에 따른 메시지 생성
  const getErrorInfo = useCallback((err: WebViewError) => {
    const code = err.code;
    const desc = err.description?.toLowerCase() || '';
    
    // DNS 해석 실패
    if (code === -2 || desc.includes('err_name_not_resolved')) {
      return {
        icon: '🌐',
        title: '서버를 찾을 수 없습니다',
        message: '웹사이트 주소가 올바른지 확인해주세요.\n인터넷 연결 상태도 확인해보세요.',
        detail: `URL: ${err.url}`,
      };
    }
    
    // 연결 실패
    if (code === -6 || desc.includes('err_connection_refused')) {
      return {
        icon: '🔌',
        title: '서버에 연결할 수 없습니다',
        message: '서버가 응답하지 않습니다.\n잠시 후 다시 시도해주세요.',
        detail: `URL: ${err.url}`,
      };
    }
    
    // 타임아웃
    if (code === -1 || desc.includes('timeout') || desc.includes('timed out')) {
      return {
        icon: '⏱️',
        title: '연결 시간 초과',
        message: '서버 응답이 너무 느립니다.\n네트워크 상태를 확인해주세요.',
        detail: `URL: ${err.url}`,
      };
    }
    
    // 인터넷 없음
    if (desc.includes('err_internet_disconnected') || desc.includes('no internet')) {
      return {
        icon: '📡',
        title: '인터넷 연결 없음',
        message: 'Wi-Fi 또는 모바일 데이터 연결을\n확인해주세요.',
        detail: '',
      };
    }
    
    // SSL 에러
    if (desc.includes('ssl') || desc.includes('certificate')) {
      return {
        icon: '🔒',
        title: '보안 연결 실패',
        message: '안전한 연결을 설정할 수 없습니다.\n사이트 인증서에 문제가 있을 수 있습니다.',
        detail: `URL: ${err.url}`,
      };
    }
    
    // HTTP 에러
    if (code >= 400 && code < 500) {
      return {
        icon: '🚫',
        title: `페이지를 찾을 수 없습니다 (${code})`,
        message: '요청한 페이지가 존재하지 않거나\n접근 권한이 없습니다.',
        detail: `URL: ${err.url}`,
      };
    }
    
    if (code >= 500) {
      return {
        icon: '⚠️',
        title: `서버 오류 (${code})`,
        message: '서버에 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.',
        detail: `URL: ${err.url}`,
      };
    }
    
    // 기타 에러
    return {
      icon: '❌',
      title: '페이지를 불러올 수 없습니다',
      message: err.description || '알 수 없는 오류가 발생했습니다.',
      detail: `코드: ${code}`,
    };
  }, []);

  // 에러 화면 렌더링
  if (error) {
    const errorInfo = getErrorInfo(error);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>{errorInfo.icon}</Text>
        <Text style={styles.errorTitle}>{errorInfo.title}</Text>
        <Text style={styles.errorMessage}>{errorInfo.message}</Text>
        {debug.enabled && errorInfo.detail && (
          <Text style={styles.errorDetail}>{errorInfo.detail}</Text>
        )}
        <Pressable style={styles.retryButtonContainer} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={webViewKey}
        ref={ref}
        source={{ uri: webview.baseUrl }}
        style={styles.webview}
        // User-Agent
        userAgent={webview.userAgent}
        // 기본 옵션
        javaScriptEnabled={webview.options.javaScriptEnabled}
        domStorageEnabled={webview.options.domStorageEnabled}
        thirdPartyCookiesEnabled={webview.options.thirdPartyCookiesEnabled}
        mediaPlaybackRequiresUserAction={webview.options.mediaPlaybackRequiresUserAction}
        mixedContentMode={webview.options.mixedContentMode}
        cacheEnabled={cacheMode && webview.options.cacheEnabled}
        allowsInlineMediaPlayback={webview.options.allowsInlineMediaPlayback}
        allowsBackForwardNavigationGestures={webview.options.allowsBackForwardNavigationGestures}
        allowFileAccess={webview.options.allowFileAccess}
        // 세션 유지
        sharedCookiesEnabled={true}
        incognito={!cacheMode}
        // 성능 최적화 옵션
        androidLayerType={webview.performance.androidLayerType}
        overScrollMode={webview.performance.overScrollMode}
        textZoom={webview.performance.textZoom}
        nestedScrollEnabled={webview.performance.nestedScrollEnabled}
        showsHorizontalScrollIndicator={!webview.performance.hideScrollIndicators}
        showsVerticalScrollIndicator={!webview.performance.hideScrollIndicators}
        allowsFullscreenVideo={webview.performance.allowsFullscreenVideo}
        startInLoadingState={false}
        originWhitelist={['*']}
        // Android 추가 성능 옵션
        setSupportMultipleWindows={webview.performance.setSupportMultipleWindows}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        // 이벤트 핸들러
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onLoadProgress={handleLoadProgress}
        onError={handleError}
        onHttpError={handleHttpError}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        // 렌더링 프로세스 종료 시 자동 재로드
        onRenderProcessGone={handleRenderProcessGone}
        onContentProcessDidTerminate={handleContentProcessDidTerminate}
        // 브릿지 클라이언트 주입 (페이지 로드 전)
        injectedJavaScriptBeforeContentLoaded={BRIDGE_CLIENT_SCRIPT}
        // 페이지 로드 후 스크립트
        injectedJavaScript={`
          (function() {
            // 중복 실행 방지
            if (window.__pageReadySent) return;
            window.__pageReadySent = true;
            
            // 디버그: DOM 상태 확인
            function checkDOMState() {
              var bodyLen = document.body ? document.body.innerHTML.length : 0;
              var bodyBg = document.body ? window.getComputedStyle(document.body).backgroundColor : 'N/A';
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'DEBUG_DOM_STATE',
                bodyLength: bodyLen,
                bodyBg: bodyBg
              }));
            }
            
            // 페이지 로드 감지 (한 번만)
            function sendPageReady() {
              if (window.__pageReadyEventSent) return;
              window.__pageReadyEventSent = true;
              
              checkDOMState();
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_READY' }));
            }
            
            if (document.readyState === 'complete') {
              sendPageReady();
            } else {
              window.addEventListener('load', sendPageReady, { once: true });
            }
            
            // 에러 감지
            if (!window.__errorHandlerSet) {
              window.__errorHandlerSet = true;
              window.onerror = function(msg, url, line, col, error) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'JS_ERROR',
                  message: msg
                }));
              };
            }
            
            // 빈 화면 감지를 위해 여러 번 체크 (1초, 2초, 5초)
            setTimeout(checkDOMState, 1000);
            setTimeout(checkDOMState, 2000);
            setTimeout(checkDOMState, 5000);
          })();
          true;
        `}
      />
      
      {/* 로딩 인디케이터 - 초기 로딩 시에만 표시 */}
      {isInitialLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator 
            size="large" 
            color={theme.loadingIndicatorColor} 
          />
          {debug.enabled && (
            <View style={styles.loadingDebugInfo}>
              <Text style={styles.loadingProgressText}>
                로딩 중... {loadProgress}%
              </Text>
              <Text style={styles.loadingDebugText}>
                isInitialLoading: true
              </Text>
              <Text style={styles.loadingDebugText}>
                hasLoadedOnce: {hasLoadedOnce.current ? 'true' : 'false'}
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* 디버그: 상태 표시 (2초 후 자동 숨김) */}
      {showDebugStatus && !isInitialLoading && (
        <View style={styles.debugStatusBar} pointerEvents="none">
          <Text style={styles.debugStatusText} numberOfLines={1}>
            ✓ {loadProgress}% | {currentUrl.replace(/^https?:\/\/[^/]+/, '')}
          </Text>
        </View>
      )}
      
      {/* 디버그 오버레이 */}
      {debug.enabled && (
        <DebugOverlay ref={debugOverlayRef} visible={true} />
      )}
    </View>
  );
}

// 외부에서 WebView 제어를 위한 헬퍼 함수들
export const webViewControls = {
  goBack: () => webViewRef?.current?.goBack(),
  goForward: () => webViewRef?.current?.goForward(),
  reload: () => webViewRef?.current?.reload(),
  stopLoading: () => webViewRef?.current?.stopLoading(),
  injectJavaScript: (script: string) => webViewRef?.current?.injectJavaScript(script),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingProgressText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  loadingDebugInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  loadingDebugText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  debugStatusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  debugStatusText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fafafa',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  errorDetail: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  retryButtonContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
