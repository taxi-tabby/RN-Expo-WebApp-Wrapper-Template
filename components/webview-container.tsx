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
  registerBuiltInHandlers,
  setBridgeWebView
} from '@/lib/bridge';
import { BRIDGE_CLIENT_SCRIPT } from '@/lib/bridge-client';

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
  const [webViewKey, setWebViewKey] = useState(1); // WebView 재생성용 키
  const [cacheMode, setCacheMode] = useState(true); // 캐시 사용 여부
  const hasLoadedOnce = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  }, []);

  // 로드 시작 - 초기 로딩 시에만 스피너 표시
  const handleLoadStart = useCallback(() => {
    loadStartTime.current = Date.now();
    debugLog('event', '🚀 로드 시작', webview.baseUrl);
    
    if (!hasLoadedOnce.current) {
      setIsInitialLoading(true);
      startLoadingTimeout();
    }
    setError(null);
  }, [startLoadingTimeout, webview.baseUrl]);

  // 로드 진행률 핸들러
  const handleLoadProgress = useCallback((event: WebViewProgressEvent) => {
    const progress = Math.round(event.nativeEvent.progress * 100);
    setLoadProgress(progress);
  }, []);

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
  }, [doHideSplash, clearLoadingTimeout]);

  // 웹에서 보내는 메시지 처리
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const messageData = event.nativeEvent.data;

    // 브릿지 메시지 처리 시도
    if (handleBridgeMessage(messageData)) {
      return;
    }

    try {
      const data = JSON.parse(messageData);
      
      // 디버그: DOM 상태 정보 (흰 화면 디버깅용)
      if (data.type === 'DEBUG_DOM_STATE') {
        debugLog('info', '🔍 DOM 상태',
          `body: ${data.bodyLength}글자 | bg: ${data.bodyBg}`
        );
        
        // body가 비어있으면 자동 재로드 시도
        if (data.bodyLength === 0) {
          emptyBodyRetryCount.current += 1;
          
          if (emptyBodyRetryCount.current <= MAX_EMPTY_BODY_RETRIES) {
            // 1~2차: 일반 재로드
            debugLog('warn', `⚠️ 빈 화면! 재로드 ${emptyBodyRetryCount.current}/${MAX_EMPTY_BODY_RETRIES}`);
            setTimeout(() => ref.current?.reload(), 500);
          } else if (emptyBodyRetryCount.current === MAX_EMPTY_BODY_RETRIES + 1) {
            // 3차: 캐시 삭제 후 WebView 재생성
            debugLog('warn', '🗑️ 캐시 삭제 후 재시작...');
            emptyBodyRetryCount.current = 0;
            hasLoadedOnce.current = false;
            setIsInitialLoading(true);
            setCacheMode(false); // 캐시 비활성화
            setWebViewKey(prev => prev + 1); // WebView 완전 재생성
            
            // 다음 로드 후 캐시 다시 활성화
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
    setError(null);
    setIsInitialLoading(true);
    ref.current?.reload();
  }, []);

  // 에러 화면 렌더링
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>페이지를 불러올 수 없습니다</Text>
        <Text style={styles.errorDescription}>{error.description}</Text>
        <Pressable onPress={handleRetry}>
          <Text style={styles.retryButton}>다시 시도</Text>
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
        // 브릿지 클라이언트 + 페이지 로드 스크립트 주입
        injectedJavaScript={`
          ${BRIDGE_CLIENT_SCRIPT}
          (function() {
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
            
            // 페이지 로드 감지
            if (document.readyState === 'complete') {
              checkDOMState();
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_READY' }));
            } else {
              window.addEventListener('load', function() {
                checkDOMState();
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_READY' }));
              });
            }
            
            // 에러 감지
            window.onerror = function(msg, url, line, col, error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'JS_ERROR',
                message: msg
              }));
            };
            
            // 빈 화면 감지를 위해 여러 번 체크 (1초, 2초, 5초)
            setTimeout(checkDOMState, 1000);
            setTimeout(checkDOMState, 2000);
            setTimeout(checkDOMState, 5000);
          })();
          true;
        `}
        // 페이지 이동 시에도 스크립트 재주입
        injectedJavaScriptBeforeContentLoaded={BRIDGE_CLIENT_SCRIPT}
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
      
      {/* 디버그: 상태 표시 (흰 화면 디버깅용) */}
      {debug.enabled && !isInitialLoading && (
        <View style={styles.debugStatusBar} pointerEvents="none">
          <Text style={styles.debugStatusText}>
            ✓ 로딩완료 | Progress: {loadProgress}% | hasLoaded: {hasLoadedOnce.current ? 'Y' : 'N'}
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
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  errorDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
