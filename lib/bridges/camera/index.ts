/**
 * 카메라 관련 핸들러
 */

import { registerHandler, sendToWeb } from '@/lib/bridge';
import { NativeEventEmitter, Platform } from 'react-native';

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

  let eventEmitter: any = null;

  // 네이티브 이벤트 이미터 초기화
  try {
    const nativeModule = Camera.getNativeModule();
    console.log('[Bridge] Native module:', nativeModule ? 'available' : 'not found');
    
    if (nativeModule) {
      eventEmitter = new NativeEventEmitter(nativeModule);
      
      // 프레임 데이터 수신 - 고정 이벤트로 Web에 전달
      eventEmitter.addListener('onCameraFrame', (data: any) => {
        console.log(`[Bridge] ✓ Frame received - type: ${data?.type}, size: ${data?.base64?.length || 0}`);
        console.log(`[Bridge] Calling sendToWeb('onCameraFrame', ...)`);
        sendToWeb('onCameraFrame', data);
        console.log(`[Bridge] sendToWeb call completed`);
      });
      
      console.log('[Bridge] ✓ Camera event listeners registered');
    } else {
      console.warn('[Bridge] Native module not available, event listeners not registered');
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

  // 카메라 스트리밍 시작
  registerHandler('startCamera', async (payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const options = payload as { facing?: 'front' | 'back' };
      const result = await Camera.startCamera(options?.facing || 'back');
      
      respond(result);
    } catch (error) {
      console.error('[Bridge] startCamera error:', error);
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start camera' 
      });
    }
  });

  // 카메라 중지
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

  // 디버그 로그 가져오기
  registerHandler('getDebugLog', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.getDebugLog();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get debug log' 
      });
    }
  });

  // 디버그 로그 공유하기
  registerHandler('shareDebugLog', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.shareDebugLog();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to share debug log' 
      });
    }
  });

  // 디버그 로그 삭제
  registerHandler('clearDebugLog', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.clearDebugLog();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear debug log' 
      });
    }
  });

  console.log('[Bridge] Camera handlers registered');
};
