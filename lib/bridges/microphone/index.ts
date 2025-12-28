import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';
import { registerMicrophoneHandlers as moduleRegister } from 'rnww-plugin-microphone';

/**
 * 마이크 관련 핸들러
 */
export const registerMicrophoneHandlers = () => {
  moduleRegister({
    bridge: { registerHandler, sendToWeb },
    platform: { OS: Platform.OS }
  });
}

