/**
 * WebView 컨테이너 컴포넌트
 * 단일 웹 세션을 유지하며 전역 상태와 연동
 */

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview/lib/WebViewTypes';

import { APP_CONFIG } from '@/constants/app-config';
import {
  handleBridgeMessage,
  registerBuiltInHandlers,
  setBridgeWebView
} from '@/lib/bridge';
import { BRIDGE_CLIENT_SCRIPT } from '@/lib/bridge-client';

// WebView 인스턴스를 전역에서 접근 가능하도록 (네비게이션 제어용)
export let webViewRef: React.RefObject<WebView | null>;

interface WebViewError {
  code: number;
  description: string;
  url: string;
}

export default function WebViewContainer() {
  const ref = useRef<WebView>(null);
  webViewRef = ref;

  // 초기 로딩 상태만 관리 (SPA 내부 네비게이션에서는 스피너 표시 안 함)
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState<WebViewError | null>(null);
  const hasLoadedOnce = useRef(false);

  const { webview, theme } = APP_CONFIG;

  // 브릿지 초기화
  useEffect(() => {
    registerBuiltInHandlers();
  }, []);

  // WebView ref 변경 시 브릿지에 설정
  useEffect(() => {
    if (ref.current) {
      setBridgeWebView(ref.current);
    }
    return () => setBridgeWebView(null);
  }, [ref.current]);

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
    if (!hasLoadedOnce.current) {
      setIsInitialLoading(true);
    }
    setError(null);
  }, []);

  // 스플래시 숨기기 헬퍼
  const doHideSplash = useCallback(() => {
    const { minDisplayTime } = APP_CONFIG.splash;
    setTimeout(() => {
      import('@/app/_layout').then(({ hideSplashScreen }) => {
        hideSplashScreen();
      });
    }, minDisplayTime);
  }, []);

  // 로드 완료
  const handleLoadEnd = useCallback(() => {
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      setIsInitialLoading(false);
      doHideSplash();
    }
  }, [doHideSplash]);

  // 웹에서 보내는 메시지 처리
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const messageData = event.nativeEvent.data;

    // 브릿지 메시지 처리 시도
    if (handleBridgeMessage(messageData)) {
      return; // 브릿지에서 처리됨
    }

    // 기존 로직 (hydration 감지)
    try {
      const data = JSON.parse(messageData);
      
      if (data.type === 'HYDRATION_COMPLETE' || data.type === 'PAGE_READY') {
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
    const { nativeEvent } = event;
    setError({
      code: nativeEvent.code,
      description: nativeEvent.description,
      url: nativeEvent.url,
    });
    setIsInitialLoading(false);
    doHideSplash();
  }, [doHideSplash]);

  // 재시도 핸들러
  const handleRetry = useCallback(() => {
    setError(null);
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
        cacheEnabled={webview.options.cacheEnabled}
        allowsInlineMediaPlayback={webview.options.allowsInlineMediaPlayback}
        allowsBackForwardNavigationGestures={webview.options.allowsBackForwardNavigationGestures}
        allowFileAccess={webview.options.allowFileAccess}
        // 세션 유지
        sharedCookiesEnabled={true}
        incognito={false}
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
        onError={handleError}
        onMessage={handleMessage}
        // 브릿지 클라이언트 + 페이지 로드 스크립트 주입
        injectedJavaScript={`
          ${BRIDGE_CLIENT_SCRIPT}
          (function() {
            // 페이지 로드 감지
            if (document.readyState === 'complete') {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_READY' }));
            } else {
              window.addEventListener('load', function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_READY' }));
              });
            }
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
        </View>
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
