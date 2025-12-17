/**
 * 커스텀 스플래시 스크린 컴포넌트
 * 앱 설정에서 활성화/비활성화 및 커스터마이징 가능
 */

import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    StyleSheet,
    Text,
    useColorScheme
} from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';

interface CustomSplashProps {
  visible: boolean;
  onHidden?: () => void;
}

export default function CustomSplash({ visible, onHidden }: CustomSplashProps) {
  const colorScheme = useColorScheme();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { splash } = APP_CONFIG;

  const backgroundColor = colorScheme === 'dark' 
    ? splash.darkBackgroundColor 
    : splash.backgroundColor;

  const textColor = colorScheme === 'dark' ? '#ffffff' : '#000000';

  useEffect(() => {
    if (!visible) {
      // 페이드 아웃 애니메이션
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: splash.fadeOutDuration,
        useNativeDriver: true,
      }).start(() => {
        onHidden?.();
      });
    }
  }, [visible, fadeAnim, onHidden, splash.fadeOutDuration]);

  if (!splash.enabled) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, opacity: fadeAnim },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {splash.logoImage && (
        <Image
          source={{ uri: splash.logoImage }}
          style={styles.logo}
          resizeMode="contain"
        />
      )}
      
      {splash.loadingText && (
        <Text style={[styles.loadingText, { color: textColor }]}>
          {splash.loadingText}
        </Text>
      )}
      
      {splash.showLoadingIndicator && (
        <ActivityIndicator
          size="large"
          color={colorScheme === 'dark' ? '#ffffff' : '#007AFF'}
          style={styles.indicator}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    marginBottom: 20,
  },
  indicator: {
    marginTop: 10,
  },
});
