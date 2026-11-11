import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, type PressableInstance } from 'react-native';
import { createOverlayManager, createToastState, designTokens, detailDrawerState, dismissToast, enqueueToast, nativeDialogA11yProps, nativeToastA11yProps } from '@routefit/shared';

import type { DriverLanguage } from './driver-api';
import { collectionConfirmationState, collectionDialogResult, deliverySubmissionState, fulfillmentSurfacePlan, offlineNotice, problemReportState, undeliveredReasonState } from './fulfillment.mjs';
import { text } from './messages';
import { createCollectionDialogSession } from './fulfillment-dialog.mjs';

export type FulfillmentSurfaceProps = {
  language: DriverLanguage;
  stage: string;
  offline?: boolean;
};

export function FulfillmentSurface({ language, stage, offline = false }: FulfillmentSurfaceProps) {
  const [loadScanCode, setLoadScanCode] = useState('');
  const [deliveryScanCode, setDeliveryScanCode] = useState('');
  const [locationMarked, setLocationMarked] = useState(false);
  const [undeliveredReason, setUndeliveredReason] = useState('');
  const [problemSummary, setProblemSummary] = useState('');
  const [problemRecorded, setProblemRecorded] = useState(false);
  const [method, setMethod] = useState<'cash' | 'khqr' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [warehouseArrived, setWarehouseArrived] = useState(false);
  const [deliveryProofViewed, setDeliveryProofViewed] = useState(false);
  const [toastState, setToastState] = useState(() => createToastState());
  const collectionTriggerRef = useRef<PressableInstance | null>(null);
  const collectionCancelRef = useRef<PressableInstance | null>(null);
  const collectionConfirmRef = useRef<PressableInstance | null>(null);
  const collectionContainerRef = useRef<PressableInstance | null>(null);
  const collectionDialogSessionRef = useRef<ReturnType<typeof createCollectionDialogSession> | null>(null);
  const overlayManager = useMemo(() => createOverlayManager(), []);
  const collectionFocusTargets = useMemo(() => ({
    trigger: { focus: () => collectionTriggerRef.current?.focus() },
    cancel: { focus: () => collectionCancelRef.current?.focus() },
    confirm: { focus: () => collectionConfirmRef.current?.focus() },
    container: { focus: () => collectionContainerRef.current?.focus() },
  }), []);
  const t = (key: Parameters<typeof text>[1]) => text(language, key);
  const plan = fulfillmentSurfacePlan(stage, language);
  const { status, panels } = plan;
  const drawer = detailDrawerState(drawerVisible ? status : null);
  const collection = method ? collectionConfirmationState(method, confirmed, recorded) : null;
  const delivery = deliverySubmissionState({ scanCode: deliveryScanCode, locationVerified: locationMarked, evidenceReady: false });
  const undelivered = undeliveredReasonState(undeliveredReason);
  const problem = problemReportState(problemSummary);
  const offlineState = offlineNotice(offline);

  function closeCollection(action: 'cancel' | 'escape' | 'confirm') {
    const result = collectionDialogResult(action);
    overlayManager.closeActive();
    setDialogOpen(false);
    if (result.record && collection?.canRecord && !recorded) {
      setRecorded(true);
      setConfirmed(false);
    }
  }

  function openCollectionDialog() {
    setDialogOpen(true);
  }

  function showCollectionDialog() {
    const session = createCollectionDialogSession({
      manager: overlayManager,
      titleId: 'collection-confirmation-title',
      trigger: collectionFocusTargets.trigger,
      focusables: [collectionFocusTargets.cancel, collectionFocusTargets.confirm],
      container: collectionFocusTargets.container,
      onCancel: () => setDialogOpen(false),
    });
    collectionDialogSessionRef.current = session;
    session.onShow();
  }

  function handleDialogKeyDown(event: { nativeEvent: { key?: string; shiftKey?: boolean }; preventDefault?: () => void }, target: { focus: () => void }) {
    collectionDialogSessionRef.current?.onKeyDown({
      key: event.nativeEvent.key ?? '',
      shiftKey: Boolean(event.nativeEvent.shiftKey),
      target,
      preventDefault: () => event.preventDefault?.(),
    });
  }

  function recordProblem() {
    setProblemRecorded(true);
    setToastState((current) => enqueueToast(current, { id: 'problem-recorded', message: t('problemRecorded') }));
  }

  return (
    <View style={styles.surface}>
      {offlineState.visible ? <Text {...nativeToastA11yProps()} accessibilityRole="alert" style={styles.notice}>{t('offlineNotice')}</Text> : null}
      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>{status.label}</Text>
        <Text style={styles.caption}>{t('fulfillmentFrontendExample')}</Text>
        <Pressable accessibilityRole="button" onPress={() => setDrawerVisible((value) => !value)} style={styles.secondaryButton}>
          <Text>{t('assignmentDetails')}</Text>
        </Pressable>
        {drawer.open && drawer.record ? <View style={styles.drawer}><Text style={styles.label}>{drawer.record.label}</Text></View> : null}
      </View>
      {panels.includes('warehouse') ? (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>{t('warehouseArrival')}</Text>
          <Text style={styles.caption}>{t('warehouseArrivalExample')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setWarehouseArrived(true)} style={styles.secondaryButton}>
            <Text>{t('markWarehouseArrival')}</Text>
          </Pressable>
          {warehouseArrived ? <Text style={styles.notice}>{t('warehouseArrivalRecorded')}</Text> : null}
        </View>
      ) : null}
      {panels.includes('load_scan') ? (
        <View style={styles.panel}>
          <Text style={styles.title}>{t('loadScan')}</Text>
          <TextInput accessibilityLabel={t('loadScan')} onChangeText={setLoadScanCode} placeholder={t('loadScanPlaceholder')} style={styles.input} value={loadScanCode} />
          <Text style={styles.caption}>{t('fulfillmentFrontendExample')}</Text>
          {loadScanCode.trim() ? <Text style={styles.notice}>{t('loadScanRecorded')}</Text> : null}
        </View>
      ) : null}
      {panels.includes('delivery') ? (
        <View style={styles.panel}>
          <Text style={styles.title}>{t('deliveryRecord')}</Text>
          <TextInput accessibilityLabel={t('deliveryScanCode')} onChangeText={setDeliveryScanCode} placeholder={t('deliveryScanPlaceholder')} style={styles.input} value={deliveryScanCode} />
          <Pressable accessibilityRole="button" onPress={() => setLocationMarked((value) => !value)} style={styles.secondaryButton}>
            <Text>{locationMarked ? t('deliveryLocationVerified') : t('verifyDeliveryLocation')}</Text>
          </Pressable>
          <Text style={styles.caption}>{t('deliveryVerificationExample')}</Text>
          {!delivery.canSubmit ? <Text style={styles.caption}>{t('deliveryCheckMissing')}</Text> : null}
          <Text style={styles.label}>{t('undeliveredReason')}</Text>
          <TextInput accessibilityLabel={t('undeliveredReason')} onChangeText={setUndeliveredReason} placeholder={t('undeliveredReasonPlaceholder')} style={styles.input} value={undeliveredReason} />
          {!undelivered.canSubmit ? <Text style={styles.caption}>{t('undeliveredReasonMissing')}</Text> : null}
          <Text style={styles.label}>{t('problemReport')}</Text>
          <TextInput accessibilityLabel={t('problemReport')} onChangeText={(value) => { setProblemSummary(value); setProblemRecorded(false); }} placeholder={t('problemReportPlaceholder')} style={styles.input} value={problemSummary} />
          <Pressable accessibilityRole="button" disabled={!problem.canSubmit || problemRecorded} onPress={recordProblem} style={styles.secondaryButton}>
            <Text>{t('recordProblemExample')}</Text>
          </Pressable>
          <Text style={styles.caption}>{t('fulfillmentFrontendExample')}</Text>
          {problemRecorded ? <Text style={styles.notice}>{t('problemRecorded')}</Text> : null}
        </View>
      ) : null}
      {panels.includes('collection') ? (
        <View style={styles.panel}>
          <Text style={styles.title}>{t('collection')}</Text>
          <Text style={styles.caption}>{t('collectionExampleOnly')}</Text>
          {(['cash', 'khqr'] as const).map((value) => (
            <Pressable accessibilityRole="button" key={value} onPress={() => { setMethod(value); setConfirmed(false); setRecorded(false); }} style={styles.secondaryButton}>
              <Text>{t(value === 'cash' ? 'collectionCash' : 'collectionKhqr')}</Text>
            </Pressable>
          ))}
          {collection ? <>
            <Pressable accessibilityRole="button" onPress={() => setConfirmed((value) => !value)} style={styles.secondaryButton}><Text>{confirmed ? t('collectionConfirmed') : t('collectionConfirm')}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={!collection.canRecord} onPress={openCollectionDialog} ref={collectionTriggerRef} style={styles.button}><Text style={styles.buttonText}>{t('collectionRecord')}</Text></Pressable>
          </> : null}
          {recorded ? <Text style={styles.notice}>{t('collectionRecorded')}</Text> : null}
        </View>
      ) : null}
      {panels.includes('delivery_proof') ? (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>{t('deliveryProofReview')}</Text>
          <Text style={styles.caption}>{t('deliveryProofExample')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setDeliveryProofViewed(true)} style={styles.secondaryButton}>
            <Text>{t('viewDeliveryProof')}</Text>
          </Pressable>
          {deliveryProofViewed ? <Text style={styles.notice}>{t('deliveryProofViewed')}</Text> : null}
        </View>
      ) : null}
      {toastState.active ? <Pressable {...nativeToastA11yProps()} accessibilityRole="alert" onPress={() => setToastState((current) => dismissToast(current))}><Text style={styles.notice}>{toastState.active.message}</Text></Pressable> : null}
      <Modal onRequestClose={() => closeCollection('escape')} onShow={showCollectionDialog} transparent visible={dialogOpen}>
        <Pressable {...nativeDialogA11yProps(t('collectionConfirm'))} onKeyDown={(event) => handleDialogKeyDown(event, collectionFocusTargets.container)} ref={collectionContainerRef} style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text accessibilityRole="header" nativeID="collection-confirmation-title" style={styles.title}>{t('collectionConfirm')}</Text>
            <Text style={styles.caption}>{t('collectionExampleOnly')}</Text>
            <Pressable accessibilityRole="button" onKeyDown={(event) => handleDialogKeyDown(event, collectionFocusTargets.cancel)} onPress={() => closeCollection('cancel')} ref={collectionCancelRef} style={styles.secondaryButton}><Text>{t('collectionCancel')}</Text></Pressable>
            <Pressable accessibilityRole="button" onKeyDown={(event) => handleDialogKeyDown(event, collectionFocusTargets.confirm)} onPress={() => closeCollection('confirm')} ref={collectionConfirmRef} style={styles.button}><Text style={styles.buttonText}>{t('collectionRecord')}</Text></Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { gap: designTokens.space.x4 },
  panel: { backgroundColor: designTokens.color.surface, borderColor: designTokens.color.line, borderRadius: designTokens.radius.large, borderWidth: 1, gap: designTokens.space.x3, padding: designTokens.space.x4 },
  title: { color: designTokens.color.navy, fontSize: designTokens.type.size.lead, fontWeight: '700' },
  label: { color: designTokens.color.navy, fontSize: designTokens.type.size.body, fontWeight: '600' },
  caption: { color: designTokens.color.navy, fontSize: designTokens.type.size.small },
  notice: { color: designTokens.color.navy, fontSize: designTokens.type.size.body },
  input: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.medium, borderWidth: 1, padding: designTokens.space.x3 },
  secondaryButton: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.medium, borderWidth: 1, padding: designTokens.space.x3 },
  button: { backgroundColor: designTokens.color.navy, borderRadius: designTokens.radius.medium, padding: designTokens.space.x3 },
  buttonText: { color: designTokens.color.surface },
  backdrop: { alignItems: 'center', backgroundColor: designTokens.color.scrim, flex: 1, justifyContent: 'center', padding: designTokens.space.x4 },
  dialog: { backgroundColor: designTokens.color.surface, borderRadius: designTokens.radius.large, gap: designTokens.space.x3, padding: designTokens.space.x4, width: '100%' },
  drawer: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.medium, borderWidth: 1, padding: designTokens.space.x3 },
});
