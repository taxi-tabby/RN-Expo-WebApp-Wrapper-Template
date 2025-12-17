/**
 * 오프라인 화면 컴포넌트
 * 네트워크 연결이 끊겼을 때 표시
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Pressable,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';

interface OfflineScreenProps {
  onRetry?: () => void;
  isReconnecting?: boolean;
}

export default function OfflineScreen({ onRetry, isReconnecting = false }: OfflineScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { offline } = APP_CONFIG;

  // 애니메이션
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  const backgroundColor = isDark ? offline.darkBackgroundColor : offline.backgroundColor;
  const textColor = isDark ? '#ffffff' : '#333333';
  const subTextColor = isDark ? '#aaaaaa' : '#666666';

  return (
    <Animated.View 
      style={[
        styles.container, 
        { backgroundColor, opacity: fadeAnim }
      ]}
    >
      <View style={styles.content}>
        {/* 아이콘 */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📡</Text>
        </View>

        {/* 제목 */}
        <Text style={[styles.title, { color: textColor }]}>
          {offline.title}
        </Text>

        {/* 설명 */}
        <Text style={[styles.message, { color: subTextColor }]}>
          {offline.message}
        </Text>

        {/* 재시도 버튼 */}
        {isReconnecting ? (
          <View style={styles.reconnectingContainer}>
            <ActivityIndicator 
              size="small" 
              color={APP_CONFIG.theme.loadingIndicatorColor} 
            />
            <Text style={[styles.reconnectingText, { color: subTextColor }]}>
              연결 확인 중...
            </Text>
          </View>
        ) : (
          <Pressable 
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.retryButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <Text style={styles.retryButtonText}>
              {offline.retryButtonText}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    padding: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  reconnectingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reconnectingText: {
    fontSize: 14,
  },
});
