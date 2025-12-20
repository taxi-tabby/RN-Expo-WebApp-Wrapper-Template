/**
 * 메인 홈 스크린 - WebView 컨테이너
 * 단일 웹 세션으로 https://gdjs.link/ 표시
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// import { AppCameraView } from '@/components/camera-view';
import OfflineScreen from '@/components/offline-screen';
import WebViewContainer, { webViewControls } from '@/components/webview-container';
import { APP_CONFIG } from '@/constants/app-config';
import { useIsOnline } from '@/hooks/use-network-status';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { safeArea, statusBar, navigationBar, offline } = APP_CONFIG;

  // 네트워크 상태
  const isOnline = useIsOnline();
  const [showOffline, setShowOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wasOffline = useRef(false);
  const hasReloaded = useRef(false);

  // 카메라 상태
  // const [cameraVisible, setCameraVisible] = useState(false);

  // 오프라인 상태 감지
  useEffect(() => {
    if (!offline.enabled) return;

    if (!isOnline) {
      // 오프라인으로 전환
      setShowOffline(true);
      wasOffline.current = true;
      hasReloaded.current = false;
    } else if (wasOffline.current && isOnline && !hasReloaded.current) {
      // 온라인으로 복구됨 (한 번만 실행)
      setIsReconnecting(true);
      hasReloaded.current = true;
      
      if (offline.autoReconnect) {
        // 자동 새로고침
        setTimeout(() => {
          webViewControls.reload();
          setShowOffline(false);
          setIsReconnecting(false);
          wasOffline.current = false;
        }, 500);
      } else {
        setIsReconnecting(false);
        wasOffline.current = false;
      }
    }
  }, [isOnline, offline.enabled, offline.autoReconnect]);

  // 수동 재시도
  const handleRetry = useCallback(() => {
    if (isOnline) {
      webViewControls.reload();
      setShowOffline(false);
      wasOffline.current = false;
      hasReloaded.current = false;
    }
  }, [isOnline]);

  // SafeArea 배경색 (다크모드 지원)
  const safeAreaBgColor = colorScheme === 'dark' 
    ? safeArea.darkBackgroundColor 
    : safeArea.backgroundColor;

  // SafeArea 높이 계산
  const getTopInset = () => {
    // overlapsWebView가 true면 상단 SafeArea 없음 (웹뷰가 상태바까지 확장)
    if (statusBar.overlapsWebView) return 0;
    if (!safeArea.enabled) return insets.top; // 겹치지 않으면 상태바 높이만큼 여백
    if (safeArea.edges === 'none') return 0;
    if (safeArea.edges === 'bottom') return 0;
    return insets.top;
  };

  const getBottomInset = () => {
    // 네비게이션 바가 숨김이면 하단 SafeArea도 없음 (웹뷰가 하단까지 확장)
    if (navigationBar.visibility === 'hidden') return 0;
    if (!safeArea.enabled) return 0;
    if (safeArea.edges === 'none') return 0;
    if (safeArea.edges === 'top') return 0;
    return insets.bottom;
  };

  return (
    <View style={[styles.container, { backgroundColor: safeAreaBgColor }]}>
      {/* 상단 SafeArea */}
      {getTopInset() > 0 && (
        <View style={[styles.safeAreaTop, { height: getTopInset(), backgroundColor: safeAreaBgColor }]} />
      )}
      
      <WebViewContainer />
      
      {/* 하단 SafeArea */}
      {getBottomInset() > 0 && (
        <View style={[styles.safeAreaBottom, { height: getBottomInset(), backgroundColor: safeAreaBgColor }]} />
      )}

      {/* 상태바 반투명 오버레이 (웹뷰가 상태바와 겹칠 때만 표시) */}
      {statusBar.overlapsWebView && statusBar.showOverlay && (
        <View 
          style={[
            styles.statusBarOverlay, 
            { height: insets.top, backgroundColor: statusBar.overlayColor }
          ]} 
          pointerEvents="none"
        />
      )}

      {/* 오프라인 화면 */}
      {showOffline && (
        <OfflineScreen 
          onRetry={handleRetry}
          isReconnecting={isReconnecting}
        />
      )}

      {/* 카메라 뷰 (항상 마운트되어 있어야 함) */}
      {/* <AppCameraView 
        visible={cameraVisible} 
        onClose={() => setCameraVisible(false)} 
      /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeAreaTop: {},
  safeAreaBottom: {},
  statusBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});
