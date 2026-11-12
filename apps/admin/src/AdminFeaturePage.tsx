import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminPage, Panel } from './AdminPage';
import { getAdminFeaturePage } from './admin-feature-pages.mjs';

type AdminFeaturePageProps = { route: string };

export function AdminFeaturePage({ route }: AdminFeaturePageProps) {
  const page = getAdminFeaturePage(route);
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  if (!page) return <AdminPage title="页面暂不可用" description="请选择已授权的管理后台业务页面。" />;

  const activeTab = page.tabs[Math.min(tabIndex, page.tabs.length - 1)];
  return <AdminPage title={page.title} description={page.description}>
    <Text accessibilityRole="note" style={styles.notice}>{page.notice}</Text>
    <View accessibilityRole="tablist" style={styles.tabs}>
      {page.tabs.map((tab: { label: string }, index: number) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: index === tabIndex }} key={tab.label} onPress={() => setTabIndex(index)} style={[styles.tab, index === tabIndex && styles.tabActive]}><Text style={[styles.tabText, index === tabIndex && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}
    </View>
    <Panel title={activeTab.label}>
      <View style={styles.rows}>{activeTab.rows.map((row: { title: string; detail: string; action?: string; requiresConfirmation?: boolean }) => <View key={row.title} style={styles.row}><View style={styles.copy}><Text style={styles.rowTitle}>{row.title}</Text><Text style={styles.detail}>{row.detail}</Text></View>{row.action && <Pressable accessibilityLabel={`${row.action}（纯前端）`} accessibilityRole="button" onPress={() => row.requiresConfirmation ? setConfirmation(row.title) : setMessage(`已查看${row.title}（演示数据）`)} style={styles.button}><Text style={styles.buttonText}>{row.action}</Text></Pressable>}</View>)}</View>
      {message ? <Text accessibilityRole="status" style={styles.status}>{message}</Text> : null}
    </Panel>
    {confirmation ? <Panel title="请确认"><View accessibilityRole="alert" style={styles.confirmation}><Text style={styles.detail}>确认{confirmation}？此操作仅更新本地演示状态，不调用任何资金、银行或支付服务。</Text><View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => setConfirmation(null)} style={styles.secondary}><Text style={styles.secondaryText}>取消</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setConfirmation(null); setMessage(`已完成${confirmation}的纯前端演示确认`); }} style={styles.button}><Text style={styles.buttonText}>确认（演示）</Text></Pressable></View></View></Panel> : null}
  </AdminPage>;
}

const styles = StyleSheet.create({
  notice: { color: '#59697A', fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { backgroundColor: '#EAF0F5', borderRadius: 20, minHeight: 36, paddingHorizontal: 14, paddingVertical: 8 },
  tabActive: { backgroundColor: '#0B6B6B' },
  tabText: { color: '#314559', fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#FFF' },
  rows: { gap: 1 },
  row: { alignItems: 'center', backgroundColor: '#F8FAFC', flexDirection: 'row', gap: 16, justifyContent: 'space-between', padding: 14 },
  copy: { flex: 1, gap: 4 }, rowTitle: { color: '#0B2545', fontSize: 16, fontWeight: '600' }, detail: { color: '#59697A', fontSize: 14, lineHeight: 21 },
  button: { backgroundColor: '#0B6B6B', borderRadius: 8, minHeight: 40, paddingHorizontal: 12, paddingVertical: 10 }, buttonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  status: { color: '#087861', fontSize: 14, marginTop: 14 }, confirmation: { gap: 16 }, actions: { flexDirection: 'row', gap: 10 }, secondary: { borderColor: '#9BA8B4', borderRadius: 8, borderWidth: 1, minHeight: 40, paddingHorizontal: 12, paddingVertical: 10 }, secondaryText: { color: '#314559', fontSize: 14, fontWeight: '600' },
});
