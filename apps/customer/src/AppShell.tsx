import { PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLanguage } from './LanguageContext';
import { useRuntime } from './RuntimeContext';

export function AppShell({ children }: PropsWithChildren) {
  const { t } = useLanguage();
  const runtime = useRuntime();
  return (
    <View
      nativeID="routefit-app-shell"
      style={[styles.screen, { backgroundColor: runtime.backgroundColor }]}
    >
      <StatusBar style="dark" />
      {__DEV__ && Platform.OS === 'web' ? (
        <View accessibilityRole="text" style={[styles.modeBadge, { backgroundColor: runtime.accentColor }]} testID="customer-home-runtime-mode">
          <Text style={[styles.modeText, { color: runtime.buttonTextColor }]}>{runtime.mode === 'telegram' ? t('modeTelegram') : t('modeH5')}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: '100%',
  },
  modeBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
