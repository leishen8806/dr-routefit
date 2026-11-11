import { useState } from 'react';
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
  online: boolean;
  registrationReady: boolean;
  registration: DemoRegistration;
  onRegistrationChange: (next: DemoRegistration) => void;
  onTransition: (type: string, payload?: Record<string, unknown>) => void;
};

function Action({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export function DriverDemoScreens(props: DriverDemoScreenProps) {
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const t = (key: Parameters<typeof demoText>[1]) => demoText(props.language, key);
  const set = (field: keyof DemoRegistration, value: DemoRegistration[keyof DemoRegistration]) => {
    const registration = { ...props.registration, [field]: value } as DemoRegistration;
    props.onRegistrationChange(registration);
    props.onTransition('set_registration_ready', { registration });
  };
  const documentsSelected = Object.values(props.registration.documents).every(Boolean);
  const registrationReady = props.registrationReady;

  if (props.screen === 'login') {
    return <View style={styles.card}>
      <Text style={styles.title}>{t('signIn')}</Text>
      <TextInput accessibilityLabel={t('phone')} keyboardType="phone-pad" onChangeText={setPhone} placeholder={t('phone')} style={styles.input} value={phone} />
      <TextInput accessibilityLabel={t('verificationCode')} keyboardType="number-pad" onChangeText={setVerificationCode} placeholder={t('verificationCode')} style={styles.input} value={verificationCode} />
      <Text style={styles.caption}>{t('noPayment')}</Text>
      <Action label={t('signInDemo')} disabled={!phone.trim() || !verificationCode.trim()} onPress={() => props.onTransition('sign_in_demo')} />
      <Action label={t('register')} onPress={() => props.onTransition('start_registration')} secondary />
    </View>;
  }
  if (props.screen === 'registration_profile') return <View style={styles.card}><Text style={styles.title}>{t('profileStep')}</Text><TextInput accessibilityLabel={t('fullName')} onChangeText={(value) => set('fullName', value)} placeholder={t('fullName')} style={styles.input} value={props.registration.fullName} /><Action label={t('continue')} onPress={() => props.onTransition('continue_registration')} /></View>;
  if (props.screen === 'registration_vehicle') return <View style={styles.card}><Text style={styles.title}>{t('vehicleStep')}</Text><TextInput accessibilityLabel={t('vehicle')} onChangeText={(value) => set('vehicleType', value)} placeholder={t('vehicle')} style={styles.input} value={props.registration.vehicleType} /><TextInput accessibilityLabel={t('plate')} onChangeText={(value) => set('plateNumber', value)} placeholder={t('plate')} style={styles.input} value={props.registration.plateNumber} /><Action label={t('continue')} onPress={() => props.onTransition('continue_registration')} /></View>;
  if (props.screen === 'registration_documents') return <View style={styles.card}><Text style={styles.title}>{t('documentsStep')}</Text><Action label={documentsSelected ? t('documentsSelected') : t('uploadDemo')} onPress={() => set('documents', { idFront: true, idBack: true, license: true, vehicle: true })} secondary /><Action label={props.registration.acceptedTerms ? t('termsAccepted') : t('agree')} onPress={() => set('acceptedTerms', !props.registration.acceptedTerms)} secondary /><Action label={t('verifySampleDetails')} onPress={() => props.onTransition('set_registration_ready', { registration: props.registration })} secondary /><Text accessibilityRole="alert" style={registrationReady ? styles.ready : styles.caption}>{registrationReady ? t('registrationReady') : t('registrationIncomplete')}</Text><Action label={t('submitRegistration')} disabled={!registrationReady} onPress={() => props.onTransition('submit_registration')} /></View>;
  if (props.screen === 'review') return <View style={styles.card}><Text style={styles.title}>{t('reviewing')}</Text>{props.reviewState === 'needs_revision' ? <Action label={t('resubmit')} onPress={() => props.onTransition('resubmit_registration')} /> : null}{props.reviewState === 'submitted' ? <Action label={t('approveDemo')} onPress={() => props.onTransition('approve_demo')} /> : null}{props.reviewState === 'approved' ? <Action label={t('goOnline')} onPress={() => props.onTransition('show_offer')} /> : null}{props.reviewState === 'submitted' ? <Action label={t('requestRevision')} onPress={() => props.onTransition('return_review')} secondary /> : null}</View>;
  if (props.screen === 'offer') return <View style={styles.card}><Text style={styles.title}>{t('offer')}</Text><Text style={styles.caption}>{props.online ? t('online') : t('offline')}</Text><Text>{t('demoTripTitle')}</Text><Action label={props.online ? t('goOffline') : t('goOnline')} onPress={() => props.onTransition(props.online ? 'go_offline' : 'go_online')} secondary /><Action label={t('accept')} disabled={!props.online} onPress={() => props.onTransition('accept_offer')} /><Action label={t('decline')} onPress={() => props.onTransition('decline_offer')} secondary /><Action label={t('navTrips')} onPress={() => props.onTransition('show_trips')} secondary /><Action label={t('navWallet')} onPress={() => props.onTransition('show_wallet')} secondary /><Action label={t('navProfile')} onPress={() => props.onTransition('show_profile')} secondary /></View>;
  if (props.screen === 'trips') return <View style={styles.card}><Text style={styles.title}>{t('trips')}</Text><Text>{t('demoTripTitle')}</Text><Action label={t('viewDetail')} onPress={() => props.onTransition('open_trip', { trips: [{ id: 'sample-trip-1' }], tripId: 'sample-trip-1' })} secondary /><Action label={t('navHome')} onPress={() => props.onTransition('show_offer')} secondary /><Action label={t('navWallet')} onPress={() => props.onTransition('show_wallet')} secondary /><Action label={t('navProfile')} onPress={() => props.onTransition('show_profile')} secondary /></View>;
  if (props.screen === 'trip_detail') return <View style={styles.card}><Text style={styles.title}>{t('tripDetail')}</Text><Text>{t('pickup')}</Text><Text>{t('dropoff')}</Text><Action label={t('back')} onPress={() => props.onTransition('show_trips')} secondary /></View>;
  if (props.screen === 'withdrawal_confirm') return <View style={styles.card}><Text style={styles.title}>{t('withdraw')}</Text><Text style={styles.caption}>{t('withdrawConfirm')}</Text><Action label={t('withdrawConfirm')} onPress={() => props.onTransition('confirm_withdrawal')} /><Action label={t('back')} onPress={() => props.onTransition('cancel_withdrawal')} secondary /></View>;
  if (props.screen === 'wallet') return <View style={styles.card}><Text style={styles.title}>{t('wallet')}</Text><Text style={styles.caption}>{t('sample')}</Text>{props.withdrawalState === 'submitted' ? <Text>{t('withdrawSubmitted')}</Text> : null}<Action label={t('withdraw')} onPress={() => props.onTransition('start_withdrawal')} /><Action label={t('navHome')} onPress={() => props.onTransition('show_offer')} secondary /><Action label={t('navTrips')} onPress={() => props.onTransition('show_trips')} secondary /><Action label={t('navProfile')} onPress={() => props.onTransition('show_profile')} secondary /></View>;
  if (props.screen === 'profile') return <View style={styles.card}><Text style={styles.title}>{t('profile')}</Text><Text>{props.registration.fullName || t('fullName')}</Text><Text style={styles.caption}>{t('sample')}</Text><Action label={t('navHome')} onPress={() => props.onTransition('show_offer')} secondary /><Action label={t('navWallet')} onPress={() => props.onTransition('show_wallet')} secondary /><Action label={t('navTrips')} onPress={() => props.onTransition('show_trips')} secondary /></View>;
  return <View style={styles.card}><Text style={styles.title}>{t('appName')}</Text><Text style={styles.caption}>{t('sample')}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, gap: 12, padding: 18 }, title: { color: '#12324a', fontSize: 22, fontWeight: '700' }, caption: { color: '#536574', lineHeight: 20 }, ready: { color: '#176b50', fontWeight: '600' }, input: { borderColor: '#d7e1e8', borderRadius: 10, borderWidth: 1, minHeight: 48, padding: 12 }, button: { alignItems: 'center', backgroundColor: '#176b50', borderRadius: 12, justifyContent: 'center', minHeight: 48, padding: 12 }, buttonText: { color: '#fff', fontWeight: '600' }, secondary: { backgroundColor: '#e8eef3' }, secondaryText: { color: '#12324a' }, disabled: { opacity: 0.45 },
});
