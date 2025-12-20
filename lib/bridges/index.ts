/**
 * Bridge Handlers 통합 모듈
 * 그룹별로 분리된 핸들러들을 통합 등록
 */

import { registerHandler } from '../bridge';
import { registerCameraHandlers } from './camera';
import { registerClipboardHandlers } from './clipboard';
import { registerDeviceHandlers } from './device';
import { registerKeepAwakeHandlers } from './keep-awake';
import { registerNavigationBarHandlers } from './navigation-bar';
import { registerOrientationHandlers } from './orientation';
import { registerScreenPinningHandlers } from './screen-pinning';
import { registerSplashHandlers } from './splash';
import { registerStatusBarHandlers } from './status-bar';
import { registerUIHandlers } from './ui';
import { registerWebviewHandlers } from './webview';

/**
 * 모든 내장 핸들러 등록
 */
export const registerBuiltInHandlers = () => {
  registerDeviceHandlers();
  registerUIHandlers();
  registerClipboardHandlers();
  registerWebviewHandlers();
  registerSplashHandlers();
  registerOrientationHandlers();
  registerStatusBarHandlers();
  registerNavigationBarHandlers();
  registerScreenPinningHandlers();
  registerKeepAwakeHandlers();
  registerCameraHandlers(registerHandler);

  console.log('[Bridge] All built-in handlers registered');
};
