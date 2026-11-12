import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { designTokens } from '@routefit/shared';
import { activateTelegram, detectRuntime, shouldLoadTelegramScript } from './runtime.mjs';

type TelegramBackButton = {
  hide?: () => void;
  offClick?: (handler: () => void) => void;
  onClick?: (handler: () => void) => void;
  show?: () => void;
};

type TelegramWebApp = {
  BackButton?: TelegramBackButton;
  contentSafeAreaInset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  expand?: () => void;
  ready?: () => void;
  safeAreaInset?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  themeParams?: Record<string, string>;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type RuntimeContextValue = {
  mode: 'h5' | 'telegram';
  webApp?: TelegramWebApp;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  surfaceColor: string;
  mutedColor: string;
  buttonTextColor: string;
};

const DEFAULT_RUNTIME: RuntimeContextValue = {
  mode: 'h5',
  backgroundColor: designTokens.color.background,
  textColor: designTokens.color.ink,
  accentColor: designTokens.color.teal,
  surfaceColor: designTokens.color.surface,
  mutedColor: designTokens.color.muted,
  buttonTextColor: designTokens.color.surface,
};

const RuntimeContext = createContext(DEFAULT_RUNTIME);

function activateCurrentTelegram(setRuntime: (runtime: RuntimeContextValue) => void) {
  const telegram = window.Telegram;
  const result = activateTelegram(telegram);
  if (!result.activated) return;
  const webApp = telegram?.WebApp;
  const safe = webApp?.safeAreaInset ?? {};
  const contentSafe = webApp?.contentSafeAreaInset ?? {};
  const root = document.documentElement;
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    root.style.setProperty(`--tg-safe-area-inset-${side}`, `${safe[side] ?? 0}px`);
    root.style.setProperty(`--tg-content-safe-area-inset-${side}`, `${contentSafe[side] ?? 0}px`);
  }
  setRuntime({
    mode: 'telegram',
    webApp,
    backgroundColor: result.themeParams.bg_color ?? DEFAULT_RUNTIME.backgroundColor,
    textColor: result.themeParams.text_color ?? DEFAULT_RUNTIME.textColor,
    accentColor: result.themeParams.button_color ?? DEFAULT_RUNTIME.accentColor,
    surfaceColor: result.themeParams.secondary_bg_color ?? DEFAULT_RUNTIME.surfaceColor,
    mutedColor: result.themeParams.hint_color ?? DEFAULT_RUNTIME.mutedColor,
    buttonTextColor: result.themeParams.button_text_color ?? DEFAULT_RUNTIME.buttonTextColor,
  });
}

export function RuntimeProvider({ children }: PropsWithChildren) {
  const [runtime, setRuntime] = useState(DEFAULT_RUNTIME);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const input = { location: window.location, telegram: window.Telegram };
    const mode = detectRuntime(input);
    if (mode === 'h5') return;
    if (window.Telegram?.WebApp) {
      activateCurrentTelegram(setRuntime);
      return;
    }
    if (!shouldLoadTelegramScript(input)) return;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.dataset.routefitTelegram = 'official';
    script.addEventListener('load', () => activateCurrentTelegram(setRuntime), { once: true });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return <RuntimeContext.Provider value={useMemo(() => runtime, [runtime])}>{children}</RuntimeContext.Provider>;
}

export function useRuntime() {
  return useContext(RuntimeContext);
}

export function useTelegramBackButton(handler: () => void) {
  const { webApp } = useRuntime();
  useEffect(() => {
    const button = webApp?.BackButton;
    if (!button) return;
    button.onClick?.(handler);
    button.show?.();
    return () => {
      button.offClick?.(handler);
      button.hide?.();
    };
  }, [handler, webApp]);
}
