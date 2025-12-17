/**
 * Zustand 전역 상태 스토어
 * 모듈형 확장 가능한 설계
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import { APP_CONFIG } from '@/constants/app-config';
import type { WebViewNavigation } from 'react-native-webview';
import type {
    AppState,
    RootStore,
    WebviewError,
    WebviewState
} from './types';

// ============================================
// 초기 상태
// ============================================
const initialWebviewState: WebviewState = {
  currentUrl: APP_CONFIG.webview.baseUrl,
  isLoading: true,
  pageTitle: '',
  canGoBack: false,
  canGoForward: false,
  error: null,
  lastNavigation: null,
};

const initialAppState: AppState = {
  isInitialized: false,
  isActive: true,
  isOnline: true,
  theme: 'system',
};

// ============================================
// 스토어 생성
// ============================================
export const useAppStore = create<RootStore>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
        // ========== 웹뷰 상태 ==========
        ...initialWebviewState,

        setCurrentUrl: (url: string) => 
          set({ currentUrl: url }, false, 'webview/setCurrentUrl'),

        setIsLoading: (loading: boolean) => 
          set({ isLoading: loading }, false, 'webview/setIsLoading'),

        setPageTitle: (title: string) => 
          set({ pageTitle: title }, false, 'webview/setPageTitle'),

        setCanGoBack: (canGoBack: boolean) => 
          set({ canGoBack }, false, 'webview/setCanGoBack'),

        setCanGoForward: (canGoForward: boolean) => 
          set({ canGoForward }, false, 'webview/setCanGoForward'),

        setError: (error: WebviewError | null) => 
          set({ error }, false, 'webview/setError'),

        setLastNavigation: (navigation: WebViewNavigation | null) => 
          set({ lastNavigation: navigation }, false, 'webview/setLastNavigation'),

        resetWebviewState: () => 
          set({ ...initialWebviewState }, false, 'webview/reset'),

        // ========== 앱 상태 ==========
        ...initialAppState,

        setInitialized: (initialized: boolean) => 
          set({ isInitialized: initialized }, false, 'app/setInitialized'),

        setActive: (active: boolean) => 
          set({ isActive: active }, false, 'app/setActive'),

        setOnline: (online: boolean) => 
          set({ isOnline: online }, false, 'app/setOnline'),

        setTheme: (theme: 'light' | 'dark' | 'system') => 
          set({ theme }, false, 'app/setTheme'),

        // ========== 모듈 확장 시스템 ==========
        _modules: {},

        registerModule: <T>(moduleName: string, initialState: T) => {
          set(
            (state) => ({
              _modules: {
                ...state._modules,
                [moduleName]: initialState,
              },
            }),
            false,
            `modules/register/${moduleName}`
          );
        },
      })
    ),
    {
      name: 'RNWebWrapper-Store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================
// 선택적 셀렉터 (성능 최적화)
// ============================================

export const useWebviewState = () => useAppStore((state) => ({
  currentUrl: state.currentUrl,
  isLoading: state.isLoading,
  pageTitle: state.pageTitle,
  canGoBack: state.canGoBack,
  canGoForward: state.canGoForward,
  error: state.error,
}));

// 액션은 스토어에서 직접 가져오기 (안정적인 참조)
export const getWebviewActions = () => ({
  setCurrentUrl: useAppStore.getState().setCurrentUrl,
  setIsLoading: useAppStore.getState().setIsLoading,
  setPageTitle: useAppStore.getState().setPageTitle,
  setCanGoBack: useAppStore.getState().setCanGoBack,
  setCanGoForward: useAppStore.getState().setCanGoForward,
  setError: useAppStore.getState().setError,
  setLastNavigation: useAppStore.getState().setLastNavigation,
  resetWebviewState: useAppStore.getState().resetWebviewState,
});

export const useAppState = () => useAppStore((state) => ({
  isInitialized: state.isInitialized,
  isActive: state.isActive,
  isOnline: state.isOnline,
  theme: state.theme,
}));

export const getAppActions = () => ({
  setInitialized: useAppStore.getState().setInitialized,
  setActive: useAppStore.getState().setActive,
  setOnline: useAppStore.getState().setOnline,
  setTheme: useAppStore.getState().setTheme,
});
