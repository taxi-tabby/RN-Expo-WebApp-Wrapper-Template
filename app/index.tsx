/**
 * 메인 홈 스크린 - WebView 컨테이너
 * 단일 웹 세션으로 https://gdjs.link/ 표시
 */

import { StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WebViewContainer from '@/components/webview-container';
import { APP_CONFIG } from '@/constants/app-config';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { safeArea, statusBar } = APP_CONFIG;

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
