import { registerHandler, sendToWeb } from '@/lib/bridge';
import Microphone, {
    checkMicrophonePermission,
    getMicrophoneStatus,
    requestMicrophonePermission,
    startRecording,
    stopRecording,
    type AudioChunkEvent,
    type MicrophonePermissionResult,
    type MicrophoneStatusResult,
} from '@/modules/microphone';

let audioChunkSubscription: any = null;

/**
 * 마이크 브릿지 핸들러 등록
 */
export function registerMicrophoneHandlers() {
  // 마이크 권한 확인
  registerHandler('checkMicrophonePermission', async (payload, respond) => {
    try {
      const result = await checkMicrophonePermission();
      respond({ success: true, ...result });
    } catch (error) {
      respond({ success: false, error: String(error) });
    }
  });

  // 마이크 권한 요청
  registerHandler('requestMicrophonePermission', async (payload, respond) => {
    try {
      const result = await requestMicrophonePermission();
      respond({ success: true, ...result });
    } catch (error) {
      respond({ success: false, error: String(error) });
    }
  });

  // 녹음 시작 (스트리밍)
  registerHandler('startRecording', async (payload, respond) => {
    try {
      const result = await startRecording();
      
      if (result.success) {
        // 오디오 청크 이벤트 리스너 등록
        audioChunkSubscription = Microphone.addListener('onAudioChunk', (event: AudioChunkEvent) => {
          // 웹으로 오디오 청크 전송
          sendToWeb('onAudioChunk', event);
        });
      }
      
      respond(result);
    } catch (error) {
      respond({ success: false, error: String(error) });
    }
  });

  // 녹음 중지
  registerHandler('stopRecording', async (payload, respond) => {
    try {
      // 이벤트 리스너 해제
      if (audioChunkSubscription) {
        audioChunkSubscription.remove();
        audioChunkSubscription = null;
      }
      
      const result = await stopRecording();
      respond(result);
    } catch (error) {
      respond({ success: false, error: String(error) });
    }
  });

  // 마이크 상태 조회
  registerHandler('getMicrophoneStatus', async (payload, respond) => {
    try {
      const result = await getMicrophoneStatus();
      respond({ success: true, ...result });
    } catch (error) {
      respond({ success: false, error: String(error) });
    }
  });
}

export {
    checkMicrophonePermission, getMicrophoneStatus, requestMicrophonePermission,
    startRecording,
    stopRecording, type AudioChunkEvent, type MicrophonePermissionResult,
    type MicrophoneStatusResult
};

export default Microphone;
