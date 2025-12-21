import * as Camera from '@/modules/camera';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Image, NativeEventEmitter, NativeModules, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraDebugScreen() {
  const [status, setStatus] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [crashLogs, setCrashLogs] = useState<any[]>([]);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [frameInfo, setFrameInfo] = useState<{ width: number; height: number; size: number } | null>(null);
  const frameCountRef = useRef<number>(0);
  const eventListenerRef = useRef<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage].slice(-20)); // 최근 20개만
  };

  // 카메라 프레임 이벤트 리스너 설정
  useEffect(() => {
    try {
      const { CustomCamera } = NativeModules;
      if (CustomCamera) {
        const eventEmitter = new NativeEventEmitter(CustomCamera);
        
        eventListenerRef.current = eventEmitter.addListener('onCameraFrame', (data) => {
          frameCountRef.current += 1;
          setFrameCount(frameCountRef.current);
          
          if (data.base64) {
            setLastFrame(data.base64);
            const base64Size = data.base64.length;
            setFrameInfo({
              width: data.width || 0,
              height: data.height || 0,
              size: Math.round(base64Size / 1024) // KB
            });
          }
        });
        
        addLog('프레임 이벤트 리스너 등록됨');
      }
    } catch (error) {
      addLog(`이벤트 리스너 설정 실패: ${error}`);
    }

    return () => {
      if (eventListenerRef.current) {
        eventListenerRef.current.remove();
        addLog('프레임 이벤트 리스너 해제됨');
      }
    };
  }, []);

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
      // 프레임 카운터 초기화
      frameCountRef.current = 0;
      setFrameCount(0);
      setLastFrame(null);
      setFrameInfo(null);
      
      const result = await Camera.startCamera({ facing: 'back', eventKey: 'cameraStream' });
      addLog(`카메라 시작 결과: ${JSON.stringify(result)}`);
      
      if (result.success) {
        addLog('프레임 수신 대기 중...');
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
      addLog(`총 수신 프레임: ${frameCountRef.current}개`);
    } catch (error) {
      addLog(`카메라 중지 실패: ${error}`);
    }
  };

  const checkCameraStatus = async () => {
    try {
      addLog('카메라 상태 확인 중...');
      const result = await Camera.getCameraStatus();
      addLog(`카메라 상태: ${JSON.stringify(result)}`);
      
      Alert.alert(
        '카메라 상태',
        `실행 중: ${result.isRecording ? '예' : '아니오'}\n` +
        `스트리밍: ${result.isStreaming ? '예' : '아니오'}\n` +
        `카메라 사용 가능: ${result.hasCamera ? '예' : '아니오'}`
      );
    } catch (error) {
      addLog(`상태 확인 실패: ${error}`);
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

  const clearCrashLogs = async () => {
    try {
      Alert.alert(
        '크래시 로그 삭제',
        '모든 크래시 로그를 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              addLog('크래시 로그 삭제 중...');
              const result = await Camera.clearCrashLogs();
              if (result.success) {
                addLog(`크래시 로그 ${result.deleted}개 삭제됨`);
                setCrashLogs([]);
                Alert.alert('완료', `${result.deleted}개의 로그를 삭제했습니다.`);
              } else {
                addLog(`삭제 실패: ${result.error}`);
                Alert.alert('실패', result.error || '삭제 중 오류 발생');
              }
            },
          },
        ]
      );
    } catch (error) {
      addLog(`크래시 로그 삭제 실패: ${error}`);
      Alert.alert('오류', String(error));
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>카메라 디버그</Text>
        </View>
        <Text style={styles.status}>{status}</Text>

        {/* 프레임 정보 */}
        <View style={styles.frameInfo}>
          <Text style={styles.frameInfoTitle}>📹 프레임 정보</Text>
          <Text style={styles.frameInfoText}>수신 프레임: {frameCount}개</Text>
          {frameInfo && (
            <>
              <Text style={styles.frameInfoText}>
                해상도: {frameInfo.width} x {frameInfo.height}
              </Text>
              <Text style={styles.frameInfoText}>크기: ~{frameInfo.size} KB</Text>
            </>
          )}
          {lastFrame && (
            <View style={styles.framePreview}>
              <Text style={styles.framePreviewTitle}>최신 프레임:</Text>
              <Image 
                source={{ uri: lastFrame }} 
                style={styles.frameImage}
                resizeMode="contain"
              />
            </View>
          )}
        </View>

      <View style={styles.buttons}>
        <Button title="1. 권한 확인" onPress={checkPermission} />
        <Button title="2. 권한 요청" onPress={requestPermission} />
        <Button title="3. 카메라 시작" onPress={startCamera} />
        <Button title="4. 카메라 중지" onPress={stopCamera} />
        <Button title="5. 카메라 상태 확인" onPress={checkCameraStatus} color="#4CAF50" />
        <Button title="크래시 로그 보기" onPress={getCrashLogs} color="#ff6b6b" />
        <Button title="크래시 로그 삭제" onPress={clearCrashLogs} color="#d32f2f" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    marginRight: 10,
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 18,
    marginBottom: 10,
    color: '#333',
  },
  frameInfo: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  frameInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  frameInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  framePreview: {
    marginTop: 10,
  },
  framePreviewTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  frameImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#000',
    borderRadius: 4,
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
