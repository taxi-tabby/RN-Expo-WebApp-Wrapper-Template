/**
 * Camera Bridge Handlers
 * Provides real-time video recording with frame streaming using custom native module
 */

import { requireNativeModule } from 'expo-modules-core';
import type { BridgeHandler } from '../../bridge';
import { sendToWeb } from '../../bridge';

let CameraModule: any = null;

// Try to load native module (only available in development build)
try {
  CameraModule = requireNativeModule('Camera');
} catch (e) {
  console.warn('[Camera] Native module not available. Use development build: npx expo run:android');
  CameraModule = null;
}

// Recording state management
interface RecordingState {
  isRecording: boolean;
  facing: string;
  eventKey?: string;
}

let recordingState: RecordingState = {
  isRecording: false,
  facing: 'back',
};

/**
 * Set up event listeners
 */
if (CameraModule) {
  try {
    CameraModule.addListener('onCameraFrame', (event: any) => {
      if (recordingState.eventKey && recordingState.isRecording) {
        sendToWeb(recordingState.eventKey, event);
      }
    });

    CameraModule.addListener('onRecordingFinished', (event: any) => {
      if (recordingState.eventKey) {
        sendToWeb(recordingState.eventKey, {
          type: 'recordingFinished',
          path: event.path,
        });
      }
    });

    CameraModule.addListener('onRecordingError', (event: any) => {
      if (recordingState.eventKey) {
        sendToWeb(recordingState.eventKey, {
          type: 'recordingError',
          error: event.error,
        });
      }
    });
  } catch (e) {
    console.warn('[Camera] Failed to add event listeners:', e);
  }
}

/**
 * Dummy functions for compatibility (camera component not needed)
 */
export function setCameraRef(ref: any) {
  // Not used with native module
}

export function getCameraRef() {
  return null;
}

/**
 * Check camera permission status
 */
export const checkCameraPermission: BridgeHandler = async (_payload, respond) => {
  if (!CameraModule) {
    respond({
      granted: false,
      status: 'unavailable',
      error: 'Camera module not available. Run: npx expo prebuild --clean && npx expo run:android',
    });
    return;
  }

  try {
    const result = await CameraModule.checkCameraPermission();
    console.log('[Camera] Permission check result:', result);
    
    respond({
      granted: result.granted,
      status: result.status,
      cameraGranted: result.cameraGranted,
      micGranted: result.micGranted,
    });
  } catch (error) {
    console.error('[Camera] Permission check error:', error);
    respond({
      granted: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to check camera permission',
    });
  }
};

/**
 * Request camera permission
 */
export const requestCameraPermission: BridgeHandler = async (_payload, respond) => {
  if (!CameraModule) {
    respond({
      granted: false,
      status: 'unavailable',
      error: 'Camera module not available. Run: npx expo prebuild --clean && npx expo run:android',
    });
    return;
  }

  try {
    // Note: Android permissions must be requested via AndroidManifest.xml
    // This just checks the current status
    const result = await CameraModule.checkCameraPermission();
    console.log('[Camera] Permission status:', result);
    
    respond({
      granted: result.granted,
      status: result.status,
      message: 'Please grant camera and microphone permissions in app settings',
    });
  } catch (error) {
    console.error('[Camera] Permission request error:', error);
    respond({
      granted: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to request camera permission',
    });
  }
};

/**
 * Take a photo (one-time capture, not streaming)
 */
export const takePhoto: BridgeHandler = async (_payload, respond) => {
  if (!CameraModule) {
    respond({
      success: false,
      error: 'Camera module not available. Run: npx expo prebuild --clean && npx expo run:android',
    });
    return;
  }

  try {
    const result = await CameraModule.takePhoto();
    
    if (result.success) {
      respond({
        success: true,
        data: {
          path: result.path,
        },
      });
    } else {
      respond({
        success: false,
        error: result.error || 'Failed to take photo',
      });
    }
  } catch (error) {
    respond({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to take photo',
    });
  }
};

/**
 * Start video recording with optional frame streaming
 */
export const startCamera: BridgeHandler = async (payload, respond) => {
  if (!CameraModule) {
    respond({
      error: 'Camera module not available. Run: npx expo prebuild --clean && npx expo run:android',
    });
    return;
  }

  const params = (payload || {}) as { 
    facing?: string; 
    eventKey?: string; 
  };
  const { facing = 'back', eventKey } = params;

  try {
    const result = await CameraModule.startCamera(facing, eventKey || null);
    
    if (result.success) {
      recordingState = {
        isRecording: true,
        facing,
        eventKey,
      };

      respond({
        isRecording: true,
        facing,
        eventKey,
        isStreaming: result.isStreaming,
        mode: result.isStreaming ? 'recording+streaming' : 'recording',
      });

      console.log('[Camera] Recording started - streaming:', result.isStreaming);
    } else {
      respond({
        error: result.error || 'Failed to start camera',
      });
    }
  } catch (error) {
    respond({
      error: error instanceof Error ? error.message : 'Failed to start camera',
    });
  }
};

/**
 * Stop video recording
 */
export const stopCamera: BridgeHandler = async (_payload, respond) => {
  if (!CameraModule) {
    respond({
      error: 'Camera module not available. Run: npx expo prebuild --clean && npx expo run:android',
    });
    return;
  }

  if (!recordingState.isRecording) {
    respond({
      error: 'No recording in progress',
    });
    return;
  }

  try {
    const result = await CameraModule.stopCamera();
    
    recordingState = {
      isRecording: false,
      facing: recordingState.facing,
      eventKey: undefined,
    };

    if (result.success) {
      console.log('[Camera] Recording stopped');
      respond({
        isRecording: false,
      });
    } else {
      respond({
        error: result.error || 'Failed to stop camera',
      });
    }
  } catch (error) {
    recordingState.isRecording = false;
    recordingState.eventKey = undefined;
    
    respond({
      error: error instanceof Error ? error.message : 'Failed to stop recording',
    });
  }
};

/**
 * Get recording status
 */
export const getCameraStatus: BridgeHandler = async (_payload, respond) => {
  if (!CameraModule) {
    respond({
      success: true,
      data: {
        isRecording: false,
        isStreaming: false,
        facing: 'back',
        hasCamera: false,
        error: 'Camera module not available',
      },
    });
    return;
  }

  try {
    const result = await CameraModule.getCameraStatus();
    
    respond({
      success: true,
      data: {
        isRecording: result.isRecording || recordingState.isRecording,
        isStreaming: result.isStreaming,
        facing: recordingState.facing,
        eventKey: recordingState.eventKey,
        hasCamera: result.hasCamera,
      },
    });
  } catch (error) {
    respond({
      success: true,
      data: {
        isRecording: recordingState.isRecording,
        facing: recordingState.facing,
        eventKey: recordingState.eventKey,
        hasCamera: false,
      },
    });
  }
};

/**
 * Register all camera handlers
 */
export function registerCameraHandlers(registerHandler: (name: string, handler: BridgeHandler) => void) {
  registerHandler('checkCameraPermission', checkCameraPermission);
  registerHandler('requestCameraPermission', requestCameraPermission);
  registerHandler('takePhoto', takePhoto);
  registerHandler('startCamera', startCamera);
  registerHandler('stopCamera', stopCamera);
  registerHandler('getCameraStatus', getCameraStatus);
  console.log('[Bridge] Camera handlers registered (VisionCamera)');
}
