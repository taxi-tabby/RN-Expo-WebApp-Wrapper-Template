/**
 * 디버그 오버레이 컴포넌트
 * 웹뷰 위에 오버레이로 로그를 표시
 */

import { documentDirectory, writeAsStringAsync } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'event' | 'nav';

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
  exportLogs: () => Promise<void>;
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

const DebugOverlayComponent = React.forwardRef<DebugOverlayRef, DebugOverlayProps>(
  ({ visible = true }, ref) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isMinimized, setIsMinimized] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    
    const { debug } = APP_CONFIG;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    // 시간 포맷
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
    };

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
        if (newLogs.length > debug.maxLogLines) {
          return newLogs.slice(-debug.maxLogLines);
        }
        return newLogs;
      });

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, [debug.maxLogLines]);

    // 로그 클리어
    const clearLogs = useCallback(() => {
      setLogs([]);
    }, []);

    // 로그를 파일로 저장
    const exportLogs = useCallback(async () => {
      try {
        if (logs.length === 0) {
          addLog('warn', '저장할 로그가 없습니다');
          return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `debug-log-${timestamp}.txt`;
        const filePath = `${documentDirectory}${fileName}`;

        let content = `=== DEBUG LOG EXPORT ===\n`;
        content += `생성 시간: ${new Date().toLocaleString('ko-KR')}\n`;
        content += `총 로그: ${logs.length}개\n`;
        content += `에러: ${logs.filter(l => l.level === 'error').length}개\n`;
        content += `경고: ${logs.filter(l => l.level === 'warn').length}개\n`;
        content += `=========================\n\n`;

        logs.forEach(log => {
          const time = formatTime(log.timestamp);
          const level = log.level.toUpperCase().padEnd(7);
          content += `[${time}] ${level} ${log.message}\n`;
          if (log.details) {
            content += `  └─ ${log.details}\n`;
          }
          content += '\n';
        });

        await writeAsStringAsync(filePath, content);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/plain',
            dialogTitle: '디버그 로그 내보내기',
          });
          addLog('success', `로그를 파일로 저장했습니다: ${fileName}`);
        } else {
          addLog('success', `로그를 저장했습니다: ${filePath}`);
        }
      } catch (error) {
        console.error('로그 저장 실패:', error);
        addLog('error', '로그 저장 실패', String(error));
      }
    }, [logs, addLog, formatTime]);

    // ref로 메서드 노출
    useImperativeHandle(ref, () => ({
      log: addLog,
      clear: clearLogs,
      exportLogs,
    }), [addLog, clearLogs, exportLogs]);

    // 전역 ref 설정
    useEffect(() => {
      globalDebugRef = { log: addLog, clear: clearLogs, exportLogs };
      return () => {
        globalDebugRef = null;
      };
    }, [addLog, clearLogs, exportLogs]);

    // 초기 로그
    useEffect(() => {
      addLog('info', '디버그 오버레이 시작됨');
      addLog('info', `화면 크기: ${screenWidth}x${screenHeight}`);
    }, [addLog, screenWidth, screenHeight]);

    if (!debug.enabled || !visible) {
      return null;
    }

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
        case 'nav': return '📍';
        default: return '•';
      }
    };

    // 최소화 상태
    if (isMinimized) {
      return (
        <View style={styles.minimizedContainer}>
          <TouchableOpacity
            onPress={() => setIsMinimized(false)}
            style={[
              styles.minimizedButton,
              logs.some(l => l.level === 'error') && styles.minimizedButtonError
            ]}
            activeOpacity={0.7}
          >
            <Text style={styles.minimizedText}>
              🐛 {logs.length}
              {logs.filter(l => l.level === 'error').length > 0 && 
                ` (${logs.filter(l => l.level === 'error').length}❌)`
              }
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const containerHeight = isExpanded ? screenHeight * 0.7 : 220;

    return (
      <View
        style={[
          styles.container,
          {
            height: containerHeight,
            maxWidth: screenWidth - 20,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🐛 Debug Log</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={() => setIsExpanded(!isExpanded)} 
              style={styles.headerButton}
              activeOpacity={0.6}
            >
              <Text style={styles.headerButtonText}>{isExpanded ? '▼' : '▲'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={exportLogs} 
              style={styles.headerButton}
              activeOpacity={0.6}
            >
              <Text style={styles.headerButtonText}>💾</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={clearLogs} 
              style={styles.headerButton}
              activeOpacity={0.6}
            >
              <Text style={styles.headerButtonText}>🗑️</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setIsMinimized(true)} 
              style={styles.headerButton}
              activeOpacity={0.6}
            >
              <Text style={styles.headerButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

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

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            📊 {logs.filter(l => l.level === 'error').length} errors | 
            {logs.filter(l => l.level === 'warn').length} warns | 
            {logs.length} total
          </Text>
        </View>
      </View>
    );
  }
);

DebugOverlayComponent.displayName = 'DebugOverlay';

export const DebugOverlay = DebugOverlayComponent;

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
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#fff',
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
    bottom: 100,
    right: 10,
    zIndex: 9999,
  },
  minimizedButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  minimizedButtonError: {
    backgroundColor: 'rgba(231, 76, 60, 0.95)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  minimizedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default DebugOverlay;
