import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import CustomSplash from '@/components/custom-splash';

// 스플래시 상태를 전역에서 제어하기 위한 콜백
let hideSplashCallback: (() => void) | null = null;

export const hideSplashScreen = () => {
  hideSplashCallback?.();
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);
  const [splashFullyHidden, setSplashFullyHidden] = useState(false);

  // 외부에서 호출 가능한 숨김 함수 등록
  hideSplashCallback = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleSplashHidden = useCallback(() => {
    setSplashFullyHidden(true);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
      
      {/* 커스텀 스플래시 - 페이드아웃 완료 전까지 렌더링 */}
      {!splashFullyHidden && (
        <CustomSplash visible={showSplash} onHidden={handleSplashHidden} />
      )}
    </ThemeProvider>
  );
}