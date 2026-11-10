import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { designTokens } from '@routefit/shared';
import {
  ActivityIndicator,
  AccessibilityInfo,
  findNodeHandle,
  Linking,
  Modal,
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
  confirmCustodyTransfer,
  departAssignment,
  DriverApiError,
  completeDriverUpload,
  createDriverUpload,
  getDepartureReadiness,
  getAssignment,
  getDriverOrder,
  getRecipientAuthorization,
  listCustodyTransfers,
  listAssignments,
  recordDriverDelivery,
  syncDriverEvent,
  uploadDriverEvidence,
  type AssignmentDetail,
  type DepartureReadiness,
  type DriverArrivedEvent,
  type DriverAction,
  type DriverAssignment,
  type DriverCustodyTransfer,
  type DriverLanguage,
  type DriverOrderDetail,
  type RecipientAuthorization,
  type UploadTicket,
} from './src/driver-api';
import { deleteDeliveryPhoto, deliveryPhotoBlob, captureDeliveryPhoto, type DeliveryPhoto } from './src/delivery-photo';
import { deliveryConfirmationStep, packageSelection, uploadTicketForPhoto } from './src/delivery.mjs';
import { collectionConfirmationState, collectionDialogResult, deliverySubmissionState, fulfillmentStatusPresentation } from './src/fulfillment.mjs';
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
  const [custodyTransfers, setCustodyTransfers] = useState<DriverCustodyTransfer[] | null>(null);
  const [departureReadiness, setDepartureReadiness] = useState<DepartureReadiness | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState<'list' | 'detail' | ''>('');
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectArmed, setRejectArmed] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [executionReason, setExecutionReason] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState('');
  const [photo, setPhoto] = useState<DeliveryPhoto | null>(null);
  const [uploadTicket, setUploadTicket] = useState<UploadTicket | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [recipientAuthorization, setRecipientAuthorization] = useState<RecipientAuthorization | null>(null);
  const [packageChoices, setPackageChoices] = useState<Record<string, 'delivered' | 'remaining'>>({});
  const [deliveryReason, setDeliveryReason] = useState('');
  const [deliveryScanCode, setDeliveryScanCode] = useState('');
  const [deliveryLocationVerified, setDeliveryLocationVerified] = useState(false);
  const [deliveryArmed, setDeliveryArmed] = useState(false);
  const [deliveryOutcome, setDeliveryOutcome] = useState('');
  const [collectionMethod, setCollectionMethod] = useState<'cash' | 'khqr' | null>(null);
  const [collectionConfirmed, setCollectionConfirmed] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectionOutcome, setCollectionOutcome] = useState('');
  const [now, setNow] = useState(Date.now());
  // shortcut: manual device ID is development-only, remove after RF-PM-055 batch 5 registers devices.
  const [deviceId, setDeviceId] = useState('');
  const [pendingEvents, setPendingEvents] = useState(0);
  const [quarantinedEvents, setQuarantinedEvents] = useState(0);
  const [queueFailed, setQueueFailed] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const actionInFlight = useRef(false);
  const collectionDialogTrigger = useRef<ComponentRef<typeof Pressable> | null>(null);
  const collectionDialogConfirm = useRef<ComponentRef<typeof Pressable> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Awaited<ReturnType<typeof openOfflineEventQueue>> | null>(null);
  const networkState = useNetworkState();

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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function displayError(cause: unknown, fallback: MessageKey) {
    if (cause instanceof DriverApiError) {
      return errorText(language, cause.code) ?? cause.serverMessage ?? t(fallback);
    }
    return cause instanceof Error ? cause.message : t(fallback);
  }

  function returnCollectionDialogFocus() {
    const triggerTag = findNodeHandle(collectionDialogTrigger.current);
    if (triggerTag) AccessibilityInfo.setAccessibilityFocus(triggerTag);
  }

  function closeCollectionDialog(action: 'cancel' | 'escape' | 'confirm') {
    const result = collectionDialogResult(action);
    setCollectionDialogOpen(false);
    if (result.record && collection?.canRecord && !collectionOutcome) {
      setCollectionOutcome(t('collectionRecorded'));
      setCollectionConfirmed(false);
    }
    setTimeout(returnCollectionDialogFocus, 0);
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
    setDeliveryArmed(false);
    setDeliveryOutcome('');
    setCollectionMethod(null);
    setCollectionConfirmed(false);
    setCollectionDialogOpen(false);
    setCollectionOutcome('');
    try {
      const nextDetail = await getAssignment(auth(), language, assignmentId);
      const nextOrder = await getDriverOrder(auth(), language, nextDetail.assignment.orderId);
      const [nextTransfers, nextReadiness, nextAuthorization] = await Promise.all([
        nextDetail.assignment.state === 'accepted'
          ? listCustodyTransfers(auth(), language, assignmentId)
          : Promise.resolve(null),
        nextDetail.assignment.state === 'accepted'
          ? getDepartureReadiness(auth(), language, assignmentId)
          : Promise.resolve(null),
        nextDetail.assignment.state === 'accepted' && nextOrder.order.fulfillmentStage === 'in_transit'
          ? getRecipientAuthorization(auth(), language, nextDetail.assignment.orderId)
          : Promise.resolve(null),
      ]);
      setDetail(nextDetail);
      setOrder(nextOrder);
      setCustodyTransfers(nextTransfers);
      setDepartureReadiness(nextReadiness);
      setRecipientAuthorization(nextAuthorization);
      setPackageChoices({});
      setDeliveryScanCode('');
      setDeliveryLocationVerified(false);
    } catch (cause) {
      setDetail(null);
      setOrder(null);
      setCustodyTransfers(null);
      setDepartureReadiness(null);
      setRecipientAuthorization(null);
      setError(displayError(cause, 'taskReadFailed'));
    } finally {
      setLoading('');
    }
  }

  async function takePhoto() {
    if (actionBusy) return;
    setError('');
    setNotice('');
    try {
      const captured = await captureDeliveryPhoto();
      setCameraDenied(captured.denied);
      if (!captured.photo) return;
      deleteDeliveryPhoto(photo);
      setPhoto(captured.photo);
      setUploadTicket(null);
      setEvidenceFileId('');
      setNotice(t('photoReady'));
    } catch (cause) {
      setError(displayError(cause, 'photoFailed'));
    }
  }

  async function uploadPhoto() {
    if (!photo || !order || !online || actionBusy) return;
    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      const ticket = await uploadTicketForPhoto(uploadTicket, () => createDriverUpload(auth(), language, {
        purpose: order.order.fulfillmentStage === 'in_transit' ? 'DELIVERY' : 'HANDOVER',
        resourceId: order.order.id,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        sha256: photo.sha256,
      }));
      setUploadTicket(ticket);
      await uploadDriverEvidence(ticket, deliveryPhotoBlob(photo));
      const completed = await completeDriverUpload(auth(), language, ticket);
      setEvidenceFileId(completed.id);
      deleteDeliveryPhoto(photo);
      setPhoto(null);
      setUploadTicket(null);
      setNotice(t('photoUploaded'));
    } catch (cause) {
      setError(displayError(cause, 'evidenceUploadFailed'));
    } finally {
      setActionBusy(false);
    }
  }

  async function submitDelivery() {
    if (!order || !recipientAuthorization || actionInFlight.current || !deliveryReady) return;
    if (deliveryConfirmationStep(deliveryArmed) === 'confirm') {
      setDeliveryArmed(true);
      return;
    }
    actionInFlight.current = true;
    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await recordDriverDelivery(auth(), language, order.order, {
        deliveredPackageIds: deliverySelection.deliveredPackageIds,
        remainingPackageIds: deliverySelection.remainingPackageIds,
        recipientAuthorizationId: recipientAuthorization.id,
        observedAt: new Date().toISOString(),
        evidenceFileIds: [evidenceFileId],
        ...(deliverySelection.remainingPackageIds.length ? { reason: deliveryReason.trim() } : {}),
      });
      setDeliveryOutcome(result.state === 'delivered' ? t('deliveryComplete') : t('deliveryPartial'));
      setDeliveryArmed(false);
      await refreshAssignments(false);
    } catch (cause) {
      setError(displayError(cause, 'deliveryFailed'));
    } finally {
      actionInFlight.current = false;
      setActionBusy(false);
    }
  }

  async function submitExecution(action: 'custody' | 'depart', transfer?: DriverCustodyTransfer) {
    if (!detail || actionInFlight.current || !executionReason.trim() || !evidenceReady) return;
    actionInFlight.current = true;
    setActionBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'custody' && transfer) {
        await confirmCustodyTransfer(auth(), language, transfer, executionReason.trim(), evidenceFileId.trim());
      } else if (action === 'depart') {
        await departAssignment(auth(), language, detail, executionReason.trim(), evidenceFileId.trim());
      }
      await openDetails(detail.assignment.id, false);
      setExecutionReason('');
      setNotice(t(action === 'custody' ? 'custodyConfirmed' : 'departed'));
    } catch (cause) {
      const stale = cause instanceof DriverApiError && (cause.status === 409 || cause.status === 412);
      setError(displayError(cause, 'taskActionFailed'));
      if (stale) await openDetails(detail.assignment.id, false);
    } finally {
      actionInFlight.current = false;
      setActionBusy(false);
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

  async function recordArrival(observedPoint: DriverArrivedEvent['payload']['point']) {
    if (!queueRef.current || !detail) return;
    setError('');
    setNotice('');
    try {
      await queueRef.current.enqueue({
        eventId: Crypto.randomUUID(),
        assignmentId: detail.assignment.id,
        assignmentVersion: detail.assignment.version,
        planVersion: detail.assignment.planVersion,
        observedAt: new Date().toISOString(),
        type: 'ARRIVED',
        payload: { point: observedPoint, evidenceFileIds: [] },
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
      if (result.dispatchRequired) setError(t('syncSequenceInvalid'));
      else setNotice(t(result.delayed ? 'syncDelayed' : 'syncFinished'));
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
  const evidenceReady = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceFileId.trim());
  const online = networkState.isConnected !== false && networkState.isInternetReachable !== false;
  const assignmentRemainingSeconds = detail ? Math.max(0, Math.ceil((Date.parse(detail.assignment.expiresAt) - now) / 1000)) : 0;
  const assignmentExpired = Boolean(detail && detail.assignment.state === 'offered' && assignmentRemainingSeconds === 0);
  const actionAvailable = detail?.assignment.state === 'offered' && !assignmentExpired && online;
  const itemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const packageIds = order?.items.flatMap((item) => item.packageIds) ?? [];
  const deliverySelection = packageSelection(packageIds, packageChoices);
  const deliverySubmission = deliverySubmissionState({
    scanCode: deliveryScanCode,
    locationVerified: deliveryLocationVerified,
    evidenceReady,
  });
  const deliveryReady = online
    && Boolean(recipientAuthorization)
    && evidenceReady
    && deliverySelection.complete
    && deliverySelection.deliveredPackageIds.length > 0
    && (deliverySelection.remainingPackageIds.length === 0 || Boolean(deliveryReason.trim()))
    && deliverySubmission.canSubmit
    && !deliveryOutcome;
  const collection = collectionMethod ? collectionConfirmationState(collectionMethod, collectionConfirmed, Boolean(collectionOutcome)) : null;
  const fulfillmentStatus = fulfillmentStatusPresentation(
    order?.order.fulfillmentStage ?? 'none',
    language,
  );

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
            <Pressable accessibilityRole="button" onPress={() => { setDetail(null); setOrder(null); setCustodyTransfers(null); setDepartureReadiness(null); }} style={styles.linkButton}>
              <Text style={styles.linkText}>{t('backToList')}</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>{t('assignmentDetails')}</Text>
            <Text>{t('task')} {detail.assignment.id.slice(0, 8)}</Text>
            <Text>{t('status')} {detail.assignment.state}</Text>
            <Text>{t('expires')} {new Date(detail.assignment.expiresAt).toLocaleString()}</Text>
            {detail.assignment.state === 'offered' ? <Text>{t('assignmentRemaining')} {assignmentRemainingSeconds}s</Text> : null}
            {assignmentExpired ? <Text style={styles.error}>{t('assignmentExpired')}</Text> : null}
            <Text>{t('routeVersion')} {detail.assignment.planVersion}</Text>

            <Text style={styles.sectionTitle}>{t('orderDetails')}</Text>
            <Text>{t('order')} {order.order.orderNo}</Text>
            <Text accessibilityLabel={t('status')}>{fulfillmentStatus.label}</Text>
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
            {detail.assignment.state === 'accepted' ? (
              <View style={styles.execution}>
                <Text style={styles.sectionTitle}>{t('evidencePhoto')}</Text>
                <Pressable accessibilityRole="button" disabled={actionBusy} onPress={takePhoto} style={[styles.secondaryButton, actionBusy && styles.buttonDisabled]}>
                  <Text style={styles.secondaryButtonText}>{photo ? t('retakePhoto') : t('takePhoto')}</Text>
                </Pressable>
                {cameraDenied ? (
                  <View>
                    <Text style={styles.caption}>{t('cameraDenied')}</Text>
                    <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()} style={styles.linkButton}>
                      <Text style={styles.linkText}>{t('openSettings')}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {photo ? <Text style={styles.caption}>{t('photoStoredPrivately')}</Text> : null}
                <Pressable accessibilityRole="button" disabled={actionBusy || !photo || !online} onPress={uploadPhoto} style={[styles.secondaryButton, (actionBusy || !photo || !online) && styles.buttonDisabled]}>
                  <Text style={styles.secondaryButtonText}>{actionBusy ? t('actionWorking') : t('uploadPhoto')}</Text>
                </Pressable>
                {!online ? <Text style={styles.caption}>{t('needsNetwork')}</Text> : null}
                {!photo && !evidenceReady ? <Text style={styles.caption}>{t('photoRequired')}</Text> : null}
                {evidenceReady ? <Text style={styles.notice}>{t('evidenceReady')}</Text> : null}
                <Text style={styles.sectionTitle}>{t('custodyTransfers')}</Text>
                {custodyTransfers?.length === 0 ? <Text style={styles.caption}>{t('custodyEmpty')}</Text> : null}
                {custodyTransfers?.map((transfer) => (
                  <View key={transfer.id} style={styles.packageRow}>
                    <Text>{t('custodyInitiated')} {new Date(transfer.initiatedAt).toLocaleString()}</Text>
                    {transfer.items.map((item) => (
                      <View key={item.itemId}>
                        <Text>{t('itemId')} {item.itemId}</Text>
                        <Text>{t('packageIds')} {item.packageIds.join(', ')}</Text>
                      </View>
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      disabled={actionBusy || !online || !evidenceReady || !executionReason.trim()}
                      onPress={() => submitExecution('custody', transfer)}
                      style={[styles.secondaryButton, (actionBusy || !online || !evidenceReady || !executionReason.trim()) && styles.buttonDisabled]}
                    >
                      <Text style={styles.secondaryButtonText}>{t('confirmCustody')}</Text>
                    </Pressable>
                    {(!executionReason.trim() || !evidenceReady || !online) ? <Text style={styles.caption}>{!online ? t('needsNetwork') : t('executionMissing')}</Text> : null}
                  </View>
                ))}
                <Text style={styles.label}>{t('executionReason')}</Text>
                <TextInput
                  accessibilityLabel={t('executionReason')}
                  onChangeText={setExecutionReason}
                  placeholder={t('executionReasonPlaceholder')}
                  style={styles.input}
                  value={executionReason}
                />
                <Text style={styles.sectionTitle}>{t('departureReadiness')}</Text>
                <Text>{departureReadiness?.ready ? t('departureReady') : t('departureBlocked')}</Text>
                {departureReadiness?.reasons.map((reason) => (
                  <Text key={reason} style={styles.caption}>{errorText(language, reason) ?? reason}</Text>
                ))}
                <Pressable
                  accessibilityRole="button"
                  disabled={actionBusy || !online || !departureReadiness?.ready || !evidenceReady || !executionReason.trim()}
                  onPress={() => submitExecution('depart')}
                  style={[styles.button, (actionBusy || !online || !departureReadiness?.ready || !evidenceReady || !executionReason.trim()) && styles.buttonDisabled]}
                >
                  <Text style={styles.buttonText}>{actionBusy ? t('actionWorking') : t('depart')}</Text>
                </Pressable>
                {(!departureReadiness?.ready || !executionReason.trim() || !evidenceReady || !online) ? (
                  <Text style={styles.caption}>{!online ? t('needsNetwork') : !departureReadiness?.ready ? t('departureBlocked') : t('executionMissing')}</Text>
                ) : null}

                {order.order.fulfillmentStage === 'in_transit' ? (
                  <View style={styles.deliveryPanel}>
                    <Text style={styles.sectionTitle}>{t('deliveryRecord')}</Text>
                    <Text>{recipientAuthorization ? t('recipientAuthorizationReady') : t('recipientAuthorizationMissing')}</Text>
                    <Text style={styles.label}>{t('deliveryScanCode')}</Text>
                    <TextInput
                      accessibilityLabel={t('deliveryScanCode')}
                      onChangeText={(value) => { setDeliveryScanCode(value); setDeliveryArmed(false); }}
                      placeholder={t('deliveryScanPlaceholder')}
                      style={styles.input}
                      value={deliveryScanCode}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => { setDeliveryLocationVerified((current) => !current); setDeliveryArmed(false); }}
                      style={[styles.secondaryButton, deliveryLocationVerified && styles.choiceActive]}
                    >
                      <Text style={styles.secondaryButtonText}>{deliveryLocationVerified ? t('deliveryLocationVerified') : t('verifyDeliveryLocation')}</Text>
                    </Pressable>
                    <Text style={styles.caption}>{t('deliveryVerificationExample')}</Text>
                    {packageIds.map((packageId) => (
                      <View key={packageId} style={styles.packageChoice}>
                        <Text>{t('package')} {packageId}</Text>
                        <View style={styles.choiceRow}>
                          <Pressable accessibilityRole="button" onPress={() => { setPackageChoices((current) => ({ ...current, [packageId]: 'delivered' })); setDeliveryArmed(false); }} style={[styles.choice, packageChoices[packageId] === 'delivered' && styles.choiceActive]}>
                            <Text>{t('markDelivered')}</Text>
                          </Pressable>
                          <Pressable accessibilityRole="button" onPress={() => { setPackageChoices((current) => ({ ...current, [packageId]: 'remaining' })); setDeliveryArmed(false); }} style={[styles.choice, packageChoices[packageId] === 'remaining' && styles.choiceActive]}>
                            <Text>{t('markRemaining')}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                    {deliverySelection.remainingPackageIds.length ? (
                      <TextInput accessibilityLabel={t('partialReason')} onChangeText={(value) => { setDeliveryReason(value); setDeliveryArmed(false); }} placeholder={t('partialReasonPlaceholder')} style={styles.input} value={deliveryReason} />
                    ) : null}
                    <Text>{t('deliverySummary')} {deliverySelection.deliveredPackageIds.length}/{packageIds.length} {t('deliveredCount')}; {deliverySelection.remainingPackageIds.length} {t('remainingCount')}</Text>
                    <Pressable accessibilityRole="button" disabled={actionBusy || !deliveryReady} onPress={submitDelivery} style={[styles.button, (actionBusy || !deliveryReady) && styles.buttonDisabled]}>
                      <Text style={styles.buttonText}>{deliveryArmed ? t('confirmDelivery') : t('submitDelivery')}</Text>
                    </Pressable>
                    {!deliveryReady && !deliveryOutcome ? <Text style={styles.caption}>{!online ? t('needsNetwork') : !deliverySubmission.canSubmit ? t('deliveryCheckMissing') : t('deliveryMissing')}</Text> : null}
                    {deliveryOutcome ? <Text style={styles.notice}>{deliveryOutcome}</Text> : null}
                    <View style={styles.collectionPanel}>
                      <Text style={styles.sectionTitle}>{t('collection')}</Text>
                      <Text style={styles.caption}>{t('collectionExampleOnly')}</Text>
                      <View style={styles.choiceRow}>
                        {(['cash', 'khqr'] as const).map((method) => (
                          <Pressable
                            accessibilityRole="button"
                            key={method}
                            onPress={() => { setCollectionMethod(method); setCollectionConfirmed(false); setCollectionOutcome(''); }}
                            style={[styles.choice, collectionMethod === method && styles.choiceActive]}
                          >
                            <Text>{t(method === 'cash' ? 'collectionCash' : 'collectionKhqr')}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {collection ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setCollectionConfirmed((current) => !current)}
                            style={[styles.secondaryButton, collectionConfirmed && styles.choiceActive]}
                          >
                            <Text style={styles.secondaryButtonText}>{collectionConfirmed ? t('collectionConfirmed') : t('collectionConfirm')}</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            disabled={!collection.canRecord || Boolean(collectionOutcome)}
                            onPress={() => setCollectionDialogOpen(true)}
                            ref={collectionDialogTrigger}
                            style={[styles.button, (!collection.canRecord || Boolean(collectionOutcome)) && styles.buttonDisabled]}
                          >
                            <Text style={styles.buttonText}>{t('collectionRecord')}</Text>
                          </Pressable>
                        </>
                      ) : null}
                      {collectionOutcome ? <Text style={styles.notice}>{collectionOutcome}</Text> : null}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
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
              {!online ? <Text style={styles.caption}>{t('needsNetwork')}</Text> : null}
              {assignmentExpired ? <Text style={styles.caption}>{t('assignmentExpired')}</Text> : null}
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
              <Text style={styles.caption}>{t('deviceIdLifecycle')}</Text>
              <Text>{t('pendingEvents')} {pendingEvents}</Text>
              {quarantinedEvents > 0 ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t('quarantinedPrefix')} {quarantinedEvents} {t('quarantinedSuffix')}
                </Text>
              ) : null}
              {__DEV__ ? (
                <Pressable accessibilityRole="button" disabled={!detail} onPress={() => recordArrival({ lat: 11.5564, lng: 104.9282 })} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{t('recordSyntheticArrival')}</Text>
                </Pressable>
              ) : null}
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
      <Modal
        animationType="fade"
        onRequestClose={() => closeCollectionDialog('escape')}
        transparent
        visible={collectionDialogOpen}
      >
        <View accessibilityViewIsModal style={styles.dialogBackdrop}>
          <View accessibilityLabel={t('collectionConfirm')} accessibilityRole="alert" style={styles.dialog}>
            <Text style={styles.sectionTitle}>{t('collectionConfirm')}</Text>
            <Text style={styles.caption}>{t('collectionExampleOnly')}</Text>
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" onPress={() => closeCollectionDialog('cancel')} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{t('collectionCancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => closeCollectionDialog('confirm')}
                onLayout={() => {
                  if (!collectionDialogOpen) return;
                  const confirmTag = findNodeHandle(collectionDialogConfirm.current);
                  if (confirmTag) AccessibilityInfo.setAccessibilityFocus(confirmTag);
                }}
                ref={collectionDialogConfirm}
                style={styles.button}
              >
                <Text style={styles.buttonText}>{t('collectionRecord')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: designTokens.color.background },
  content: { padding: designTokens.space.x6 },
  header: { gap: 6, marginBottom: 24 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: designTokens.color.ink, fontSize: designTokens.type.size.title, fontWeight: '700' },
  caption: { color: '#526174', fontSize: 14, lineHeight: 20 },
  languages: { flexDirection: 'row', gap: 8, marginTop: 8 },
  language: { backgroundColor: '#e8edf3', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  languageActive: { backgroundColor: '#99f6e4' },
  login: { backgroundColor: designTokens.color.surface, borderRadius: designTokens.radius.large, gap: 12, marginBottom: 20, padding: 18 },
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
  detail: { backgroundColor: designTokens.color.surface, borderRadius: designTokens.radius.large, gap: 8, padding: 18 },
  sectionTitle: { color: '#13233a', fontSize: 20, fontWeight: '700', marginTop: 10 },
  actions: { gap: 10, marginTop: 12 },
  execution: { borderTopColor: designTokens.color.line, borderTopWidth: 1, gap: 10, marginTop: 12, paddingTop: 8 },
  deliveryPanel: { borderTopColor: designTokens.color.line, borderTopWidth: 1, gap: 10, marginTop: 12, paddingTop: 8 },
  collectionPanel: { borderTopColor: designTokens.color.line, borderTopWidth: 1, gap: 10, marginTop: 12, paddingTop: 8 },
  dialogBackdrop: { alignItems: 'center', backgroundColor: designTokens.color.navy, flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: designTokens.color.surface, borderRadius: designTokens.radius.large, gap: 12, maxWidth: 420, padding: designTokens.space.x6, width: '100%' },
  dialogActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  offline: { borderTopColor: designTokens.color.line, borderTopWidth: 1, gap: 10, marginTop: 18, paddingTop: 8 },
  packageRow: { backgroundColor: '#f4f6f8', borderRadius: 8, gap: 4, padding: 10 },
  packageChoice: { backgroundColor: '#f4f6f8', borderRadius: 8, gap: 8, padding: 10 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { borderColor: '#94a3b8', borderRadius: 8, borderWidth: 1, padding: 8 },
  choiceActive: { backgroundColor: '#99f6e4', borderColor: '#0f766e' },
  secondaryButton: { alignItems: 'center', borderColor: '#153a63', borderRadius: 10, borderWidth: 1, marginTop: 10, padding: 12 },
  secondaryButtonText: { color: '#153a63', fontWeight: '700' },
  rejectButton: { alignItems: 'center', borderColor: '#b91c1c', borderRadius: 10, borderWidth: 1, padding: 12 },
  rejectText: { color: '#b91c1c', fontWeight: '700' },
  linkButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  linkText: { color: '#0f766e', fontWeight: '700' },
});
