/**
 * Camera Bridge Handlers
 * Provides real-time camera control with frame streaming to web
 */

import { Camera, CameraType, CameraView } from 'expo-camera';
import type { BridgeHandler } from '../../bridge';
import { sendToWeb } from '../../bridge';

// Recording state management
interface RecordingState {
  isRecording: boolean;
  facing: CameraType;
  recordingPromise?: Promise<any>;
  eventKey?: string;
  frameInterval?: ReturnType<typeof setInterval>;
}

let recordingState: RecordingState = {
  isRecording: false,
  facing: 'back',
};

let cameraRef: CameraView | null = null;

/**
 * Set camera ref from app component
 * This must be called from the app to provide camera instance
 */
export function setCameraRef(ref: CameraView | null) {
  cameraRef = ref;
}

/**
 * Get current camera ref
 */
export function getCameraRef() {
  return cameraRef;
}

/**
 * Check camera permission status
 */
export const checkCameraPermission: BridgeHandler = async (_payload, respond) => {
  try {
    const permission = await Camera.getCameraPermissionsAsync();
    console.log('[Camera] Permission check result:', JSON.stringify(permission));
    
    const granted = permission.granted === true;
    const status = permission.status || 'undetermined';
    const canAskAgain = permission.canAskAgain !== false;
    
    console.log('[Camera] Parsed - granted:', granted, 'status:', status, 'canAskAgain:', canAskAgain);
    
    respond({
      granted,
      status,
      canAskAgain,
      expires: permission.expires || 'never',
    });
  } catch (error) {
    console.error('[Camera] Permission check error:', error);
    respond({
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
      expires: 'never',
      error: error instanceof Error ? error.message : 'Failed to check camera permission',
    });
  }
};

/**
 * Request camera permission
 */
export const requestCameraPermission: BridgeHandler = async (_payload, respond) => {
  try {
    console.log('[Camera] Requesting camera permission...');
    const permission = await Camera.requestCameraPermissionsAsync();
    console.log('[Camera] Permission request result:', JSON.stringify(permission));
    
    const granted = permission.granted === true;
    const status = permission.status || 'denied';
    const canAskAgain = permission.canAskAgain !== false;
    
    console.log('[Camera] Parsed - granted:', granted, 'status:', status, 'canAskAgain:', canAskAgain);
    
    respond({
      granted,
      status,
      canAskAgain,
      expires: permission.expires || 'never',
    });
  } catch (error) {
    console.error('[Camera] Permission request error:', error);
    respond({
      granted: false,
      status: 'denied',
      canAskAgain: false,
      expires: 'never',
      error: error instanceof Error ? error.message : 'Failed to request camera permission',
    });
  }
};

/**
 * Take a photo (one-time capture, not streaming)
 */
export const takePhoto: BridgeHandler = async (payload, respond) => {
  const params = (payload || {}) as { quality?: number };
  const { quality = 0.8 } = params;

  if (!cameraRef) {
    respond({
      success: false,
      error: 'Camera component not initialized. Please add <AppCameraView> to your app.',
    });
    return;
  }

  // Check and request permission if needed
  let { status } = await Camera.getCameraPermissionsAsync();
  if (status !== 'granted') {
    const result = await Camera.requestCameraPermissionsAsync();
    status = result.status;
    
    if (status !== 'granted') {
      respond({
        success: false,
        error: 'Camera permission denied',
      });
      return;
    }
  }

  try {
    const photo = await cameraRef.takePictureAsync({
      quality,
      base64: true,
      isImageMirror: false,
      shutterSound: false, // 무음 촬영 (iOS)
    });

    respond({
      success: true,
      data: {
        uri: photo.uri,
        base64: photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : undefined,
        width: photo.width,
        height: photo.height,
      },
    });
  } catch (error) {
    respond({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to take photo',
    });
  }
};

/**
 * Start video recording
 */
export const startCamera: BridgeHandler = async (payload, respond) => {
  const params = (payload || {}) as { facing?: string; maxDuration?: number; eventKey?: string; frameInterval?: number };
  const { facing = 'back', maxDuration, eventKey, frameInterval = 100 } = params;

  if (!cameraRef) {
    respond({
      success: false,
      error: 'Camera component not initialized. Please add <AppCameraView> to your app.',
    });
    return;
  }

  // Check and request permission if needed
  let { status } = await Camera.getCameraPermissionsAsync();
  if (status !== 'granted') {
    const result = await Camera.requestCameraPermissionsAsync();
    status = result.status;
    
    if (status !== 'granted') {
      respond({
        success: false,
        error: 'Camera permission denied',
      });
      return;
    }
  }

  // Don't request microphone permission - this allows silent video recording without audio track
  // (similar to Chrome mobile camera API behavior)

  try {
    // Start recording (without audio track - silent recording)
    const recordingPromise = cameraRef.recordAsync({
      maxDuration: maxDuration,
    });

    recordingState = {
      isRecording: true,
      facing: facing as CameraType,
      recordingPromise,
      eventKey,
    };

    // If eventKey is provided, start frame streaming
    if (eventKey && cameraRef) {
      const interval = setInterval(async () => {
        if (!recordingState.isRecording || !cameraRef) {
          clearInterval(interval);
          return;
        }

        try {
          // Capture frame from camera (silent)
          const photo = await cameraRef.takePictureAsync({
            quality: 0.5,
            base64: true,
            skipProcessing: true,
            shutterSound: false, // 무음 촬영 (iOS)
          });

          if (photo?.base64) {
            // Send frame to web via sendToWeb
            sendToWeb(eventKey, {
              type: 'cameraFrame',
              base64: `data:image/jpeg;base64,${photo.base64}`,
              timestamp: Date.now(),
              facing: recordingState.facing,
              width: photo.width,
              height: photo.height,
            });
          }
        } catch (error) {
          // Silently ignore frame capture errors
        }
      }, frameInterval);

      recordingState.frameInterval = interval;
    }

    respond({
      success: true,
      data: {
        isRecording: true,
        facing: recordingState.facing,
        eventKey,
      },
    });

    console.log('[Camera] Recording started');
  } catch (error) {
    respond({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start recording',
    });
  }
};

/**
 * Stop video recording
 */
export const stopCamera: BridgeHandler = async (_payload, respond) => {
  if (!cameraRef || !recordingState.isRecording) {
    respond({
      success: false,
      error: 'No recording in progress',
    });
    return;
  }

  try {
    // Clear frame interval if exists
    if (recordingState.frameInterval) {
      clearInterval(recordingState.frameInterval);
      recordingState.frameInterval = undefined;
    }

    // Stop recording
    cameraRef.stopRecording();

    // Wait for recording to finish
    const video = await recordingState.recordingPromise;

    recordingState = {
      isRecording: false,
      facing: recordingState.facing,
      recordingPromise: undefined,
      eventKey: undefined,
    };

    console.log('[Camera] Recording stopped:', video.uri);

    respond({
      success: true,
      data: {
        isRecording: false,
        uri: video?.uri,
      },
    });
  } catch (error) {
    recordingState.isRecording = false;
    recordingState.recordingPromise = undefined;
    recordingState.eventKey = undefined;
    if (recordingState.frameInterval) {
      clearInterval(recordingState.frameInterval);
      recordingState.frameInterval = undefined;
    }
    
    respond({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop recording',
    });
  }
};

/**
 * Get recording status
 */
export const getCameraStatus: BridgeHandler = async (_payload, respond) => {
  respond({
    success: true,
    data: {
      isRecording: recordingState.isRecording,
      facing: recordingState.facing,
      eventKey: recordingState.eventKey,
      hasRef: cameraRef !== null,
    },
  });
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
  console.log('[Bridge] Camera handlers registered');
}
