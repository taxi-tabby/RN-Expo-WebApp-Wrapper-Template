import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';
import { registerCameraHandlers as moduleRegister } from 'rnww-plugin-camera';

/**
 * 카메라 관련 핸들러
 */


export const registerCameraHandlers = () => {
  
  moduleRegister({
    bridge: {registerHandler, sendToWeb},
    platform: { OS: Platform.OS }
  })
};


