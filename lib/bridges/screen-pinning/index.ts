/**
 * 앱 고정(Screen Pinning) 관련 핸들러 - Android 전용
 */

import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';
import { registerScreenPinningHandlers as moduleRegister } from 'rnww-plugin-screen-pinning';

export const registerScreenPinningHandlers = () => {
  
  moduleRegister({
    bridge: {registerHandler, sendToWeb},
    platform: { OS: Platform.OS }
  });

};