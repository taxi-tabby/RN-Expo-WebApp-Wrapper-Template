/**
 * Camera Bridge Handlers
 * Provides real-time camera control with frame streaming to web
 */

import { Camera, CameraType, CameraView } from 'expo-camera';
import type { BridgeHandler } from '../../bridge';

// Camera state management
interface CameraState {
  isActive: boolean;
  facing: CameraType;
  eventKey?: string;
  frameInterval?: ReturnType<typeof setInterval>;
}

let cameraState: CameraState = {
  isActive: false,
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
  const { status } = await Camera.getCameraPermissionsAsync();
  respond({
    success: true,
    data: {
      granted: status === 'granted',
      status,
    },
  });
};

/**
 * Request camera permission
 */
export const requestCameraPermission: BridgeHandler = async (_payload, respond) => {
  const { status } = await Camera.requestCameraPermissionsAsync();
  respond({
    success: true,
    data: {
      granted: status === 'granted',
      status,
    },
  });
};

/**
 * Start camera with real-time frame streaming
 * @param facing - Camera facing direction ('front' | 'back')
 * @param eventKey - Event key for streaming frames to web (optional)
 * @param frameInterval - Frame capture interval in ms (default: 100ms)
 */
export const startCamera: BridgeHandler = async (payload, respond) => {
  const params = (payload || {}) as { facing?: string; eventKey?: string; frameInterval?: number };
  const { facing = 'back', eventKey, frameInterval = 100 } = params;

  // Check permission first
  const { status } = await Camera.getCameraPermissionsAsync();
  if (status !== 'granted') {
    respond({
      success: false,
      error: 'Camera permission not granted',
    });
    return;
  }

  // Update camera state
  cameraState = {
    isActive: true,
    facing: facing as CameraType,
    eventKey,
  };

  // If eventKey is provided, start frame streaming
  if (eventKey && cameraRef) {
    const interval = setInterval(async () => {
      if (!cameraState.isActive || !cameraRef) {
        clearInterval(interval);
        return;
      }

      try {
        // Capture frame from camera
        const photo = await cameraRef.takePictureAsync({
          quality: 0.5,
          base64: true,
          skipProcessing: true,
        });

        if (photo?.base64) {
          // Send frame to web via event
          // This will be handled by the bridge's sendToWeb function
          const eventData = {
            type: 'cameraFrame',
            data: {
              base64: `data:image/jpeg;base64,${photo.base64}`,
              timestamp: Date.now(),
              facing: cameraState.facing,
            },
          };

          // Emit event to web (will be implemented in bridge)
          if (typeof (global as any).__bridgeEmitEvent === 'function') {
            (global as any).__bridgeEmitEvent(eventKey, eventData);
          }
        }
      } catch (error) {
        console.warn('[Camera] Frame capture error:', error);
      }
    }, frameInterval);

    cameraState.frameInterval = interval;
  }

  respond({
    success: true,
    data: {
      isActive: true,
      facing: cameraState.facing,
      eventKey,
    },
  });
};

/**
 * Stop camera
 */
export const stopCamera: BridgeHandler = async (_payload, respond) => {
  // Clear frame interval if exists
  if (cameraState.frameInterval) {
    clearInterval(cameraState.frameInterval);
    cameraState.frameInterval = undefined;
  }

  cameraState.isActive = false;
  cameraState.eventKey = undefined;

  respond({
    success: true,
    data: {
      isActive: false,
    },
  });
};

/**
 * Get camera status
 */
export const getCameraStatus: BridgeHandler = async (_payload, respond) => {
  respond({
    success: true,
    data: {
      isActive: cameraState.isActive,
      facing: cameraState.facing,
      eventKey: cameraState.eventKey,
      hasRef: cameraRef !== null,
    },
  });
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
      error: 'Camera ref not set',
    });
    return;
  }

  const { status } = await Camera.getCameraPermissionsAsync();
  if (status !== 'granted') {
    respond({
      success: false,
      error: 'Camera permission not granted',
    });
    return;
  }

  try {
    const photo = await cameraRef.takePictureAsync({
      quality,
      base64: true,
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
 * Register all camera handlers
 */
export function registerCameraHandlers(registerHandler: (name: string, handler: BridgeHandler) => void) {
  registerHandler('checkCameraPermission', checkCameraPermission);
  registerHandler('requestCameraPermission', requestCameraPermission);
  registerHandler('startCamera', startCamera);
  registerHandler('stopCamera', stopCamera);
  registerHandler('getCameraStatus', getCameraStatus);
  registerHandler('takePhoto', takePhoto);
  console.log('[Bridge] Camera handlers registered');
}
