import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { designTokens } from '@routefit/shared';
import { AdminPage, Panel } from './AdminPage';
import { adminFeaturePages, financeTabs, normalizeFeaturePage, requiresConfirmation } from './frontend2-content.mjs';

export function Frontend2Page({ pageId }: { pageId: string }) {
  const page = adminFeaturePages.find((item) => item.id === normalizeFeaturePage(pageId)) ?? adminFeaturePages[0];
  const [activeTab, setActiveTab] = useState(financeTabs[0]);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmationType = requiresConfirmation(page.action);
  return <AdminPage title={page.title} description={page.description}>
    {page.id === 'finance' && <View style={styles.tabs}>{financeTabs.map((tab) => <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}><Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text></Pressable>)}</View>}
    <Panel title={page.id === 'finance' ? activeTab : '示例配置'}><Text style={styles.detail}>{page.detail}</Text>{confirmationType && <Pressable accessibilityRole="button" onPress={() => setConfirmation(confirmationType)} style={styles.action}><Text style={styles.actionText}>{page.action}</Text></Pressable>}</Panel>
    {confirmation && <Panel title="确认示例操作"><Text style={styles.detail}>确认类型：{confirmation}。此操作仅为示例，不调用真实支付或银行接口。</Text><Pressable accessibilityRole="button" onPress={() => setConfirmation(null)} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable></Panel>}
  </AdminPage>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: designTokens.space.x2 },
  tab: { borderColor: designTokens.color.line, borderRadius: designTokens.radius.small, borderWidth: 1, minHeight: 40, paddingHorizontal: designTokens.space.x3, justifyContent: 'center' },
  activeTab: { backgroundColor: designTokens.color.navy },
  tabText: { color: designTokens.color.ink, fontSize: designTokens.type.size.small, fontWeight: '500' },
  activeTabText: { color: designTokens.color.surface },
  detail: { color: designTokens.color.muted, fontSize: designTokens.type.size.body, lineHeight: 24 },
  action: { alignSelf: 'flex-start', backgroundColor: designTokens.color.teal, borderRadius: designTokens.radius.small, marginTop: designTokens.space.x4, minHeight: 44, paddingHorizontal: designTokens.space.x4, justifyContent: 'center' },
  actionText: { color: designTokens.color.navy, fontWeight: '600' },
  cancel: { alignSelf: 'flex-start', borderColor: designTokens.color.line, borderRadius: designTokens.radius.small, borderWidth: 1, marginTop: designTokens.space.x4, minHeight: 44, paddingHorizontal: designTokens.space.x4, justifyContent: 'center' },
  cancelText: { color: designTokens.color.ink, fontWeight: '500' },
});
