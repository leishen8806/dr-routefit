import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { developmentSessionAuth } from './src/development-auth';
import {
  actOnAssignment,
  DriverApiError,
  getAssignment,
  getDriverOrder,
  listAssignments,
  syncDriverEvent,
  type AssignmentDetail,
  type DriverArrivedEvent,
  type DriverAction,
  type DriverAssignment,
  type DriverLanguage,
  type DriverOrderDetail,
} from './src/driver-api';
import { errorText, languageOptions, text, type MessageKey } from './src/messages';
import { openOfflineEventQueue } from './src/offline-queue.mjs';
import { createOfflineQueueStore } from './src/offline-store';
import { rejectConfirmationStep } from './src/task-actions.mjs';

export default function App() {
  const [language, setLanguage] = useState<DriverLanguage>('zh-Hans');
  const [token, setToken] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [assignments, setAssignments] = useState<DriverAssignment[] | null>(null);
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [order, setOrder] = useState<DriverOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState<'list' | 'detail' | ''>('');
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectArmed, setRejectArmed] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [pendingEvents, setPendingEvents] = useState(0);
  const [quarantinedEvents, setQuarantinedEvents] = useState(0);
  const [queueReady, setQueueReady] = useState(false);
  const [queueFailed, setQueueFailed] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const actionInFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Awaited<ReturnType<typeof openOfflineEventQueue>> | null>(null);

  const t = (key: Parameters<typeof text>[1]) => text(language, key);
  const auth = () => developmentSessionAuth(token, csrfToken);

  function refreshQueue(queue = queueRef.current) {
    if (!queue) return;
    const snapshot = queue.snapshot();
    setPendingEvents(snapshot.events.length);
    setQuarantinedEvents(snapshot.quarantined.length);
  }

  useEffect(() => {
    let active = true;
    openOfflineEventQueue(createOfflineQueueStore())
      .then((queue) => {
        if (!active) return;
        queueRef.current = queue;
        setQueueReady(true);
        refreshQueue(queue);
      })
      .catch(() => {
        if (active) setQueueFailed(true);
      });
    return () => {
      active = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  function displayError(cause: unknown, fallback: MessageKey) {
    if (cause instanceof DriverApiError) {
      return errorText(language, cause.code) ?? cause.serverMessage ?? t(fallback);
    }
    return cause instanceof Error ? cause.message : t(fallback);
  }

  async function refreshAssignments(clearError = true) {
    setLoading('list');
    if (clearError) setError('');
    try {
      const page = await listAssignments(auth(), language);
      setAssignments(page.items);
    } catch (cause) {
      setAssignments(null);
      setError(displayError(cause, 'taskReadFailed'));
    } finally {
      setLoading('');
    }
  }

  async function openDetails(assignmentId: string, clearError = true) {
    setLoading('detail');
    if (clearError) setError('');
    setNotice('');
    setRejectArmed(false);
    try {
      const nextDetail = await getAssignment(auth(), language, assignmentId);
      const nextOrder = await getDriverOrder(auth(), language, nextDetail.assignment.orderId);
      setDetail(nextDetail);
      setOrder(nextOrder);
    } catch (cause) {
      setDetail(null);
      setOrder(null);
      setError(displayError(cause, 'taskReadFailed'));
    } finally {
      setLoading('');
    }
  }

  async function submitAction(action: DriverAction) {
    if (!detail || actionInFlight.current) return;
    if (action === 'reject' && rejectConfirmationStep(rejectArmed) === 'confirm') {
      setRejectArmed(true);
      return;
    }
    if (action === 'reject' && !rejectReason.trim()) return;

    actionInFlight.current = true;
    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await actOnAssignment(
        auth(),
        language,
        detail,
        action,
        rejectReason.trim(),
      );
      setDetail({ assignment: updated, etag: `"${updated.version}"` });
      setRejectArmed(false);
      setRejectReason('');
      await refreshAssignments(false);
      if (action === 'accept') await openDetails(updated.id, false);
      setNotice(t(action === 'accept' ? 'accepted' : 'rejected'));
    } catch (cause) {
      const stale = cause instanceof DriverApiError && (cause.status === 409 || cause.status === 412);
      setError(displayError(cause, 'taskActionFailed'));
      if (stale) await openDetails(detail.assignment.id, false);
    } finally {
      actionInFlight.current = false;
      setActionBusy(false);
    }
  }

  async function navigate(point: DriverOrderDetail['pickup']['point']) {
    if (!point) return;
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${point.lat},${point.lng}`
      : `geo:${point.lat},${point.lng}?q=${point.lat},${point.lng}`;
    try {
      await Linking.openURL(url);
    } catch {
      setError(t('navigationUnavailable'));
    }
  }

  async function recordArrival() {
    if (!queueRef.current || !detail || !order?.delivery.point) return;
    setError('');
    setNotice('');
    try {
      await queueRef.current.enqueue({
        eventId: globalThis.crypto.randomUUID(),
        assignmentId: detail.assignment.id,
        assignmentVersion: detail.assignment.version,
        planVersion: detail.assignment.planVersion,
        observedAt: new Date().toISOString(),
        type: 'ARRIVED',
        payload: { point: order.delivery.point, evidenceFileIds: [] },
      });
      refreshQueue();
      setNotice(t('arrivalQueued'));
    } catch {
      setError(t('queueWriteFailed'));
    }
  }

  async function syncEvents() {
    if (!queueRef.current || syncBusy) return;
    setSyncBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await queueRef.current.replay((event: DriverArrivedEvent) =>
        syncDriverEvent(auth(), language, deviceId.trim(), event));
      refreshQueue();
      setNotice(t(result.delayed ? 'syncDelayed' : 'syncFinished'));
      if (result.delayed) {
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(syncEvents, result.retryAfterMs);
      }
    } catch (cause) {
      setError(displayError(cause, 'syncFailed'));
    } finally {
      setSyncBusy(false);
    }
  }

  const credentialsReady = token.trim().length >= 32 && csrfToken.trim().length >= 32;
  const deviceReady = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId.trim());
  const actionAvailable = detail?.assignment.state === 'offered';
  const arrivalAvailable = detail?.assignment.state === 'in_transit' && Boolean(order?.delivery.point) && queueReady;
  const itemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('appName')}</Text>
          <Text style={styles.title}>{t('title')}</Text>
          <Text style={styles.caption}>{t('caption')}</Text>
          <View style={styles.languages}>
            {languageOptions.map(({ code, label }) => (
              <Pressable
                accessibilityRole="button"
                key={code}
                onPress={() => setLanguage(code)}
                style={[styles.language, language === code && styles.languageActive]}
              >
                <Text>{label}</Text>
              </Pressable>
            ))}
          </View>
          {language === 'km' ? <Text style={styles.caption}>{t('kmPending')}</Text> : null}
        </View>

        <View style={styles.login}>
          <Text style={styles.label}>{t('tokenLabel')}</Text>
          <TextInput
            accessibilityLabel={t('tokenLabel')}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setToken}
            placeholder={t('secretPlaceholder')}
            secureTextEntry
            style={styles.input}
            value={token}
          />
          <Text style={styles.label}>{t('csrfLabel')}</Text>
          <TextInput
            accessibilityLabel={t('csrfLabel')}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setCsrfToken}
            placeholder={t('secretPlaceholder')}
            secureTextEntry
            style={styles.input}
            value={csrfToken}
          />
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(loading) || !credentialsReady}
            onPress={() => refreshAssignments()}
            style={({ pressed }) => [
              styles.button,
              (Boolean(loading) || !credentialsReady) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>{assignments ? t('refreshTasks') : t('connectTasks')}</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator accessibilityLabel={loading === 'list' ? t('loadingTasks') : t('loadingDetails')} size="large" /> : null}
        {queueFailed ? <Text accessibilityRole="alert" style={styles.error}>{t('queueLoadFailed')}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}

        {detail && order ? (
          <View style={styles.detail}>
            <Pressable accessibilityRole="button" onPress={() => { setDetail(null); setOrder(null); }} style={styles.linkButton}>
              <Text style={styles.linkText}>{t('backToList')}</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>{t('assignmentDetails')}</Text>
            <Text>{t('task')} {detail.assignment.id.slice(0, 8)}</Text>
            <Text>{t('status')} {detail.assignment.state}</Text>
            <Text>{t('expires')} {new Date(detail.assignment.expiresAt).toLocaleString()}</Text>
            <Text>{t('routeVersion')} {detail.assignment.planVersion}</Text>

            <Text style={styles.sectionTitle}>{t('orderDetails')}</Text>
            <Text>{t('order')} {order.order.orderNo}</Text>
            <Text style={styles.label}>{t('pickup')}</Text>
            <Text>{order.pickup.address}</Text>
            <Text>{t('contact')} {order.pickup.contactName}</Text>
            <Text>{t('phone')} {order.pickup.phone}</Text>
            <Text style={styles.label}>{t('delivery')}</Text>
            <Text>{order.delivery.address}</Text>
            <Text>{t('contact')} {order.delivery.contactName}</Text>
            <Text>{t('phone')} {order.delivery.phone}</Text>
            <Text>{t('itemCount')} {itemCount}</Text>
            <Text style={styles.label}>{t('packageDetails')}</Text>
            {order.items.map((item) => (
              <View key={item.id} style={styles.packageRow}>
                <Text>{t('itemId')} {item.id}</Text>
                <Text>{t('packageIds')} {item.packageIds.length ? item.packageIds.join(', ') : t('noPackages')}</Text>
              </View>
            ))}
            <Text style={styles.caption}>{t('executionContractBlocked')}</Text>
            <Pressable accessibilityRole="button" disabled={!order.pickup.point} onPress={() => navigate(order.pickup.point)} style={[styles.secondaryButton, !order.pickup.point && styles.buttonDisabled]}>
              <Text style={styles.secondaryButtonText}>{t('navigatePickup')}</Text>
            </Pressable>
            {!order.pickup.point ? <Text style={styles.caption}>{t('coordinatesUnavailable')}</Text> : null}
            <Pressable accessibilityRole="button" disabled={!order.delivery.point} onPress={() => navigate(order.delivery.point)} style={[styles.secondaryButton, !order.delivery.point && styles.buttonDisabled]}>
              <Text style={styles.secondaryButtonText}>{t('navigateDelivery')}</Text>
            </Pressable>
            {!order.delivery.point ? <Text style={styles.caption}>{t('coordinatesUnavailable')}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={actionBusy || !actionAvailable}
                onPress={() => submitAction('accept')}
                style={[styles.button, (actionBusy || !actionAvailable) && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>{actionBusy ? t('actionWorking') : t('accept')}</Text>
              </Pressable>
              <Text style={styles.label}>{t('rejectReason')}</Text>
              <TextInput
                accessibilityLabel={t('rejectReason')}
                editable={!actionBusy}
                onChangeText={setRejectReason}
                placeholder={t('rejectReasonPlaceholder')}
                style={styles.input}
                value={rejectReason}
              />
              <Pressable
                accessibilityRole="button"
                disabled={actionBusy || !actionAvailable || (rejectArmed && !rejectReason.trim())}
                onPress={() => submitAction('reject')}
                style={[styles.rejectButton, (actionBusy || !actionAvailable) && styles.buttonDisabled]}
              >
                <Text style={styles.rejectText}>{rejectArmed ? t('confirmReject') : t('reject')}</Text>
              </Pressable>
              {rejectArmed ? (
                <Pressable accessibilityRole="button" onPress={() => setRejectArmed(false)} style={styles.linkButton}>
                  <Text style={styles.linkText}>{t('cancelReject')}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.offline}>
              <Text style={styles.sectionTitle}>{t('offlineEvents')}</Text>
              <Text style={styles.label}>{t('deviceId')}</Text>
              <TextInput
                accessibilityLabel={t('deviceId')}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setDeviceId}
                placeholder={t('deviceIdPlaceholder')}
                style={styles.input}
                value={deviceId}
              />
              <Text>{t('pendingEvents')} {pendingEvents}</Text>
              {quarantinedEvents > 0 ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t('quarantinedPrefix')} {quarantinedEvents} {t('quarantinedSuffix')}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={!arrivalAvailable || syncBusy}
                onPress={recordArrival}
                style={[styles.secondaryButton, (!arrivalAvailable || syncBusy) && styles.buttonDisabled]}
              >
                <Text style={styles.secondaryButtonText}>{t('recordArrival')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!credentialsReady || !deviceReady || pendingEvents === 0 || syncBusy}
                onPress={syncEvents}
                style={[styles.button, (!credentialsReady || !deviceReady || pendingEvents === 0 || syncBusy) && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>{syncBusy ? t('syncWorking') : t('syncEvents')}</Text>
              </Pressable>
            </View>
          </View>
        ) : assignments ? (
          <View style={styles.list}>
            {assignments.length === 0 ? <Text style={styles.empty}>{t('emptyTasks')}</Text> : null}
            {assignments.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{t('task')} {item.id.slice(0, 8)}</Text>
                <Text style={styles.cardMeta}>{t('order')} {item.orderId.slice(0, 8)}</Text>
                <Text style={styles.cardMeta}>{t('status')} {item.state}</Text>
                <Text style={styles.cardMeta}>{t('expires')} {new Date(item.expiresAt).toLocaleString()}</Text>
                <Pressable accessibilityRole="button" onPress={() => openDetails(item.id)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{t('viewDetails')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f8' },
  content: { padding: 24 },
  header: { gap: 6, marginBottom: 24 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#13233a', fontSize: 32, fontWeight: '700' },
  caption: { color: '#526174', fontSize: 14, lineHeight: 20 },
  languages: { flexDirection: 'row', gap: 8, marginTop: 8 },
  language: { backgroundColor: '#e8edf3', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  languageActive: { backgroundColor: '#99f6e4' },
  login: { backgroundColor: '#ffffff', borderRadius: 16, gap: 12, marginBottom: 20, padding: 18 },
  label: { color: '#13233a', fontSize: 14, fontWeight: '600', marginTop: 6 },
  input: { borderColor: '#c8d1dc', borderRadius: 10, borderWidth: 1, color: '#13233a', padding: 12 },
  button: { alignItems: 'center', backgroundColor: '#153a63', borderRadius: 10, padding: 14 },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  error: { backgroundColor: '#fee2e2', borderRadius: 10, color: '#991b1b', marginBottom: 16, padding: 12 },
  notice: { backgroundColor: '#ccfbf1', borderRadius: 10, color: '#115e59', marginBottom: 16, padding: 12 },
  list: { gap: 12, paddingBottom: 24 },
  empty: { color: '#526174', paddingVertical: 24, textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderRadius: 14, gap: 5, padding: 16 },
  cardTitle: { color: '#13233a', fontSize: 17, fontWeight: '700' },
  cardMeta: { color: '#526174', fontSize: 14 },
  detail: { backgroundColor: '#ffffff', borderRadius: 16, gap: 8, padding: 18 },
  sectionTitle: { color: '#13233a', fontSize: 20, fontWeight: '700', marginTop: 10 },
  actions: { gap: 10, marginTop: 12 },
  offline: { borderTopColor: '#d7dee7', borderTopWidth: 1, gap: 10, marginTop: 18, paddingTop: 8 },
  packageRow: { backgroundColor: '#f4f6f8', borderRadius: 8, gap: 4, padding: 10 },
  secondaryButton: { alignItems: 'center', borderColor: '#153a63', borderRadius: 10, borderWidth: 1, marginTop: 10, padding: 12 },
  secondaryButtonText: { color: '#153a63', fontWeight: '700' },
  rejectButton: { alignItems: 'center', borderColor: '#b91c1c', borderRadius: 10, borderWidth: 1, padding: 12 },
  rejectText: { color: '#b91c1c', fontWeight: '700' },
  linkButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  linkText: { color: '#0f766e', fontWeight: '700' },
});
