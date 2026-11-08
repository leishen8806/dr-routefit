import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CopyKey, languageOptions } from '../src/copy';
import { useLanguage } from '../src/LanguageContext';

type Tab = 'send' | 'orders' | 'messages' | 'profile';

const tabs: readonly { key: Tab; label: CopyKey; mark: string }[] = [
  { key: 'send', label: 'send', mark: '↗' },
  { key: 'orders', label: 'orders', mark: '≡' },
  { key: 'messages', label: 'messages', mark: '●' },
  { key: 'profile', label: 'profile', mark: '○' },
];

const emptyCopy: Record<Tab, { title: CopyKey; body: CopyKey }> = {
  send: { title: 'sendTitle', body: 'sendBody' },
  orders: { title: 'ordersTitle', body: 'ordersBody' },
  messages: { title: 'messagesTitle', body: 'messagesBody' },
  profile: { title: 'profileTitle', body: 'profileBody' },
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const { language, setLanguage, t } = useLanguage();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const activeCopy = emptyCopy[activeTab];

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: `${t('appName')} · ${t(activeCopy.title)}` }} />
      <ScrollView contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}>
        <View style={styles.routeHeader}>
          <View style={styles.routeMark}>
            <Text style={styles.routeLetter}>R</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>{t('appName')}</Text>
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </View>
        </View>

        <View accessibilityLabel="Language" accessibilityRole="radiogroup" style={styles.languages}>
          {languageOptions.map((option) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: language === option.code }}
              key={option.code}
              onPress={() => setLanguage(option.code)}
              style={({ pressed }) => [
                styles.languageButton,
                language === option.code && styles.languageButtonActive,
                pressed && styles.pressed,
              ]}
              testID={`language-${option.code}`}
            >
              <Text style={[styles.languageText, language === option.code && styles.languageTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.title, language === 'km' && styles.khmerText]}>{t('greeting')}</Text>
            <Text style={[styles.intro, language === 'km' && styles.khmerText]}>{t('intro')}</Text>
          </View>
          <View style={styles.routeDiagram} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.routeLine} />
            <View style={styles.routeStart} />
            <View style={styles.routeCargo}><Text style={styles.routeCargoText}>□</Text></View>
          </View>
        </View>

        <Text style={[styles.reviewNote, language === 'km' && styles.khmerText]}>{t('reviewPending')}</Text>

        <View accessibilityLiveRegion="polite" style={styles.emptyPanel} testID="empty-panel">
          <Text style={styles.emptyMark}>{tabs.find((tab) => tab.key === activeTab)?.mark}</Text>
          <Text style={[styles.emptyTitle, language === 'km' && styles.khmerText]}>{t(activeCopy.title)}</Text>
          <Text style={[styles.emptyBody, language === 'km' && styles.khmerText]}>{t(activeCopy.body)}</Text>
          <Link accessibilityRole="link" href="/track" style={styles.trackLink} testID="track-link">
            {t('trackLink')} →
          </Link>
        </View>
      </ScrollView>

      <View accessibilityRole="tablist" style={styles.tabBar}>
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
              <Text style={[styles.tabMark, selected && styles.tabTextSelected]}>{tab.mark}</Text>
              <Text style={[styles.tabText, language === 'km' && styles.khmerTab, selected && styles.tabTextSelected]}>
                {t(tab.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: '100%' },
  scrollContent: { alignSelf: 'center', flexGrow: 1, maxWidth: 1180, paddingBottom: 112, paddingHorizontal: 40, paddingTop: 48, width: '100%' },
  scrollContentCompact: { paddingHorizontal: 20, paddingTop: 32 },
  routeHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 24 },
  routeMark: { alignItems: 'center', borderColor: '#13C29B', borderRadius: 12, borderWidth: 2, height: 48, justifyContent: 'center', width: 48 },
  routeLetter: { color: '#0B2545', fontSize: 30, fontWeight: '800' },
  brandCopy: { flex: 1 },
  brand: { color: '#0B2545', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  tagline: { color: '#5B6B7F', fontSize: 12, marginTop: 2 },
  languages: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderColor: '#E3E8EF', borderRadius: 10, borderWidth: 1, flexDirection: 'row', marginBottom: 24, padding: 4 },
  languageButton: { alignItems: 'center', borderRadius: 7, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  languageButtonActive: { backgroundColor: '#0B2545' },
  languageText: { color: '#0B2545', fontSize: 14, fontWeight: '600' },
  languageTextActive: { color: '#FFFFFF' },
  hero: { alignItems: 'center', backgroundColor: '#0B2545', borderRadius: 18, flexDirection: 'row', gap: 36, minHeight: 220, overflow: 'hidden', padding: 36 },
  heroCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 28, padding: 24 },
  heroCopy: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', lineHeight: 42 },
  intro: { color: '#DCE5EF', fontSize: 16, lineHeight: 26, marginTop: 12, maxWidth: 620 },
  khmerText: { lineHeight: 30 },
  routeDiagram: { flex: 0.7, height: 122, justifyContent: 'center', minWidth: 220, position: 'relative' },
  routeLine: { backgroundColor: '#13C29B', borderRadius: 999, height: 5, left: 12, position: 'absolute', right: 12, transform: [{ rotate: '-12deg' }] },
  routeStart: { backgroundColor: '#13C29B', borderColor: '#FFFFFF', borderRadius: 12, borderWidth: 4, bottom: 18, height: 24, left: 4, position: 'absolute', width: 24 },
  routeCargo: { alignItems: 'center', backgroundColor: '#F5A623', borderRadius: 12, height: 48, justifyContent: 'center', position: 'absolute', right: 8, top: 12, width: 48 },
  routeCargoText: { color: '#0B2545', fontSize: 28, fontWeight: '800' },
  reviewNote: { color: '#5B3FA8', fontSize: 13, lineHeight: 24, marginHorizontal: 4, marginTop: 14 },
  emptyPanel: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E3E8EF', borderRadius: 18, borderWidth: 1, marginTop: 24, minHeight: 250, padding: 32 },
  emptyMark: { color: '#13C29B', fontSize: 34, fontWeight: '700' },
  emptyTitle: { color: '#0B2545', fontSize: 22, fontWeight: '700', lineHeight: 36, marginTop: 12, textAlign: 'center' },
  emptyBody: { color: '#5B6B7F', fontSize: 16, lineHeight: 28, marginTop: 8, maxWidth: 560, textAlign: 'center' },
  trackLink: { color: '#1D5FBF', fontSize: 16, fontWeight: '700', marginTop: 24, paddingHorizontal: 12, paddingVertical: 10 },
  tabBar: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderColor: '#E3E8EF', borderRadius: 16, borderWidth: 1, bottom: 16, flexDirection: 'row', left: 16, maxWidth: 720, overflow: 'hidden', position: 'absolute', right: 16 },
  tab: { alignItems: 'center', borderTopColor: 'transparent', borderTopWidth: 4, flex: 1, justifyContent: 'center', minHeight: 72, paddingHorizontal: 6, paddingVertical: 8 },
  tabSelected: { backgroundColor: '#F2FBF8', borderTopColor: '#13C29B' },
  tabMark: { color: '#5B6B7F', fontSize: 20, lineHeight: 24 },
  tabText: { color: '#5B6B7F', fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 2, textAlign: 'center' },
  khmerTab: { fontSize: 12, lineHeight: 22 },
  tabTextSelected: { color: '#0B2545' },
  pressed: { opacity: 0.68 },
});
