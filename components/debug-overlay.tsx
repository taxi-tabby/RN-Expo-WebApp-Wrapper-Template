/**
 * 디버그 오버레이 컴포넌트
 * 웹뷰 위에 오버레이로 로그를 표시
 */

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'event';

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: string;
}

export interface DebugOverlayRef {
  log: (level: LogLevel, message: string, details?: string) => void;
  clear: () => void;
}

interface DebugOverlayProps {
  visible?: boolean;
}

let logIdCounter = 0;

// 전역 로그 함수를 위한 ref
let globalDebugRef: DebugOverlayRef | null = null;

// 전역 디버그 로그 함수
export const debugLog = (level: LogLevel, message: string, details?: string) => {
  if (!APP_CONFIG.debug.enabled) return;
  
  // 콘솔에도 출력
  const prefix = `[DEBUG ${level.toUpperCase()}]`;
  const fullMessage = details ? `${message}\n${details}` : message;
  
  switch (level) {
    case 'error':
      console.error(prefix, fullMessage);
      break;
    case 'warn':
      console.warn(prefix, fullMessage);
      break;
    default:
      console.log(prefix, fullMessage);
  }
  
  // 오버레이에 추가
  globalDebugRef?.log(level, message, details);
};

export const DebugOverlay = React.forwardRef<DebugOverlayRef, DebugOverlayProps>(
  ({ visible = true }, ref) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    
    const { debug } = APP_CONFIG;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    // 드래그 관련
    const pan = useRef(new Animated.ValueXY({ x: 10, y: 60 })).current;
    
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pan.setOffset({
            x: (pan.x as any)._value,
            y: (pan.y as any)._value,
          });
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: () => {
          pan.flattenOffset();
        },
      })
    ).current;

    // 로그 추가
    const addLog = useCallback((level: LogLevel, message: string, details?: string) => {
      const newLog: LogEntry = {
        id: ++logIdCounter,
        timestamp: new Date(),
        level,
        message,
        details,
      };

      setLogs(prevLogs => {
        const newLogs = [...prevLogs, newLog];
        // 최대 라인 수 초과 시 오래된 로그 제거
        if (newLogs.length > debug.maxLogLines) {
          return newLogs.slice(-debug.maxLogLines);
        }
        return newLogs;
      });

      // 자동 스크롤
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, [debug.maxLogLines]);

    // 로그 클리어
    const clearLogs = useCallback(() => {
      setLogs([]);
    }, []);

    // ref로 메서드 노출
    useImperativeHandle(ref, () => ({
      log: addLog,
      clear: clearLogs,
    }), [addLog, clearLogs]);

    // 전역 ref 설정
    useEffect(() => {
      globalDebugRef = { log: addLog, clear: clearLogs };
      return () => {
        globalDebugRef = null;
      };
    }, [addLog, clearLogs]);

    // 초기 로그
    useEffect(() => {
      addLog('info', '디버그 오버레이 시작됨');
      addLog('info', `화면 크기: ${screenWidth}x${screenHeight}`);
    }, [addLog, screenWidth, screenHeight]);

    if (!debug.enabled || !visible) {
      return null;
    }

    // 시간 포맷
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
    };

    // 레벨별 색상
    const getLevelColor = (level: LogLevel) => {
      return debug.colors[level] || '#ffffff';
    };

    // 레벨 아이콘
    const getLevelIcon = (level: LogLevel) => {
      switch (level) {
        case 'info': return 'ℹ️';
        case 'warn': return '⚠️';
        case 'error': return '❌';
        case 'success': return '✅';
        case 'event': return '📡';
        default: return '•';
      }
    };

    // 최소화 상태
    if (isMinimized) {
      return (
        <Animated.View
          style={[
            styles.minimizedContainer,
            { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
          ]}
          {...panResponder.panHandlers}
        >
          <Pressable
            onPress={() => setIsMinimized(false)}
            style={styles.minimizedButton}
          >
            <Text style={styles.minimizedText}>
              🔍 {logs.length}
            </Text>
          </Pressable>
        </Animated.View>
      );
    }

    const containerHeight = isExpanded ? screenHeight * 0.7 : 200;

    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            height: containerHeight,
            maxWidth: screenWidth - 20,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* 헤더 */}
        <View style={styles.header} {...panResponder.panHandlers}>
          <Text style={styles.headerTitle}>🐛 Debug Log</Text>
          <View style={styles.headerButtons}>
            <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>{isExpanded ? '▼' : '▲'}</Text>
            </Pressable>
            <Pressable onPress={clearLogs} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>🗑️</Text>
            </Pressable>
            <Pressable onPress={() => setIsMinimized(true)} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>➖</Text>
            </Pressable>
          </View>
        </View>

        {/* 로그 목록 */}
        <ScrollView
          ref={scrollViewRef}
          style={[styles.logList, { backgroundColor: `rgba(0,0,0,${debug.overlayOpacity})` }]}
          contentContainerStyle={styles.logListContent}
          showsVerticalScrollIndicator={true}
        >
          {logs.length === 0 ? (
            <Text style={[styles.emptyText, { fontSize: debug.fontSize }]}>
              로그가 없습니다
            </Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logEntry}>
                <Text style={[styles.logTime, { fontSize: debug.fontSize - 1 }]}>
                  {formatTime(log.timestamp)}
                </Text>
                <Text style={styles.logIcon}>{getLevelIcon(log.level)}</Text>
                <View style={styles.logContent}>
                  <Text
                    style={[
                      styles.logMessage,
                      { color: getLevelColor(log.level), fontSize: debug.fontSize },
                    ]}
                  >
                    {log.message}
                  </Text>
                  {log.details && (
                    <Text
                      style={[
                        styles.logDetails,
                        { fontSize: debug.fontSize - 1 },
                      ]}
                    >
                      {log.details}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* 상태 바 */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            📊 {logs.filter(l => l.level === 'error').length} errors | 
            {logs.filter(l => l.level === 'warn').length} warns | 
            {logs.length} total
          </Text>
        </View>
      </Animated.View>
    );
  }
);

DebugOverlay.displayName = 'DebugOverlay';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  headerButtonText: {
    fontSize: 16,
  },
  logList: {
    flex: 1,
  },
  logListContent: {
    padding: 8,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  logEntry: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  logTime: {
    color: '#888',
    marginRight: 6,
    fontFamily: 'monospace',
    minWidth: 85,
  },
  logIcon: {
    marginRight: 6,
    fontSize: 12,
  },
  logContent: {
    flex: 1,
  },
  logMessage: {
    fontFamily: 'monospace',
  },
  logDetails: {
    color: '#aaa',
    fontFamily: 'monospace',
    marginTop: 2,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#444',
  },
  statusBar: {
    backgroundColor: '#16213e',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: '#888',
    fontSize: 10,
    textAlign: 'center',
  },
  minimizedContainer: {
    position: 'absolute',
    zIndex: 9999,
  },
  minimizedButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  minimizedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default DebugOverlay;
