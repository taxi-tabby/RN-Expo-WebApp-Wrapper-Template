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
    baseUrl: 'https://anilife.app/',
    
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

  // 오프라인 화면 설정
  offline: {
    // 오프라인 감지 활성화
    enabled: true,
    // 오프라인 화면 제목
    title: '인터넷 연결 없음',
    // 오프라인 화면 메시지
    message: '네트워크 연결을 확인해주세요.\nWi-Fi 또는 모바일 데이터가\n활성화되어 있는지 확인하세요.',
    // 재시도 버튼 텍스트
    retryButtonText: '다시 시도',
    // 배경색
    backgroundColor: '#ffffff',
    // 다크모드 배경색
    darkBackgroundColor: '#1a1a1a',
    // 자동 재연결 시도 (온라인 복구 시 자동 새로고침)
    autoReconnect: true,
  },

  // 상태바 & SafeArea 설정
  statusBar: {
    // 상태바 표시 여부
    visible: true,
    // 상태바 스타일: 'auto' | 'light' | 'dark'
    // 'light': 흰색 아이콘 (어두운 배경일 때)
    // 'dark': 검은색 아이콘 (밝은 배경일 때)
    // 'auto': 시스템 테마에 따름
    style: 'light' as 'auto' | 'light' | 'dark',

    // 상태바와 웹뷰 겹침 여부
    // true: 웹뷰가 상태바 영역까지 확장됨 (G-Market 스타일)
    // false: 웹뷰가 상태바 아래부터 시작 (일반적인 앱)
    overlapsWebView: false,

    // 상태바 오버레이 표시 (웹뷰 위에 반투명 배경, overlapsWebView가 true일 때만 유효)
    showOverlay: true,

    // 상태바 오버레이 색상 (반투명 검정 등)
    // rgba 또는 8자리 Hex 사용
    overlayColor: 'rgba(0,0,0,0.5)',

    // 상태바 반투명 여부 (Android) - overlapsWebView와 함께 사용
    translucent: true,
  },

  // 하단 네비게이션 바 설정 (Android 전용)
  navigationBar: {
    // 네비게이션 바 표시 모드
    // 'visible': 항상 표시
    // 'hidden': 숨김 (스와이프로 나타남)
    visibility: 'hidden' as 'visible' | 'hidden',
    
    // 숨김 시 동작 방식 (visibility가 'hidden'일 때만 유효)
    // 'overlay-swipe': 스와이프하면 오버레이로 나타남 (컨텐츠 유지)
    // 'inset-swipe': 스와이프하면 나타남 (컨텐츠 밀림)
    behavior: 'overlay-swipe' as 'overlay-swipe' | 'inset-swipe',
    
    // 네비게이션 바 배경색 (Hex)
    backgroundColor: '#ffffff',
    
    // 다크모드 네비게이션 바 배경색
    darkBackgroundColor: '#000000',
    
    // 네비게이션 바 버튼 스타일
    // 'light': 밝은 버튼 (어두운 배경용)
    // 'dark': 어두운 버튼 (밝은 배경용)
    buttonStyle: 'dark' as 'light' | 'dark',
  },

  // SafeArea 설정
  safeArea: {
    // SafeArea 사용 여부 (false면 웹뷰가 상태바 뒤까지 확장)
    enabled: false,
    // 적용할 영역: 'all' | 'top' | 'bottom' | 'none'
    edges: 'none' as 'all' | 'top' | 'bottom' | 'none',
    // SafeArea 배경색
    backgroundColor: '#ffffff',
    // 다크모드 SafeArea 배경색
    darkBackgroundColor: '#000000',
  },

  // 테마 설정
  theme: {
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

  // 디버그 설정
  debug: {
    // 디버그 모드 활성화 (웹뷰 위에 로그 오버레이 표시)
    enabled: true,
    // 최대 로그 라인 수
    maxLogLines: 50,
    // 로그 오버레이 투명도 (0-1)
    overlayOpacity: 0.85,
    // 로그 폰트 크기
    fontSize: 11,
    // 로그 레벨 색상
    colors: {
      info: '#3498db',
      warn: '#f39c12',
      error: '#e74c3c',
      success: '#27ae60',
      event: '#9b59b6',
    },
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
