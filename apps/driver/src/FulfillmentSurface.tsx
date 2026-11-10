import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createDialogController, designTokens, nativeDialogA11yProps, nativeToastA11yProps } from '@routefit/shared';

import type { DriverLanguage } from './driver-api';
import { collectionConfirmationState, collectionDialogResult, deliverySubmissionState, fulfillmentSections, offlineNotice, problemReportState, undeliveredReasonState } from './fulfillment.mjs';
import { text } from './messages';

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
  const collectionDialogRef = useRef<ReturnType<typeof createDialogController> | null>(null);
  if (!collectionDialogRef.current) {
    collectionDialogRef.current = createDialogController({
      titleId: 'collection-confirmation-title',
      onCancel: () => setDialogOpen(false),
    });
  }
  const collectionDialog = collectionDialogRef.current;
  const t = (key: Parameters<typeof text>[1]) => text(language, key);
  const sections = fulfillmentSections(stage);
  const collection = method ? collectionConfirmationState(method, confirmed, recorded) : null;
  const delivery = deliverySubmissionState({ scanCode: deliveryScanCode, locationVerified: locationMarked, evidenceReady: false });
  const undelivered = undeliveredReasonState(undeliveredReason);
  const problem = problemReportState(problemSummary);
  const offlineState = offlineNotice(offline);

  function closeCollection(action: 'cancel' | 'escape' | 'confirm') {
    const result = collectionDialogResult(action);
    collectionDialog.close(action === 'confirm' ? 'replaced' : action);
    setDialogOpen(false);
    if (result.record && collection?.canRecord && !recorded) {
      setRecorded(true);
      setConfirmed(false);
    }
  }

  function openCollectionDialog() {
    collectionDialog.open();
    setDialogOpen(true);
  }

  return (
    <View style={styles.surface}>
      {offlineState.visible ? <Text {...nativeToastA11yProps()} accessibilityRole="alert" style={styles.notice}>{t('offlineNotice')}</Text> : null}
      {sections.includes('load_scan') ? (
        <View style={styles.panel}>
          <Text style={styles.title}>{t('loadScan')}</Text>
          <TextInput accessibilityLabel={t('loadScan')} onChangeText={setLoadScanCode} placeholder={t('loadScanPlaceholder')} style={styles.input} value={loadScanCode} />
          <Text style={styles.caption}>{t('fulfillmentFrontendExample')}</Text>
          {loadScanCode.trim() ? <Text style={styles.notice}>{t('loadScanRecorded')}</Text> : null}
        </View>
      ) : null}
      {sections.includes('delivery') ? (
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
          <Pressable accessibilityRole="button" disabled={!problem.canSubmit || problemRecorded} onPress={() => setProblemRecorded(true)} style={styles.secondaryButton}>
            <Text>{t('recordProblemExample')}</Text>
          </Pressable>
          <Text style={styles.caption}>{t('fulfillmentFrontendExample')}</Text>
          {problemRecorded ? <Text style={styles.notice}>{t('problemRecorded')}</Text> : null}
        </View>
      ) : null}
      {sections.includes('collection') ? (
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
            <Pressable accessibilityRole="button" disabled={!collection.canRecord} onPress={openCollectionDialog} style={styles.button}><Text style={styles.buttonText}>{t('collectionRecord')}</Text></Pressable>
          </> : null}
          {recorded ? <Text style={styles.notice}>{t('collectionRecorded')}</Text> : null}
        </View>
      ) : null}
      <Modal onRequestClose={() => closeCollection('escape')} transparent visible={dialogOpen}>
        <View {...nativeDialogA11yProps(t('collectionConfirm'))} style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.title}>{t('collectionConfirm')}</Text>
            <Text style={styles.caption}>{t('collectionExampleOnly')}</Text>
            <Pressable accessibilityRole="button" onPress={() => closeCollection('cancel')} style={styles.secondaryButton}><Text>{t('collectionCancel')}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => closeCollection('confirm')} style={styles.button}><Text style={styles.buttonText}>{t('collectionRecord')}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { gap: designTokens.space.x4 },
  panel: { backgroundColor: designTokens.color.surface, borderColor: designTokens.color.line, borderRadius: designTokens.radius.large, borderWidth: 1, gap: designTokens.space.x3, padding: designTokens.space.x4 },
  title: { color: designTokens.color.navy, fontSize: designTokens.type.size.title, fontWeight: '700' },
  label: { color: designTokens.color.navy, fontSize: designTokens.type.size.body, fontWeight: '600' },
  caption: { color: designTokens.color.navy, fontSize: designTokens.type.size.small },
  notice: { color: designTokens.color.navy, fontSize: designTokens.type.size.body },
  input: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.medium, borderWidth: 1, padding: designTokens.space.x3 },
  secondaryButton: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.medium, borderWidth: 1, padding: designTokens.space.x3 },
  button: { backgroundColor: designTokens.color.navy, borderRadius: designTokens.radius.medium, padding: designTokens.space.x3 },
  buttonText: { color: designTokens.color.surface },
  backdrop: { alignItems: 'center', backgroundColor: designTokens.color.navy, flex: 1, justifyContent: 'center', padding: designTokens.space.x4 },
  dialog: { backgroundColor: designTokens.color.surface, borderRadius: designTokens.radius.large, gap: designTokens.space.x3, padding: designTokens.space.x4, width: '100%' },
});
