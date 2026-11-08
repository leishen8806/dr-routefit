function hasTelegramSignal(location) {
  const value = `${location?.search ?? ''}${location?.hash ?? ''}`;
  return value.includes('tgWebAppData=');
}

export function detectRuntime({ location, telegram }) {
  return telegram?.WebApp || hasTelegramSignal(location) ? 'telegram' : 'h5';
}

export function shouldLoadTelegramScript({ location, telegram }) {
  return !telegram?.WebApp && hasTelegramSignal(location);
}

export function activateTelegram(telegram) {
  const webApp = telegram?.WebApp;
  if (!webApp) return { activated: false, themeParams: {} };
  webApp.ready?.();
  webApp.expand?.();
  return { activated: true, themeParams: webApp.themeParams ?? {} };
}
