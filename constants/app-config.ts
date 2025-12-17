/**
 * 앱 환경설정 상수
 * 웹뷰 및 앱 전반적인 설정을 관리
 */

export const APP_CONFIG = {
  // 앱 기본 정보
  app: {
    name: 'RNWebWrapper',
    version: '1.0.0',
    bundleId: 'com.gdjs.rnwebwrapper',
  },

  // 웹뷰 설정
  webview: {
    // 메인 웹사이트 URL
    baseUrl: 'https://gdjs.link/',
    
    // 웹뷰 기본 옵션
    options: {
      // JavaScript 활성화
      javaScriptEnabled: true,
      // DOM 스토리지 활성화 (localStorage, sessionStorage)
      domStorageEnabled: true,
      // 서드파티 쿠키 허용
      thirdPartyCookiesEnabled: true,
      // 미디어 자동재생 허용
      mediaPlaybackRequiresUserAction: false,
      // 혼합 컨텐츠 허용 (HTTPS 페이지에서 HTTP 리소스)
      mixedContentMode: 'compatibility' as const,
      // 캐시 모드
      cacheEnabled: true,
      // 줌 허용
      scalesPageToFit: true,
      // 인라인 미디어 재생 허용 (iOS)
      allowsInlineMediaPlayback: true,
      // 백그라운드에서도 미디어 재생 (iOS)
      allowsBackForwardNavigationGestures: true,
      // 파일 접근 허용 (Android)
      allowFileAccess: true,
      // 유니버설 링크 허용 (Android)
      allowUniversalAccessFromFileURLs: false,
    },

    // 성능 최적화 옵션 (Android)
    performance: {
      // 레이어 타입: 'none' | 'software' | 'hardware'
      // 'hardware': GPU 사용, 애니메이션 부드러움
      androidLayerType: 'hardware' as 'none' | 'software' | 'hardware',
      // 렌더링 우선순위
      renderPriority: 'high' as 'high' | 'low',
      // 오버스크롤 모드
      overScrollMode: 'never' as 'always' | 'content' | 'never',
      // 텍스트 줌 고정 (100% = 변경없음)
      textZoom: 100,
      // 중첩 스크롤 비활성화
      nestedScrollEnabled: false,
      // 스크롤바 숨김
      hideScrollIndicators: true,
      // 풀스크린 비디오 허용
      allowsFullscreenVideo: true,
      // 자동 이미지 로드
      loadsImagesAutomatically: true,
      // 뷰포트 초기 스케일
      initialScale: 100,
      // 세이프에어리어 포함
      setSupportMultipleWindows: false,
      // 포커스 시 자동 줌 비활성화
      setUseWideViewPort: true,
    },

    // 커스텀 User-Agent
    userAgent: 'webapp-wrapper',

    // 허용된 URL 패턴 (보안)
    allowedUrlPatterns: [
      'https://gdjs.link',
      'https://*.gdjs.link',
    ],
  },

  // 네트워크 설정
  network: {
    // 요청 타임아웃 (ms)
    timeout: 30000,
    // 재시도 횟수
    retryCount: 3,
  },

  // 테마 설정
  theme: {
    // 상태바 스타일
    statusBarStyle: 'auto' as 'auto' | 'light' | 'dark',
    // 웹뷰 배경색
    webviewBackgroundColor: '#FFFFFF',
    // 로딩 인디케이터 색상
    loadingIndicatorColor: '#007AFF',
  },

  // 커스텀 스플래시 스크린 설정
  splash: {
    // 스플래시 활성화 여부
    enabled: true,
    // 최소 표시 시간 (ms) - 0이면 WebView 로드 즉시 숨김
    minDisplayTime: 1000,
    // 페이드 아웃 시간 (ms)
    fadeOutDuration: 300,
    // 배경색
    backgroundColor: '#ffffff',
    // 다크모드 배경색
    darkBackgroundColor: '#000000',
    // 로고 이미지 (null이면 텍스트만)
    logoImage: null as string | null,
    // 로딩 텍스트
    loadingText: '로딩 중...',
    // 로딩 인디케이터 표시
    showLoadingIndicator: true,
  },

  // 기능 플래그 (추후 확장용)
  features: {
    // Firebase 푸시 알림
    pushNotifications: false,
    // 앱 내 알림
    localNotifications: false,
    // 기기 제어 기능
    deviceControl: false,
    // 생체인증
    biometrics: false,
    // 딥링크
    deepLinking: false,
    // 오프라인 모드
    offlineMode: false,
  },
} as const;

// 타입 추출
export type AppConfig = typeof APP_CONFIG;
export type WebviewConfig = typeof APP_CONFIG.webview;
export type FeatureFlags = typeof APP_CONFIG.features;
