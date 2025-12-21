import { requireNativeModule } from 'expo-modules-core';

const MicrophoneModule = requireNativeModule('Microphone');

export interface MicrophonePermissionResult {
  granted: boolean;
  status: 'granted' | 'denied' | 'unavailable' | 'error';
}

export interface MicrophoneStatusResult {
  isStreaming: boolean;
  hasMicrophone: boolean;
}

export interface AudioChunkEvent {
  type: 'audioChunk';
  base64: string;
  chunkSize: number;
  chunkNumber: number;
  timestamp: number;
  sampleRate: number;
  encoding: 'pcm_16bit';
}

export function getMicrophoneModule() {
  if (!MicrophoneModule) {
    throw new Error('Microphone module is not available');
  }
  return MicrophoneModule;
}

export async function checkMicrophonePermission(): Promise<MicrophonePermissionResult> {
  const module = getMicrophoneModule();
  return await module.checkMicrophonePermission();
}

export async function requestMicrophonePermission(): Promise<MicrophonePermissionResult> {
  const module = getMicrophoneModule();
  return await module.requestMicrophonePermission();
}

export async function startRecording(): Promise<{ success: boolean; error?: string }> {
  const module = getMicrophoneModule();
  return await module.startRecording();
}

export async function stopRecording(): Promise<{ success: boolean; error?: string }> {
  const module = getMicrophoneModule();
  return await module.stopRecording();
}

export async function getMicrophoneStatus(): Promise<MicrophoneStatusResult> {
  const module = getMicrophoneModule();
  return await module.getMicrophoneStatus();
}

export default {
  checkMicrophonePermission,
  requestMicrophonePermission,
  startRecording,
  stopRecording,
  getMicrophoneStatus,
  addListener: (eventName: string, listener: (event: AudioChunkEvent) => void) => {
    const module = getMicrophoneModule();
    return module.addListener(eventName, listener);
  },
};
