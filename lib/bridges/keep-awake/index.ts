/**
 * 화면 절전 방지 관련 핸들러
 */

import { registerHandler } from '@/lib/bridge';

let isKeepAwakeActive = false;

export const registerKeepAwakeHandlers = () => {
  // 절전 방지 상태 확인
  registerHandler('getKeepAwake', async (_payload, respond) => {
    try {
      respond({ 
        success: true, 
        isActive: isKeepAwakeActive 
      });
    } catch (error) {
      respond({ 
        success: false, 
        isActive: false, 
        error: error instanceof Error ? error.message : 'Failed to get keep awake status' 
      });
    }
  });

  // 절전 방지 활성화
  registerHandler('activateKeepAwake', async (_payload, respond) => {
    try {
      const { activateKeepAwakeAsync } = await import('expo-keep-awake');
      await activateKeepAwakeAsync();
      isKeepAwakeActive = true;
      respond({ success: true, isActive: true });
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to activate keep awake' 
      });
    }
  });

  // 절전 방지 비활성화
  registerHandler('deactivateKeepAwake', async (_payload, respond) => {
    try {
      const { deactivateKeepAwake } = await import('expo-keep-awake');
      deactivateKeepAwake();
      isKeepAwakeActive = false;
      respond({ success: true, isActive: false });
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to deactivate keep awake' 
      });
    }
  });

  console.log('[Bridge] KeepAwake handlers registered');
};
