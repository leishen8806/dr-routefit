import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../src/LanguageContext';
import { useTelegramBackButton } from '../src/RuntimeContext';
import { createCustomerExperience } from '../src/customerExperience.mjs';

export default function TrackPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const goBack = useCallback(() => router.back(), [router]);
  const experience = useMemo(() => createCustomerExperience(), []);
  const tracking = experience.findRecipientTracking('EXAMPLE-CUSTOMER-001');
  useTelegramBackButton(goBack);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: `${t('appName')} · ${t('trackTitle')}` }} />
      <View style={styles.mark}><Text style={styles.markText}>↗</Text></View>
      <Text style={[styles.title, language === 'km' && styles.khmer]}>{t('trackTitle')}</Text>
      <Text style={[styles.body, language === 'km' && styles.khmer]}>{t('trackBody')}</Text>
      {tracking ? (
        <View style={styles.card} testID="customer-track-recipient-example">
          <Text style={[styles.example, language === 'km' && styles.khmer]}>{t('example')}</Text>
          <Text style={[styles.body, styles.cardText, language === 'km' && styles.khmer]}>{t('tracking')}</Text>
          <View style={styles.stops}>
            {tracking.stops.map((stop, index) => <View key={stop.state} style={[styles.stop, stop.active && styles.stopActive, index === tracking.stops.length - 1 && styles.stopLast]} />)}
          </View>
          <View style={styles.summary}>
            <Text style={[styles.summaryText, language === 'km' && styles.khmer]}>{t('quote')}</Text>
            <Text style={[styles.summaryText, language === 'km' && styles.khmer]}>{t('cod')}</Text>
          </View>
        </View>
      ) : null}
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
  card: { borderColor: '#D7DEE8', borderLeftColor: '#13C29B', borderLeftWidth: 4, borderRadius: 12, borderWidth: 1, marginTop: 24, padding: 20, width: '100%' },
  example: { color: '#0B2545', fontSize: 13, fontWeight: '600' },
  cardText: { textAlign: 'left' },
  stops: { flexDirection: 'row', marginTop: 20 },
  stop: { backgroundColor: '#D7DEE8', flex: 1, height: 6, marginRight: 6 },
  stopActive: { backgroundColor: '#F5A623' },
  stopLast: { marginRight: 0 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  summaryText: { color: '#0B2545', fontSize: 14, fontWeight: '500' },
  khmer: { lineHeight: 32 },
  link: { color: '#1D5FBF', fontSize: 16, fontWeight: '700', marginTop: 28, paddingHorizontal: 18, paddingVertical: 12 },
});
