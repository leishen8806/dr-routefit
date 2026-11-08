import { Stack } from 'expo-router';
import { AppShell } from '../src/AppShell';
import { LanguageProvider } from '../src/LanguageContext';
import { RuntimeProvider } from '../src/RuntimeContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <RuntimeProvider>
        <AppShell>
          <Stack screenOptions={{ headerShown: false }} />
        </AppShell>
      </RuntimeProvider>
    </LanguageProvider>
  );
}
