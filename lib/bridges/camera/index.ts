/**
 * Camera Bridge Handler
 * 카메라 촬영 및 이미지 선택 기능
 * 
 * 웹에서 사용 예시:
 * const result = await AppBridge.call('takePhoto', { 
 *   quality: 0.8,
 *   maxWidth: 1920,
 *   maxHeight: 1080
 * });
 * // result.data = base64 인코딩된 이미지 데이터
 * 
 * 또는 File 객체 전송:
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 * await AppBridge.call('uploadImage', { image: file });
 */

import { registerHandler } from '@/lib/bridge';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface PhotoOptions {
  /** 이미지 품질 (0~1) */
  quality?: number;
  /** 최대 가로 크기 */
  maxWidth?: number;
  /** 최대 세로 크기 */
  maxHeight?: number;
  /** 편집 허용 여부 */
  allowsEditing?: boolean;
}

export interface PhotoResult {
  success: boolean;
  /** base64 인코딩된 이미지 데이터 */
  data?: string;
  /** MIME 타입 */
  mimeType?: string;
  /** 파일 크기 (bytes) */
  size?: number;
  /** 이미지 가로 크기 */
  width?: number;
  /** 이미지 세로 크기 */
  height?: number;
  error?: string;
}

/**
 * 카메라로 사진 촬영
 */
async function takePhoto(options: PhotoOptions = {}): Promise<PhotoResult> {
  try {
    // 권한 요청
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { 
        success: false, 
        error: '카메라 권한이 필요합니다.' 
      };
    }

    // 사진 촬영
    const result = await ImagePicker.launchCameraAsync({
      quality: options.quality ?? 0.8,
      allowsEditing: options.allowsEditing ?? false,
      base64: true,
      exif: false,
    });

    if (result.canceled) {
      return { success: false, error: 'User cancelled' };
    }

    const asset = result.assets[0];
    
    return {
      success: true,
      data: asset.base64 || '',
      mimeType: asset.mimeType || 'image/jpeg',
      width: asset.width,
      height: asset.height,
      size: asset.base64?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to take photo',
    };
  }
}

/**
 * 갤러리에서 이미지 선택
 */
async function pickImage(options: PhotoOptions = {}): Promise<PhotoResult> {
  try {
    // 권한 요청
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { 
        success: false, 
        error: '갤러리 접근 권한이 필요합니다.' 
      };
    }

    // 이미지 선택
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: options.quality ?? 0.8,
      allowsEditing: options.allowsEditing ?? false,
      base64: true,
      exif: false,
    });

    if (result.canceled) {
      return { success: false, error: 'User cancelled' };
    }

    const asset = result.assets[0];
    
    return {
      success: true,
      data: asset.base64 || '',
      mimeType: asset.mimeType || 'image/jpeg',
      width: asset.width,
      height: asset.height,
      size: asset.base64?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pick image',
    };
  }
}

/**
 * 웹에서 전송한 base64 이미지 처리 예제
 */
async function processImageFromWeb(payload: any): Promise<{ success: boolean; savedPath?: string; error?: string }> {
  try {
    // base64 데이터 추출
    if (payload.image && payload.image.type === 'base64') {
      const { data, mimeType, name } = payload.image;
      
      // 파일 시스템에 저장
      const filename = name || `image_${Date.now()}.jpg`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(filepath, data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('[Camera] Image saved:', filepath);
      
      return {
        success: true,
        savedPath: filepath,
      };
    }

    return {
      success: false,
      error: 'Invalid image data',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process image',
    };
  }
}

// ========================================
// WebView 브릿지 핸들러
// ========================================

export const registerCameraHandlers = () => {
  // 카메라로 사진 촬영
  registerHandler('takePhoto', async (payload: PhotoOptions, respond) => {
    const result = await takePhoto(payload);
    respond(result);
  });

  // 갤러리에서 이미지 선택
  registerHandler('pickImage', async (payload: PhotoOptions, respond) => {
    const result = await pickImage(payload);
    respond(result);
  });

  // 웹에서 전송한 이미지 처리 (File 객체 등)
  registerHandler('uploadImage', async (payload, respond) => {
    const result = await processImageFromWeb(payload);
    respond(result);
  });

  console.log('[Bridge] Camera handlers registered');
};
