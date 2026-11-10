import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { demoText, type DemoLanguage } from './src/demo-copy';
import { createDemoDriverFlow, transitionDemoDriverFlow } from './src/demo-driver-flow.mjs';

const languages: DemoLanguage[] = ['zh-Hans', 'en', 'km'];
const languageLabels: Record<DemoLanguage, string> = { 'zh-Hans': '中文', en: 'English', km: 'ខ្មែរ' };
const sampleRegistration = {
  fullName: 'Sample Driver',
  vehicleType: 'box_truck',
  plateNumber: '2BB-4471',
  documents: { idFront: true, idBack: true, license: true, vehicle: true },
  acceptedTerms: true,
};

export default function App() {
  const [language, setLanguage] = useState<DemoLanguage>('zh-Hans');
  const [flow, setFlow] = useState(createDemoDriverFlow);
  const t = (key: Parameters<typeof demoText>[1]) => demoText(language, key);
  const act = (type: string, tripId?: string, registration?: typeof sampleRegistration) => setFlow((current) => transitionDemoDriverFlow(current, { type, tripId, registration }));
  const registration = flow.screen.startsWith('registration_');

  const action = (label: string, type: string, style = styles.primary, tripId?: string) => <Pressable accessibilityRole="button" onPress={() => act(type, tripId)} style={style}><Text style={styles.buttonText}>{label}</Text></Pressable>;

  return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><Text style={styles.brand}>{t('appName')}</Text><Text style={styles.badge}>{t('sample')}</Text></View>
    <View style={styles.languageRow}><Text style={styles.muted}>{t('language')}</Text>{languages.map((code) => <Pressable key={code} onPress={() => setLanguage(code)} style={[styles.language, language === code && styles.languageActive]}><Text>{languageLabels[code]}</Text></Pressable>)}</View>
    {flow.screen === 'login' && <Card title={t('signIn')}><Text style={styles.muted}>{t('noPayment')}</Text>{action(t('register'), 'start_registration')}</Card>}
    {registration && <Card title={flow.screen === 'registration_profile' ? t('profileStep') : flow.screen === 'registration_vehicle' ? t('vehicleStep') : t('documentsStep')}>
      <Text style={styles.field}>{flow.screen === 'registration_profile' ? t('fullName') : flow.screen === 'registration_vehicle' ? t('vehicle') : t('uploadDemo')}</Text>
      <Text style={styles.field}>{flow.screen === 'registration_vehicle' ? t('plate') : flow.screen === 'registration_documents' ? t('agree') : t('sample')}</Text>
      {flow.screen === 'registration_documents' ? <><Text style={styles.notice}>{t('registrationReady')}</Text><Pressable accessibilityRole="button" onPress={() => act('set_registration_ready', undefined, sampleRegistration)} style={styles.secondary}><Text style={styles.buttonText}>{t('verifySampleDetails')}</Text></Pressable>{action(t('submitRegistration'), 'submit_registration')}</> : action(t('continue'), 'continue_registration')}</Card>}
    {flow.screen === 'review' && <Card title={t('reviewing')}><Text style={styles.muted}>{t('sample')}</Text>{action(t('approveDemo'), 'approve_demo')}</Card>}
    {flow.screen === 'offer' && <Card title={t('offer')}><Text style={styles.title}>{t('demoTripTitle')}</Text><Text>{t('pickup')}</Text><Text>{t('dropoff')}</Text>{action(t('accept'), 'accept_offer')}</Card>}
    {flow.screen === 'trips' && <Card title={t('trips')}><Text style={styles.title}>{t('demoTripTitle')}</Text><Text style={styles.muted}>{t('online')}</Text>{action(t('viewDetail'), 'open_trip', styles.primary, 'sample-trip-1')}</Card>}
    {flow.screen === 'trip_detail' && <Card title={t('tripDetail')}><Text style={styles.title}>{t('demoTripTitle')}</Text><Text>{t('pickup')}</Text><Text>{t('dropoff')}</Text>{action(t('back'), 'show_trips', styles.secondary)}</Card>}
    {flow.screen === 'profile' && <Card title={t('profile')}><Text style={styles.muted}>{t('noPayment')}</Text>{flow.withdrawalState === 'submitted' && <Text style={styles.notice}>{t('withdrawSubmitted')}</Text>}{action(t('withdraw'), 'start_withdrawal')}</Card>}
    {flow.screen === 'withdrawal_confirm' && <Card title={t('withdraw')}><Text style={styles.notice}>{t('withdrawConfirm')}</Text>{action(t('withdrawConfirm'), 'confirm_withdrawal')}</Card>}
    {['review', 'trips', 'trip_detail', 'profile'].includes(flow.screen) && <View style={styles.nav}><Pressable onPress={() => setFlow((f) => ({ ...f, screen: 'trips' }))} style={styles.navItem}><Text>{t('navTrips')}</Text></Pressable><Pressable onPress={() => setFlow((f) => ({ ...f, screen: 'profile' }))} style={styles.navItem}><Text>{t('navProfile')}</Text></Pressable></View>}
    {flow.screen === 'review' && action(t('goOnline'), 'show_offer')}
  </ScrollView></SafeAreaView>;
}

function Card({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{children}</View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f6f8fb' }, page: { padding: 20, gap: 16, paddingBottom: 36 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brand: { fontSize: 20, fontWeight: '600', color: '#12324a' }, badge: { color: '#176b50', fontWeight: '600' }, languageRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, language: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#e8eef3' }, languageActive: { backgroundColor: '#cdebdc' }, card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 12, shadowColor: '#12324a', shadowOpacity: 0.06, shadowRadius: 8 }, cardTitle: { fontSize: 22, fontWeight: '600', color: '#12324a' }, title: { fontSize: 17, fontWeight: '600' }, field: { minHeight: 44, borderWidth: 1, borderColor: '#d7e1e8', borderRadius: 10, padding: 12 }, primary: { minHeight: 48, borderRadius: 12, backgroundColor: '#176b50', alignItems: 'center', justifyContent: 'center', padding: 12 }, secondary: { minHeight: 48, borderRadius: 12, backgroundColor: '#e8eef3', alignItems: 'center', justifyContent: 'center', padding: 12 }, buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center' }, muted: { color: '#536574', lineHeight: 20 }, notice: { color: '#176b50', fontWeight: '500' }, nav: { flexDirection: 'row', gap: 12 }, navItem: { minHeight: 44, flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e8eef3', borderRadius: 10 } });
