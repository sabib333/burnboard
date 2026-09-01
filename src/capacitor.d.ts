declare module '@capacitor/haptics' {
  export const Haptics: { vibrate: (options: { duration: number }) => Promise<void> };
}
declare module '@capacitor/core' {
  export const Capacitor: { isNative: boolean; isNativePlatform: () => boolean; getPlatform: () => string };
}
declare module '@capacitor/status-bar' {
  export const StatusBar: { setStyle: (options: any) => Promise<void>; setBackgroundColor: (options: any) => Promise<void>; setOverlaysWebView: (options: any) => Promise<void> };
  export const Style: { Dark: string; Light: string };
}
declare module '@capacitor/splash-screen' {
  export const SplashScreen: { hide: () => Promise<void> };
}
declare module '@capacitor/app' {
  export const App: {
    addListener: (event: string, cb: (...args: any[]) => void) => Promise<{ remove: () => void }>;
    getState: () => Promise<{ isActive: boolean }>;
    getInfo: () => Promise<{ version: string }>;
  };
}
declare module '@capacitor/network' {
  export const Network: {
    getStatus: () => Promise<{ connected: boolean }>;
    addListener: (event: string, cb: (status: { connected: boolean }) => void) => Promise<{ remove: () => void }>;
  };
}
