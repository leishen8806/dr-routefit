import { Link, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { designTokens } from '@routefit/shared';
import { CopyKey, Language, languageOptions } from '../src/copy';
import { useLanguage } from '../src/LanguageContext';
import { useRuntime } from '../src/RuntimeContext';
import { createCustomerExperience, createPromotionSequence } from '../src/customerExperience.mjs';

type Tab = 'send' | 'orders' | 'messages' | 'profile';

const tabs: readonly { key: Tab; label: CopyKey }[] = [
  { key: 'send', label: 'send' },
  { key: 'orders', label: 'orders' },
  { key: 'messages', label: 'messages' },
  { key: 'profile', label: 'profile' },
];

const emptyCopy: Record<Tab, { title: CopyKey; body: CopyKey }> = {
  send: { title: 'sendTitle', body: 'sendBody' },
  orders: { title: 'ordersTitle', body: 'ordersBody' },
  messages: { title: 'messagesTitle', body: 'messagesBody' },
  profile: { title: 'profileTitle', body: 'profileBody' },
};

const fontFamily: Record<Language, string> = {
  en: designTokens.type.latin,
  zh: designTokens.type.cjk,
  km: designTokens.type.khmer,
};

function TabIcon({ tab, selected }: { tab: Tab; selected: boolean }) {
  const color = selected ? designTokens.color.navy : designTokens.color.muted;
  if (tab === 'send') {
    return <View style={[styles.sendIcon, { borderColor: color }]}><View style={[styles.sendIconLine, { backgroundColor: color }]} /></View>;
  }
  if (tab === 'orders') {
    return <View style={styles.listIcon}>{[0, 1, 2].map((row) => <View key={row} style={[styles.listIconLine, { backgroundColor: color }]} />)}</View>;
  }
  if (tab === 'messages') {
    return <View style={[styles.messageIcon, { borderColor: color }]} />;
  }
  return <View style={[styles.profileIcon, { borderColor: color }]}><View style={[styles.profileIconBody, { borderColor: color }]} /></View>;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const [sendMode, setSendMode] = useState<'single' | 'bulk'>('single');
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const runtime = useRuntime();
  const { width } = useWindowDimensions();
  const experience = useMemo(() => createCustomerExperience(), []);
  const promotionSequence = useMemo(() => createPromotionSequence(), []);
  const [promotionVisibility, setPromotionVisibility] = useState(() => promotionSequence.getVisiblePromotion());
  const overview = experience.getOverview();
  const orderDetail = experience.findOrderDetail(overview.order.id);
  const paymentIntent = experience.getExamplePaymentConfirmation();
  const messages = experience.listMessages();
  const profile = experience.getProfileSummary();
  const compact = width < 720;
  const activeCopy = emptyCopy[activeTab];
  const face = { fontFamily: fontFamily[language] };

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: `${t('appName')} · ${t(activeCopy.title)}` }} />
      <ScrollView contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}>
        <View style={styles.masthead}>
          <View style={styles.routeHeader}>
            <Svg accessibilityLabel={t('appName')} height={44} testID="routefit-brand-mark" viewBox="0 0 64 64" width={44}>
              <Path d="M16 53 V13 A4 4 0 0 1 20 9 H38 A13 13 0 0 1 51 22 A13 13 0 0 1 38 35 H26 L44 53" fill="none" stroke="#0B2545" strokeLinecap="round" strokeLinejoin="round" strokeWidth={7} />
              <Circle cx={16} cy={53} fill="#13C29B" r={6} />
              <Rect fill="#F5A623" height={11} rx={2.5} width={15} x={24} y={16.5} />
            </Svg>
            <View style={styles.brandCopy}>
              <Text style={[styles.brand, face]}>{t('appName')}</Text>
              <Text style={[styles.tagline, face]}>{t('tagline')}</Text>
            </View>
          </View>

          <View accessibilityLabel="Language" accessibilityRole="radiogroup" style={styles.languages}>
            {languageOptions.map((option) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: language === option.code }}
                key={option.code}
                onPress={() => setLanguage(option.code)}
                style={({ pressed }) => [styles.languageButton, language === option.code && styles.languageButtonActive, pressed && styles.pressed]}
                testID={`language-${option.code}`}
              >
                <Text style={[styles.languageText, face, language === option.code && styles.languageTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.title, face]}>{t('greeting')}</Text>
            <Text style={[styles.intro, face]}>{t('intro')}</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.routeDiagram} testID="route-diagram">
            <View style={styles.routeTrack} />
            <View style={[styles.routeNode, styles.routeNodeStart]} />
            <View style={[styles.routeNode, styles.routeNodeCurrent]} />
            <View style={[styles.routeNode, styles.routeNodeEnd]} />
            <View style={styles.routeVehicle}><View style={styles.routeVehicleCab} /></View>
          </View>
        </View>

        <Text style={[styles.reviewNote, face]}>{t('reviewPending')}</Text>

        {promotionVisibility.startupAd && overview.startupAd.kind === 'example' ? (
          <View accessibilityLiveRegion="polite" style={styles.startupAd} testID="example-startup-ad">
            <Text style={[styles.startupTitle, face]}>{t('promotion')}</Text>
            <Text style={[styles.startupBody, face]}>{t('example')}</Text>
            <Pressable accessibilityRole="button" onPress={() => { promotionSequence.dismissStartupAd(); setPromotionVisibility(promotionSequence.getVisiblePromotion()); }} style={styles.confirmButton} testID="dismiss-startup-ad">
              <Text style={[styles.confirmText, face]}>{t('confirm')}</Text>
            </Pressable>
          </View>
        ) : null}

        {promotionVisibility.homePopup && overview.homePopup.kind === 'example' ? (
          <View accessibilityLiveRegion="polite" style={styles.promotion} testID="example-promotion">
            <View style={styles.exampleBadge}><Text style={[styles.exampleBadgeText, face]}>{t('example')}</Text></View>
            <View style={styles.promotionCopy}>
              <Text style={[styles.promotionTitle, face]}>{t('promotion')}</Text>
              <Text style={[styles.promotionBody, face]}>{t('intro')}</Text>
            </View>
            <Pressable accessibilityLabel={t('back')} onPress={() => { promotionSequence.dismissHomePopup(); setPromotionVisibility(promotionSequence.getVisiblePromotion()); }} style={styles.dismissButton} testID="dismiss-promotion">
              <Text style={[styles.dismissText, face]}>×</Text>
            </Pressable>
          </View>
        ) : null}

        <View accessibilityLiveRegion="polite" style={[styles.emptyPanel, { backgroundColor: runtime.surfaceColor }]} testID="empty-panel">
          <View style={styles.emptyRule} />
          <Text style={[styles.emptyTitle, face]}>{t(activeTab === 'orders' ? 'orderExampleTitle' : activeTab === 'messages' ? 'messageExampleTitle' : activeTab === 'profile' ? 'profileExampleTitle' : activeCopy.title)}</Text>
          <Text style={[styles.emptyBody, face]}>{activeTab === 'send' ? t(activeCopy.body) : t('noRealData')}</Text>
          {activeTab === 'send' ? (
            <>
              <View style={styles.choiceRow}>
                {(['single', 'bulk'] as const).map((mode) => (
                  <Pressable key={mode} onPress={() => setSendMode(mode)} style={[styles.choiceButton, sendMode === mode && styles.choiceButtonActive]} testID={`send-mode-${mode}`}>
                    <Text style={[styles.choiceText, face, sendMode === mode && styles.choiceTextActive]}>{t(mode === 'single' ? 'singleDelivery' : 'bulkDelivery')}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.flowSummary} testID="send-flow-summary">
                <Text style={[styles.flowText, face]}>{t('quote')}</Text>
                <Text style={[styles.flowText, face]}>{t('payment')}</Text>
                <Text style={[styles.flowText, face]}>{t('cod')}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => { promotionSequence.beginPaymentConfirmation(); setPromotionVisibility(promotionSequence.getVisiblePromotion()); setPaymentConfirmationOpen(true); }} style={styles.confirmButton} testID="confirm-example-payment">
                <Text style={[styles.confirmText, face]}>{paymentConfirmed ? t('payment') : t('confirm')}</Text>
              </Pressable>
            </>
          ) : null}
          {activeTab === 'orders' ? (
            <View style={styles.detailCard} testID="example-order-detail">
              <View style={styles.exampleBadge}><Text style={[styles.exampleBadgeText, face]}>{t('example')}</Text></View>
              <Text style={[styles.detailTitle, face]}>{t('orderDetail')}</Text>
              <Text style={[styles.detailStatus, face]}>{t('orderStatus')}</Text>
              <View style={styles.flowSummary}>
                <Text style={[styles.flowText, face]}>{t('quote')}</Text>
                <Text style={[styles.flowText, face]}>{t('payment')}</Text>
                <Text style={[styles.flowText, face]}>{t('cod')}</Text>
              </View>
              {orderDetail ? <Text style={[styles.detailHint, face]}>{t('protectedPhone')}</Text> : null}
            </View>
          ) : null}
          {activeTab === 'messages' ? (
            <View style={styles.detailCard} testID="example-message">
              <View style={styles.exampleBadge}><Text style={[styles.exampleBadgeText, face]}>{t('example')}</Text></View>
              <Text style={[styles.detailTitle, face]}>{t('messageExampleTitle')}</Text>
              {messages.map((entry) => <Text key={entry.id} style={[styles.detailHint, face]}>{t(entry.state === 'driver_assigned' ? 'messageExampleBody' : 'noRealData')}</Text>)}
            </View>
          ) : null}
          {activeTab === 'profile' ? (
            <View style={styles.detailCard} testID="profile-example">
              <View style={styles.exampleBadge}><Text style={[styles.exampleBadgeText, face]}>{t('example')}</Text></View>
              <Text style={[styles.detailTitle, face]}>{t('recipient')}</Text>
              <Text style={[styles.detailHint, face]}>{t('protectedPhone')}</Text>
              <View style={styles.flowSummary}>
                <Text style={[styles.flowText, face]}>{t('languageSetting')}</Text>
                <Text style={[styles.flowText, face]}>{profile.settings.languageSelection === 'frontend_only' ? t('frontendOnly') : t('noRealData')}</Text>
              </View>
            </View>
          ) : null}
          <Link accessibilityRole="link" href="/track" style={[styles.trackLink, face]} testID="track-link">
            {t('trackLink')} →
          </Link>
        </View>
      </ScrollView>

      {paymentConfirmationOpen ? (
        <View accessibilityViewIsModal style={styles.modalBackdrop} testID="example-payment-confirmation">
          <View accessibilityRole="alert" style={[styles.modalCard, { backgroundColor: runtime.surfaceColor }]}>
            <View style={styles.exampleBadge}><Text style={[styles.exampleBadgeText, face]}>{t('example')}</Text></View>
            <Text style={[styles.modalTitle, face]}>{t('paymentConfirmTitle')}</Text>
            <Text style={[styles.detailHint, face]}>{t('paymentConfirmBody')}</Text>
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setPaymentConfirmationOpen(false)} style={styles.cancelButton} testID="cancel-example-payment">
                <Text style={[styles.cancelText, face]}>{t('cancel')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { if (paymentIntent.requiresConfirmation && paymentIntent.action === 'frontend_only') setPaymentConfirmed(true); setPaymentConfirmationOpen(false); }} style={styles.confirmButton} testID="complete-example-payment">
                <Text style={[styles.confirmText, face]}>{t('confirm')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <View accessibilityRole="tablist" style={[styles.tabBar, { backgroundColor: runtime.surfaceColor }]}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              aria-selected={selected}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.pressed]}
              testID={`tab-${tab.key}`}
            >
              <TabIcon selected={selected} tab={tab.key} />
              <Text style={[styles.tabText, face, selected && styles.tabTextSelected]}>{t(tab.label)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: '100%' },
  scrollContent: { alignSelf: 'center', flexGrow: 1, maxWidth: 1120, paddingBottom: 104, paddingHorizontal: designTokens.space.x12, paddingTop: designTokens.space.x12, width: '100%' },
  scrollContentCompact: { paddingHorizontal: designTokens.space.x4, paddingTop: designTokens.space.x8 },
  masthead: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: designTokens.space.x4, justifyContent: 'space-between', marginBottom: designTokens.space.x8 },
  routeHeader: { alignItems: 'center', flexDirection: 'row', gap: designTokens.space.x3 },
  brandCopy: { flexShrink: 1 },
  brand: { color: designTokens.color.navy, fontSize: 18, fontWeight: '600', letterSpacing: 0.2 },
  tagline: { color: designTokens.color.muted, fontSize: 12, marginTop: 2 },
  languages: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.small, borderWidth: 1, flexDirection: 'row', padding: 3 },
  languageButton: { alignItems: 'center', borderRadius: 4, justifyContent: 'center', minHeight: 40, paddingHorizontal: designTokens.space.x3 },
  languageButtonActive: { backgroundColor: designTokens.color.navy },
  languageText: { color: designTokens.color.navy, fontSize: 13, fontWeight: '500' },
  languageTextActive: { color: designTokens.color.surface },
  hero: { alignItems: 'center', backgroundColor: designTokens.color.navy, borderRadius: designTokens.radius.large, flexDirection: 'row', gap: designTokens.space.x12, minHeight: 240, overflow: 'hidden', padding: designTokens.space.x12 },
  heroCompact: { alignItems: 'stretch', flexDirection: 'column', gap: designTokens.space.x8, padding: designTokens.space.x6 },
  heroCopy: { flex: 1 },
  title: { color: designTokens.color.surface, fontSize: 32, fontWeight: '600', lineHeight: 42 },
  intro: { color: '#D9E6EF', fontSize: 16, lineHeight: 26, marginTop: designTokens.space.x3, maxWidth: 620 },
  routeDiagram: { flex: 0.7, height: 132, justifyContent: 'center', minWidth: 240, position: 'relative' },
  routeTrack: { backgroundColor: '#4E6B87', height: 2, left: 8, position: 'absolute', right: 8, top: 66 },
  routeNode: { borderRadius: 9, height: 18, position: 'absolute', top: 58, width: 18 },
  routeNodeStart: { backgroundColor: designTokens.color.teal, left: 4 },
  routeNodeCurrent: { backgroundColor: designTokens.color.amber, left: '48%' },
  routeNodeEnd: { backgroundColor: designTokens.color.surface, right: 4 },
  routeVehicle: { backgroundColor: designTokens.color.amber, height: 22, left: '43%', position: 'absolute', top: 28, width: 38 },
  routeVehicleCab: { backgroundColor: '#FFD17A', height: 14, position: 'absolute', right: -10, top: 8, width: 12 },
  reviewNote: { color: designTokens.color.muted, fontSize: 13, lineHeight: 22, marginTop: designTokens.space.x3 },
  startupAd: { alignItems: 'center', backgroundColor: designTokens.color.navy, borderRadius: designTokens.radius.large, marginTop: designTokens.space.x6, minHeight: 180, padding: designTokens.space.x8 },
  startupTitle: { color: designTokens.color.surface, fontSize: 24, fontWeight: '600', lineHeight: 34, textAlign: 'center' },
  startupBody: { color: '#D9E6EF', fontSize: 15, lineHeight: 24, marginTop: designTokens.space.x3, textAlign: 'center' },
  promotion: { alignItems: 'center', backgroundColor: '#FFF4DA', borderColor: designTokens.color.amber, borderRadius: designTokens.radius.medium, borderWidth: 1, flexDirection: 'row', gap: designTokens.space.x3, marginTop: designTokens.space.x6, padding: designTokens.space.x4 },
  exampleBadge: { backgroundColor: designTokens.color.amber, borderRadius: 999, paddingHorizontal: designTokens.space.x2, paddingVertical: 3 },
  exampleBadgeText: { color: designTokens.color.navy, fontSize: 12, fontWeight: '600' },
  promotionCopy: { flex: 1 },
  promotionTitle: { color: designTokens.color.ink, fontSize: 16, fontWeight: '600' },
  promotionBody: { color: designTokens.color.muted, fontSize: 13, lineHeight: 20, marginTop: 2 },
  dismissButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  dismissText: { color: designTokens.color.navy, fontSize: 16, fontWeight: '600' },
  emptyPanel: { borderColor: designTokens.color.line, borderLeftColor: designTokens.color.teal, borderLeftWidth: 4, borderRadius: designTokens.radius.medium, borderWidth: 1, marginTop: designTokens.space.x8, minHeight: 220, padding: designTokens.space.x8 },
  emptyRule: { backgroundColor: designTokens.color.amber, height: 3, marginBottom: designTokens.space.x6, width: 48 },
  emptyTitle: { color: designTokens.color.ink, fontSize: 22, fontWeight: '600', lineHeight: 32 },
  emptyBody: { color: designTokens.color.muted, fontSize: 16, lineHeight: 27, marginTop: designTokens.space.x2, maxWidth: 600 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: designTokens.space.x3, marginTop: designTokens.space.x6 },
  choiceButton: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.small, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: designTokens.space.x4 },
  choiceButtonActive: { backgroundColor: '#E9F7F3', borderColor: designTokens.color.teal },
  choiceText: { color: designTokens.color.navy, fontSize: 14, fontWeight: '500' },
  choiceTextActive: { fontWeight: '600' },
  flowSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: designTokens.space.x3, marginTop: designTokens.space.x6 },
  flowText: { color: designTokens.color.navy, fontSize: 14, fontWeight: '500', lineHeight: 22 },
  detailCard: { backgroundColor: '#F8FAFC', borderColor: designTokens.color.line, borderRadius: designTokens.radius.small, borderWidth: 1, gap: designTokens.space.x2, marginTop: designTokens.space.x6, padding: designTokens.space.x4 },
  detailTitle: { color: designTokens.color.ink, fontSize: 16, fontWeight: '600', lineHeight: 24, marginTop: designTokens.space.x2 },
  detailStatus: { color: designTokens.color.navy, fontSize: 14, fontWeight: '500', lineHeight: 22 },
  detailHint: { color: designTokens.color.muted, fontSize: 14, lineHeight: 22 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(11, 37, 69, 0.42)', bottom: 0, justifyContent: 'center', left: 0, padding: designTokens.space.x6, position: 'absolute', right: 0, top: 0, zIndex: 20 },
  modalCard: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.large, borderWidth: 1, gap: designTokens.space.x3, maxWidth: 480, padding: designTokens.space.x6, width: '100%' },
  modalTitle: { color: designTokens.color.ink, fontSize: 20, fontWeight: '600', lineHeight: 28 },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: designTokens.space.x3, justifyContent: 'flex-end' },
  cancelButton: { alignItems: 'center', borderColor: designTokens.color.line, borderRadius: designTokens.radius.small, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: designTokens.space.x5 },
  cancelText: { color: designTokens.color.navy, fontSize: 14, fontWeight: '500' },
  confirmButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: designTokens.color.navy, borderRadius: designTokens.radius.small, justifyContent: 'center', marginTop: designTokens.space.x6, minHeight: 44, paddingHorizontal: designTokens.space.x5 },
  confirmText: { color: designTokens.color.surface, fontSize: 14, fontWeight: '600' },
  trackLink: { color: designTokens.color.navyRaised, fontSize: 15, fontWeight: '600', marginTop: designTokens.space.x6, paddingVertical: designTokens.space.x2 },
  tabBar: { alignSelf: 'center', borderColor: designTokens.color.line, borderTopWidth: 1, bottom: 0, flexDirection: 'row', left: 0, maxWidth: 1120, position: 'absolute', right: 0 },
  tab: { alignItems: 'center', borderTopColor: 'transparent', borderTopWidth: 3, flex: 1, justifyContent: 'center', minHeight: 76, paddingHorizontal: designTokens.space.x2, paddingVertical: designTokens.space.x2 },
  tabSelected: { backgroundColor: '#E9F7F3', borderTopColor: designTokens.color.teal },
  tabText: { color: designTokens.color.muted, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 4, textAlign: 'center' },
  tabTextSelected: { color: designTokens.color.navy },
  sendIcon: { borderRadius: 2, borderWidth: 2, height: 18, transform: [{ rotate: '-35deg' }], width: 18 },
  sendIconLine: { height: 2, left: 3, position: 'absolute', top: 6, width: 10 },
  listIcon: { gap: 3, height: 18, justifyContent: 'center', width: 20 },
  listIconLine: { height: 2, width: 20 },
  messageIcon: { borderBottomLeftRadius: 6, borderBottomRightRadius: 2, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 2, height: 17, width: 20 },
  profileIcon: { borderRadius: 6, borderWidth: 2, height: 12, width: 12 },
  profileIconBody: { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderTopWidth: 2, height: 8, left: -5, position: 'absolute', top: 13, width: 18 },
  pressed: { opacity: 0.72 },
});
