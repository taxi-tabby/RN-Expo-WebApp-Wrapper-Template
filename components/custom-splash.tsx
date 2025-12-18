/**
 * 커스텀 스플래시 스크린 컴포넌트
 * 앱 설정에서 활성화/비활성화 및 커스터마이징 가능
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';

interface CustomSplashProps {
  visible: boolean;
  onHidden?: () => void;
}

// 고급 미니멀 스피너 - 얇은 아크 회전
function ArcSpinner({ color, size = 36 }: { color: string; size?: number }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1100,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [spinValue]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const borderWidth = Math.max(2, size * 0.06);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: `${color}15`,
          borderTopColor: color,
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

// 펄스 도트 (3개의 점이 순차적으로 펄스)
function PulseDots({ color, size = 8 }: { color: string; size?: number }) {
  const anim1 = useRef(new Animated.Value(0.3)).current;
  const anim2 = useRef(new Animated.Value(0.3)).current;
  const anim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const p1 = createPulse(anim1, 0);
    const p2 = createPulse(anim2, 150);
    const p3 = createPulse(anim3, 300);

    p1.start();
    p2.start();
    p3.start();

    return () => {
      p1.stop();
      p2.stop();
      p3.stop();
    };
  }, [anim1, anim2, anim3]);

  const dotStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    marginHorizontal: size * 0.5,
  };

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[dotStyle, { opacity: anim1, transform: [{ scale: anim1 }] }]} />
      <Animated.View style={[dotStyle, { opacity: anim2, transform: [{ scale: anim2 }] }]} />
      <Animated.View style={[dotStyle, { opacity: anim3, transform: [{ scale: anim3 }] }]} />
    </View>
  );
}

export default function CustomSplash({ visible, onHidden }: CustomSplashProps) {
  const colorScheme = useColorScheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const { splash } = APP_CONFIG;

  const backgroundColor = colorScheme === 'dark'
    ? splash.darkBackgroundColor
    : splash.backgroundColor;

  const textColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)';
  const spinnerColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,122,255,0.9)';

  // 등장 애니메이션
  useEffect(() => {
    if (visible && splash.enabled) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // 로고 미세한 펄스 (있을 경우)
      if (splash.logoImage) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(logoScale, {
              toValue: 1.02,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(logoScale, {
              toValue: 1,
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    }
  }, [visible, splash.enabled, splash.logoImage, fadeAnim, scaleAnim, logoScale]);

  // 퇴장 애니메이션
  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: splash.fadeOutDuration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.02,
          duration: splash.fadeOutDuration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHidden?.();
      });
    }
  }, [visible, fadeAnim, scaleAnim, onHidden, splash.fadeOutDuration]);

  if (!splash.enabled) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.content}>
        {splash.logoImage && (
          <Animated.View style={{ transform: [{ scale: logoScale }] }}>
            <Image
              source={{ uri: splash.logoImage }}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        )}

        {splash.loadingText && (
          <Text style={[styles.loadingText, { color: textColor }]}>
            {splash.loadingText}
          </Text>
        )}

        {splash.showLoadingIndicator && (
          <View style={styles.spinnerWrapper}>
            {/* 심플한 아크 스피너 사용 (또는 PulseDots로 교체 가능) */}
            <ArcSpinner color={spinnerColor} size={32} />
          </View>
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
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  spinnerWrapper: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});