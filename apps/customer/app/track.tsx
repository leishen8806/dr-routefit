import { Link, Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../src/LanguageContext';
import { useTelegramBackButton } from '../src/RuntimeContext';

export default function TrackPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const goBack = useCallback(() => router.back(), [router]);
  useTelegramBackButton(goBack);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: `${t('appName')} · ${t('trackTitle')}` }} />
      <View style={styles.mark}><Text style={styles.markText}>↗</Text></View>
      <Text style={[styles.title, language === 'km' && styles.khmer]}>{t('trackTitle')}</Text>
      <Text style={[styles.body, language === 'km' && styles.khmer]}>{t('trackBody')}</Text>
      <Link accessibilityRole="link" href="/" style={styles.link}>{t('back')}</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', alignSelf: 'center', flex: 1, justifyContent: 'center', maxWidth: 760, padding: 28, width: '100%' },
  mark: { alignItems: 'center', backgroundColor: '#0B2545', borderRadius: 18, height: 72, justifyContent: 'center', width: 72 },
  markText: { color: '#13C29B', fontSize: 38, fontWeight: '800' },
  title: { color: '#0B2545', fontSize: 28, fontWeight: '700', lineHeight: 42, marginTop: 24, textAlign: 'center' },
  body: { color: '#5B6B7F', fontSize: 16, lineHeight: 28, marginTop: 12, textAlign: 'center' },
  khmer: { lineHeight: 32 },
  link: { color: '#1D5FBF', fontSize: 16, fontWeight: '700', marginTop: 28, paddingHorizontal: 18, paddingVertical: 12 },
});
