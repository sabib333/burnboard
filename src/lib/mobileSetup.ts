/**
 * Mobile App Setup - Capacitor initialization
 *
 * Sets up:
 * - Status bar (dark style, custom background)
 * - Splash screen dismiss
 * - App lifecycle listeners
 */

import { Capacitor } from '@capacitor/core';

/** Initialize status bar for Android */
export async function setupStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
    // Overlap web content for full-bleed look
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch (err) {
    console.warn('[MobileSetup] StatusBar error:', err);
  }
}

/** Hide the Capacitor splash screen after app loads */
export async function hideSplashScreen(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (err) {
    console.warn('[MobileSetup] SplashScreen error:', err);
  }
}

/** Setup app back button handler (Android) */
export function setupBackButton(onBack: () => void): void {
  if (!Capacitor.isNativePlatform()) return;

  try {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          onBack();
        }
      });
    });
  } catch (err) {
    console.warn('[MobileSetup] BackButton error:', err);
  }
}

/** Check for app version updates */
export async function checkForUpdates(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return info.version;
  } catch {
    return null;
  }
}

/** Run all mobile setup tasks */
export async function initMobileApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  console.log('[Mobile] Initializing native app...');
  await setupStatusBar();
  await hideSplashScreen();

  // Set up back button
  setupBackButton(() => {
    // On back from root, minimize app or do nothing
    console.log('[Mobile] Back button pressed at root');
  });

  console.log('[Mobile] Native app initialized');
}
