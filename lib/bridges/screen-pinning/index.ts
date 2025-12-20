/**
 * Screen Pinning Module (Android Only)
 * Android 앱 고정 (Screen Pinning / Lock Task Mode) 기능
 * 
 * 네이티브 모듈 + WebView 브릿지 통합
 */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { registerHandler } from '@/lib/bridge';

// ========================================
// 네이티브 모듈 인터페이스
// ========================================

const ScreenPinningModule = Platform.OS === 'android' 
  ? requireNativeModule('ScreenPinning')
  : null;

export interface ScreenPinningStatus {
  /** 앱 고정 활성화 여부 */
  isPinned: boolean;
  /** Lock Task 모드 상태 (0: none, 1: pinned, 2: locked) */
  lockTaskModeState: number;
}

/**
 * 앱 고정 상태 확인
 * @returns 앱 고정 상태 정보
 */
export async function isScreenPinned(): Promise<ScreenPinningStatus> {
  if (Platform.OS !== 'android' || !ScreenPinningModule) {
    return { isPinned: false, lockTaskModeState: 0 };
  }
  return await ScreenPinningModule.isScreenPinned();
}

/**
 * 앱 고정 시작
 * 사용자에게 확인 다이얼로그가 표시됩니다.
 * Device Owner 앱인 경우 다이얼로그 없이 바로 고정됩니다.
 */
export async function startScreenPinning(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'android' || !ScreenPinningModule) {
    return { success: false, error: 'Only supported on Android' };
  }
  return await ScreenPinningModule.startScreenPinning();
}

/**
 * 앱 고정 해제
 * 일반 앱: 뒤로가기 + 최근 앱 버튼 동시 길게 누르기로 해제
 * Device Owner 앱: 프로그래밍 방식으로 해제 가능
 */
export async function stopScreenPinning(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'android' || !ScreenPinningModule) {
    return { success: false, error: 'Only supported on Android' };
  }
  return await ScreenPinningModule.stopScreenPinning();
}

// ========================================
// WebView 브릿지 핸들러
// ========================================

export const registerScreenPinningHandlers = () => {
  // 앱 고정 상태 확인
  registerHandler('getScreenPinning', async (_payload, respond) => {
    try {
      const status = await isScreenPinned();
      respond({ success: true, ...status });
    } catch (error) {
      respond({ success: false, isPinned: false, error: error instanceof Error ? error.message : 'Failed to get screen pinning status' });
    }
  });

  // 앱 고정 시작
  registerHandler('startScreenPinning', async (_payload, respond) => {
    try {
      const result = await startScreenPinning();
      respond(result);
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to start screen pinning' });
    }
  });

  // 앱 고정 해제
  registerHandler('stopScreenPinning', async (_payload, respond) => {
    try {
      const result = await stopScreenPinning();
      respond(result);
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to stop screen pinning' });
    }
  });

  console.log('[Bridge] ScreenPinning handlers registered');
};
