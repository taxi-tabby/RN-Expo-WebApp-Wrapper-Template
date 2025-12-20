/**
 * 카메라 관련 핸들러
 */

import { registerHandler } from '@/lib/bridge';
import { Platform } from 'react-native';

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
      const result = await Camera.startCamera(options);
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
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
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
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
      if (!Camera) {
        respond({ 
          success: true,
          data: {
            isRecording: false,
            isStreaming: false,
            facing: 'back',
            hasCamera: false
          }
        });
        return;
      }
      
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get camera status' 
      });
    }
  });

  console.log('[Bridge] Camera handlers registered');
};
