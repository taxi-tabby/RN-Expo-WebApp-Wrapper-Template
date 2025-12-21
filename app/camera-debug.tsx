import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import * as Camera from '@/modules/camera';

export default function CameraDebugScreen() {
  const [status, setStatus] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [crashLogs, setCrashLogs] = useState<any[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage].slice(-20)); // 최근 20개만
  };

  const checkPermission = async () => {
    try {
      addLog('권한 확인 중...');
      const result = await Camera.checkCameraPermission();
      addLog(`권한 상태: ${JSON.stringify(result)}`);
      setStatus(result.granted ? '권한 있음 ✓' : '권한 없음 ✗');
    } catch (error) {
      addLog(`권한 확인 실패: ${error}`);
    }
  };

  const requestPermission = async () => {
    try {
      addLog('권한 요청 중...');
      const result = await Camera.requestCameraPermission();
      addLog(`권한 요청 결과: ${JSON.stringify(result)}`);
      
      // 요청 후 1초 뒤에 다시 확인
      setTimeout(async () => {
        const check = await Camera.checkCameraPermission();
        addLog(`권한 재확인: ${JSON.stringify(check)}`);
        setStatus(check.granted ? '권한 있음 ✓' : '권한 없음 ✗');
      }, 1000);
    } catch (error) {
      addLog(`권한 요청 실패: ${error}`);
    }
  };

  const startCamera = async () => {
    try {
      addLog('카메라 시작 중...');
      const result = await Camera.startCamera({ facing: 'back' });
      addLog(`카메라 시작 결과: ${JSON.stringify(result)}`);
      
      if (result.success) {
        Alert.alert('성공', '카메라가 시작되었습니다!');
      } else {
        Alert.alert('실패', result.error || '알 수 없는 오류');
      }
    } catch (error: any) {
      addLog(`카메라 시작 실패: ${error.message || error}`);
      Alert.alert('크래시', `에러: ${error.message || error}`);
    }
  };

  const stopCamera = async () => {
    try {
      addLog('카메라 중지 중...');
      const result = await Camera.stopCamera();
      addLog(`카메라 중지 결과: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(`카메라 중지 실패: ${error}`);
    }
  };

  const getCrashLogs = async () => {
    try {
      addLog('크래시 로그 조회 중...');
      const result = await Camera.getCrashLogs();
      addLog(`크래시 로그: ${result.count}개 발견`);
      
      if (result.success && result.logs) {
        setCrashLogs(result.logs);
        if (result.count === 0) {
          Alert.alert('알림', '크래시 로그가 없습니다.');
        } else {
          Alert.alert(
            '크래시 로그',
            `총 ${result.count}개 발견`,
            [
              {
                text: '최신 로그 공유',
                onPress: () => Camera.shareCrashLog(result.logs![0].path),
              },
              { text: '확인' },
            ]
          );
        }
      }
    } catch (error) {
      addLog(`크래시 로그 조회 실패: ${error}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('로그 클리어됨');
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>카메라 디버그</Text>
      <Text style={styles.status}>{status}</Text>

      <View style={styles.buttons}>
        <Button title="1. 권한 확인" onPress={checkPermission} />
        <Button title="2. 권한 요청" onPress={requestPermission} />
        <Button title="3. 카메라 시작" onPress={startCamera} />
        <Button title="4. 카메라 중지" onPress={stopCamera} />
        <Button title="크래시 로그 보기" onPress={getCrashLogs} color="#ff6b6b" />
        <Button title="로그 클리어" onPress={clearLogs} color="#999" />
      </View>

      <ScrollView style={styles.logContainer}>
        <Text style={styles.logTitle}>📋 로그:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    fontSize: 18,
    marginBottom: 20,
    color: '#333',
  },
  buttons: {
    gap: 10,
    marginBottom: 20,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
    color: '#333',
  },
});
