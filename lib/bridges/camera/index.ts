/**
 * 카메라 관련 핸들러
 */

import { registerHandler, sendToWeb } from '@/lib/bridge';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export const registerCameraHandlers = () => {
  // Android가 아니면 카메라 기능을 등록하지 않음
  if (Platform.OS !== 'android') {
    console.log('[Bridge] Camera handlers skipped (Android only)');
    return;
  }

  // 카메라 모듈을 안전하게 로드
  let Camera: any = null;
  try {
    Camera = require('@/modules/camera');
  } catch (error) {
    console.error('[Bridge] Failed to load camera module:', error);
    return;
  }

  // 네이티브 이벤트 리스너 설정
  try {
    const { CustomCamera } = NativeModules;
    if (CustomCamera) {
      const eventEmitter = new NativeEventEmitter(CustomCamera);
      
      // 카메라 프레임 이벤트를 웹으로 전달
      eventEmitter.addListener('onCameraFrame', (data) => {
        sendToWeb('onCameraFrame', data);
      });
      
      // 녹화 완료 이벤트
      eventEmitter.addListener('onRecordingFinished', (data) => {
        sendToWeb('onRecordingFinished', data);
      });
      
      // 녹화 에러 이벤트
      eventEmitter.addListener('onRecordingError', (data) => {
        sendToWeb('onRecordingError', data);
      });
      
      console.log('[Bridge] Camera event listeners registered');
    }
  } catch (error) {
    console.error('[Bridge] Failed to setup camera event listeners:', error);
  }

  // 카메라 권한 확인
  registerHandler('checkCameraPermission', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ granted: false, status: 'unavailable', error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.checkCameraPermission();
      respond({ success: true, ...result });
    } catch (error) {
      respond({ 
        success: false, 
        granted: false, 
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check camera permission' 
      });
    }
  });

  // 카메라 권한 요청
  registerHandler('requestCameraPermission', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ granted: false, status: 'unavailable', error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.requestCameraPermission();
      respond({ success: true, ...result });
    } catch (error) {
      respond({ 
        success: false, 
        granted: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to request camera permission' 
      });
    }
  });

  // 사진 촬영
  registerHandler('takePhoto', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.takePhoto();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to take photo' 
      });
    }
  });

  // 카메라 녹화 시작
  registerHandler('startCamera', async (payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const options = payload as { facing?: 'front' | 'back'; eventKey?: string };
      // eventKey는 필수 - 없으면 기본값 사용
      const result = await Camera.startCamera({
        facing: options?.facing || 'back',
        eventKey: options?.eventKey || 'cameraStream'
      });
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start camera' 
      });
    }
  });

  // 카메라 녹화 중지
  registerHandler('stopCamera', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.stopCamera();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop camera' 
      });
    }
  });

  // 카메라 상태 확인
  registerHandler('getCameraStatus', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ 
          isRecording: false,
          isStreaming: false,
          facing: 'back',
          hasCamera: false
        });
        return;
      }
      
      const status = await Camera.getCameraStatus();
      respond(status);
    } catch (error) {
      respond({ 
        isRecording: false,
        isStreaming: false,
        facing: 'back',
        hasCamera: false,
        error: error instanceof Error ? error.message : 'Failed to get camera status'
      });
    }
  });

  // 크래시 로그 조회
  registerHandler('getCrashLogs', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.getCrashLogs();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get crash logs' 
      });
    }
  });

  // 크래시 로그 공유
  registerHandler('shareCrashLog', async (payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const { filePath } = payload as { filePath: string };
      if (!filePath) {
        respond({ success: false, error: 'filePath is required' });
        return;
      }
      
      const result = await Camera.shareCrashLog(filePath);
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to share crash log' 
      });
    }
  });

  // 크래시 로그 삭제
  registerHandler('clearCrashLogs', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.clearCrashLogs();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear crash logs' 
      });
    }
  });

  console.log('[Bridge] Camera handlers registered');
};
