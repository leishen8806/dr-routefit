import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { demoText, type DemoLanguage } from './demo-copy';

export type DemoRegistration = {
  fullName: string;
  vehicleType: string;
  plateNumber: string;
  acceptedTerms: boolean;
  documents: { idFront: boolean; idBack: boolean; license: boolean; vehicle: boolean };
};

export type DriverDemoScreenProps = {
  language: DemoLanguage;
  screen: string;
  reviewState: string;
  withdrawalState: string;
  registration: DemoRegistration;
  onRegistrationChange: (next: DemoRegistration) => void;
  onTransition: (type: string, payload?: Record<string, unknown>) => void;
};

function Action({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, secondary && styles.secondary]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

export function DriverDemoScreens(props: DriverDemoScreenProps) {
  const t = (key: Parameters<typeof demoText>[1]) => demoText(props.language, key);
  const set = (field: keyof DemoRegistration, value: string | boolean) => props.onRegistrationChange({ ...props.registration, [field]: value });

  if (props.screen === 'login') return <View style={styles.card}><Text style={styles.title}>{t('signIn')}</Text><Text style={styles.caption}>{t('noPayment')}</Text><Action label={t('register')} onPress={() => props.onTransition('start_registration')} /></View>;
  if (props.screen === 'registration_profile') return <View style={styles.card}><Text style={styles.title}>{t('profileStep')}</Text><TextInput accessibilityLabel={t('fullName')} onChangeText={(value) => set('fullName', value)} placeholder={t('fullName')} style={styles.input} value={props.registration.fullName} /><Action label={t('continue')} onPress={() => props.onTransition('continue_registration')} /></View>;
  if (props.screen === 'registration_vehicle') return <View style={styles.card}><Text style={styles.title}>{t('vehicleStep')}</Text><TextInput accessibilityLabel={t('vehicle')} onChangeText={(value) => set('vehicleType', value)} placeholder={t('vehicle')} style={styles.input} value={props.registration.vehicleType} /><TextInput accessibilityLabel={t('plate')} onChangeText={(value) => set('plateNumber', value)} placeholder={t('plate')} style={styles.input} value={props.registration.plateNumber} /><Action label={t('continue')} onPress={() => props.onTransition('continue_registration')} /></View>;
  if (props.screen === 'registration_documents') return <View style={styles.card}><Text style={styles.title}>{t('documentsStep')}</Text><Action label={t('uploadDemo')} onPress={() => props.onRegistrationChange({ ...props.registration, documents: { idFront: true, idBack: true, license: true, vehicle: true } })} secondary /><Action label={t('agree')} onPress={() => set('acceptedTerms', !props.registration.acceptedTerms)} secondary /><Action label={t('verifySampleDetails')} onPress={() => props.onTransition('set_registration_ready', { registration: props.registration })} secondary /><Action label={t('submitRegistration')} onPress={() => props.onTransition('submit_registration')} /></View>;
  if (props.screen === 'review') return <View style={styles.card}><Text style={styles.title}>{t('reviewing')}</Text>{props.reviewState === 'needs_revision' ? <Action label={t('continue')} onPress={() => props.onTransition('resubmit_registration')} /> : <Action label={t('approveDemo')} onPress={() => props.onTransition('approve_demo')} />}{props.reviewState === 'submitted' ? <Action label={t('back')} onPress={() => props.onTransition('return_review')} secondary /> : null}</View>;
  if (props.screen === 'offer') return <View style={styles.card}><Text style={styles.title}>{t('offer')}</Text><Text>{t('demoTripTitle')}</Text><Action label={t('accept')} onPress={() => props.onTransition('accept_offer')} /><Action label={t('navProfile')} onPress={() => props.onTransition('show_profile')} secondary /></View>;
  if (props.screen === 'trips') return <View style={styles.card}><Text style={styles.title}>{t('trips')}</Text><Text>{t('demoTripTitle')}</Text><Action label={t('viewDetail')} onPress={() => props.onTransition('open_trip', { trips: [{ id: 'sample-trip-1' }], tripId: 'sample-trip-1' })} secondary /><Action label={t('navProfile')} onPress={() => props.onTransition('show_profile')} secondary /></View>;
  if (props.screen === 'trip_detail') return <View style={styles.card}><Text style={styles.title}>{t('tripDetail')}</Text><Text>{t('pickup')}</Text><Text>{t('dropoff')}</Text><Action label={t('back')} onPress={() => props.onTransition('show_trips')} secondary /></View>;
  if (props.screen === 'withdrawal_confirm') return <View style={styles.card}><Text style={styles.title}>{t('withdraw')}</Text><Text style={styles.caption}>{t('withdrawConfirm')}</Text><Action label={t('withdrawConfirm')} onPress={() => props.onTransition('confirm_withdrawal')} /><Action label={t('back')} onPress={() => props.onTransition('cancel_withdrawal')} secondary /></View>;
  return <View style={styles.card}><Text style={styles.title}>{t('profile')}</Text><Text>{t('fullName')}</Text><Text style={styles.caption}>{t('sample')}</Text>{props.withdrawalState === 'submitted' ? <Text>{t('withdrawSubmitted')}</Text> : null}<Action label={t('withdraw')} onPress={() => props.onTransition('start_withdrawal')} /><Action label={t('navTrips')} onPress={() => props.onTransition('show_trips')} secondary /></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, gap: 12, padding: 18 },
  title: { color: '#12324a', fontSize: 22, fontWeight: '700' },
  caption: { color: '#536574', lineHeight: 20 },
  input: { borderColor: '#d7e1e8', borderRadius: 10, borderWidth: 1, minHeight: 48, padding: 12 },
  button: { alignItems: 'center', backgroundColor: '#176b50', borderRadius: 12, justifyContent: 'center', minHeight: 48, padding: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondary: { backgroundColor: '#e8eef3' },
  secondaryText: { color: '#12324a' },
});
