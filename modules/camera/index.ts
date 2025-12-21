/**
 * Camera Module (Android Only)
 * 카메라 권한 및 녹화 기능 제공
 */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

// Lazy 모듈 로드 (크래시 방지)
let CameraModule: any = null;

function getCameraModule() {
  if (Platform.OS !== 'android') {
    return null;
  }
  
  if (CameraModule === null) {
    try {
      CameraModule = requireNativeModule('CustomCamera');
    } catch (error) {
      console.error('[CustomCamera] Failed to load native module:', error);
      CameraModule = undefined; // 재시도 방지
      return null;
    }
  }
  
  return CameraModule === undefined ? null : CameraModule;
}

export interface CameraPermissionStatus {
  /** 권한 승인 여부 */
  granted: boolean;
  /** 권한 상태 */
  status: string;
  /** 카메라 권한 */
  cameraGranted?: boolean;
  /** 마이크 권한 */
  micGranted?: boolean;
}

export interface CameraRecordingOptions {
  /** 카메라 방향 (front/back) */
  facing?: 'front' | 'back';
  /** 이벤트 키 (프레임 스트리밍용) */
  eventKey?: string;
}

export interface RecordingResult {
  /** 성공 여부 */
  success: boolean;
  /** 녹화 여부 */
  isRecording?: boolean;
  /** 스트리밍 여부 */
  isStreaming?: boolean;
  /** 오류 메시지 */
  error?: string;
}

export interface CameraStatus {
  /** 녹화 여부 */
  isRecording: boolean;
  /** 스트리밍 여부 */
  isStreaming: boolean;
  /** 카메라 방향 */
  facing: string;
  /** 카메라 사용 가능 여부 */
  hasCamera: boolean;
}

export interface CrashLog {
  /** 파일명 */
  name: string;
  /** 파일 경로 */
  path: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** 생성 날짜 (timestamp) */
  date: number;
}

export interface CrashLogsResult {
  /** 성공 여부 */
  success: boolean;
  /** 크래시 로그 목록 */
  logs?: CrashLog[];
  /** 로그 개수 */
  count?: number;
  /** 오류 메시지 */
  error?: string;
}

export interface PhotoResult {
  /** 성공 여부 */
  success: boolean;
  /** 사진 파일 경로 */
  path?: string;
  /** 오류 메시지 */
  error?: string;
}

/**
 * 카메라 권한 확인
 * @returns 카메라 권한 상태
 */
export async function checkCameraPermission(): Promise<CameraPermissionStatus> {
  const module = getCameraModule();
  if (!module) {
    return { granted: false, status: 'unavailable' };
  }
  return await module.checkCameraPermission();
}

/**
 * 카메라 권한 요청
 * @returns 권한 요청 결과
 */
export async function requestCameraPermission(): Promise<CameraPermissionStatus> {
  const module = getCameraModule();
  if (!module) {
    return { granted: false, status: 'unavailable' };
  }
  return await module.requestCameraPermission();
}

/**
 * 사진 촬영
 * @returns 촬영 결과 및 파일 경로
 */
export async function takePhoto(): Promise<PhotoResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.takePhoto();
}

/**
 * 비디오 녹화 시작 (선택적으로 프레임 스트리밍)
 * @param options 녹화 옵션 (카메라 방향, 이벤트 키)
 * @returns 녹화 시작 결과
 */
export async function startCamera(options?: CameraRecordingOptions): Promise<RecordingResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  
  const { facing = 'back', eventKey } = options || {};
  return await module.startCamera(facing, eventKey || null);
}

/**
 * 비디오 녹화 중지
 * @returns 녹화 중지 결과
 */
export async function stopCamera(): Promise<RecordingResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.stopCamera();
}

/**
 * 카메라 상태 확인
 * @returns 현재 카메라 상태
 */
export async function getCameraStatus(): Promise<CameraStatus> {
  const module = getCameraModule();
  if (!module) {
    return { 
      isRecording: false, 
      isStreaming: false, 
      facing: 'back',
      hasCamera: false 
    };
  }
  return await module.getCameraStatus();
}

/**
 * 크래시 로그 목록 가져오기
 * @returns 크래시 로그 목록
 */
export async function getCrashLogs(): Promise<CrashLogsResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.getCrashLogs();
}

/**
 * 크래시 로그 공유하기 (카카오톡, 이메일 등)
 * @param filePath 공유할 로그 파일 경로
 * @returns 공유 성공 여부
 */
export async function shareCrashLog(filePath: string): Promise<{ success: boolean; error?: string }> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.shareCrashLog(filePath);
}

/**
 * 모든 크래시 로그 삭제
 * @returns 삭제 성공 여부 및 삭제된 파일 수
 */
export async function clearCrashLogs(): Promise<{ success: boolean; deleted?: number; error?: string }> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.clearCrashLogs();
}

